import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { build } from 'esbuild';
import { panelBounds, panelArrowLeft, trustedPanelCommand } from '../../dist-electron/src/shared/tray.js';
test('panel placement follows tray monitor, clamps edges and short displays', () => {
  const area = { x: -1200, y: 30, width: 1200, height: 800 };
  const bounds = panelBounds({ x: -20, y: 0, width: 28, height: 24 }, area, 370);
  assert.equal(bounds.x + bounds.width, 0);
  assert.equal(bounds.y, 30);
  const small = panelBounds({ x: 0, y: 0, width: 28, height: 24 }, { x: 0, y: 24, width: 300, height: 220 }, 500);
  assert.deepEqual(small, { x: 0, y: 24, width: 300, height: 220 });
});
test('panel source permits only exact trusted page and limited operations', () => {
  assert.equal(trustedPanelCommand('trayPreferences', 'dogcow://app/index.html?surface=tray'), true);
  assert.equal(trustedPanelCommand('settings', 'dogcow://app/index.html?surface=tray'), false);
  assert.equal(trustedPanelCommand('bootstrap', 'dogcow://app/index.html'), false);
  assert.equal(trustedPanelCommand('bootstrap', 'http://127.0.0.1:5180/?surface=tray', 'http://127.0.0.1:5180'), true);
  assert.equal(trustedPanelCommand('bootstrap', 'http://127.0.0.1:5180.evil/?surface=tray', 'http://127.0.0.1:5180'), false);
});
let cursor = { x: 500, y: 500 };
const screen = new EventEmitter();
Object.assign(screen, { getCursorScreenPoint: () => cursor, getDisplayMatching: () => ({ workArea: { x: 0, y: 30, width: 1200, height: 800 } }) });
const windows = [];
class NativeWindow extends EventEmitter {
  visible = false; destroyed = false;
  webContents = new EventEmitter();
  constructor(options) { super(); this.options = options; this.events = []; Object.assign(this.webContents, { setWindowOpenHandler() {}, session: { setPermissionRequestHandler() {} }, isLoadingMainFrame: () => false, send: (channel, data) => this.events.push([channel, data]) }); windows.push(this); }
  setVisibleOnAllWorkspaces() { assert.fail('must not transform the application process type'); } async loadURL() { queueMicrotask(() => ready()); }
  setBounds(value) { this.bounds = value; } show() { assert.fail('must not activate the application'); } focus() { assert.fail('must not steal native focus'); }
  showInactive() { this.visible = true; }
  hide() { this.visible = false; } destroy() { this.destroyed = true; } isDestroyed() { return this.destroyed; }
}
let ready = () => {};
globalThis.__trayPanelNative = { BrowserWindow: NativeWindow, screen };
const bundled = await build({ entryPoints: ['dist-electron/src/main/tray-panel-controller.js'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'panel-native-fixture', setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const { BrowserWindow, screen } = globalThis.__trayPanelNative;' }));
} }] });
const { TrayPanelController } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('rapid reopening cancels obsolete hide; resize, window coexistence, display changes and disposal', async () => {
  const controller = new TrayPanelController({ preload: 'fixture', url: 'fixture', data: () => ({}), failed() { assert.fail('unexpected failure'); } });
  ready = () => controller.acknowledgeReady();
  const anchor = { x: 600, y: 0, width: 28, height: 24 };
  await controller.toggle(anchor);
  const win = windows.at(-1);
  assert.equal(win.visible, true);
  assert.equal(win.options.webPreferences.sandbox, true);
  if (process.platform === 'darwin') {
    assert.equal(win.options.type, 'panel');
    assert.equal(win.options.acceptFirstMouse, true);
    assert.equal(win.options.skipTaskbar, undefined);
  }
  assert.equal(controller.owns(win.webContents), true);
  assert.equal(controller.owns({}), false);
  controller.hide(); await controller.toggle(anchor);
  await delay(190);
  assert.equal(win.visible, true);
  assert.equal(win.events.at(-1)[1].phase, 'open');
  controller.resize(500); assert.equal(win.bounds.height, 500);
  controller.resize(NaN); assert.equal(win.bounds.height, 500);
  cursor = { x: 610, y: 10 }; win.emit('blur'); await delay(130); assert.equal(win.visible, true);
  cursor = { x: 900, y: 500 }; win.emit('blur'); await delay(130); assert.equal(win.visible, true);
  assert.equal(win.events.at(-1)[1].arrowLeft, 160);
  controller.hide(true); assert.equal(win.visible, false);
  await controller.toggle(anchor); screen.emit('display-removed'); assert.equal(win.visible, false);
  controller.dispose(); assert.equal(win.destroyed, true); assert.equal(screen.listenerCount('display-removed'), 0);
});
test('renderer crash hides destroyed panel, reports diagnostic id and permits a new window', async () => {
  let error;
  const controller = new TrayPanelController({ preload: 'fixture', url: 'fixture', data: () => ({}), failed(code, id) { error = { code, id }; } });
  ready = () => controller.acknowledgeReady();
  const anchor = { x: 600, y: 0, width: 28, height: 24 };
  await controller.toggle(anchor);
  const old = windows.at(-1);
  old.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(error.code, 'TRAY_PANEL_FAILED'); assert.ok(error.id); assert.equal(old.destroyed, true);
  await controller.toggle(anchor); assert.notEqual(windows.at(-1), old); assert.equal(windows.at(-1).visible, true);
  controller.dispose();
});

test('arrow follows icon and numeric anchor centers and avoids rounded corners', () => {
  const area = { x: 0, y: 30, width: 1200, height: 800 };
  for (const anchor of [{ x: 600, y: 0, width: 28, height: 24 }, { x: 600, y: 0, width: 90, height: 24 }]) {
    const bounds = panelBounds(anchor, area, 370);
    assert.equal(bounds.x + 12 + panelArrowLeft(anchor, bounds), anchor.x + anchor.width / 2);
  }
  const right = { x: 1190, y: 0, width: 10, height: 24 };
  const bounds = panelBounds(right, area, 370);
  assert.equal(panelArrowLeft(right, bounds), 280);
  const left = { x: 0, y: 0, width: 28, height: 24 };
  assert.equal(panelArrowLeft(left, panelBounds(left, area, 370)), 40);
  assert.equal(panelArrowLeft(left, { x: 0, width: 40 }), 8);
});
