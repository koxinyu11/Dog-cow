import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { closeSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { patchTempSource } from '../../scripts/patch-build-dependencies.mjs';

const require = createRequire(import.meta.url);

test('build compatibility patch is idempotent and refuses unexpected upstream changes', () => {
  const source = readFileSync(require.resolve('temp'), 'utf8');
  assert.equal(patchTempSource(source), source);
  assert.throws(() => patchTempSource(`${source}\n// modified upstream`), /源码与已审阅版本不符/);
});

test('temporary file cleanup preserves callback, promise and synchronous APIs', async () => {
  const temp = require('temp').track();
  const callbackDir = await new Promise((resolve, reject) => temp.mkdir('dogcow-compat-callback-', (error, file) => error ? reject(error) : resolve(file)));
  await writeFile(path.join(callbackDir, 'child.txt'), 'callback cleanup');
  const callbackResult = await new Promise((resolve, reject) => temp.cleanup((error, counts) => error ? reject(error) : resolve(counts)));
  assert.equal(callbackResult.dirs, 1);
  assert.equal(existsSync(callbackDir), false);

  const promiseDir = await temp.mkdir('dogcow-compat-promise-');
  const file = await temp.open('dogcow-compat-file-');
  closeSync(file.fd);
  const promiseResult = await temp.cleanup();
  assert.equal(promiseResult.dirs, 1);
  assert.equal(promiseResult.files, 1);
  assert.equal(existsSync(promiseDir), false);
  assert.equal(existsSync(file.path), false);

  const syncDir = temp.mkdirSync('dogcow-compat-sync-');
  const syncFile = temp.openSync('dogcow-compat-file-sync-');
  closeSync(syncFile.fd);
  assert.deepEqual(temp.cleanupSync(), { files: 1, dirs: 1 });
  assert.equal(existsSync(syncDir), false);
  assert.equal(existsSync(syncFile.path), false);
});

test('packager and Windows installer resolve fixed ASAR and preserve archive matching/extraction', async () => {
  const packagerRequire = createRequire(require.resolve('@electron/packager'));
  const installerRequire = createRequire(require.resolve('electron-winstaller'));
  const asar = packagerRequire('@electron/asar');
  assert.equal(installerRequire.resolve('@electron/asar'), packagerRequire.resolve('@electron/asar'));
  const asarRequire = createRequire(packagerRequire.resolve('@electron/asar'));
  assert.equal(asarRequire('glob/package.json').version, '14.0.3');
  assert.equal(asarRequire('minimatch/package.json').version, '11.0.4');

  const dir = await mkdtemp(path.join(tmpdir(), 'dogcow-asar-'));
  try {
    const input = path.join(dir, 'input');
    const archive = path.join(dir, 'app.asar');
    await mkdir(path.join(input, 'nested'), { recursive: true });
    await writeFile(path.join(input, 'package.json'), JSON.stringify({ name: 'dogcow-archive-test' }));
    await writeFile(path.join(input, 'nested', '中文.txt'), 'archive roundtrip');
    await writeFile(path.join(input, 'nested', 'unpacked.bin'), 'unpacked content');
    if (process.platform !== 'win32') await symlink('中文.txt', path.join(input, 'nested', 'alias.txt'));
    await asar.createPackageWithOptions(input, archive, { unpack: '*.bin' });
    // This is the exact sync API used by electron-winstaller to read app metadata.
    const metadata = JSON.parse(installerRequire('@electron/asar').extractFile(archive, 'package.json').toString());
    assert.equal(metadata.name, 'dogcow-archive-test');
    assert.equal(asar.extractFile(archive, 'nested/中文.txt').toString(), 'archive roundtrip');
    assert.equal(await readFile(`${archive}.unpacked/nested/unpacked.bin`, 'utf8'), 'unpacked content');
    const extracted = path.join(dir, 'extracted');
    asar.extractAll(archive, extracted);
    assert.equal(await readFile(path.join(extracted, 'nested', '中文.txt'), 'utf8'), 'archive roundtrip');
    if (process.platform !== 'win32') assert.equal(await readFile(path.join(extracted, 'nested', 'alias.txt'), 'utf8'), 'archive roundtrip');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
