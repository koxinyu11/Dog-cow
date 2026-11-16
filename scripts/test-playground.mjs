import { build } from 'esbuild';
import { mkdtemp, writeFile, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import electron from 'electron';
import assert from 'node:assert/strict';
import { SourceMap } from 'node:module';
const repository = fileURLToPath(new URL('..', import.meta.url));
const devRunning = await new Promise(resolve => {
  const socket = net.connect(5180, '127.0.0.1');
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
if (devRunning) throw Error('5180 端口正在使用。请先结束已确认的本项目开发实例，再运行隔离验收；不要关闭正式包。');
const buildInfo = JSON.parse(await readFile(path.join(repository, 'dist-renderer/build-info.json'), 'utf8'));
const assets = path.join(repository, 'dist-renderer/assets');
const names = await readdir(assets);
assert.equal(names.some(name => name.endsWith('.map')), false, 'source maps must not ship with the renderer');
const archive = path.join(repository, 'build/diagnostics', buildInfo.buildId, 'assets');
let mapped = false;
for (const name of names.filter(name => name.endsWith('.js'))) {
  const code = await readFile(path.join(assets, name), 'utf8');
  assert.equal(code.includes('sourceMappingURL='), false);
  const index = code.indexOf('GameLoadError');
  if (index < 0) continue;
  const prefix = code.slice(0, index).split('\n');
  const mapping = new SourceMap(JSON.parse(await readFile(path.join(archive, `${name}.map`), 'utf8'))).findEntry(prefix.length - 1, prefix.at(-1).length);
  if (mapping.originalSource?.endsWith('/game-diagnostics.ts')) mapped = true;
}
assert.equal(mapped, true, 'production stack offsets must resolve to the matching original diagnostic source');
console.log('PASS: matching build/source-map archive, production offsets resolve to TS source, maps excluded from app output');
const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-playground-test-'));
try {
  await build({ absWorkingDir: repository, entryPoints: ['tests/fixtures/playground-host.tsx'], outfile: path.join(directory, 'fixture.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
  await writeFile(path.join(directory, 'fixture.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'unsafe-inline\'"><div id="root"></div><script src="fixture.js"></script>');
  const code = await new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(repository, 'tests/desktop/playground-integration.cjs')], {
      cwd: repository, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', DOGCOW_TEST_PROFILE: path.join(directory, 'profile'), DOGCOW_REPO: repository, DOGCOW_PLAYGROUND_FIXTURE: path.join(directory, 'fixture.html') },
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  process.exitCode = Number(code);
} finally { await rm(directory, { recursive: true, force: true }); }
