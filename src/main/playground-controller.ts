import { errorDetails, type DiagnosticContext, type DiagnosticStage, type PlaygroundReport } from '../shared/playground-diagnostics.js';
import { BrowserWindow, screen } from 'electron';
import { randomUUID } from 'node:crypto';
import { PLAYGROUND_ERRORS, trustedPlaygroundCommand, type PlaygroundTheme } from '../shared/playground.js';
interface Dependencies {
  preload: string;
  url: string;
  theme(): PlaygroundTheme;
  environment?: { version: string; buildId: string };
  record?(report: PlaygroundReport, context: DiagnosticContext): Promise<unknown>;
  failed(message: string, correlationId: string): void;
}
class NativeFailure extends Error {
  constructor(readonly stage: DiagnosticStage, cause: unknown) { super('游乐场原生阶段失败', { cause }); }
}
/** Owns a single independent window; never owns the main application's data. */
export class PlaygroundController {
  window?: BrowserWindow;
  private opening?: Promise<boolean>;
  private phase: 'closed' | 'loading' | 'ready' = 'closed';
  private ready?: () => void;
  private rejectReady?: (error: Error) => void;
  private disposed = false;
  private bounds?: Electron.Rectangle;
  private sessionId = randomUUID();
  lastFailure?: { message: string; correlationId: string; errorCode: string };
  context(): DiagnosticContext { return { sessionId: this.sessionId, version: this.deps.environment?.version ?? 'development', buildId: this.deps.environment?.buildId ?? 'development' }; }
  authorize(sender: Electron.WebContents, frame: Electron.WebFrameMain | null, command: unknown) {
    if (sender !== this.window?.webContents || frame !== sender.mainFrame || !trustedPlaygroundCommand(command, frame?.url ?? '', this.deps.url)) {
      this.diagnose('ipc', Error('游乐场操作来源或命令被拒绝'));
      throw Error('不允许的游乐场操作。');
    }
  }
  constructor(private deps: Dependencies) {}
  command(sender: Electron.WebContents, frame: Electron.WebFrameMain | null, command: unknown) {
    this.authorize(sender, frame, command);
    if (command === 'ready') this.ready?.();
    return { theme: this.deps.theme(), context: this.context() };
  }
  open(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.opening) return this.opening;
    const pending = this.openWindow().finally(() => {
      if (this.opening === pending) this.opening = undefined;
    });
    this.opening = pending;
    return pending;
  }
  private async openWindow(): Promise<boolean> {
    let win = this.window;
    let stage: DiagnosticStage = 'create';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!win || this.phase !== 'ready') {
        this.phase = 'loading';
        this.sessionId = randomUUID();
        this.lastFailure = undefined;
        const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
        const width = Math.min(this.bounds?.width ?? 960, area.width);
        const height = Math.min(this.bounds?.height ?? 680, area.height);
        win = new BrowserWindow({ width, height,
          x: Math.max(area.x, Math.min(this.bounds?.x ?? area.x + Math.round((area.width - width) / 2), area.x + area.width - width)),
          y: Math.max(area.y, Math.min(this.bounds?.y ?? area.y + Math.round((area.height - height) / 2), area.y + area.height - height)),
          minWidth: Math.min(720, area.width), minHeight: Math.min(520, area.height),
          title: '狗牛游乐场', show: false, backgroundColor: this.deps.theme() === 'dark' ? '#17211c' : '#f6f5ef',
          ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 14 } } : {}),
          webPreferences: { preload: this.deps.preload, nodeIntegration: false, contextIsolation: true, sandbox: true },
        });
        this.window = win;
        const created = win;
        stage = 'initialize';
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.webContents.on('will-navigate', event => event.preventDefault());
        win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
        win.on('close', () => { if (!created.isMaximized() && !created.isFullScreen()) this.bounds = created.getBounds(); });
        win.on('closed', () => {
          if (this.window === created) {
            this.window = undefined; this.phase = 'closed';
            this.rejectReady?.(Error('closed'));
          }
        });
        const rejectOrFail = (stage: DiagnosticStage, error: unknown) => {
          if (this.disposed || this.window !== created) return;
          if (this.phase === 'loading') this.rejectReady?.(new NativeFailure(stage, error));
          else this.fail(created, stage, error);
        };
        win.webContents.on('preload-error', (_event, _preloadPath, error) => rejectOrFail('preload', error));
        win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
          if (isMainFrame && code !== -3) rejectOrFail('page', Object.assign(Error(description), { code }));
        });
        win.on('unresponsive', () => {
          if (!this.disposed && this.window === created) {
            const id = this.diagnose('unresponsive', Error('游乐场页面未响应'));
            this.deps.failed('游乐场暂未响应，可稍后重试。', id);
          }
        });
        win.webContents.on('render-process-gone', (_event, details) => {
          if (this.disposed || this.window !== created) return;
          rejectOrFail('renderer', Object.assign(Error(details.reason), { code: details.exitCode }));
        });
        let startupError: Error | undefined;
        win.webContents.on('console-message', event => {
          if (this.phase === 'loading' && event.level === 'error') startupError = Object.assign(Error(event.message), { code: 'STARTUP_CONSOLE_ERROR' });
        });
        const ready = new Promise<void>((resolve, reject) => {
          this.ready = resolve; this.rejectReady = reject;
          timer = setTimeout(() => reject(new NativeFailure('ready', new Error('页面未在 10 秒内完成就绪握手', { cause: startupError }))), 10000);
        });
        stage = 'load';
        // Defer loadURL so synchronous native failures also reject through Promise.all.
        await Promise.all([Promise.resolve().then(() => created.loadURL(this.deps.url)), ready]);
        if (this.disposed || this.window !== created || created.isDestroyed()) return false;
        this.phase = 'ready';
      }
      stage = 'show';
      if (this.disposed || !win || this.window !== win || this.phase !== 'ready') return false;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return true;
    } catch (error) {
      // An intentional close/disposal cancels opening without an error toast.
      if (!this.disposed && (!win || this.window === win)) this.fail(win, error instanceof NativeFailure ? error.stage : stage, error);
      return false;
    } finally {
      clearTimeout(timer);
      this.ready = undefined;
      this.rejectReady = undefined;
    }
  }
  private fail(win: BrowserWindow | undefined, stage: DiagnosticStage, cause: unknown) {
    this.window = undefined;
    this.phase = 'closed';
    const correlationId = this.diagnose(stage, cause);
    if (win && !win.isDestroyed()) {
      try { win.destroy(); } catch (cleanupError) { this.diagnose('renderer', new Error('失败窗口清理异常', { cause: cleanupError })); }
    }
    const code = stage === 'renderer' ? 'PLAYGROUND_RENDERER_FAILED' : 'PLAYGROUND_OPEN_FAILED';
    this.lastFailure = { message: PLAYGROUND_ERRORS[code], correlationId, errorCode: code };
    this.deps.failed(this.lastFailure.message, correlationId);
  }
  diagnose(stage: DiagnosticStage, cause: unknown) {
    const report: PlaygroundReport = { correlationId: randomUUID(), runId: this.sessionId, stage, errors: errorDetails(cause) };
    if (this.deps.record) void this.deps.record(report, this.context()).catch(() => console.error('游乐场诊断暂时无法保存。'));
    else console.error(JSON.stringify({ ...report, ...this.context() }));
    return report.correlationId;
  }
  publishTheme() {
    const win = this.window;
    if (!win || win.isDestroyed()) return;
    try {
      const theme = this.deps.theme();
      win.setBackgroundColor(theme === 'dark' ? '#17211c' : '#f6f5ef');
      win.webContents.send('dogcow:playground-theme', theme);
    } catch (error) { this.diagnose('theme', error); }
  }
  dispose() {
    this.disposed = true;
    this.rejectReady?.(Error('disposed'));
    this.window?.destroy(); this.window = undefined; this.phase = 'closed';
  }
}
