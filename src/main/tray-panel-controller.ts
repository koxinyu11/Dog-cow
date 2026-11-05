import { BrowserWindow, screen } from 'electron';
import { randomUUID } from 'node:crypto';
import { panelBounds, panelArrowLeft, type TrayPanelData, type TrayPanelPhase } from '../shared/tray.js';
interface Dependencies {
  preload: string;
  url: string;
  failed(errorCode: string, correlationId: string): void;
  data(): TrayPanelData;
  environment?(): { dockVisible?: boolean; mainVisible?: boolean; mainFocused?: boolean; mainAlwaysOnTop?: boolean };
}
/** Owns only the panel's native lifecycle; business commands remain in main. */
export class TrayPanelController {
  window?: BrowserWindow;
  private phase: TrayPanelPhase = 'hidden';
  private anchor?: Electron.Rectangle;
  private height = 370;
  private arrowLeft = 160;
  private timer?: ReturnType<typeof setTimeout>;
  private load?: Promise<void>;
  private generation = 0;
  private disposed = false;
  private ready?: () => void;
  constructor(private deps: Dependencies) {
    screen.on('display-removed', this.displayChanged);
    screen.on('display-metrics-changed', this.displayChanged);
  }
  owns(sender: Electron.WebContents) { return !!this.window && sender === this.window.webContents; }
  acknowledgeReady() { this.ready?.(); }
  private fail(stage: string, cause: unknown) {
    const correlationId = randomUUID();
    console.error(JSON.stringify({ operation: 'trayPanel', stage, errorCode: 'TRAY_PANEL_FAILED', correlationId, cause: cause instanceof Error ? cause.name : 'unknown' }));
    this.hide(true);
    this.window?.destroy();
    this.window = undefined;
    this.load = undefined;
    this.deps.failed('TRAY_PANEL_FAILED', correlationId);
  }
  private ensureWindow(): Promise<void> {
    if (this.load) return this.load;
    this.load = (async () => {
      const win = new BrowserWindow({ width: 344, height: this.height, show: false, frame: false, transparent: true,
        resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
        ...(process.platform === 'darwin' ? { type: 'panel' as const, acceptFirstMouse: true } : { skipTaskbar: true }),
        alwaysOnTop: true, hasShadow: false, backgroundColor: '#00000000',
        webPreferences: { preload: this.deps.preload, nodeIntegration: false, contextIsolation: true, sandbox: true } });
      this.window = win;
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', event => event.preventDefault());
      win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
      win.on('close', event => { if (!this.disposed) { event.preventDefault(); this.hide(); } });
      win.webContents.on('render-process-gone', (_event, details) => { if (!this.disposed) this.fail('renderer', Error(details.reason)); });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const ready = new Promise<void>((resolve, reject) => {
        this.ready = resolve;
        timeout = setTimeout(() => reject(Error('Panel ready timeout')), 8000);
      });
      try { await Promise.all([win.loadURL(this.deps.url), ready]); }
      finally { clearTimeout(timeout); this.ready = undefined; }
    })();
    return this.load;
  }
  async toggle(anchor: Electron.Rectangle) {
    this.anchor = anchor;
    if (this.phase === 'open' || this.phase === 'opening') { this.hide(); return; }
    const generation = ++this.generation;
    clearTimeout(this.timer);
    this.phase = 'opening';
    try {
      await this.ensureWindow();
      if (this.disposed || generation !== this.generation) return;
      this.position();
      const before = this.deps.environment?.();
      this.window!.showInactive();
      const correlationId = randomUUID();
      console.info(JSON.stringify({ operation: 'trayPanel', stage: 'showInactive', correlationId, before, after: this.deps.environment?.() }));
      this.publish();
      this.timer = setTimeout(() => { if (generation === this.generation) { this.phase = 'open'; this.publish(); } }, 170);
    } catch (error) { if (!this.disposed) this.fail('load', error); }
  }
  hide(immediate = false) {
    ++this.generation;
    clearTimeout(this.timer);
    this.phase = immediate ? 'hidden' : 'closing';
    this.publish();
    const finish = () => { this.window?.hide(); this.phase = 'hidden'; };
    if (immediate) finish(); else this.timer = setTimeout(finish, 110);
  }
  resize(height: unknown) {
    if (typeof height !== 'number' || !Number.isFinite(height)) return;
    const next = Math.min(640, Math.max(250, Math.ceil(height)));
    if (next === this.height) return;
    this.height = next;
    this.position();
  }
  private position() {
    if (!this.window || !this.anchor) return;
    const bounds = panelBounds(this.anchor, screen.getDisplayMatching(this.anchor).workArea, this.height);
    this.arrowLeft = panelArrowLeft(this.anchor, bounds);
    this.window.setBounds(bounds);
    this.publish();
  }
  private displayChanged = () => this.hide(true);
  publish() {
    if (!this.window || this.window.isDestroyed() || this.window.webContents.isLoadingMainFrame()) return;
    this.window.webContents.send('dogcow:tray-panel', { data: this.deps.data(), phase: this.phase, arrowLeft: this.arrowLeft });
  }
  dispose() {
    this.disposed = true;
    ++this.generation;
    clearTimeout(this.timer);
    screen.removeListener('display-removed', this.displayChanged);
    screen.removeListener('display-metrics-changed', this.displayChanged);
    this.window?.destroy();
    this.window = undefined;
  }
}
