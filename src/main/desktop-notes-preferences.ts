import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { NoteRect } from '../shared/desktop-note-window.js';
export interface NotePlacement { bounds: NoteRect; desktop: NoteRect; displayId: string; hanging: boolean; expanded: boolean; anchor: number }
interface Preferences { version: 1; displayId: string; alwaysOnTop: boolean; lineOffset: number; notes: Record<string, NotePlacement> }
const initial = (): Preferences => ({ version: 1, displayId: '', alwaysOnTop: false, lineOffset: 48, notes: {} });
const rect = (v: unknown): v is NoteRect => !!v && typeof v === 'object' && ['x', 'y', 'width', 'height'].every(k => Number.isFinite((v as Record<string, unknown>)[k])) && (v as NoteRect).width > 0 && (v as NoteRect).height > 0;
/** Local display coordinates stay out of portable task backups. */
export class DesktopNotesPreferences {
  value = initial();
  warning = '';
  private damaged = false;
  private dirty = false;
  private queue: Promise<boolean> = Promise.resolve(true);
  constructor(private directory: string) {}
  private get file() { return path.join(this.directory, 'desktop-notes-preferences.json'); }
  async load() {
    try {
      const v = JSON.parse(await readFile(this.file, 'utf8'));
      if (!v || v.version !== 1 || typeof v.displayId !== 'string' || !v.notes || typeof v.notes !== 'object' || Array.isArray(v.notes) || Object.keys(v.notes).length > 200) throw Error();
      for (const p of Object.values(v.notes) as NotePlacement[]) if (!p || !rect(p.bounds) || !rect(p.desktop) || typeof p.displayId !== 'string' || typeof p.hanging !== 'boolean' || typeof p.expanded !== 'boolean' || !Number.isFinite(p.anchor) || p.anchor < 0 || p.anchor > 1) throw Error();
      if (v.alwaysOnTop !== undefined && typeof v.alwaysOnTop !== 'boolean'
        || v.lineOffset !== undefined && (!Number.isFinite(v.lineOffset) || v.lineOffset < 0 || v.lineOffset > 1_000_000)) throw Error();
      this.value = { ...v, alwaysOnTop: v.alwaysOnTop ?? false, lineOffset: v.lineOffset ?? 48 };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { this.damaged = true; this.warning = '便签偏好损坏，已使用默认位置；原文件保留，可重置位置恢复。'; }
    }
  }
  update(notes: Record<string, NotePlacement>, displayId: string, lineOffset = this.value.lineOffset) {
    this.value = { ...this.value, notes: structuredClone(notes), displayId, lineOffset }; this.dirty = true;
  }
  setAlwaysOnTop(enabled: boolean) { this.value = { ...this.value, alwaysOnTop: enabled }; this.dirty = true; }
  get pending() { return this.dirty && !this.damaged; }
  async reset() {
    if (this.damaged) await copyFile(this.file, `${this.file}.invalid-${randomUUID()}.bak`);
    this.damaged = false; this.warning = ''; this.value = { ...initial(), alwaysOnTop: this.value.alwaysOnTop }; this.dirty = true;
    return this.flush();
  }
  flush(): Promise<boolean> {
    this.queue = this.queue.then(async () => {
      if (this.damaged) return false;
      if (!this.dirty) return true;
      const payload = JSON.stringify(this.value);
      const temp = `${this.file}.${randomUUID()}.tmp`;
      try {
        await mkdir(this.directory, { recursive: true });
        await writeFile(temp, payload, { mode: 0o600 }); await rename(temp, this.file);
        if (await readFile(this.file, 'utf8') !== payload) throw Error();
        if (JSON.stringify(this.value) === payload) this.dirty = false;
        this.warning = ''; return true;
      } catch { this.warning = '便签偏好尚未保存，请重试保存。'; return false; }
    });
    return this.queue;
  }
}
