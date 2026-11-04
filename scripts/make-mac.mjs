import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { makeDmg } from './make-dmg.mjs';
const run = promisify(execFile);
const arch = process.argv[2] || process.arch;
if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) {
  throw Error('Mac 构建仅接受 arm64 或 x64。');
}
async function forge(command, extra = []) {
  const child = spawn(
    process.execPath,
    [
      'node_modules/@electron-forge/cli/dist/electron-forge.js',
      command,
      '--platform=darwin',
      `--arch=${arch}`,
      ...extra,
    ],
    { stdio: 'inherit' },
  );
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(`Forge ${command} 失败 ${code}`)),
    );
  });
}
await forge('package');
const application = path.resolve(`out/狗牛-darwin-${arch}/狗牛.app`);
await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', application], {
  timeout: 120_000,
});
await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', application], {
  timeout: 120_000,
});
await forge('make', ['--from-package']);
console.log(await makeDmg({ app: application, output: path.resolve(`out/make/狗牛-${arch}.dmg`) }));
