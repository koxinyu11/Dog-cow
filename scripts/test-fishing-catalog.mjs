import { build } from 'esbuild';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import electron from 'electron';
import { Repository } from '../dist-electron/src/main/repository.js';
import { species, emptyFishing, FISHING_KEY } from '../dist-electron/src/shared/fishing.js';
import { emptyCoins, COINS_KEY } from '../dist-electron/src/shared/coins.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const devRunning = await new Promise(resolve => {
  const socket = net.connect(5180, '127.0.0.1');
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
if (devRunning) throw Error('请先结束已核实的本项目开发实例，再运行隔离验收；不要关闭正式包。');
const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-fishing-test-'));
const artifacts = process.env.DOGCOW_FISHING_ARTIFACTS || await mkdtemp(path.join(tmpdir(), 'dogcow-fishing-art-'));
await mkdir(artifacts, { recursive: true });
try {
  const profile = path.join(directory, 'profile');
  const repo = new Repository(path.join(profile, 'data')); await repo.load();
  const state = emptyFishing();
  state.rods.collector = 1; state.equipped = 'collector'; state.spot = 'river';
  state.wear.collector = 300;
  state.book = Object.fromEntries(species.map(entry => [entry.id, { count: 1, largest: entry.min }]));
  state.bag = species.filter(entry => !entry.visitor).map(entry => ({ id: `fixture-${entry.id}`, species: entry.id, kg: entry.min, value: entry.price, locked: entry.rarity === 5 }));
  repo.storage.setItem(FISHING_KEY, JSON.stringify(state));
  repo.storage.setItem(COINS_KEY, JSON.stringify({ ...emptyCoins(), balance: 1000 }));
  if (!await repo.flush()) throw Error('隔离测试存档准备失败。');
  await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/fishing-catalog.tsx'], outfile: path.join(directory, 'catalog.js'),
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
  await writeFile(path.join(directory, 'catalog.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'">
    <link rel="stylesheet" href="catalog.css"><style>
    :root { --c-surface:#f9f7f0; --c-ink:#2f463d; --c-muted:#7b857b; }
    body { margin:0; background:#eeeee5; color:#2f463d; font-family:system-ui,sans-serif; }
    .fixture-gallery.df-game { display:block; height:auto; overflow:visible; padding:22px; box-sizing:border-box; }
    h1 { margin:0 0 4px; font-size:22px; } p { margin:0 0 14px; color:#7b857b; font-size:12px; }
    h2 { margin:12px 0 8px; font-size:14px; } .fixture-grid { display:grid; grid-template-columns:repeat(10,minmax(0,1fr)); gap:8px; }
    article { display:flex; flex-direction:column; align-items:center; padding:7px 4px; border-radius:10px; background:#f9f7f0; }
    article .df-art { width:100px; height:54px; } article .df-rod-art { width:100px; height:64px; } strong { margin-top:3px; font-size:11px; font-weight:500; }
    small { margin-top:2px; color:#7b857b; font-size:10px; }
    </style><div id="root"></div><script src="catalog.js"></script></html>`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(root, 'tests/desktop/fishing-catalog.cjs')], { cwd: root, stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test', DOGCOW_TEST_PROFILE: profile, DOGCOW_REPO: root,
        DOGCOW_FISHING_FIXTURE: path.join(directory, 'catalog.html'), DOGCOW_FISHING_ARTIFACTS: artifacts } });
    child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
  });
  process.exitCode = Number(code);
  console.log(`Fishing screenshots: ${artifacts}`);
} finally { await rm(directory, { recursive: true, force: true }); }
