import type { BrowserWindow } from 'electron';
import type { Rectangle } from '../shared/capsule.js';

const DURATION_MS = 240;
const NATIVE_TIMEOUT_MS = 1500;
const matches = (a: Rectangle, b: Rectangle) =>
  (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(a[key] - b[key]) <= 1);

/** Owns native animation lifetime; never publishes per-frame application snapshots. */
export class WindowAnimation {
  private abort?: AbortController;
  constructor(private win: BrowserWindow, private platform = process.platform) {}

  cancel() { this.abort?.abort(); }

  async move(target: Rectangle, animate: boolean): Promise<void> {
    this.cancel();
    if (!animate || matches(this.win.getBounds(), target)) {
      this.win.setBounds(target);
      return;
    }
    const controller = new AbortController();
    this.abort = controller;
    try {
      if (this.platform === 'darwin') await this.native(target, controller.signal);
      else await this.interpolate(target, controller.signal);
    } finally {
      if (this.abort === controller) this.abort = undefined;
    }
  }

  private native(target: Rectangle, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.win.removeListener('resized', resized);
        signal.removeEventListener('abort', cancelled);
      };
      const finish = (error?: Error) => { cleanup(); error ? reject(error) : resolve(); };
      const resized = () => { if (matches(this.win.getBounds(), target)) finish(); };
      const cancelled = () => {
        // Stop the OS animation at its current native bounds before recovery.
        try { if (!this.win.isDestroyed()) this.win.setBounds(this.win.getBounds()); }
        catch { /* Recovery belongs to WindowController; abort must never throw globally. */ }
        finish(Error('window animation cancelled'));
      };
      const timer = setTimeout(() => {
        // Some OS versions omit the completion event; accept only verified final bounds.
        finish(matches(this.win.getBounds(), target) ? undefined : Error('window animation timeout'));
      }, NATIVE_TIMEOUT_MS);
      this.win.on('resized', resized);
      signal.addEventListener('abort', cancelled, { once: true });
      try { this.win.setBounds(target, true); } catch (error) { finish(error instanceof Error ? error : Error('native animation failed')); }
    });
  }

  private interpolate(target: Rectangle, signal: AbortSignal): Promise<void> {
    const start = this.win.getBounds();
    const began = performance.now();
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancelled); };
      const cancelled = () => { cleanup(); reject(Error('window animation cancelled')); };
      const frame = () => {
        try {
          const progress = Math.min(1, (performance.now() - began) / DURATION_MS);
          const eased = 1 - (1 - progress) ** 3;
          const mix = (a: number, b: number) => Math.round(a + (b - a) * eased);
          const width = mix(start.width, target.width);
          this.win.setBounds({
            x: mix(start.x + start.width, target.x + target.width) - width,
            y: mix(start.y, target.y), width, height: mix(start.height, target.height),
          });
          if (progress === 1) { cleanup(); resolve(); }
          else timer = setTimeout(frame, 16);
        } catch (error) { cleanup(); reject(error); }
      };
      signal.addEventListener('abort', cancelled, { once: true });
      frame();
    });
  }
}
