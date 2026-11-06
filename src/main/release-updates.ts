import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, open, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { UpdateState } from '../shared/contracts.js';

export const RELEASE_API = 'https://api.github.com/repos/koxinyu11/Dog-cow/releases/latest';
// Electron's default User-Agent includes the Chinese app name, which the asset server rejects.
const UPDATE_USER_AGENT = 'DogCow-desktop';
class UpdateError extends Error {
  constructor(message: string, readonly code?: string, readonly retryable = false, readonly httpStatus?: number, readonly retryAfterMs?: number) { super(message); }
}
const MAX_PACKAGE = 2 * 1024 ** 3;
export function versionParts(value: string): number[] | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
export function newerVersion(candidate: string, current: string): boolean {
  const a = versionParts(candidate), b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
export interface ReleaseAsset { name: string; browser_download_url: string; size: number; digest: string }
export function selectRelease(raw: unknown, current: string, platform: string, arch: string): { version: string; asset: ReleaseAsset } | null {
  const data = raw as Record<string, unknown> | null;
  if (!data || data.draft !== false || data.prerelease !== false || typeof data.tag_name !== 'string' || !versionParts(data.tag_name)) throw new UpdateError('最新版本信息无效。');
  if (!newerVersion(data.tag_name, current)) return null;
  const version = data.tag_name.replace(/^v/, '');
  const name = platform === 'darwin' && ['arm64', 'x64'].includes(arch) ? `DogCow-${arch}-${version}.dmg`
    : platform === 'win32' && arch === 'x64' ? `DogCow-win32-x64-${version}-setup.exe` : '';
  const asset = Array.isArray(data.assets) ? data.assets.find((a) => a?.name === name) as ReleaseAsset | undefined : undefined;
  if (!name || !asset) throw new UpdateError('最新版本暂无适合此系统和架构的安装包。');
  const url = new URL(asset.browser_download_url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.search || url.hash || url.pathname !== `/koxinyu11/Dog-cow/releases/download/${data.tag_name}/${name}`
    || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_PACKAGE || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) throw new UpdateError('安装包来源或校验信息无效。');
  return { version, asset };
}

export class ReleaseUpdater {
  state: UpdateState = { status: 'idle', version: '', progress: 0, message: '自动检查并下载最新正式版，安装需手动完成。' };
  private job: Promise<void> | null = null;
  private phase: 'check' | 'download' | 'verify' | 'open' = 'check';
  private attempt = 0;
  private received = 0;
  private correlationId = '';
  private logQueue: Promise<void> = Promise.resolve();
  private downloaded: { file: string; digest: string } | null = null;
  constructor(private options: { current: string; platform: string; arch: string; directory: string; fetch: typeof fetch; changed: () => void; wait?: (ms: number) => Promise<void>; now?: () => number }) {}
  private set(patch: Partial<UpdateState>) { this.state = { ...this.state, ...patch }; this.options.changed(); }
  check(): Promise<void> {
    if (this.job) return this.job;
    this.correlationId = randomUUID();
    this.job = this.runWithRetry().finally(() => { this.job = null; });
    return this.job;
  }
  private classify(error: unknown): UpdateError {
    if (error instanceof UpdateError) return error;
    const raw = error as { name?: string; code?: string; cause?: { code?: string }; message?: string };
    const code = raw?.code ?? raw?.cause?.code;
    if (code === 'ENOSPC') return new UpdateError('磁盘空间不足，请清理空间后重试。', 'UPDATE_DISK_FULL');
    if (['EACCES', 'EPERM', 'EROFS'].includes(code ?? '')) return new UpdateError('无法写入更新目录，请检查文件权限。', 'UPDATE_DISK_PERMISSION');
    if (raw?.name === 'TimeoutError' || raw?.name === 'AbortError') return new UpdateError('更新请求超时，请检查网络后重试。', 'UPDATE_TIMEOUT', true);
    const network = this.phase === 'check' || this.phase === 'download';
    if (network && (raw?.name === 'TypeError' || /^(ECONN|ENET|EHOST|EAI_|ETIMEDOUT|UND_ERR)/.test(code ?? '') || /net::ERR_|connection|network|fetch failed|Redirect was cancelled/i.test(raw?.message ?? ''))) {
      return new UpdateError('更新连接中断，请检查网络后重试。', `UPDATE_${this.phase.toUpperCase()}_FAILED`, true);
    }
    return new UpdateError(this.phase === 'open' ? '安装包无法打开，请重新下载或使用官方下载页。' : '更新处理失败，请重试或使用官方下载页。', `UPDATE_${this.phase.toUpperCase()}_FAILED`);
  }
  private async diagnostic(error: unknown, failure: UpdateError, retrying: boolean) {
    const raw = error as { name?: string; code?: string; cause?: { code?: string }; message?: string };
    // Keep only allowlisted error tokens, never raw paths, URLs or signed query strings.
    const cause = `${raw?.code ?? raw?.cause?.code ?? ''} ${raw?.message ?? ''}`.match(/(?:net::ERR_[A-Z_]+|\bE[A-Z_]{2,30}\b|UND_ERR_[A-Z_]+)/)?.[0];
    const line = JSON.stringify({ time: new Date().toISOString(), operation: 'update', stage: this.phase,
      errorCode: failure.code ?? `UPDATE_${this.phase.toUpperCase()}_FAILED`, correlationId: this.correlationId,
      attempt: this.attempt, received: this.received, httpStatus: failure.httpStatus, cause: cause ?? raw?.name ?? 'unknown', retrying });
    console.warn(line);
    this.logQueue = this.logQueue.then(async () => {
      await mkdir(this.options.directory, { recursive: true });
      const file = path.join(this.options.directory, 'update-diagnostics.jsonl');
      const size = await stat(file).then(value => value.size, () => 0);
      if (size >= 256 * 1024) {
        await rm(`${file}.1`, { force: true });
        await rename(file, `${file}.1`);
      }
      await appendFile(file, `${line}\n`, { mode: 0o600 });
    }).catch(() => { console.warn('[update] diagnostic file unavailable'); });
    await this.logQueue;
  }
  private async runWithRetry() {
    for (this.attempt = 1; this.attempt <= 3; this.attempt++) {
      try { await this.run(); return; }
      catch (error) {
        const failure = this.classify(error);
        const retrying = failure.retryable && this.attempt < 3 && (failure.retryAfterMs ?? 0) <= 30000;
        await this.diagnostic(error, failure, retrying);
        if (!retrying) {
          this.set({ status: 'error', errorCode: failure.code ?? `UPDATE_${this.phase.toUpperCase()}_FAILED`, correlationId: this.correlationId, message: failure.message });
          return;
        }
        this.set({ message: `连接暂时失败，等待后自动重试（${this.attempt}/2）…` });
        await (this.options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(Math.max(1000 * 2 ** (this.attempt - 1), failure.retryAfterMs ?? 0));
      }
    }
  }
  private httpError(response: Response): UpdateError {
    const limited = response.status === 403 || response.status === 429;
    const retry = response.headers.get('retry-after');
    const now = this.options.now?.() ?? Date.now();
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    const delay = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - now)
      : limited && reset > now ? reset - now : limited ? Infinity : 0;
    return new UpdateError(limited ? '更新请求受限，请稍后重试。' : `更新服务暂不可用（HTTP ${response.status}），请稍后重试。`,
      limited ? 'UPDATE_RATE_LIMITED' : 'UPDATE_HTTP_FAILED', limited || response.status >= 500, response.status, Number.isNaN(delay) ? Infinity : Math.max(0, delay));
  }
  private async run() {
    this.phase = 'check';
    this.received = 0;
    this.set({ status: 'checking', version: '', errorCode: undefined, correlationId: undefined, progress: 0, message: '正在检查最新正式版…' });
    const response = await this.options.fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': UPDATE_USER_AGENT }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (response.status === 404) { this.set({ status: 'current', message: '暂无正式版更新。' }); return; }
    if (!response.ok) { await response.body?.cancel(); throw this.httpError(response); }
    const metadataReader = response.body?.getReader();
    if (!metadataReader) throw new UpdateError('版本信息为空。');
    let bytes = 0;
    const parts: Uint8Array[] = [];
    try {
      for (;;) {
        const next = await metadataReader.read(); if (next.done) break;
        bytes += next.value.length;
        if (bytes > 1024 ** 2) throw new UpdateError('版本信息过大。');
        parts.push(next.value);
      }
    } finally { await metadataReader.cancel().catch(() => {}); }
    const release = selectRelease(JSON.parse(Buffer.concat(parts).toString('utf8')), this.options.current, this.options.platform, this.options.arch);
    if (!release) { this.set({ status: 'current', version: '', message: '当前已是最新正式版。' }); return; }
    await mkdir(this.options.directory, { recursive: true });
    const target = path.join(this.options.directory, release.asset.name);
    this.downloaded = { file: target, digest: release.asset.digest.slice(7) };
    try {
      await this.validateInstaller();
      this.set({ status: 'ready', version: release.version, progress: 100, message: '安装包已就绪，请手动安装。' });
      return;
    } catch { this.downloaded = null; }
    this.phase = 'download';
    this.set({ status: 'downloading', version: release.version, message: '正在下载更新…' });
    const temporary = `${target}.part`;
    const file = await open(temporary, 'w');
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      let url = release.asset.browser_download_url;
      let download: Response | undefined;
      for (let hop = 0; hop < 6; hop++) {
        download = await this.options.fetch(url, { headers: { 'User-Agent': UPDATE_USER_AGENT }, signal: AbortSignal.timeout(15 * 60 * 1000), redirect: 'manual' });
        if (![301, 302, 303, 307, 308].includes(download.status)) break;
        const location = download.headers.get('location');
        await download.body?.cancel();
        if (!location) throw new UpdateError('安装包下载跳转无效。');
        const next = new URL(location, url);
        if (next.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(next.hostname) || next.username || next.password) throw new UpdateError('安装包下载来源不受信任。');
        url = next.href;
      }
      if (!download?.ok) { await download?.body?.cancel(); if (download) throw this.httpError(download); throw new UpdateError('下载响应为空。'); }
      if (!download.body) throw new UpdateError('下载内容为空。');
      reader = download.body.getReader();
      const hash = createHash('sha256');
      let received = 0, lastProgress = -1;
      for (;;) {
        const next = await reader.read(); if (next.done) break;
        received += next.value.length;
        this.received = received;
        if (received > release.asset.size || received > MAX_PACKAGE) throw new UpdateError('安装包大小不符，请重新下载。', 'UPDATE_INTEGRITY_FAILED');
        hash.update(next.value);
        await file.writeFile(next.value);
        const progress = Math.floor(received / release.asset.size * 100);
        if (progress !== lastProgress) { lastProgress = progress; this.set({ progress }); }
      }
      this.phase = 'verify';
      if (received !== release.asset.size || hash.digest('hex') !== release.asset.digest.slice(7)) throw new UpdateError('安装包校验失败，请重新下载。', 'UPDATE_INTEGRITY_FAILED');
      await file.close();
      await rename(temporary, target);
      this.downloaded = { file: target, digest: release.asset.digest.slice(7) };
      this.set({ status: 'ready', progress: 100, message: '安装包已就绪，请手动安装。' });
    } finally {
      await reader?.cancel().catch(() => {});
      await file.close().catch(() => {});
      await rm(temporary, { force: true });
    }
  }
  async installer(): Promise<string> {
    try { return await this.validateInstaller(); }
    catch (error) {
      this.phase = 'open';
      this.correlationId = randomUUID();
      this.downloaded = null;
      const failure = new UpdateError('安装包丢失或已变化，请重新下载。', 'UPDATE_INSTALLER_INVALID');
      await this.diagnostic(error, failure, false);
      this.set({ status: 'error', progress: 0, errorCode: failure.code, correlationId: this.correlationId, message: failure.message });
      throw failure;
    }
  }
  async openInstaller(openPath: (file: string) => Promise<string>): Promise<void> {
    const file = await this.installer();
    try {
      const message = await openPath(file);
      if (message) throw new UpdateError('无法打开安装包，请重试或使用官方下载页。', 'UPDATE_OPEN_FAILED');
    } catch (error) {
      this.phase = 'open';
      this.correlationId = randomUUID();
      const failure = this.classify(error);
      await this.diagnostic(error, failure, false);
      this.set({ errorCode: failure.code, correlationId: this.correlationId, message: failure.message });
      throw failure;
    }
  }
  private async validateInstaller(): Promise<string> {
    if (!this.downloaded) throw new UpdateError('请先下载最新安装包。');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(this.downloaded.file)) hash.update(chunk);
    const digest = hash.digest('hex');
    if (digest !== this.downloaded.digest) throw new UpdateError('安装包已变化，请重新检查更新。');
    return this.downloaded.file;
  }
}
