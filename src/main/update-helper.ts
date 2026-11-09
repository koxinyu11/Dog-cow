/** Standalone installer. Copied outside the app before replacement; Node built-ins only. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile, rename, rm, lstat, realpath, access, open, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const BUNDLE_ID = 'app.dogcow.desktop';
export class InstallError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export interface InstallJob {
  schema: 1; id: string; directory: string; target: string; stage: string; backup: string;
  version: string; arch: string; executable: string; parentPid: number; parentExecutable: string;
  hadTarget: boolean; dataBackup: string;
}
export const INSTALL_MESSAGES: Record<string, string> = {
  UPDATE_DOWNGRADE: '所选安装包版本早于已安装版本，请下载最新正式版。',
  UPDATE_TARGET_INVALID: '安装位置或应用标识不匹配，请将狗牛安装到“应用程序”后重试。',
  UPDATE_PERMISSION: '无法写入应用目录，请使用 DMG 手动安装。',
  UPDATE_PACKAGE_INVALID: '新版应用版本、架构或签名校验失败，请重新下载。',
  UPDATE_RUNNING: '目标狗牛仍在运行，请先正常退出后重试。',
  UPDATE_EXIT_TIMEOUT: '旧版未能及时退出，未替换应用。请正常退出后重试。',
  UPDATE_DISK_FULL: '磁盘空间不足，未完成安装，请清理空间后重试。',
  UPDATE_RESTORE_FAILED: '恢复旧版失败，请保留安装恢复目录并使用 DMG 手动恢复。',
  UPDATE_RESTORED: '替换失败，已恢复旧版。请重试或使用 DMG 手动安装。',
  UPDATE_LAUNCH_UNCONFIRMED: '新版尚未确认启动成功，旧版及数据备份已保留。请检查应用后再重试。',
  UPDATE_INSTALL_FAILED: '安装未完成，恢复材料已保留，请重试或使用 DMG 手动安装。',
};
export function installFailure(error: unknown): InstallError {
  if (error instanceof InstallError) return error;
  const code = (error as NodeJS.ErrnoException)?.code;
  const mapped = code === 'ENOSPC' ? 'UPDATE_DISK_FULL'
    : ['EACCES', 'EPERM', 'EROFS'].includes(code ?? '') ? 'UPDATE_PERMISSION' : 'UPDATE_INSTALL_FAILED';
  return new InstallError(mapped, INSTALL_MESSAGES[mapped]);
}
async function exists(file: string) {
  try { await lstat(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
}
async function plainDirectory(directory: string) {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
    throw new InstallError('UPDATE_TARGET_INVALID', INSTALL_MESSAGES.UPDATE_TARGET_INVALID);
}
async function plist(app: string, key: string) {
  const result = await run('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', path.join(app, 'Contents/Info.plist')]);
  return result.stdout.trim();
}
export async function inspectApplication(application: string) {
  await plainDirectory(application);
  const [id, version, executable] = await Promise.all([
    plist(application, 'CFBundleIdentifier'), plist(application, 'CFBundleShortVersionString'), plist(application, 'CFBundleExecutable'),
  ]);
  if (id !== BUNDLE_ID || !/^\d+\.\d+\.\d+$/.test(version) || !executable || path.basename(executable) !== executable)
    throw new InstallError('UPDATE_PACKAGE_INVALID', INSTALL_MESSAGES.UPDATE_PACKAGE_INVALID);
  const binary = path.join(application, 'Contents/MacOS', executable);
  const binaryInfo = await lstat(binary);
  if (!binaryInfo.isFile() || binaryInfo.isSymbolicLink()) throw new InstallError('UPDATE_PACKAGE_INVALID', INSTALL_MESSAGES.UPDATE_PACKAGE_INVALID);
  return { version, executable, binary };
}
export function hasOtherTargetProcesses(output: string, target: string, helperPid: number): boolean {
  return output.split('\n').some(line => {
    const process = /^\s*(\d+)\s+(.+)$/.exec(line);
    return !!process && Number(process[1]) !== helperPid && process[2].startsWith(`${target}/Contents/`);
  });
}
export async function runningTarget(target: string): Promise<boolean> {
  const { stdout } = await run('/bin/ps', ['-axo', 'pid=,comm=']);
  return hasOtherTargetProcesses(stdout, target, process.pid);
}
export async function validateCandidate(application: string, version: string, arch: string) {
  try {
    const info = await inspectApplication(application);
    if (info.version !== version || !['arm64', 'x64'].includes(arch)) throw Error('version or architecture');
    await run('/usr/bin/lipo', [info.binary, '-verify_arch', arch === 'x64' ? 'x86_64' : arch]);
    await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', application]);
    return info;
  } catch (error) {
    if (error instanceof InstallError) throw error;
    throw new InstallError('UPDATE_PACKAGE_INVALID', INSTALL_MESSAGES.UPDATE_PACKAGE_INVALID);
  }
}
async function journal(job: InstallJob, phase: string, code?: string) {
  const temporary = path.join(job.directory, 'status.tmp');
  await writeFile(temporary, JSON.stringify({ phase, code, id: job.id, time: new Date().toISOString() }), { mode: 0o600 });
  await rename(temporary, path.join(job.directory, 'status.json'));
}
export async function prepareInstall(options: {
  source: string; target: string; version: string; arch: string; jobs: string;
  parentPid?: number; parentExecutable?: string; dataBackup?: string;
}): Promise<InstallJob> {
  const target = path.resolve(options.target);
  if (path.basename(target) !== '狗牛.app') throw new InstallError('UPDATE_TARGET_INVALID', INSTALL_MESSAGES.UPDATE_TARGET_INVALID);
  await plainDirectory(path.dirname(target));
  const hadTarget = await exists(target);
  if (hadTarget) {
    const previous = await inspectApplication(target);
    const oldParts = previous.version.split('.').map(Number), nextParts = options.version.split('.').map(Number);
    const changed = nextParts.findIndex((part, index) => part !== oldParts[index]);
    if (changed >= 0 && nextParts[changed] < oldParts[changed]) throw new InstallError('UPDATE_DOWNGRADE', INSTALL_MESSAGES.UPDATE_DOWNGRADE);
  }
  await access(path.dirname(target), constants.W_OK);
  if (await runningTarget(target) && !options.parentPid) throw new InstallError('UPDATE_RUNNING', INSTALL_MESSAGES.UPDATE_RUNNING);
  const info = await validateCandidate(options.source, options.version, options.arch);
  await mkdir(options.jobs, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(options.jobs, 'install-job-'));
  const id = randomUUID();
  const job: InstallJob = { schema: 1, id, directory, target, version: options.version, arch: options.arch,
    executable: info.executable, hadTarget, stage: path.join(path.dirname(target), `.dogcow-new-${id}.app`),
    backup: path.join(path.dirname(target), `.dogcow-old-${id}.app`), parentPid: options.parentPid ?? 0,
    parentExecutable: options.parentExecutable ?? '', dataBackup: options.dataBackup ?? '' };
  await writeFile(path.join(directory, 'job.json'), JSON.stringify(job), { mode: 0o600 });
  await journal(job, 'preparing');
  try {
    await run('/usr/bin/ditto', [options.source, job.stage]);
    await validateCandidate(job.stage, job.version, job.arch);
    await journal(job, 'prepared');
    return job;
  } catch (error) {
    await rm(job.stage, { recursive: true, force: true });
    const failure = installFailure(error);
    await journal(job, 'failed', failure.code);
    throw failure;
  }
}
export async function readJob(directory: string): Promise<InstallJob> {
  await plainDirectory(directory);
  const info = await lstat(directory);
  if (info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0 || !path.basename(directory).startsWith('install-job-')) throw Error('Invalid install job permissions');
  const file = path.join(directory, 'job.json');
  const raw = await lstat(file);
  if (!raw.isFile() || raw.isSymbolicLink() || raw.size > 16384) throw Error('Invalid install manifest');
  const job = JSON.parse(await readFile(file, 'utf8')) as InstallJob;
  if (job.schema !== 1 || job.directory !== directory || !/^[a-f0-9-]{36}$/.test(job.id)
    || !path.isAbsolute(job.target) || path.basename(job.target) !== '狗牛.app'
    || job.stage !== path.join(path.dirname(job.target), `.dogcow-new-${job.id}.app`)
    || job.backup !== path.join(path.dirname(job.target), `.dogcow-old-${job.id}.app`)
    || !/^\d+\.\d+\.\d+$/.test(job.version) || !['arm64', 'x64'].includes(job.arch)
    || typeof job.hadTarget !== 'boolean' || typeof job.dataBackup !== 'string'
    || !Number.isSafeInteger(job.parentPid) || job.parentPid < 0 || typeof job.parentExecutable !== 'string'
    || !job.executable || path.basename(job.executable) !== job.executable) throw Error('Invalid install manifest');
  await plainDirectory(path.dirname(job.target));
  return job;
}
export async function acknowledgeInstall(directory: string, application: string, version: string) {
  const job = await readJob(directory);
  const status = JSON.parse(await readFile(path.join(directory, 'status.json'), 'utf8'));
  if (job.target !== await realpath(application) || job.version !== version || status.phase !== 'launching') throw Error('Install acknowledgment mismatch');
  await writeFile(path.join(directory, 'ready.json'), JSON.stringify({ id: job.id }), { mode: 0o600 });
}
export async function cancelInstall(job: InstallJob) {
  await writeFile(path.join(job.directory, 'cancelled'), '', { mode: 0o600 });
  await rm(job.stage, { recursive: true, force: true });
  await journal(job, 'cancelled');
}
export async function executeInstall(directory: string, hooks: {
  running?: (target: string) => Promise<boolean>;
  move?: typeof rename; launch?: (job: InstallJob) => Promise<void>; wait?: (ms: number) => Promise<void>;
  attempts?: number;
} = {}) {
  const job = await readJob(directory);
  const lock = await open(path.join(directory, 'install.lock'), 'wx', 0o600);
  const running = hooks.running ?? runningTarget, move = hooks.move ?? rename, wait = hooks.wait ?? sleep;
  try {
    const initial = JSON.parse(await readFile(path.join(directory, 'status.json'), 'utf8'));
    if (initial.phase !== 'prepared' || await exists(path.join(directory, 'cancelled'))) throw Error('Install job is not prepared');
    await journal(job, 'waiting');
    // No signals are sent: the updater can only wait for the specifically identified app.
    if (job.parentPid) {
      for (let i = 0; i < (hooks.attempts ?? 60); i++) {
        let same = false;
        try { same = (await run('/bin/ps', ['-p', String(job.parentPid), '-o', 'comm='])).stdout.trim() === job.parentExecutable; } catch { /* exited */ }
        if (!same) break;
        if (i === (hooks.attempts ?? 60) - 1) throw new InstallError('UPDATE_EXIT_TIMEOUT', INSTALL_MESSAGES.UPDATE_EXIT_TIMEOUT);
        await wait(1000);
      }
    }
    if (await running(job.target)) throw new InstallError('UPDATE_RUNNING', INSTALL_MESSAGES.UPDATE_RUNNING);
    await validateCandidate(job.stage, job.version, job.arch);
    if (await exists(job.backup)) throw Error('Backup already exists');
    if (await exists(job.target)) await inspectApplication(job.target);
    else if (job.hadTarget) throw new InstallError('UPDATE_TARGET_INVALID', INSTALL_MESSAGES.UPDATE_TARGET_INVALID);
    if (await exists(path.join(directory, 'cancelled'))) throw Error('Installation cancelled');
    await journal(job, 'replacing');
    let movedOld = false;
    try {
      if (job.hadTarget) { await move(job.target, job.backup); movedOld = true; }
      await move(job.stage, job.target);
    } catch (error) {
      if (movedOld) {
        try { await move(job.backup, job.target); }
        catch { throw new InstallError('UPDATE_RESTORE_FAILED', INSTALL_MESSAGES.UPDATE_RESTORE_FAILED); }
        throw new InstallError('UPDATE_RESTORED', INSTALL_MESSAGES.UPDATE_RESTORED);
      }
      throw error;
    }
    await journal(job, 'launching');
    await (hooks.launch ?? (async value => { const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
      await run('/usr/bin/open', ['-n', value.target, '--args', `--dogcow-update-job=${value.directory}`], { env }); }))(job);
    for (let i = 0; i < (hooks.attempts ?? 60); i++) {
      if (await exists(path.join(directory, 'ready.json'))) {
        const ready = JSON.parse(await readFile(path.join(directory, 'ready.json'), 'utf8'));
        if (ready.id === job.id) { await journal(job, 'completed'); await prunePreviousBackup(job); return; }
      }
      await wait(1000);
    }
    throw new InstallError('UPDATE_LAUNCH_UNCONFIRMED', INSTALL_MESSAGES.UPDATE_LAUNCH_UNCONFIRMED);
  } catch (error) {
    const failure = installFailure(error);
    await journal(job, 'failed', failure.code);
    console.error(JSON.stringify({ operation: 'install', errorCode: failure.code, correlationId: job.id }));
    throw failure;
  } finally { await lock.close(); }
}
async function prunePreviousBackup(current: InstallJob) {
  for (const name of await readdir(path.dirname(current.directory))) {
    if (!name.startsWith('install-job-') || name === path.basename(current.directory)) continue;
    try {
      const previous = await readJob(path.join(path.dirname(current.directory), name));
      const state = JSON.parse(await readFile(path.join(previous.directory, 'status.json'), 'utf8'));
      if (state.phase === 'completed' && previous.target === current.target && await exists(previous.backup)) {
        await inspectApplication(previous.backup);
        await rm(previous.backup, { recursive: true });
      }
    } catch { console.warn('[install] older backup retained'); }
  }
}
/** Only restore a missing application during the rename gap. Never overwrite a launched app or its data. */
export async function recoverInstallJobs(jobs: string, target?: string) {
  await mkdir(jobs, { recursive: true, mode: 0o700 });
  const records: { job: InstallJob; state: { phase: string; code?: string }; time: number }[] = [];
  for (const name of await readdir(jobs)) {
    if (!name.startsWith('install-job-')) continue;
    try {
      const job = await readJob(path.join(jobs, name));
      if (target && job.target !== target) continue;
      const statusFile = path.join(job.directory, 'status.json');
      const state = JSON.parse(await readFile(statusFile, 'utf8'));
      // Old journals may lack time. Their file timestamp is a conservative ordering fallback.
      const recorded = typeof state.time === 'string' ? Date.parse(state.time) : NaN;
      const time = Number.isFinite(recorded) ? recorded : (await lstat(statusFile)).mtimeMs;
      records.push({ job, state, time });
    } catch { console.warn('[install] unreadable recovery manifest retained'); }
  }
  const failures: { code: string; id: string }[] = [];
  const atLeastVersion = (left: string, right: string) => {
    const a = left.split('.').map(Number), b = right.split('.').map(Number);
    const different = a.findIndex((part, i) => part !== b[i]);
    return different < 0 || a[different] > b[different];
  };
  // Never rely on random job-directory names or filesystem enumeration order.
  for (const { job, state, time } of records.sort((a, b) => a.time - b.time)) {
    try {
      const superseded = records.some(next => next.job.target === job.target && next.state.phase === 'completed'
        && next.time > time && atLeastVersion(next.job.version, job.version));
      if (superseded && (state.phase === 'failed' || (state.phase === 'replacing' && await exists(job.target)))) continue;
      if (state.phase === 'replacing') {
        if (!await exists(job.target) && await exists(job.backup)) {
          await inspectApplication(job.backup);
          await rename(job.backup, job.target);
          await journal(job, 'failed', 'UPDATE_RESTORED');
          failures.push({ code: 'UPDATE_RESTORED', id: job.id });
        } else failures.push({ code: 'UPDATE_LAUNCH_UNCONFIRMED', id: job.id });
      } else if (state.phase === 'failed') failures.push({ code: state.code ?? 'UPDATE_INSTALL_FAILED', id: job.id });
    } catch { console.warn('[install] unreadable recovery manifest retained'); }
  }
  return failures.at(-1);
}
export async function backupProfile(profile: string, destination: string) {
  if (!await exists(profile)) return;
  await mkdir(destination, { recursive: true, mode: 0o700 });
  // Copy children individually: Node rejects copying a directory into its own subtree
  // before evaluating a filter, even when that subtree would be excluded.
  for (const entry of await readdir(profile)) {
    if (entry === 'updates') continue;
    await cp(path.join(profile, entry), path.join(destination, entry), { recursive: true });
  }
}
async function manual(source: string) {
  const target = '/Applications/狗牛.app';
  if (await runningTarget(target)) throw new InstallError('UPDATE_RUNNING', INSTALL_MESSAGES.UPDATE_RUNNING);
  const info = await inspectApplication(source);
  const jobs = await realpath(os.tmpdir());
  // The installed app is stopped; snapshot its profile before replacement, excluding downloaded packages.
  const profile = path.join(os.homedir(), 'Library/Application Support/DogCow');
  await recoverInstallJobs(path.join(profile, 'updates'), target);
  await recoverInstallJobs(jobs, target);
  const backup = await mkdtemp(path.join(jobs, 'dogcow-data-backup-'));
  await backupProfile(profile, path.join(backup, 'DogCow'));
  const job = await prepareInstall({ source, target, version: info.version, arch: process.arch, jobs, dataBackup: backup });
  console.log(`安装恢复目录：${job.directory}\n数据备份：${backup}`);
  await executeInstall(job.directory);
  console.log('狗牛已安装并启动。旧版备份保留在应用目录旁。');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [mode, directory] = process.argv.slice(2);
  const task = mode === 'install' && directory ? executeInstall(directory)
    : mode === 'manual' && directory ? manual(directory) : Promise.reject(Error('Invalid installer arguments'));
  task.catch(error => { console.error(installFailure(error).message); process.exitCode = 1; });
}
