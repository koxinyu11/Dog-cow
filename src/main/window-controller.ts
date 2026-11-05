import { WindowAnimation } from './window-animation.js';
import { BrowserWindow, screen, Menu, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { CAPSULE_SIZE, anchoredBounds, fitBounds, isMetric, isMode, WINDOW_ERRORS, type WindowError, type WindowMode, type WindowSnapshot } from '../shared/capsule.js';
import type { Fields, Result } from '../shared/contracts.js';
import { WindowStateStore } from './window-state.js';

interface Dependencies {
  broadcast(): void;
  saveData(): Promise<boolean>;
  enqueue<T>(work: () => Promise<T>): Promise<T>;
  quitting(): boolean;
}
export class WindowController {
  phase: WindowSnapshot['phase'] = 'idle';
  private pending?: { nonce: string; resolve(ready: boolean): void; timer: ReturnType<typeof setTimeout> };
  private movement?: ReturnType<typeof setTimeout>;
  private menuOpen = false;
  private warning = '';
  private prepareTimedOut = false;
  private flight?: { target: WindowMode; promise: Promise<Result> };
  private actualMode: WindowMode = 'expanded';
  private animation: WindowAnimation;
  private visual?: { nonce: string; resolve(result: { ready: boolean; reducedMotion: boolean }): void };
  private cancelled = false;
  constructor(readonly win: BrowserWindow, readonly store: WindowStateStore, private deps: Dependencies) { this.animation = new WindowAnimation(win); }
  snapshot(): WindowSnapshot {
    return { ...structuredClone(this.store.value), mode: this.actualMode, alwaysOnTop: this.win.isAlwaysOnTop(), phase: this.phase, dirty: this.store.dirty, warning: this.warning || this.store.warning };
  }
  private error(code: WindowError, cause?: unknown): Result {
    const correlationId = randomUUID();
    console.error(JSON.stringify({ operation: 'window', stage: this.phase, errorCode: code, cause: cause instanceof Error ? cause.name : 'none', correlationId, revision: this.store.value.revision, platform: process.platform }));
    this.warning = code;
    this.deps.broadcast();
    return { applied: false, persisted: false, message: WINDOW_ERRORS[code], errorCode: code, correlationId };
  }
  private areas() { const primary = screen.getPrimaryDisplay(); return [primary, ...screen.getAllDisplays().filter(d => d.id !== primary.id)].map(d => d.workArea); }
  private defaultPosition() {
    const a = screen.getDisplayMatching(this.store.value.expanded.bounds).workArea;
    return { x: a.x + a.width - CAPSULE_SIZE.width - 16, y: a.y + 16 };
  }
  private remember() {
    if (this.actualMode === 'capsule') {
      const { x, y } = this.win.getBounds();
      this.store.update({ capsule: { x, y } });
    } else this.store.update({ expanded: { bounds: this.win.getNormalBounds(), maximized: this.win.isMaximized(), fullscreen: this.win.isFullScreen() } });
  }
  private async fullScreen(value: boolean) {
    if (this.win.isFullScreen() === value) return;
    await new Promise<void>((resolve, reject) => {
      const remove = () => { if (value) this.win.removeListener('enter-full-screen', done); else this.win.removeListener('leave-full-screen', done); };
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { remove(); reject(Error('WINDOW_FULLSCREEN_TIMEOUT')); }, 3000);
      if (value) this.win.once('enter-full-screen', done); else this.win.once('leave-full-screen', done);
      try { this.win.setFullScreen(value); } catch(error) { clearTimeout(timer); remove(); reject(error); }
    });
  }
  private async apply(target: WindowMode, transition?: { animate: boolean }) {
    const w = this.win;
    await this.fullScreen(false);
    if (transition && this.cancelled) throw Error('window transition cancelled');
    if (w.isMaximized()) w.unmaximize();
    const size = target === 'capsule' ? CAPSULE_SIZE : this.store.value.expanded.bounds;
    const current = w.getBounds();
    const bounds = transition
      ? anchoredBounds(current, size, screen.getDisplayMatching(current).workArea)
      : target === 'capsule'
        ? fitBounds({ ...(this.store.value.capsule ?? this.defaultPosition()), ...CAPSULE_SIZE }, this.areas())
        : fitBounds(this.store.value.expanded.bounds, this.areas(), { width: 900, height: 620 });
    // Both directions must remain below the expanded minimum throughout the morph.
    w.setMinimumSize(1, 1);
    w.setResizable(false);
    if (process.platform === 'darwin') w.setWindowButtonVisibility(false);
    await this.animation.move(bounds, transition?.animate ?? false);
    if (target === 'expanded') {
      w.setMinimumSize(Math.min(900, bounds.width), Math.min(620, bounds.height));
      w.setResizable(true);
      if (process.platform === 'darwin') w.setWindowButtonVisibility(true);
      // Explicit mode switches stay at the current anchor; only startup/recovery restores OS state.
      if (!transition) {
        if (this.store.value.expanded.maximized) w.maximize();
        if (this.store.value.expanded.fullscreen) await this.fullScreen(true);
      }
    }
    this.actualMode = target;
  }
  async initialize() {
    this.phase = 'applying';
    try {
      this.win.setAlwaysOnTop(this.store.value.alwaysOnTop, 'floating');
      await this.apply(this.store.value.mode);
    } catch(error) {
      this.error('WINDOW_MODE_FAILED', error);
      this.store.value.mode = 'expanded';
      this.store.value.expanded.fullscreen = false;
      this.store.value.expanded.maximized = false;
      try { await this.apply('expanded'); } catch(error) { this.error('WINDOW_RESTORE_FAILED', error); await dialog.showMessageBox({ type: 'error', message: WINDOW_ERRORS.WINDOW_RESTORE_FAILED }); }
    } finally { this.phase = 'idle'; }
    const moved = () => {
      if (this.phase !== 'idle' || this.deps.quitting()) return;
      clearTimeout(this.movement);
      this.movement = setTimeout(() => {
        if (this.phase !== 'idle' || this.win.isDestroyed()) return;
        this.remember();
        if (this.store.dirty) void this.store.flush().then(() => this.deps.broadcast());
      }, 300);
    };
    this.win.on('move', moved);
    this.win.on('resize', moved);
    screen.on('display-added', this.onDisplayChanged);
    screen.on('display-removed', this.onDisplayChanged);
    screen.on('display-metrics-changed', this.onDisplayChanged);
    this.win.once('closed', () => {
      this.cancel();
      screen.removeListener('display-added', this.onDisplayChanged);
      screen.removeListener('display-removed', this.onDisplayChanged);
      screen.removeListener('display-metrics-changed', this.onDisplayChanged);
    });
  }
  private onDisplayChanged = () => {
    if (this.phase !== 'idle' || this.deps.quitting()) return;
    void this.deps.enqueue(async () => {
      if (this.phase !== 'idle') return;
      this.phase = 'applying';
      try { await this.apply(this.actualMode); this.remember(); await this.store.flush(); }
      catch(error) { this.error('WINDOW_MODE_FAILED', error); }
      finally { this.phase = 'idle'; this.deps.broadcast(); }
    });
  };
  acknowledge(p: Fields): Result {
    if (this.pending && p.nonce === this.pending.nonce) this.pending.resolve(p.ready === true);
    return { applied: false, persisted: false, message: '' };
  }
  cancel() {
    this.cancelled = true;
    this.animation.cancel();
    this.visual?.resolve({ ready: false, reducedMotion: true });
    clearTimeout(this.movement);
    this.pending?.resolve(false);
  }
  acknowledgeTransition(p: Fields): Result {
    if (this.visual && this.visual.nonce === p.nonce) this.visual.resolve({ ready: p.ready === true, reducedMotion: p.reducedMotion === true });
    return { applied: false, persisted: false, message: '' };
  }
  private visualStep(stage: 'exit' | 'enter', target: WindowMode): Promise<{ ready: boolean; reducedMotion: boolean }> {
    return new Promise(resolve => {
      const nonce = randomUUID();
      const finish = (result: { ready: boolean; reducedMotion: boolean }) => {
        if (this.visual?.nonce !== nonce) return;
        clearTimeout(timer);
        this.visual = undefined;
        resolve(result);
      };
      const timer = setTimeout(() => finish({ ready: false, reducedMotion: true }), 1500);
      this.visual = { nonce, resolve: finish };
      this.win.webContents.send('dogcow:window-transition', { nonce, stage, target });
    });
  }
  private resetVisuals() {
    if (!this.win.isDestroyed()) this.win.webContents.send('dogcow:window-transition', { nonce: randomUUID(), stage: 'reset', target: this.actualMode });
  }
  private prepare(): Promise<boolean> {
    return new Promise(resolve => {
      const nonce = randomUUID();
      this.prepareTimedOut = false;
      const finish = (ready: boolean) => {
        if (this.pending?.nonce !== nonce) return;
        clearTimeout(this.pending.timer);
        this.pending = undefined;
        resolve(ready);
      };
      const timer = setTimeout(() => { this.prepareTimedOut = true; finish(false); }, 5000);
      this.pending = { nonce, resolve: finish, timer };
      this.win.webContents.send('dogcow:prepare-window-mode', nonce);
    });
  }
  request(target: unknown, settings = false): Promise<Result> {
    if (this.flight && this.flight.target === target && !settings) return this.flight.promise;
    const promise = this.transition(target, settings).catch(error => this.error('WINDOW_MODE_FAILED', error));
    if (isMode(target) && !this.flight) {
      this.flight = { target, promise };
      void promise.finally(() => { if (this.flight?.promise === promise) this.flight = undefined; });
    }
    return promise;
  }
  private async transition(target: unknown, settings = false): Promise<Result> {
    if (!isMode(target)) return this.error('WINDOW_INVALID_INPUT');
    if (this.phase !== 'idle' || this.menuOpen || this.deps.quitting()) return this.error('WINDOW_BUSY');
    if (target === this.actualMode) return { applied: true, persisted: !this.store.dirty, message: '' };
    this.warning = '';
    this.cancelled = false;
    clearTimeout(this.movement);
    this.phase = 'preparing'; this.deps.broadcast();
    try {
      if (target === 'capsule' && !await this.prepare()) return this.error(this.prepareTimedOut ? 'WINDOW_PREPARE_TIMEOUT' : 'WINDOW_DRAFT_BLOCKED');
      return await this.deps.enqueue(async () => {
        if (this.deps.quitting()) return this.error('WINDOW_BUSY');
        if (target === 'capsule' && !await this.deps.saveData()) return this.error('WINDOW_DATA_SAVE_FAILED');
        this.remember();
        const old = structuredClone(this.store.value);
        const previous = this.actualMode;
        this.phase = 'applying';
        this.deps.broadcast();
        try {
          const leaving = await this.visualStep('exit', target);
          if (!leaving.ready || this.cancelled) throw Error('window content transition interrupted');
          await this.apply(target, { animate: !leaving.reducedMotion });
          if (this.cancelled) throw Error('window transition cancelled');
          this.store.update({ mode: target, expanded: { ...this.store.value.expanded, maximized: false, fullscreen: false } });
          this.remember();
          this.deps.broadcast();
          const entering = await this.visualStep('enter', target);
          if (!entering.ready || this.cancelled) throw Error('window content transition interrupted');
        } catch(error) {
          this.phase = 'restoring';
          this.store.value = old;
          try { await this.apply(previous); }
          catch(restoreError) {
            this.store.value.expanded.fullscreen = false;
            this.store.value.expanded.maximized = false;
            try { await this.apply('expanded'); } catch { void dialog.showMessageBox({ type: 'error', message: WINDOW_ERRORS.WINDOW_RESTORE_FAILED }); }
            return this.error('WINDOW_RESTORE_FAILED', restoreError);
          }
          return this.error(error instanceof Error && error.message === 'WINDOW_FULLSCREEN_TIMEOUT' ? 'WINDOW_FULLSCREEN_TIMEOUT' : 'WINDOW_MODE_FAILED', error);
        }
        const persisted = await this.store.flush();
        if (settings) this.win.webContents.send('dogcow:open-capsule-settings', randomUUID());
        return { applied: true, persisted, message: persisted ? '' : WINDOW_ERRORS.WINDOW_PREFERENCES_SAVE_FAILED };
      });
    } finally { this.resetVisuals(); this.phase = 'idle'; this.deps.broadcast(); }
  }
  async preferences(p: Fields): Promise<Result> {
    if (this.phase !== 'idle' || this.deps.quitting()) return this.error('WINDOW_BUSY');
    if (p.expectedWindowRevision !== this.store.value.revision) return this.error('WINDOW_REVISION_CONFLICT');
    if (Object.keys(p).some(k => !['metric', 'alwaysOnTop', 'expectedWindowRevision', 'requestId'].includes(k)) || (p.metric !== undefined && !isMetric(p.metric)) || (p.alwaysOnTop !== undefined && typeof p.alwaysOnTop !== 'boolean')) return this.error('WINDOW_INVALID_INPUT');
    if (p.alwaysOnTop !== undefined) {
      const old = this.win.isAlwaysOnTop();
      try {
        this.win.setAlwaysOnTop(p.alwaysOnTop as boolean, 'floating');
        if (this.win.isAlwaysOnTop() !== p.alwaysOnTop) throw Error('readback');
      } catch(error) {
        try { this.win.setAlwaysOnTop(old, 'floating'); } catch { /* Snapshot always reports the actual layer. */ }
        return this.error('WINDOW_TOPMOST_FAILED', error);
      }
    }
    this.warning = '';
    this.store.update({ ...(isMetric(p.metric) ? { metric: p.metric } : {}), ...(typeof p.alwaysOnTop === 'boolean' ? { alwaysOnTop: p.alwaysOnTop } : {}) });
    // Explicit retry is allowed even if the chosen value did not change.
    if (this.store.warning) this.store.dirty = true;
    const persisted = await this.store.flush(true);
    this.deps.broadcast();
    return { applied: true, persisted, message: persisted ? '' : WINDOW_ERRORS.WINDOW_PREFERENCES_SAVE_FAILED };
  }
  async resetPosition(): Promise<Result> {
    if (this.phase !== 'idle') return this.error('WINDOW_BUSY');
    this.warning = '';
    this.store.update({ capsule: this.defaultPosition() });
    if (this.actualMode === 'capsule') {
      this.phase = 'applying';
      try { await this.apply('capsule'); } catch(error) { return this.error('WINDOW_MODE_FAILED', error); }
      finally { this.phase = 'idle'; }
    }
    const persisted = await this.store.flush();
    this.deps.broadcast();
    return { applied: true, persisted, message: persisted ? '' : WINDOW_ERRORS.WINDOW_PREFERENCES_SAVE_FAILED };
  }
  menu() {
    if (this.phase !== 'idle' || this.menuOpen) return;
    this.menuOpen = true;
    let selected: (() => void) | undefined;
    Menu.buildFromTemplate([
      { label: '展开主界面', click: () => { selected = () => { void this.request('expanded'); }; } },
      { label: '胶囊设置', click: () => { selected = () => { void this.request('expanded', true); }; } },
      { label: '始终置顶', type: 'checkbox', checked: this.win.isAlwaysOnTop(), click: item => { selected = () => { void this.deps.enqueue(() => this.preferences({ alwaysOnTop: item.checked, expectedWindowRevision: this.store.value.revision })); }; } },
      { label: '恢复胶囊位置', click: () => { selected = () => { void this.deps.enqueue(() => this.resetPosition()); }; } },
    ]).popup({ window: this.win, callback: () => { this.menuOpen = false; setImmediate(() => selected?.()); } });
  }
  async flush() {
    this.warning = '';
    this.remember();
    return this.store.flush();
  }
}
