import { appendFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { diagnosticText, errorDetails, parseDiagnosticReport, validDiagnosticId, type ErrorDetail, type DiagnosticContext, type DiagnosticReceipt, type DiagnosticView, type PlaygroundDiagnostic } from '../shared/playground-diagnostics.js';
const LIMIT = 256 * 1024;
const MEMORY_LIMIT = 100;
function storedEntry(value: unknown): PlaygroundDiagnostic | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  const report = parseDiagnosticReport(v);
  if (!report || typeof v.time !== 'string' || !validDiagnosticId(v.sessionId) || typeof v.buildId !== 'string' || typeof v.version !== 'string') return;
  return { ...report, time: diagnosticText(v.time, 40), sessionId: v.sessionId, version: diagnosticText(v.version, 80), buildId: diagnosticText(v.buildId, 80),
    errorCode: report.gameId ? 'GAME_FAILED' : `PLAYGROUND_${report.stage.toUpperCase()}_FAILED`, platform: String(v.platform).slice(0, 30), arch: String(v.arch).slice(0, 30) };
}
/** Independent bounded queue: diagnostic disk failures cannot block business commands. */
export class PlaygroundDiagnostics {
  private entries: PlaygroundDiagnostic[] = [];
  private pending = new Map<string, Promise<DiagnosticReceipt>>();
  private persisted = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();
  private warning = '';
  private storageError?: ErrorDetail[];
  constructor(private directory: string) {}
  private get file() { return path.join(this.directory, 'playground-diagnostics.jsonl'); }
  async load() {
    for (const file of [`${this.file}.1`, this.file]) {
      try {
        if ((await stat(file)).size > LIMIT + 64 * 1024) { this.warning = '诊断日志超出读取上限，已跳过。'; continue; }
        for (const line of (await readFile(file, 'utf8')).split('\n').filter(Boolean)) {
          try {
            const entry = storedEntry(JSON.parse(line));
            if (!entry) continue;
            this.entries.push(entry);
            this.persisted.add(entry.correlationId);
          } catch { this.warning = '部分诊断记录无法读取，其余记录仍可查看。'; }
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { this.warning = '历史诊断无法读取，当前会话仍可查看。'; this.storageError = errorDetails(error); } }
    }
    this.trim();
  }
  record(value: unknown, context: DiagnosticContext): Promise<DiagnosticReceipt> {
    const report = parseDiagnosticReport(value);
    if (!report || Buffer.byteLength(JSON.stringify(report), 'utf8') > 24000) return Promise.reject(Error('诊断参数无效或超出大小上限。'));
    const existing = this.pending.get(report.correlationId);
    if (existing) return existing;
    const retained = this.entries.find(entry => entry.correlationId === report.correlationId);
    if (retained && this.persisted.has(report.correlationId)) return Promise.resolve({ correlationId: report.correlationId, persisted: true });
    if (this.pending.size >= 50) return Promise.reject(Error('诊断写入繁忙，当前页面保留记录。'));
    const entry: PlaygroundDiagnostic = retained ?? { ...report, ...context, errorCode: report.gameId ? 'GAME_FAILED' : `PLAYGROUND_${report.stage.toUpperCase()}_FAILED`, time: new Date().toISOString(), platform: process.platform, arch: process.arch };
    if (!retained) { this.entries.push(entry); this.trim(); console.error(JSON.stringify(entry)); }
    const job = this.queue.then(async () => {
      try {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const size = await stat(this.file).then(v => v.size, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return 0; throw error; });
        if (size >= LIMIT) { await rm(`${this.file}.1`, { force: true }); await rename(this.file, `${this.file}.1`); }
        await appendFile(this.file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
        this.persisted.add(entry.correlationId); this.warning = ''; this.storageError = undefined;
        return { correlationId: entry.correlationId, persisted: true };
      } catch (error) {
        this.storageError = errorDetails(error);
        console.error(JSON.stringify({ operation: 'playgroundDiagnostics', stage: 'persistence', errorCode: 'PLAYGROUND_DIAGNOSTIC_WRITE_FAILED', correlationId: entry.correlationId, errors: this.storageError }));
        this.warning = '诊断未能写入磁盘，当前会话记录仍可复制；退出应用后可能丢失。';
        return { correlationId: entry.correlationId, persisted: false, warning: this.warning, storageError: this.storageError };
      }
    });
    this.queue = job;
    this.pending.set(entry.correlationId, job);
    void job.finally(() => this.pending.delete(entry.correlationId));
    return job;
  }
  async read(id?: unknown): Promise<DiagnosticView> {
    if (id !== undefined && !validDiagnosticId(id)) throw Error('问题编号无效。');
    await this.queue;
    let matches = id ? this.entries.filter(entry => entry.correlationId === id) : this.entries.slice(-50);
    if (id && !matches.length) {
      for (const file of [this.file, `${this.file}.1`]) {
        try {
          if ((await stat(file)).size > LIMIT + 64 * 1024) continue;
          for (const line of (await readFile(file, 'utf8')).split('\n').filter(Boolean)) {
            try { const entry = storedEntry(JSON.parse(line)); if (entry?.correlationId === id) { matches = [entry]; break; } } catch { /* A truncated record does not erase intact records. */ }
          }
          if (matches.length) break;
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { this.warning = '历史诊断无法读取，当前会话仍可查看。'; this.storageError = errorDetails(error); } }
      }
    }
    const warning = this.warning || (this.entries.some(entry => !this.persisted.has(entry.correlationId)) ? '部分诊断仅保存在当前会话，退出后可能丢失，请先复制。' : '');
    return { entries: structuredClone(matches), ...(warning ? { warning } : {}), ...(this.storageError ? { storageError: structuredClone(this.storageError) } : {}) };
  }
  private trim() {
    this.entries = this.entries.slice(-MEMORY_LIMIT);
    const ids = new Set(this.entries.map(entry => entry.correlationId));
    for (const id of this.persisted) if (!ids.has(id)) this.persisted.delete(id);
  }
}
