import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);

// Build beside the destination and publish only after read-only verification.
// No third-party image parser or Finder automation is needed.
export async function makeDmg({ app, output, name = '狗牛' }) {
  if (process.platform !== 'darwin') throw new Error('DMG 需要在 macOS 上构建。');
  const source = await realpath(app);
  const destination = path.resolve(output);
  if (!source.endsWith('.app') || !(await lstat(source)).isDirectory())
    throw new Error('请选择有效的 .app 目录。');
  if (!destination.endsWith('.dmg') || destination.startsWith(`${source}${path.sep}`))
    throw new Error('DMG 输出必须位于应用目录之外。');
  if (!name || /[\r\n\0]/.test(name)) throw new Error('镜像名称无效。');
  const info = path.join(source, 'Contents/Info.plist');
  const { stdout } = await run('/usr/bin/plutil', [
    '-extract',
    'CFBundleExecutable',
    'raw',
    '-o',
    '-',
    info,
  ]);
  const executable = stdout.trim();
  if (!executable || path.basename(executable) !== executable)
    throw new Error('应用可执行文件声明无效。');
  await lstat(path.join(source, 'Contents/MacOS', executable));
  await mkdir(path.dirname(destination), { recursive: true });
  const stage = await mkdtemp(path.join(tmpdir(), 'dogcow-dmg-stage-'));
  const job = await mkdtemp(path.join(path.dirname(destination), '.dogcow-dmg-'));
  const image = path.join(job, 'candidate.dmg');
  const mount = path.join(stage, 'mount');
  let attached = false;
  let detachFailed = false;
  try {
    const contents = path.join(stage, 'contents');
    await mkdir(contents);
    await cp(source, path.join(contents, path.basename(source)), {
      recursive: true,
      verbatimSymlinks: true,
    });
    await symlink('/Applications', path.join(contents, 'Applications'));
    await run(
      '/usr/bin/hdiutil',
      ['create', '-volname', name, '-srcfolder', contents, '-format', 'UDZO', image],
      { timeout: 180_000 },
    );
    await run('/usr/bin/hdiutil', ['verify', image], { timeout: 120_000 });
    await mkdir(mount);
    await run(
      '/usr/bin/hdiutil',
      ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, image],
      { timeout: 120_000 },
    );
    attached = true;
    await lstat(path.join(mount, path.basename(source), 'Contents/MacOS', executable));
    await run(
      '/usr/bin/codesign',
      ['--verify', '--deep', '--strict', path.join(mount, path.basename(source))],
      { timeout: 120_000 },
    );
    if ((await readlink(path.join(mount, 'Applications'))) !== '/Applications')
      throw new Error('Applications 安装链接校验失败。');
    await run('/usr/bin/hdiutil', ['detach', mount], { timeout: 30_000 });
    attached = false;
    await rename(image, destination);
    return destination;
  } finally {
    if (attached) {
      try {
        await run('/usr/bin/hdiutil', ['detach', mount], { timeout: 30_000 });
      } catch {
        detachFailed = true;
      }
    }
    // Never recursively remove a still-mounted filesystem.
    if (!detachFailed) {
      await rm(stage, { recursive: true, force: true });
      await rm(job, { recursive: true, force: true });
    } else {
      console.error('镜像未能卸载，临时目录已保留，请先卸载 dogcow 镜像后再清理。');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [app, output] = process.argv.slice(2);
  if (!app || !output) {
    console.error('用法：node scripts/make-dmg.mjs <应用.app> <输出.dmg>');
    process.exitCode = 1;
  } else {
    try {
      console.log(`DMG 已验证：${await makeDmg({ app, output })}`);
    } catch (error) {
      console.error(`DMG 构建失败：${error.message}`);
      process.exitCode = 1;
    }
  }
}
