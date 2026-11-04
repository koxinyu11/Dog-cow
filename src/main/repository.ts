import { mkdir, readFile, writeFile, rename, copyFile, open } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { allowedKey, collectLegacy, validateLegacy } from '../migration/transfer.js';
import { record } from '../domain/tasks/model.js';
export class Repository {
  values = new Map<string, string>();
  dirty = false;
  error = '';
  readError = '';
  revision = 0;
  receipts: string[] = [];
  migration: {
    phase: 'pending' | 'verified';
    digest: string;
    valuesDigest: string;
    backup: string;
  } | null = null;
  private queue: Promise<boolean> = Promise.resolve(true);
  constructor(readonly directory: string) {}
  get file() {
    return path.join(this.directory, 'snapshot.json');
  }
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      const text = await readFile(this.file, 'utf8');
      const value: unknown = JSON.parse(text);
      if (
        !record(value) ||
        value.schemaVersion !== 1 ||
        !record(value.values) ||
        !Number.isSafeInteger(value.revision)
      )
        throw Error();
      for (const [key, raw] of Object.entries(value.values)) {
        if (!allowedKey(key) || typeof raw !== 'string') throw Error();
        this.values.set(key, raw);
      }
      this.revision = value.revision as number;
      this.receipts = Array.isArray(value.receipts)
        ? value.receipts.filter((item): item is string => typeof item === 'string').slice(-128)
        : [];
      if (
        record(value.migration) &&
        ['pending', 'verified'].includes(String(value.migration.phase)) &&
        typeof value.migration.digest === 'string' &&
        typeof value.migration.valuesDigest === 'string' &&
        typeof value.migration.backup === 'string'
      )
        this.migration = value.migration as typeof this.migration;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.values.clear();
        this.readError = '本机快照无法读取，未覆盖原文件。请通过数据迁移面板从有效备份恢复。';
      }
    }
  }
  storage = {
    getItem: (key: string) => this.values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (this.readError) throw Error(this.readError);
      if (!allowedKey(key)) throw Error('存储键不允许。');
      if (this.values.get(key) !== value) {
        this.values.set(key, value);
        this.dirty = true;
        this.revision++;
      }
    },
  };
  async backup(label = 'backup') {
    const file = path.join(this.directory, `${label}-${Date.now()}-${randomUUID()}.json`);
    try {
      await copyFile(this.file, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return file;
  }
  flush(): Promise<boolean> {
    this.queue = this.queue.then(async () => {
      if (!this.dirty) return !this.error && !this.readError;
      if (this.readError) {
        this.error = this.readError;
        return false;
      }
      const revision = this.revision;
      const payload = JSON.stringify({
        schemaVersion: 1,
        revision,
        values: Object.fromEntries(this.values),
        receipts: this.receipts,
        migration: this.migration,
      });
      const temp = path.join(this.directory, `.snapshot-${randomUUID()}.tmp`);
      try {
        const handle = await open(temp, 'w', 0o600);
        try {
          await handle.writeFile(payload);
          await handle.sync();
        } finally {
          await handle.close();
        }
        JSON.parse(await readFile(temp, 'utf8'));
        try {
          const previous = JSON.parse(await readFile(this.file, 'utf8'));
          if (record(previous) && record(previous.values)) {
            const oldValues = previous.values;
            const checked = validateLegacy(
              collectLegacy({
                getItem: (key: string) =>
                  typeof oldValues[key] === 'string' ? oldValues[key] : null,
                length: 0,
              }),
            );
            if (!checked.layoutWarning) await copyFile(this.file, `${this.file}.bak`);
          }
        } catch {}
        await rename(temp, this.file);
        if ((await readFile(this.file, 'utf8')) !== payload) throw Error('readback');
        this.error = '';
        if (this.revision === revision) this.dirty = false;
        return true;
      } catch {
        this.error = '修改在当前窗口生效，但本机保存失败；请保留窗口并重试。';
        return false;
      }
    });
    return this.queue;
  }
}
