import { BrowserWindow, ipcMain, screen, globalShortcut } from 'electron';
import { randomUUID } from 'node:crypto';
import { DesktopNotesPreferences, type NotePlacement } from './desktop-notes-preferences.js';
import { clampNote, containsPoint, fitLine, hangingNoteBounds, lineEndpoints, ropePoint, noteSize, paperBounds, isNoteDrag, toggleSurfacePreview, type NoteRect, type SurfaceNote, type SurfaceView, type SurfaceCommand } from '../shared/desktop-note-window.js';
interface Dependencies {
  profile: string; preload: string; url: string; simulated?: boolean;
  data(): { notes: Array<Omit<SurfaceNote, 'hanging' | 'expanded'> & { visible?: boolean }>; lineVisible: boolean; revision: number; pending: boolean; error: string };
  toggle(noteId: string, taskId: string, revision: number, requestId: string): Promise<void>;
  retry(): Promise<void>;
  hide(id: string): Promise<void>;
  manage(id?: string): void;
  changed(): void;
}
/** Native note lifecycle and placement; business commands are delegated to main's serial queue. */
export function createDesktopNotesController(deps: Dependencies) {
  const channel = 'dogcow:desktop-note';
  const prefs = new DesktopNotesPreferences(deps.profile);
  const windows = new Map<string, BrowserWindow>();
  const ready = new Map<string, () => void>();
  const busy = new Set<string>();
  const failures = new Map<string, { correlationId: string; retry: boolean }>();
  let notes: SurfaceNote[] = [];
  let line: NoteRect;
  let timer: ReturnType<typeof setInterval> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let initialized = false;
  let syncing: Promise<void> | undefined;
  let syncAgain = false;
  let ownsEscape = false;
  let lineAdjusting = false;
  let controlsFocused = false;
  let controlsUntil = 0;
  const desktopPositions = new Map<string, NoteRect>();
  const motions = new Map<string, { from: NoteRect; to: NoteRect; since: number }>();
  let drag: { id: string; start: NoteRect; hanging: boolean; expanded: boolean; offset: { x: number; y: number }; origin: { x: number; y: number }; moved: boolean } | undefined;
  let lineDrag: { start: NoteRect; origin: { x: number; y: number }; attached: Map<string, NoteRect>; moved: boolean } | undefined;
  let target = false;
  let targetX: number | undefined;
  let message = '';
  const inputEnabled = new Map<BrowserWindow, boolean>();
  function releaseEscape() { if (ownsEscape) { globalShortcut.unregister('Escape'); ownsEscape = false; } }
  function lineBounds(): NoteRect {
    const display = screen.getAllDisplays().find(d => String(d.id) === prefs.value.displayId) ?? screen.getPrimaryDisplay();
    const a = display.workArea;
    return fitLine(a, a.y + prefs.value.lineOffset, hangingHeight());
  }
  function hangingHeight() {
    return Math.max(0, ...deps.data().notes.filter(note => noteById(note.id)?.hanging ?? prefs.value.notes[note.id]?.hanging).map(note => noteSize(note.kind, true).height));
  }
  function updateNotes(data = deps.data()) {
    const prior = new Map(notes.map(note => [note.id, note]));
    notes = data.notes.filter(note => note.visible !== false && (data.lineVisible || !(prior.get(note.id) ?? prefs.value.notes[note.id])?.hanging)).map(note => {
      const state = prior.get(note.id) ?? prefs.value.notes[note.id];
      return { ...note, hanging: state?.hanging ?? false, expanded: state?.expanded ?? true };
    });
  }
  function wantedRoles() {
    const data = deps.data(); updateNotes(data);
    return new Set([...notes.map(note => note.id), ...(data.lineVisible ? ['line'] : [])]);
  }
  function retryWindows(id?: string) {
    for (const [role, failure] of failures) if (!id || role === id) failure.retry = true;
  }
  function remember() {
    if (disposed || !line) return;
    const placements = { ...prefs.value.notes };
    for (const note of notes) {
      const win = windows.get(note.id); if (!win || win.isDestroyed()) continue;
      const bounds = motions.get(note.id)?.to ?? win.getBounds();
      placements[note.id] = { bounds, desktop: desktopPositions.get(note.id) ?? bounds,
        displayId: String(screen.getDisplayMatching(bounds).id), hanging: note.hanging, expanded: note.expanded,
        anchor: Math.max(0, Math.min(1, (bounds.x + bounds.width / 2 - line.x) / line.width)) };
    }
    const known = new Set(deps.data().notes.map(note => note.id));
    for (const id of Object.keys(placements)) if (!known.has(id)) delete placements[id];
    const display = screen.getDisplayMatching(line);
    prefs.update(placements, String(display.id), Math.max(0, line.y - display.workArea.y));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void prefs.flush().then(() => deps.changed()); }, 140);
  }
  function fail(id: string, error: unknown) {
    if (drag?.id === id) cancelDrag();
    if (lineDrag && (id === 'line' || lineDrag.attached.has(id))) cancelLineDrag();
    motions.delete(id);
    const correlationId = randomUUID();
    failures.set(id, { correlationId, retry: false });
    console.error(JSON.stringify({ operation: 'desktopNotes', stage: 'window', correlationId, cause: error instanceof Error ? error.name : 'unknown' }));
    const win = windows.get(id); windows.delete(id); inputEnabled.delete(win!); win?.destroy();
    deps.changed();
  }
  async function business(id: string, job: () => Promise<void>) {
    if (busy.has(id)) return;
    busy.add(id); message = ''; publish();
    try { await job(); }
    catch (error) {
      const correlationId = randomUUID();
      message = error instanceof Error ? error.message : '操作未完成，请重试。';
      console.error(JSON.stringify({ operation: 'desktopNotes', stage: 'command', errorCode: 'NOTE_COMMAND_FAILED', correlationId, cause: error instanceof Error ? error.name : 'unknown' }));
    }
    finally { busy.delete(id); publish(); deps.changed(); }
  }
  function publish(only?: SurfaceView['role']) {
    const data = deps.data(); updateNotes(data);
    for (const [role, win] of windows) if ((!only || only === role) && !win.isDestroyed() && !win.webContents.isLoadingMainFrame())
      win.webContents.send('dogcow:desktop-notes-view', { role, notes: role === 'line' ? [] : notes.filter(note => note.id === role), target, targetX, lineWidth: line.width, lineDragging: !!lineDrag, lineAdjusting, simulated: !!deps.simulated, revision: data.revision, pending: busy.size > 0 || data.pending || prefs.pending, message: message || prefs.warning || data.error } satisfies SurfaceView);
  }
  function noteById(id: string) { return notes.find(note => note.id === id)!; }
  function hangingTarget(): NoteRect { return { x: line.x + 50, y: line.y - 18, width: line.width - 100, height: 150 }; }
  function moveWindow(id: string, x: number, y: number) {
    const win = windows.get(id);
    if (!win || win.isDestroyed()) return;
    const current = win.getBounds();
    const nextX = Math.round(x), nextY = Math.round(y);
    if (current.x !== nextX || current.y !== nextY) win.setPosition(nextX, nextY);
  }
  function settle(id: string, to: NoteRect) {
    motions.set(id, { from: windows.get(id)!.getBounds(), to, since: performance.now() });
  }
  function positionHanging(note: SurfaceNote, center: number) {
    if (!note.hanging) desktopPositions.set(note.id, windows.get(note.id)!.getBounds());
    note.hanging = true;
    note.expanded = false;
    settle(note.id, hangingNoteBounds(note.kind, line, center));
  }
  function togglePreview(note: SurfaceNote) {
    if (!note.hanging) return;
    toggleSurfacePreview(notes, note.id);
    windows.get(note.id)!.moveTop();
  }
  function setInput(win: BrowserWindow, enabled: boolean) {
    if (inputEnabled.get(win) === enabled) return;
    win.setIgnoreMouseEvents(!enabled, { forward: true });
    inputEnabled.set(win, enabled);
  }
  function cancelGesture() { if (lineDrag) cancelLineDrag(); else cancelDrag(); }
  function adjustLine() {
    lineAdjusting = true; controlsUntil = performance.now() + 2000;
    windows.get('line')?.moveTop(); publish('line');
  }
  function lineTools(bounds: NoteRect): NoteRect {
    return { x: bounds.x + bounds.width - 116, y: bounds.y + 2, width: 72, height: 28 };
  }
  function startLineDrag(point: { x: number; y: number }) {
    if (drag || lineDrag || !lineEndpoints(line).some(area => containsPoint(area, point))) return;
    adjustLine();
    const attached = new Map<string, NoteRect>();
    for (const note of notes) if (note.hanging) {
      const win = windows.get(note.id);
      if (win) { motions.delete(note.id); attached.set(note.id, win.getBounds()); win.moveTop(); }
    }
    windows.get('line')!.moveTop();
    lineDrag = { start: { ...line }, origin: point, attached, moved: false };
    ownsEscape = globalShortcut.register('Escape', cancelGesture);
    message = ownsEscape ? '' : 'Esc 暂不可用，可松手结束拖动';
    publish('line');
  }
  function moveLineDrag(point: { x: number; y: number }) {
    if (!lineDrag) return;
    const active = lineDrag;
    active.moved ||= isNoteDrag(active.origin, point);
    if (!active.moved) return;
    const display = screen.getDisplayNearestPoint(point);
    const y = fitLine(display.workArea, active.start.y + point.y - active.origin.y, hangingHeight()).y;
    // Keep native width fixed until release, preserving pointer capture across displays.
    line = { ...active.start, x: Math.round(active.start.x + point.x - active.origin.x), y };
    windows.get('line')!.setPosition(line.x, line.y);
    for (const [id, bounds] of active.attached) if (windows.has(id))
      moveWindow(id, bounds.x + line.x - active.start.x, bounds.y + line.y - active.start.y);
  }
  function endLineDrag(point: { x: number; y: number }) {
    if (!lineDrag) return;
    moveLineDrag(point);
    const active = lineDrag;
    lineDrag = undefined; releaseEscape();
    if (active.moved) {
      line = fitLine(screen.getDisplayNearestPoint(point).workArea, line.y, hangingHeight());
      windows.get('line')!.setBounds(line);
      for (const [id, bounds] of active.attached) {
        const note = noteById(id);
        if (!note || !windows.has(id)) continue;
        const anchor = (bounds.x + bounds.width / 2 - active.start.x) / active.start.width;
        const next = hangingNoteBounds(note.kind, line, line.x + anchor * line.width);
        moveWindow(id, next.x, next.y);
      }
    }
    controlsUntil = performance.now() + 2000;
    remember(); publish();
  }
  function cancelLineDrag() {
    if (!lineDrag) return;
    const active = lineDrag;
    lineDrag = undefined; releaseEscape(); line = active.start;
    windows.get('line')?.setPosition(line.x, line.y);
    for (const [id, bounds] of active.attached) if (windows.has(id)) moveWindow(id, bounds.x, bounds.y);
    controlsUntil = performance.now() + 2000;
    remember(); publish();
  }
  function nudgeLine(dy: number) {
    if (drag || lineDrag) return;
    adjustLine();
    const previous = line;
    line = fitLine(screen.getDisplayMatching(line).workArea, line.y + dy, hangingHeight());
    windows.get('line')!.setPosition(line.x, line.y);
    for (const note of notes) if (note.hanging && windows.has(note.id)) {
      motions.delete(note.id);
      const b = windows.get(note.id)!.getBounds(); moveWindow(note.id, b.x, b.y + line.y - previous.y);
    }
    remember(); publish();
  }
  function cancelDrag() {
    if (!drag) return;
    const active = drag;
    drag = undefined;
    const note = noteById(active.id);
    if (note) { note.hanging = active.hanging; note.expanded = active.expanded; }
    motions.delete(active.id);
    moveWindow(active.id, active.start.x, active.start.y);
    target = false;
    targetX = undefined;
    releaseEscape();
    remember();
    publish();
  }
  function endDrag(point: { x: number; y: number }) {
    if (!drag) return;
    const active = drag;
    drag = undefined;
    releaseEscape();
    const note = noteById(active.id);
    active.moved ||= isNoteDrag(active.origin, point);
    const released = { ...active.start, x: Math.round(point.x - active.offset.x), y: Math.round(point.y - active.offset.y) };
    if (!active.moved) togglePreview(note);
    else if (containsPoint(hangingTarget(), point)) {
      positionHanging(note, released.x + released.width / 2);
      if (!active.hanging) desktopPositions.set(note.id, active.start);
    }
    else {
      note.hanging = false;
      note.expanded = true;
      const bounds = clampNote(released, screen.getDisplayNearestPoint(point).workArea);
      moveWindow(note.id, bounds.x, bounds.y);
      desktopPositions.set(note.id, bounds);
    }
    target = false;
    targetX = undefined;
    remember();
    publish();
  }
  function tick() {
    if (disposed || !windows.size) return;
    const cursor = screen.getCursorScreenPoint();
    const now = performance.now();
    if (lineAdjusting) {
      if (lineDrag || controlsFocused || containsPoint(lineTools(line), cursor)) controlsUntil = now + 2000;
      else if (now >= controlsUntil) { lineAdjusting = false; publish('line'); }
    }
    for (const [id, motion] of motions) {
      if (!windows.has(id)) { motions.delete(id); continue; }
      const t = Math.min(1, (now - motion.since) / 170);
      const eased = 1 - (1 - t) ** 4;
      moveWindow(id, motion.from.x + (motion.to.x - motion.from.x) * eased, motion.from.y + (motion.to.y - motion.from.y) * eased);
      if (t === 1) motions.delete(id);
    }
    if (drag) {
      if (isNoteDrag(drag.origin, cursor)) drag.moved = true;
      if (drag.moved) moveWindow(drag.id, cursor.x - drag.offset.x, cursor.y - drag.offset.y);
      const next = drag.moved && containsPoint(hangingTarget(), cursor);
      const center = cursor.x - drag.offset.x + drag.start.width / 2;
      const nextX = next ? Math.round(ropePoint(line, center).x - line.x) : undefined;
      if (next !== target || nextX !== targetX) { target = next; targetX = nextX; publish('line'); }
    }
    if (lineDrag) moveLineDrag(cursor);
    for (const [role, win] of windows) {
      if (role !== 'line' && !noteById(role)) { setInput(win, false); continue; }
      const b = win.getBounds();
      // Only paper, its grip, and the line's actual controls intercept the pointer.
      const paper = role === 'line' ? undefined : paperBounds(noteById(role).kind, !noteById(role).hanging || noteById(role).expanded);
      const zones: NoteRect[] = role === 'line'
        ? [...(lineAdjusting ? [lineTools(b)] : []), ...lineEndpoints(b)]
        : [{ x: b.x + paper!.x, y: b.y + paper!.y, width: paper!.width, height: paper!.height },
          { x: b.x + b.width / 2 - 36, y: b.y, width: 72, height: 35 }];
      setInput(win, drag?.id === role || role === 'line' && !!lineDrag || zones.some(zone => containsPoint(zone, cursor)));
    }
  }
  function resetPositions() {
    cancelGesture(); motions.clear(); desktopPositions.clear();
    line = lineBounds(); windows.get('line')?.setBounds(line);
    for (const [index, note] of notes.entries()) {
      note.hanging = false; note.expanded = true;
      const area = screen.getDisplayMatching(line).workArea;
      const bounds = clampNote({ x: area.x + 80 + index * 36, y: area.y + 230 + index * 24, ...noteSize(note.kind, true) }, area);
      moveWindow(note.id, bounds.x, bounds.y); desktopPositions.set(note.id, bounds);
    }
    message = ''; remember(); publish();
  }
  async function createWindow(role: SurfaceView['role']) {
    const size = role === 'line' ? { width: line.width, height: 96 } : noteSize(noteById(role).kind, true);
    const win = new BrowserWindow({ ...size, title: role === 'line' ? '狗牛晾衣线' : '狗牛桌面便签', show: false, frame: false,
      transparent: true, hasShadow: false, resizable: false, minimizable: false, maximizable: false,
      fullscreenable: false, skipTaskbar: true, acceptFirstMouse: true,
      backgroundColor: '#00000000', webPreferences: {
        preload: deps.preload,
        contextIsolation: true, sandbox: true, nodeIntegration: false,
      } });
    windows.set(role, win);
    win.setAlwaysOnTop(prefs.value.alwaysOnTop, 'floating');
    win.setIgnoreMouseEvents(true, { forward: true });
    inputEnabled.set(win, false);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    win.webContents.on('render-process-gone', (_event, details) => {
      if (disposed || windows.get(role) !== win) return;
      console.error(JSON.stringify({ operation: 'desktopNotes', stage: 'renderer', role, reason: details.reason }));
      fail(role, Error(details.reason));
    });
    win.webContents.on('console-message', event => {
      if (event.level === 'error') console.error(JSON.stringify({ operation: 'desktopNotes', stage: 'console', role, message: event.message }));
    });
    win.on('close', event => { if (!disposed) { event.preventDefault(); void business(role, () => deps.hide(role)); } });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handshake = new Promise<void>((resolve, reject) => {
      ready.set(role, resolve);
      timeout = setTimeout(() => reject(Error(`桌面便签页面未就绪`)), 8000);
    });
    let phase = 'load';
    const since = performance.now();
    win.webContents.on('did-finish-load', () => { phase = 'handshake'; });
    win.webContents.on('preload-error', () => {
      console.error(JSON.stringify({ operation: 'desktopNotes', stage: 'preload', role, errorCode: 'NOTE_PRELOAD_FAILED' }));
    });
    win.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame) console.error(JSON.stringify({ operation: 'desktopNotes', stage: 'load', role, code }));
    });
    try { await Promise.all([win.loadURL(`${deps.url}?role=${encodeURIComponent(role)}`), handshake]); }
    catch (error) {
      if (!disposed && windows.get(role) === win && wantedRoles().has(role))
        console.error(JSON.stringify({ operation: 'desktopNotes', stage: phase, role, elapsedMs: Math.round(performance.now() - since), errorCode: phase === 'load' ? 'NOTE_LOAD_FAILED' : 'NOTE_HANDSHAKE_FAILED' }));
      throw error;
    }
    finally { clearTimeout(timeout); ready.delete(role); }
    return win;
  }

  async function reconcile() {
    const wanted = wantedRoles();
    for (const id of failures.keys()) if (!wanted.has(id)) failures.delete(id);
    for (const [id, win] of windows) if (!wanted.has(id)) {
      if (drag?.id === id) cancelDrag();
      if (id === 'line' && lineDrag) cancelLineDrag();
      if (id === 'line') { lineAdjusting = false; controlsFocused = false; }
      windows.delete(id); inputEnabled.delete(win); motions.delete(id); win.destroy();
    }
    let created = false;
    for (const id of wanted) {
      const failure = failures.get(id);
      if (disposed || windows.has(id) || failure && !failure.retry || !wantedRoles().has(id)) continue;
      try {
        const win = await createWindow(id);
        const owned = windows.get(id) === win;
        const stillWanted = !disposed && wantedRoles().has(id);
        if (!owned || !stillWanted) {
          if (owned) { windows.delete(id); failures.delete(id); }
          inputEnabled.delete(win); win.destroy(); continue;
        }
        if (id === 'line') win.setBounds(line);
        else {
          const note = noteById(id); const saved = prefs.value.notes[id];
          const area = screen.getPrimaryDisplay().workArea;
          const size = noteSize(note.kind, true);
          const old = saved?.bounds ?? { x: area.x + 100 + windows.size * 40, y: area.y + 240, ...size };
          const bounds = note.hanging ? hangingNoteBounds(note.kind, line, line.x + (saved?.anchor ?? .5) * line.width)
            : clampNote({ ...old, ...size }, screen.getDisplayMatching(old).workArea);
          win.setBounds(bounds);
          desktopPositions.set(id, saved?.desktop ?? bounds);
        }
        win.showInactive(); failures.delete(id); created = true;
      } catch (error) {
        if (disposed) continue;
        if (!wantedRoles().has(id)) {
          const win = windows.get(id); windows.delete(id); failures.delete(id);
          if (win) { inputEnabled.delete(win); win.destroy(); }
        } else if (windows.has(id) || !failures.has(id)) fail(id, error);
      }
    }
    if (created) remember();
    publish();
  }
  function refresh() {
    if (disposed || !initialized) return;
    syncAgain = true;
    if (!syncing) syncing = (async () => {
      while (syncAgain && !disposed) { syncAgain = false; await reconcile(); }
    })().catch(error => fail('line', error)).finally(() => {
      syncing = undefined;
      // A request can arrive after the drain exits but before this finalizer runs.
      if (syncAgain && !disposed) refresh();
    });
    publish();
  }
  function onDisplayChanged() {
    cancelGesture(); motions.clear();
    line = lineBounds(); windows.get('line')?.setBounds(line);
    for (const note of notes) {
      const win = windows.get(note.id); if (!win) continue;
      const old = win.getBounds(); const saved = prefs.value.notes[note.id];
      const bounds = note.hanging ? hangingNoteBounds(note.kind, line, line.x + (saved?.anchor ?? .5) * line.width)
        : clampNote(old, screen.getDisplayMatching(old).workArea);
      win.setBounds(bounds);
    }
    remember(); publish();
  }
  const listener = (event: Electron.IpcMainEvent, raw: unknown) => {
    const role = [...windows].find(([, win]) => win.webContents === event.sender)?.[0];
    if (!role || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('?')[0] !== deps.url
      || !raw || typeof raw !== 'object' || !('action' in raw)) return;
    const c = raw as SurfaceCommand;
    if (c.action === 'ready') {
      console.info(JSON.stringify({ operation: 'desktopNotes', stage: 'surface-ready', role, awaiting: ready.has(role) }));
      ready.get(role)?.(); publish(); return;
    }
    if (c.action === 'manage') { deps.manage(role === 'line' ? undefined : role); return; }
    if (c.action === 'retry') { void business(role, async () => { await deps.retry(); if (!await prefs.flush()) throw Error(prefs.warning); }); return; }
    if (role === 'line') {
      if (c.action === 'lineControlsFocus' && typeof c.focused === 'boolean') controlsFocused = lineAdjusting && c.focused;
      if (c.action === 'begin' && Number.isFinite(c.x) && Number.isFinite(c.y)) startLineDrag({ x: c.x, y: c.y });
      if (c.action === 'end') endLineDrag(screen.getCursorScreenPoint());
      if (c.action === 'cancel') cancelLineDrag();
      if (c.action === 'lineNudge' && Number.isFinite(c.dy) && Math.abs(c.dy) <= 30) nudgeLine(c.dy);
      if (c.action === 'quit') void business(role, () => deps.hide('line'));
      if (c.action === 'reset') void business(role, async () => { cancelGesture(); if (!await prefs.reset()) throw Error(prefs.warning); resetPositions(); });
      return;
    }
    const note = noteById(role); if (!note) return;
    if (c.action === 'hide') { if (drag?.id === role) cancelDrag(); void business(role, () => deps.hide(role)); }
    else if (c.action === 'toggle' && typeof c.id === 'string' && typeof c.revision === 'number' && typeof c.requestId === 'string') {
      if (note.tasks.some(task => task.id === c.id)) void business(role, () => deps.toggle(role, c.id, c.revision!, c.requestId!));
    } else if (c.action === 'begin' && !drag && !lineDrag && Number.isFinite(c.x) && Number.isFinite(c.y)) {
      motions.delete(role); message = ''; windows.get(role)!.moveTop();
      const start = windows.get(role)!.getBounds();
      drag = { id: role, start, hanging: note.hanging, expanded: note.expanded,
        offset: { x: c.x - start.x, y: c.y - start.y }, origin: { x: c.x, y: c.y }, moved: false };
      ownsEscape = globalShortcut.register('Escape', cancelGesture);
      if (!ownsEscape) { message = 'Esc 暂不可用，可松手结束拖动'; publish(); }
    } else if (c.action === 'cancel' && drag?.id === role) cancelDrag();
    else if (c.action === 'end' && drag?.id === role) endDrag(screen.getCursorScreenPoint());
    else if (c.action === 'preview' && !drag) { togglePreview(note); remember(); publish(); }
    else if (c.action === 'hang' && !drag) { const b = windows.get(role)!.getBounds(); positionHanging(note, b.x + b.width / 2); remember(); publish(); }
    else if (c.action === 'take' && !drag) {
      note.hanging = false; note.expanded = true;
      const b = windows.get(role)!.getBounds(); const destination = desktopPositions.get(role) ?? { ...b, y: line.y + 180 };
      settle(role, clampNote(destination, screen.getDisplayMatching(destination).workArea)); remember(); publish();
    }
  };
  return {
    async initialize() {
      await prefs.load(); line = lineBounds(); initialized = true;
      ipcMain.on(channel, listener);
      screen.on('display-removed', onDisplayChanged); screen.on('display-metrics-changed', onDisplayChanged);
      timer = setInterval(tick, 16);
      refresh(); await syncing;
      console.info(JSON.stringify({ operation: 'desktopNotes', stage: 'ready', windows: windows.size, simulated: !!deps.simulated }));
    },
    refresh,
    async resetPositions() {
      cancelGesture(); if (!await prefs.reset()) return false;
      resetPositions(); retryWindows(); refresh();
      // Keep window loading/handshakes outside main's serial business queue.
      // Reconcile publishes any window failure independently of preference persistence.
      clearTimeout(saveTimer); return prefs.flush();
    },
    async setAlwaysOnTop(enabled: boolean) {
      cancelGesture();
      const before = prefs.value.alwaysOnTop;
      try { for (const win of windows.values()) win.setAlwaysOnTop(enabled, 'floating'); }
      catch {
        for (const win of windows.values()) { try { win.setAlwaysOnTop(before, 'floating'); } catch { /* Keep the failure visible; never overwrite the stored preference. */ } }
        throw Error('置顶切换未完成，请重试。');
      }
      prefs.setAlwaysOnTop(enabled); publish();
      const saved = await prefs.flush(); deps.changed(); return saved;
    },
    get alwaysOnTop() { return prefs.value.alwaysOnTop; },
    get layoutPending() { return prefs.pending; },
    reveal(id?: string) { retryWindows(id); refresh(); if (id) { windows.get(id)?.showInactive(); windows.get(id)?.moveTop(); } },
    get windowError() {
      const failure = failures.values().next().value;
      if (!failure) return '';
      const label = failures.size === 1 ? '便签窗口打开失败' : `${failures.size} 个便签窗口尚未恢复`;
      return `${label}，可在管理中重新显示。问题编号：${failure.correlationId}`;
    },
    get layoutError() { return prefs.warning; },
    async flush() { cancelGesture(); remember(); clearTimeout(saveTimer); return prefs.flush(); },
    dispose() {
      disposed = true; clearInterval(timer); clearTimeout(saveTimer); releaseEscape();
      ipcMain.removeListener(channel, listener); screen.removeListener('display-removed', onDisplayChanged); screen.removeListener('display-metrics-changed', onDisplayChanged);
      for (const win of windows.values()) win.destroy(); windows.clear();
    },
  };
}
export type DesktopNotesController = ReturnType<typeof createDesktopNotesController>;
