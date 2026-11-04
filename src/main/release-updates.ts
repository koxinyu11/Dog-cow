import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { UpdateState } from '../shared/contracts.js';

export const RELEASE_API = 'https://api.github.com/repos/koxinyu11/Dog-cow/releases/latest';
class UpdateError extends Error {}
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
  private downloaded: { file: string; digest: string } | null = null;
  constructor(private options: { current: string; platform: string; arch: string; directory: string; fetch: typeof fetch; changed: () => void }) {}
  private set(patch: Partial<UpdateState>) { this.state = { ...this.state, ...patch }; this.options.changed(); }
  check(): Promise<void> {
    if (this.job) return this.job;
    this.job = this.run().catch((error: unknown) => {
      console.warn('[updates:check-download]', error instanceof Error ? error.message : 'unknown');
      this.set({ status: 'error', message: error instanceof UpdateError ? error.message : '检查或下载更新失败，请稍后重试。' });
    }).finally(() => { this.job = null; });
    return this.job;
  }
  private async run() {
    this.set({ status: 'checking', progress: 0, message: '正在检查最新正式版…' });
    const response = await this.options.fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DogCow-desktop' }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (response.status === 404) { this.set({ status: 'current', message: '暂无正式版更新。' }); return; }
    if (!response.ok) throw new UpdateError(response.status === 403 || response.status === 429 ? '检查更新暂时受限，请稍后重试。' : '无法获取最新版本，请重试。');
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
      await this.installer();
      this.set({ status: 'ready', version: release.version, progress: 100, message: '安装包已就绪，请手动安装。' });
      return;
    } catch { this.downloaded = null; }
    this.set({ status: 'downloading', version: release.version, message: '正在下载更新…' });
    const temporary = `${target}.part`;
    const file = await open(temporary, 'w');
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      let url = release.asset.browser_download_url;
      let download: Response | undefined;
      for (let hop = 0; hop < 6; hop++) {
        download = await this.options.fetch(url, { signal: AbortSignal.timeout(15 * 60 * 1000), redirect: 'manual' });
        if (![301, 302, 303, 307, 308].includes(download.status)) break;
        const location = download.headers.get('location');
        await download.body?.cancel();
        if (!location) throw new UpdateError('安装包下载跳转无效。');
        const next = new URL(location, url);
        if (next.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(next.hostname) || next.username || next.password) throw new UpdateError('安装包下载来源不受信任。');
        url = next.href;
      }
      if (!download?.ok || !download.body) throw new UpdateError('安装包下载失败，请重试。');
      reader = download.body.getReader();
      const hash = createHash('sha256');
      let received = 0, lastProgress = -1;
      for (;;) {
        const next = await reader.read(); if (next.done) break;
        received += next.value.length;
        if (received > release.asset.size || received > MAX_PACKAGE) throw new UpdateError('安装包大小不符。');
        hash.update(next.value);
        await file.writeFile(next.value);
        const progress = Math.floor(received / release.asset.size * 100);
        if (progress !== lastProgress) { lastProgress = progress; this.set({ progress }); }
      }
      if (received !== release.asset.size || hash.digest('hex') !== release.asset.digest.slice(7)) throw new UpdateError('安装包校验失败，请重新下载。');
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
    if (!this.downloaded) throw new UpdateError('请先下载最新安装包。');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(this.downloaded.file)) hash.update(chunk);
    const digest = hash.digest('hex');
    if (digest !== this.downloaded.digest) throw new UpdateError('安装包已变化，请重新检查更新。');
    return this.downloaded.file;
  }
}
