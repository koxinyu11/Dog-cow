import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, rename, lstat, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { prepareInstall, executeInstall, acknowledgeInstall, recoverInstallJobs, cancelInstall, backupProfile, hasOtherTargetProcesses } from '../../dist-electron/src/main/update-helper.js';
const run = promisify(execFile);
const mac = { skip: process.platform !== 'darwin' };
async function fixture(action) {
  const root = await mkdtemp(path.join(await realpath(os.tmpdir()), 'dogcow-install-test-'));
  try {
    const code = path.join(root, 'main.c');
    await writeFile(code, 'int main(void) { return 0; }\n');
    const binary = path.join(root, 'binary');
    await run('/usr/bin/clang', [code, '-o', binary]);
    async function application(directory, version) {
      await mkdir(path.join(directory, 'Contents/MacOS'), { recursive: true });
      const { copyFile } = await import('node:fs/promises');
      await copyFile(binary, path.join(directory, 'Contents/MacOS/狗牛'));
      await writeFile(path.join(directory, 'Contents/Info.plist'), `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>app.dogcow.desktop</string><key>CFBundleShortVersionString</key><string>${version}</string><key>CFBundleExecutable</key><string>狗牛</string></dict></plist>`);
      await run('/usr/bin/codesign', ['--force', '--sign', '-', directory]);
      return directory;
    }
    const target = await application(path.join(root, '狗牛.app'), '3.0.16');
    const source = await application(path.join(root, '新版 with spaces.app'), '3.0.17');
    const jobs = path.join(root, 'jobs');
    const prepare = () => prepareInstall({ source, target, version: '3.0.17', arch: process.arch, jobs });
    await action({ root, target, source, jobs, prepare });
  } finally { await rm(root, { recursive: true, force: true }); }
}
const status = async job => JSON.parse(await readFile(path.join(job.directory, 'status.json'), 'utf8'));
test('isolated install replaces app, confirms launch, preserves data and retains old app', mac, () => fixture(async ({ root, target, prepare }) => {
  const profile = path.join(root, 'profile');
  await mkdir(path.join(profile, 'updates'), { recursive: true });
  await writeFile(path.join(profile, 'snapshot.json'), '{"user":"retained"}');
  await writeFile(path.join(profile, 'updates/package.dmg'), 'not copied');
  const job = await prepare();
  await backupProfile(profile, path.join(job.directory, 'data-backup'));
  await assert.rejects(lstat(path.join(job.directory, 'data-backup/updates')));
  await executeInstall(job.directory, { launch: async () => acknowledgeInstall(job.directory, target, '3.0.17') });
  assert.equal((await status(job)).phase, 'completed');
  assert.match(await readFile(path.join(target, 'Contents/Info.plist'), 'utf8'), /3.0.17/);
  assert.match(await readFile(path.join(job.backup, 'Contents/Info.plist'), 'utf8'), /3.0.16/);
  assert.equal(await readFile(path.join(profile, 'snapshot.json'), 'utf8'), '{"user":"retained"}');
  await assert.rejects(executeInstall(job.directory), /EEXIST/);
}));
test('replacement failure restores previous app without launching candidate', mac, () => fixture(async ({ target, prepare }) => {
  const job = await prepare(); let launched = false;
  await assert.rejects(executeInstall(job.directory, {
    move: async (from, to) => { if (from === job.stage) throw Object.assign(Error('disk'), { code: 'ENOSPC' }); await rename(from, to); },
    launch: async () => { launched = true; },
  }), error => error.code === 'UPDATE_RESTORED');
  assert.equal(launched, false);
  assert.match(await readFile(path.join(target, 'Contents/Info.plist'), 'utf8'), /3.0.16/);
}));
test('running target and cancelled job never replace an app', mac, () => fixture(async ({ target, prepare }) => {
  const job = await prepare();
  await assert.rejects(executeInstall(job.directory, { running: async () => true }), error => error.code === 'UPDATE_RUNNING');
  const cancelled = await prepare(); await cancelInstall(cancelled);
  await assert.rejects(executeInstall(cancelled.directory));
  assert.match(await readFile(path.join(target, 'Contents/Info.plist'), 'utf8'), /3.0.16/);
}));
test('unconfirmed launch retains new app, previous app and diagnostics without data rollback', mac, () => fixture(async ({ target, prepare }) => {
  const job = await prepare();
  await assert.rejects(executeInstall(job.directory, { launch: async () => {}, wait: async () => {}, attempts: 1 }), error => error.code === 'UPDATE_LAUNCH_UNCONFIRMED');
  assert.equal((await status(job)).code, 'UPDATE_LAUNCH_UNCONFIRMED');
  assert.match(await readFile(path.join(target, 'Contents/Info.plist'), 'utf8'), /3.0.17/);
  assert.ok(await lstat(job.backup));
}));
test('rename-gap recovery restores only a missing target; symlink targets and version mismatch are rejected', mac, () => fixture(async ({ root, target, source, jobs, prepare }) => {
  const job = await prepare();
  await rename(target, job.backup);
  await writeFile(path.join(job.directory, 'status.json'), JSON.stringify({ phase: 'replacing' }));
  assert.equal((await recoverInstallJobs(jobs)).code, 'UPDATE_RESTORED');
  assert.match(await readFile(path.join(target, 'Contents/Info.plist'), 'utf8'), /3.0.16/);
  await assert.rejects(prepareInstall({ source, target, jobs, version: '9.0.0', arch: process.arch }), error => error.code === 'UPDATE_PACKAGE_INVALID');
  await mkdir(path.join(root, 'alias'));
  const alias = path.join(root, 'alias/狗牛.app'); await symlink(target, alias);
  await assert.rejects(prepareInstall({ source, target: alias, jobs, version: '3.0.17', arch: process.arch }), error => error.code === 'UPDATE_TARGET_INVALID');
}));


test('process checks exclude only this helper PID while retaining other app and framework processes', () => {
  const target = '/tmp/含空格 test/狗牛.app';
  const helper = `  123 ${target}/Contents/MacOS/狗牛`;
  assert.equal(hasOtherTargetProcesses(helper, target, 123), false);
  assert.equal(hasOtherTargetProcesses(helper, target, 456), true);
  assert.equal(hasOtherTargetProcesses(`${helper}\n 456 ${target}/Contents/MacOS/狗牛`, target, 123), true);
  assert.equal(hasOtherTargetProcesses(`${helper}\n 789 ${target}/Contents/Frameworks/狗牛 Helper.app/Contents/MacOS/狗牛 Helper`, target, 123), true);
  assert.equal(hasOtherTargetProcesses(`${helper}\n 456 /tmp/another/狗牛.app/Contents/MacOS/狗牛`, target, 123), false);
  assert.equal(hasOtherTargetProcesses(`456 ${target}.backup/Contents/MacOS/狗牛`, target, 123), false);
});


test('profile backup works inside updates and excludes that entire subtree without changing source data', async () => {
  const root = await mkdtemp(path.join(await realpath(os.tmpdir()), 'dogcow-nested-backup-'));
  try {
    const profile = path.join(root, '含空格 profile');
    const destination = path.join(profile, 'updates/install-job-fixture/data-backup');
    await mkdir(path.join(profile, 'data'), { recursive: true });
    await mkdir(path.join(profile, 'updates'), { recursive: true });
    await writeFile(path.join(profile, 'data/snapshot.json'), '{"revision":7}');
    await writeFile(path.join(profile, 'window-state.json'), '{"mode":"full"}');
    await writeFile(path.join(profile, 'updates/package.dmg'), 'exclude installer');
    await backupProfile(profile, destination);
    assert.equal(await readFile(path.join(destination, 'data/snapshot.json'), 'utf8'), '{"revision":7}');
    assert.equal(await readFile(path.join(destination, 'window-state.json'), 'utf8'), '{"mode":"full"}');
    await assert.rejects(lstat(path.join(destination, 'updates')), { code: 'ENOENT' });
    assert.equal(await readFile(path.join(profile, 'data/snapshot.json'), 'utf8'), '{"revision":7}');
    assert.equal(await readFile(path.join(profile, 'updates/package.dmg'), 'utf8'), 'exclude installer');
    assert.equal((await lstat(destination)).mode & 0o077, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
