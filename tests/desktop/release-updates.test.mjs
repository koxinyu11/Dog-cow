import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ReleaseUpdater, selectRelease, newerVersion } from '../../dist-electron/src/main/release-updates.js';
import { nextReleaseVersion } from '../../scripts/release-version.mjs';
const content = Buffer.from('test installer bytes');
const sha = createHash('sha256').update(content).digest('hex');
const asset = { name: 'DogCow-arm64-3.0.1.dmg', size: content.length, digest: `sha256:${sha}`,
  browser_download_url: 'https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.1/DogCow-arm64-3.0.1.dmg' };
const release = (a = asset) => ({ tag_name: 'v3.0.1', draft: false, prerelease: false, assets: [a] });
const metadata = (value = release()) => new Response(JSON.stringify(value));
async function fixture(fn) {
  const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-update-test-'));
  const options = { directory, current: '3.0.0', platform: 'darwin', arch: 'arm64', changed() {}, wait: async () => {} };
  try { await fn(options); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('version allocation is monotonic without source version commits', () => {
  assert.equal(nextReleaseVersion('3.0.0', ['v3.0.0', 'v3.0.1', 'v3.1.0-beta.1']), '3.0.2');
  assert.equal(nextReleaseVersion('4.0.0', ['v3.0.9']), '4.0.0');
  assert.equal(nextReleaseVersion('3.0.0', []), '3.0.0');
  assert.equal(newerVersion('v3.0.10', '3.0.9'), true);
  for (const version of ['3.0.0', '2.9.0', '3.1.0-beta.1', '03.1.0', 'invalid']) assert.equal(newerVersion(version, '3.0.0'), false);
});

test('release selection rejects drafts, prereleases, wrong architecture and untrusted artifacts', () => {
  assert.equal(selectRelease(release(), '3.0.1', 'darwin', 'arm64'), null);
  assert.equal(selectRelease(release(), '3.0.0', 'darwin', 'arm64').version, '3.0.1');
  assert.throws(() => selectRelease({ ...release(), prerelease: true }, '3.0.0', 'darwin', 'arm64'));
  assert.throws(() => selectRelease({ ...release(), draft: true }, '3.0.0', 'darwin', 'arm64'));
  assert.throws(() => selectRelease(release(), '3.0.0', 'darwin', 'x64'));
  for (const change of [{ browser_download_url: 'https://evil.test/app.dmg' }, { digest: '' }, { size: 2 ** 40 }]) {
    assert.throws(() => selectRelease(release({ ...asset, ...change }), '3.0.0', 'darwin', 'arm64'));
  }
});

test('one concurrent job downloads, verifies and exposes a manual installer; cache survives restart', async () => fixture(async (options) => {
  let downloads = 0;
  const fetch = async (url) => url.includes('/releases/latest') ? metadata() : (downloads++, new Response(content));
  const updater = new ReleaseUpdater({ ...options, fetch });
  await Promise.all([updater.check(), updater.check(), updater.check()]);
  assert.equal(downloads, 1);
  assert.equal(updater.state.status, 'ready');
  assert.equal(updater.state.progress, 100);
  assert.deepEqual(await readFile(await updater.installer()), content);
  const restart = new ReleaseUpdater({ ...options, fetch });
  await restart.check();
  assert.equal(restart.state.status, 'ready');
  assert.equal(downloads, 1);
  await writeFile(await updater.installer(), 'changed bytes');
  await assert.rejects(() => updater.installer(), /安装包丢失或已变化/);
}));

test('corrupt or oversized downloads never become ready; retry recovers and removes partial files', async () => fixture(async (options) => {
  let valid = false;
  const updater = new ReleaseUpdater({ ...options, fetch: async (url) => url.includes('/releases/latest') ? metadata() : new Response(valid ? content : Buffer.alloc(content.length + 1)) });
  await updater.check();
  assert.equal(updater.state.status, 'error');
  assert.deepEqual((await readdir(options.directory)).filter(name => !name.startsWith('update-diagnostics')), []);
  valid = true;
  await updater.check();
  assert.equal(updater.state.status, 'ready');
}));

test('hash mismatch and untrusted redirects are rejected; no installer is exposed', async () => fixture(async (options) => {
  for (const response of [() => new Response(Buffer.alloc(content.length)), () => new Response(null, { status: 302, headers: { location: 'https://evil.test/update' } })]) {
    const updater = new ReleaseUpdater({ ...options, fetch: async (url) => url.includes('/releases/latest') ? metadata() : response() });
    await updater.check();
    assert.equal(updater.state.status, 'error');
    await assert.rejects(() => updater.installer());
    assert.deepEqual((await readdir(options.directory)).filter(name => !name.startsWith('update-diagnostics')), []);
  }
}));

test('trusted GitHub asset redirects work, and missing or rate-limited latest release is handled', async () => fixture(async (options) => {
  const updater = new ReleaseUpdater({ ...options, fetch: async (url) => url.includes('/releases/latest') ? metadata()
    : url.startsWith('https://github.com/') ? new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/test' } }) : new Response(content) });
  await updater.check(); assert.equal(updater.state.status, 'ready');
  const missing = new ReleaseUpdater({ ...options, fetch: async () => new Response(null, { status: 404 }) });
  await missing.check(); assert.equal(missing.state.status, 'current');
  const limited = new ReleaseUpdater({ ...options, fetch: async () => new Response(null, { status: 429 }) });
  await limited.check(); assert.equal(limited.state.status, 'error');
  assert.match(limited.state.message, /受限/);
}));


test('interrupted body cleanup still closes the file and removes partial data; retry works', async () => fixture(async (options) => {
  let interrupted = true;
  const updater = new ReleaseUpdater({ ...options, fetch: async (url) => {
    if (url.includes('/releases/latest')) return metadata();
    if (!interrupted) return new Response(content);
    let calls = 0;
    return new Response(new ReadableStream({ pull(controller) {
      if (calls++ === 0) controller.enqueue(content.subarray(0, 4));
      else controller.error(Error('simulated connection loss'));
    } }));
  } });
  await updater.check();
  assert.equal(updater.state.status, 'error');
  assert.deepEqual((await readdir(options.directory)).filter(name => !name.startsWith('update-diagnostics')), []);
  interrupted = false;
  await updater.check();
  assert.equal(updater.state.status, 'ready');
}));

test('native transport failures report the failed phase and a diagnostic reference', async () => fixture(async options => {
  const updater = new ReleaseUpdater({ ...options, fetch: async url => {
    if (url.includes('/releases/latest')) return metadata();
    throw Error('Redirect was cancelled');
  } });
  await updater.check();
  assert.equal(updater.state.status, 'error');
  assert.equal(updater.state.errorCode, 'UPDATE_DOWNLOAD_FAILED');
  assert.match(updater.state.message, /更新连接中断/);
  assert.ok(updater.state.correlationId);
  assert.deepEqual((await readdir(options.directory)).filter(name => !name.startsWith('update-diagnostics')), []);
}));

test('transient failures retry twice with diagnostic correlation and then recover', async () => fixture(async options => {
  let calls = 0;
  const waits = [];
  const updater = new ReleaseUpdater({ ...options, wait: async ms => { waits.push(ms); }, fetch: async url => {
    if (!url.includes('/releases/latest')) return new Response(content);
    if (++calls < 3) throw new TypeError('fetch failed https://secret.invalid/?token=private');
    return metadata();
  } });
  await updater.check();
  assert.equal(updater.state.status, 'ready');
  assert.deepEqual(waits, [1000, 2000]);
  const log = await readFile(path.join(options.directory, 'update-diagnostics.jsonl'), 'utf8');
  assert.equal(log.includes('private'), false);
  const entries = log.trim().split('\n').map(JSON.parse);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].correlationId, entries[1].correlationId);
}));
test('rate limit observes Retry-After and long waits stop without immediate retries', async () => fixture(async options => {
  for (const seconds of [3, 120]) {
    let calls = 0;
    const waits = [];
    const updater = new ReleaseUpdater({ ...options, wait: async ms => waits.push(ms), fetch: async () => {
      calls++;
      return new Response(null, { status: 429, headers: { 'retry-after': String(seconds) } });
    } });
    await updater.check();
    assert.equal(updater.state.errorCode, 'UPDATE_RATE_LIMITED');
    assert.equal(calls, seconds === 3 ? 3 : 1);
    assert.deepEqual(waits, seconds === 3 ? [3000, 3000] : []);
  }
}));
test('integrity and disk errors do not automatically retry', async () => fixture(async options => {
  let downloads = 0;
  const updater = new ReleaseUpdater({ ...options, fetch: async url => url.includes('/releases/latest') ? metadata() : (downloads++, new Response(Buffer.alloc(content.length))) });
  await updater.check();
  assert.equal(downloads, 1);
  assert.equal(updater.state.errorCode, 'UPDATE_INTEGRITY_FAILED');
  const blocked = path.join(options.directory, 'not-a-directory');
  await writeFile(blocked, 'x');
  const disk = new ReleaseUpdater({ ...options, directory: path.join(blocked, 'updates'), fetch: async () => metadata() });
  await disk.check();
  assert.equal(disk.state.status, 'error');
}));
test('deleted installer leaves ready state and can be downloaded again', async () => fixture(async options => {
  const updater = new ReleaseUpdater({ ...options, fetch: async url => url.includes('/releases/latest') ? metadata() : new Response(content) });
  await updater.check();
  await rm(await updater.installer());
  await assert.rejects(updater.installer());
  assert.equal(updater.state.status, 'error');
  assert.equal(updater.state.errorCode, 'UPDATE_INSTALLER_INVALID');
  await updater.check();
  assert.equal(updater.state.status, 'ready');
  await assert.rejects(updater.openInstaller(async () => 'OS failure'));
  assert.equal(updater.state.errorCode, 'UPDATE_OPEN_FAILED');
  assert.equal(updater.state.status, 'ready');
}));

test('timeout and 503 exhaust exactly three attempts; disk space and permissions stop immediately', async () => fixture(async options => {
  for (const [failure, expected, count] of [
    [() => { throw new DOMException('timed out', 'TimeoutError'); }, 'UPDATE_TIMEOUT', 3],
    [() => new Response(null, { status: 503 }), 'UPDATE_HTTP_FAILED', 3],
    [() => { throw Object.assign(new Error('disk private path'), { code: 'ENOSPC' }); }, 'UPDATE_DISK_FULL', 1],
    [() => { throw Object.assign(new Error('permission private path'), { code: 'EACCES' }); }, 'UPDATE_DISK_PERMISSION', 1],
  ]) {
    let calls = 0;
    const updater = new ReleaseUpdater({ ...options, fetch: async () => { calls++; return failure(); } });
    await updater.check();
    assert.equal(updater.state.errorCode, expected);
    assert.equal(calls, count);
  }
}));
test('diagnostic rotation stays bounded and keeps only one previous file', async () => fixture(async options => {
  const file = path.join(options.directory, 'update-diagnostics.jsonl');
  await writeFile(file, 'x'.repeat(256 * 1024));
  const updater = new ReleaseUpdater({ ...options, fetch: async () => new Response(null, { status: 429 }) });
  await updater.check();
  assert.equal((await readFile(`${file}.1`)).length, 256 * 1024);
  const entry = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(entry.errorCode, 'UPDATE_RATE_LIMITED');
  assert.equal(entry.correlationId, updater.state.correlationId);
}));
