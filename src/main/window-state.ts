import { readFile, mkdir, open, rename, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMetric, isMode, validRect, type WindowPreferences } from '../shared/capsule.js';
import { record } from '../domain/tasks/model.js';

export class WindowStateStore {
  value: WindowPreferences = { version: 1, revision: 0, mode: 'expanded', metric: 'countdown', alwaysOnTop: false, expanded: { bounds: { x: 100, y: 100, width: 1280, height: 820 }, maximized: false, fullscreen: false }, capsule: null };
  dirty = false;
  warning = '';
  private preserveOriginal = false;
  private queue: Promise<boolean> = Promise.resolve(true);
  constructor(private directory: string) {}
  get file() { return path.join(this.directory, 'window-preferences.json'); }
  async load() {
    try {
      const v: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (!record(v) || v.version !== 1 || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0 || !isMode(v.mode) || typeof v.alwaysOnTop !== 'boolean' || !record(v.expanded) || !validRect(v.expanded.bounds) || typeof v.expanded.maximized !== 'boolean' || typeof v.expanded.fullscreen !== 'boolean' || !(v.capsule === null || (record(v.capsule) && validRect({ ...v.capsule, width: 240, height: 32 })))) throw Error('invalid preferences');
      this.value = { ...v, metric: isMetric(v.metric) ? v.metric : 'countdown' } as unknown as WindowPreferences;
      if (!isMetric(v.metric)) { this.warning = 'WINDOW_PREFERENCES_INVALID'; this.preserveOriginal = true; }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { this.warning = 'WINDOW_PREFERENCES_INVALID'; this.preserveOriginal = true; return; }
      try {
        const bounds: unknown = JSON.parse(await readFile(path.join(this.directory, 'window-state.json'), 'utf8'));
        if (validRect(bounds)) this.value.expanded.bounds = bounds;
      } catch { /* Missing legacy position uses the safe default; no source is overwritten. */ }
    }
  }
  update(patch: Partial<WindowPreferences>) {
    const next = { ...this.value, ...patch };
    if (JSON.stringify(next) === JSON.stringify(this.value)) return;
    this.value = { ...next, revision: this.value.revision + 1 };
    this.dirty = true;
  }
  flush(repair = false): Promise<boolean> {
    this.queue = this.queue.then(async () => {
      if (!this.dirty) return !this.warning;
      // Recovery must not overwrite a malformed source on move, startup or quit.
      if (this.preserveOriginal && !repair) return false;
      const value = structuredClone(this.value);
      const payload = JSON.stringify(value);
      const temp = path.join(this.directory, `.window-${randomUUID()}.tmp`);
      try {
        await mkdir(this.directory, { recursive: true });
        if (this.preserveOriginal) { await copyFile(this.file, `${this.file}.invalid-${randomUUID()}.bak`); this.preserveOriginal = false; }
        const handle = await open(temp, 'wx', 0o600);
        try { await handle.writeFile(payload); await handle.sync(); } finally { await handle.close(); }
        await rename(temp, this.file);
        if (await readFile(this.file, 'utf8') !== payload) throw Error('readback');
        if (this.value.revision === value.revision) this.dirty = false;
        this.warning = '';
        return true;
      } catch (error) {
        this.warning = 'WINDOW_PREFERENCES_SAVE_FAILED';
        console.error(JSON.stringify({ operation: 'windowPreferences', stage: 'write', errorCode: this.warning, cause: (error as NodeJS.ErrnoException).code ?? 'unknown', correlationId: randomUUID() }));
        await unlink(temp).catch(() => {});
        return false;
      }
    });
    return this.queue;
  }
}
