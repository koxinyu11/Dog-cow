import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const children = new Set();
const start = (args, env = {}) => {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
};
const stop = () => {
  for (const child of children) child.kill();
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const tsc = start(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.electron.json']);
await new Promise((resolve, reject) => {
  tsc.on('exit', (code) => (code === 0 ? resolve() : reject(Error('桌面类型检查未通过。'))));
  tsc.on('error', reject);
});
const vite = start(['node_modules/vite/bin/vite.js']);
vite.on('exit', stop);
let ready = false;
for (let i = 0; i < 100; i++) {
  try {
    const response = await fetch('http://127.0.0.1:5180');
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await delay(100);
}
if (!ready) {
  stop();
  throw Error('Vite 未能就绪。');
}
let electron = start(['node_modules/electron/cli.js', '.'], {
  DOGCOW_DEV_URL: 'http://127.0.0.1:5180',
});
let timer;
const watcher = watch('src', { recursive: true }, (_event, file) => {
  if (
    !file ||
    (!file.startsWith('main/') && !file.startsWith('preload/') && !file.startsWith('domain/'))
  )
    return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const compile = start(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.electron.json']);
    compile.on('exit', (code) => {
      if (code !== 0) return;
      electron.once('exit', () => {
        electron = start(['node_modules/electron/cli.js', '.'], {
          DOGCOW_DEV_URL: 'http://127.0.0.1:5180',
        });
      });
      electron.kill();
    });
  }, 300);
});
process.on('exit', () => watcher.close());
