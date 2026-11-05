import { Tray, nativeImage } from 'electron';
import { randomUUID } from 'node:crypto';
import { type TrayState, type TrayView } from '../shared/tray.js';
interface Dependencies {
  iconPath: string;
  togglePanel(bounds: Electron.Rectangle): void;
  changed(): void;
  failed(): void;
}
export class TrayController {
  state: TrayState = { supported: process.platform === 'darwin', available: false };
  private tray?: Tray;
  private view?: TrayView;
  private signature = '';
  constructor(private deps: Dependencies) {}
  private fail(code: 'TRAY_UNAVAILABLE' | 'TRAY_RENDER_FAILED', cause: unknown) {
    if (this.state.errorCode !== code) {
      const correlationId = randomUUID();
      this.state = { ...this.state, available: !!this.tray, errorCode: code, correlationId };
      console.error(JSON.stringify({ operation: 'tray', stage: code === 'TRAY_UNAVAILABLE' ? 'initialize' : 'render', errorCode: code, correlationId, cause: cause instanceof Error ? cause.name : 'unknown', display: this.view?.display }));
      this.deps.changed();
    }
  }
  initialize() {
    if (!this.state.supported) return;
    this.dispose();
    try {
      const icon = nativeImage.createFromPath(this.deps.iconPath);
      if (icon.isEmpty()) throw Error('Tray icon missing');
      icon.setTemplateImage(true);
      this.tray = new Tray(icon);
      this.tray.on('click', () => this.deps.togglePanel(this.tray!.getBounds()));
      this.tray.on('right-click', () => this.deps.togglePanel(this.tray!.getBounds()));
      this.state = { supported: true, available: true };
      this.signature = '';
      if (this.view) this.update(this.view);
      this.deps.changed();
    } catch (error) {
      this.dispose();
      this.fail('TRAY_UNAVAILABLE', error);
      this.deps.failed();
    }
  }
  update(view: TrayView) {
    this.view = view;
    if (!this.tray || this.state.errorCode) return;
    const signature = JSON.stringify([view.title, view.display]);
    if (signature === this.signature) return;
    try {
      const icon = view.display === 'icon' ? nativeImage.createFromPath(this.deps.iconPath) : nativeImage.createEmpty();
      if (view.display === 'icon' && icon.isEmpty()) throw Error('Tray icon missing');
      icon.setTemplateImage(true);
      this.tray.setImage(icon);
      this.tray.setTitle(view.title, { fontType: 'monospacedDigit' });
      this.tray.setToolTip(view.display === 'icon' ? '狗牛' : view[view.display === 'income-today' ? 'income' : 'countdown'].tooltip);
      this.signature = signature;
      if (this.state.errorCode) {
        console.info(JSON.stringify({ operation: 'tray', stage: 'recovered', correlationId: this.state.correlationId }));
        this.state = { supported: true, available: true };
        this.deps.changed();
      }
    } catch (error) {
      // One attempt to retain a visible entry; no repeated render retries on every tick.
      this.signature = signature;
      try {
        const icon = nativeImage.createFromPath(this.deps.iconPath);
        if (icon.isEmpty()) throw Error('Tray icon missing');
        icon.setTemplateImage(true);
        this.tray.setImage(icon);
        this.tray.setTitle('');
      } catch {
        this.dispose();
        this.deps.failed();
      }
      this.fail('TRAY_RENDER_FAILED', error);
    }
  }
  dispose() {
    this.tray?.destroy();
    this.tray = undefined;
    this.state = { ...this.state, available: false };
  }
}
