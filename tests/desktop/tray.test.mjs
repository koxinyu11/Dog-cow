import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { trayView, isTrayDisplay } from '../../dist-electron/src/shared/tray.js';
import { capsuleValue } from '../../dist-electron/src/shared/capsule.js';
import { WindowStateStore } from '../../dist-electron/src/main/window-state.js';
const state = () => ({ income: { settings: {}, calculationError: null, now: Date.now(), snapshot: { earnedToday: 0, remainingSeconds: 3661 } }, tasks: { tasks: [] }, taskError: '' });
test('tray shares capsule values and distinguishes zero, missing settings and calculation error', () => {
  const s = state();
  assert.equal(trayView(s, 'icon').title, '');
  assert.equal(trayView(s, 'income-today').title, '¥0.00');
  assert.equal(trayView(s, 'countdown').title, capsuleValue(s, 'countdown').value);
  s.income.snapshot.status = 'after-work';
  assert.equal(trayView(s, 'countdown').title, '已下班');
  s.income.calculationError = { code: 'bad' };
  assert.equal(trayView(s, 'income-today').title, '—');
  s.income.settings = null;
  assert.equal(trayView(s, 'income-today').title, '未设置');
  assert.equal(isTrayDisplay('toString'), false);
});
async function profile(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'tray-test-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
test('old preferences retain position and default to icon; display survives reload', () => profile(async dir => {
  const store = new WindowStateStore(dir);
  await writeFile(store.file, JSON.stringify(store.value));
  await store.load();
  assert.equal(store.value.tray.display, 'icon');
  store.update({ tray: { display: 'countdown' } });
  assert.equal(await store.flush(), true);
  const restored = new WindowStateStore(dir); await restored.load();
  assert.equal(restored.value.tray.display, 'countdown');
  assert.deepEqual(restored.value.expanded, store.value.expanded);
}));
test('invalid tray field falls back without discarding bounds or overwriting original', () => profile(async dir => {
  const store = new WindowStateStore(dir);
  const raw = JSON.stringify({ ...store.value, tray: { display: 'bad' } });
  await writeFile(store.file, raw); await store.load();
  assert.equal(store.value.tray.display, 'icon');
  assert.equal(store.warning, 'WINDOW_PREFERENCES_INVALID');
  store.update({ tray: { display: 'income-today' } });
  assert.equal(await store.flush(), false);
  assert.equal(await readFile(store.file, 'utf8'), raw);
  assert.equal(await store.flush(true), true);
  const backup = (await readdir(dir)).find(name => name.includes('.invalid-'));
  assert.equal(await readFile(path.join(dir, backup), 'utf8'), raw);
}));
test('failed save keeps chosen display and records diagnostic id; retry succeeds', () => profile(async dir => {
  const store = new WindowStateStore(dir);
  await mkdir(store.file);
  store.update({ tray: { display: 'countdown' } });
  assert.equal(await store.flush(), false);
  assert.equal(store.value.tray.display, 'countdown');
  assert.equal(store.dirty, true);
  assert.ok(store.correlationId);
  await rm(store.file, { recursive: true });
  assert.equal(await store.flush(true), true);
  assert.equal(store.dirty, false);
  assert.equal(store.correlationId, '');
}));

// Exercise controller lifecycle with native calls stubbed; no additional app instance.
import { build } from 'esbuild';
import { EventEmitter } from 'node:events';
const nativeTrays = [];
let failTitle = false;
class NativeTray extends EventEmitter {
  titles = []; destroyed = false;
  constructor() { super(); nativeTrays.push(this); }
  getBounds() { return { x: 100, y: 0, width: 28, height: 24 }; }
  setImage() {}
  setTitle(title) { if (failTitle) throw Error('native title'); this.titles.push(title); }
  setToolTip() {}
  popUpContextMenu(menu) { this.menu = menu; }
  destroy() { this.destroyed = true; }
}
globalThis.__trayNative = { Tray: NativeTray, Menu: { buildFromTemplate: items => items }, nativeImage: { createFromPath: () => ({ isEmpty: () => false, setTemplateImage() {} }), createEmpty: () => ({ setTemplateImage() {} }) } };
const bundled = await build({ entryPoints: ['dist-electron/src/main/tray-controller.js'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'tray-native-fixture', setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const { Tray, Menu, nativeImage } = globalThis.__trayNative;' }));
} }] });
const { TrayController } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
test('tray updates without renderer, avoids redundant writes and disposes prior native instance', { skip: process.platform !== 'darwin' }, () => {
  let anchor; let failed = 0;
  const controller = new TrayController({ iconPath: 'fixture', togglePanel: bounds => { anchor = bounds; }, changed() {}, failed() { failed++; } });
  controller.initialize();
  const first = nativeTrays.at(-1);
  controller.update(trayView(state(), 'income-today'));
  controller.update(trayView(state(), 'income-today'));
  assert.deepEqual(first.titles, ['¥0.00']);
  first.emit('click');
  assert.deepEqual(anchor, { x: 100, y: 0, width: 28, height: 24 });
  failTitle = true;
  controller.update(trayView(state(), 'countdown'));
  assert.equal(controller.state.errorCode, 'TRAY_RENDER_FAILED');
  assert.equal(controller.state.available, false);
  assert.equal(failed, 1);
  assert.ok(first.destroyed);
  failTitle = false;
  controller.initialize();
  assert.equal(controller.state.available, true);
  assert.equal(controller.state.errorCode, undefined);
  assert.deepEqual(nativeTrays.at(-1).titles, ['01:01:01']);
  controller.dispose();
  assert.equal(nativeTrays.at(-1).destroyed, true);
});
