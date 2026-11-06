import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, chmod, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { cancelInstall, installFailure, InstallError, INSTALL_MESSAGES, prepareInstall, recoverInstallJobs, type InstallJob } from './update-helper.js';
const run = promisify(execFile);
export class UpdateInstaller {
  private busy = false;
  constructor(private options: { application: string; profile: string; executable: string }) {}
  async prepare(file: string, version: string): Promise<InstallJob> {
    if (this.busy) throw Error('安装正在准备，请稍候。');
    this.busy = true;
    let mount = '', attached = false;
    try {
      const target = await realpath(this.options.application);
      if (![path.join('/Applications', '狗牛.app'), path.join(os.homedir(), 'Applications/狗牛.app')].includes(target))
        throw new InstallError('UPDATE_TARGET_INVALID', INSTALL_MESSAGES.UPDATE_TARGET_INVALID);
      const temporary = await realpath(os.tmpdir());
      mount = await mkdtemp(path.join(temporary, 'dogcow-update-mount-'));
      await run('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, file], { timeout: 120000 });
      attached = true;
      const jobs = path.join(this.options.profile, 'updates');
      const job = await prepareInstall({ source: path.join(mount, '狗牛.app'), target, version,
        arch: process.arch, jobs, parentPid: process.pid, parentExecutable: this.options.executable });
      try {
        await copyFile(path.join(target, 'Contents/Resources/update-helper.mjs'), path.join(job.directory, 'helper.mjs'));
        await chmod(path.join(job.directory, 'helper.mjs'), 0o600);
      } catch (error) { await cancelInstall(job); throw error; }
      return job;
    } catch (error) { this.busy = false; throw error; }
    finally {
      if (attached) {
        try { await run('/usr/bin/hdiutil', ['detach', mount], { timeout: 30000 }); attached = false; }
        catch { console.warn('[install] mount retained; detach failed'); }
      }
      if (mount && !attached) await rm(mount, { recursive: true, force: true });
    }
  }
  async cancel(job: InstallJob) { this.busy = false; await cancelInstall(job); }
  async launch(job: InstallJob) {
    try {
      const child = spawn(this.options.executable, [path.join(job.directory, 'helper.mjs'), 'install', job.directory], {
        detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      });
      await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
      for (let attempt = 0; attempt < 50; attempt++) {
        const status = JSON.parse(await readFile(path.join(job.directory, 'status.json'), 'utf8'));
        if (status.phase === 'waiting') return;
        if (status.phase === 'failed') throw new InstallError(status.code, INSTALL_MESSAGES[status.code] ?? INSTALL_MESSAGES.UPDATE_INSTALL_FAILED);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new InstallError('UPDATE_INSTALL_FAILED', '安装助手未能就绪，应用保持运行，请重试。');
    } catch (error) { this.busy = false; throw installFailure(error); }
  }
}
export async function installRecovery(profile: string) {
  return recoverInstallJobs(path.join(profile, 'updates'));
}
