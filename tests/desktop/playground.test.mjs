import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { build } from 'esbuild';
import { trustedPlaygroundCommand } from '../../dist-electron/src/shared/playground.js';
const url = 'dogcow://app/playground.html';
test('playground accepts only exact page and limited commands', () => {
  assert.equal(trustedPlaygroundCommand('bootstrap', url, url), true);
  assert.equal(trustedPlaygroundCommand('ready', url, url), true);
  for (const command of ['settings', 'task', 'quit', '', {}, null]) assert.equal(trustedPlaygroundCommand(command, url, url), false);
  for (const source of [`${url}?extra=1`, `${url}/`, 'dogcow://app/index.html', 'https://app/playground.html']) assert.equal(trustedPlaygroundCommand('ready', source, url), false);
});
const instances = [];
let onLoad = () => {};
let nativeFault = '';
class NativeWindow extends EventEmitter {
  destroyed = false; minimized = false; shown = 0; focused = 0;
  webContents = new EventEmitter();
  constructor(options) {
    super();
    if (nativeFault === 'create') throw Error('create failed');
    this.options = options;
    const frame = { url };
    Object.assign(this.webContents, { mainFrame: frame, setWindowOpenHandler() { if (nativeFault === 'initialize') throw Error('initialize failed'); }, session: { setPermissionRequestHandler() {} }, send: (...value) => { this.lastEvent = value; } });
    instances.push(this);
  }
  loadURL() { if (nativeFault === 'load') throw Error('sync load failed'); return Promise.resolve(onLoad(this)); }
  isDestroyed() { return this.destroyed; }
  isMinimized() { return this.minimized; }
  restore() { this.minimized = false; }
  isMaximized() { return false; } isFullScreen() { return false; }
  getBounds() { return { x: 10, y: 20, width: 800, height: 600 }; }
  show() { if (nativeFault === 'show') throw Error('show failed'); this.shown++; } focus() { this.focused++; }
  setBackgroundColor(value) { this.color = value; }
  destroy() { this.destroyed = true; this.emit('closed'); }
}
globalThis.__playgroundNative = { BrowserWindow: NativeWindow, screen: { getCursorScreenPoint: () => ({ x: 1, y: 1 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1000, height: 800 } }) } };
const bundled = await build({ entryPoints: ['dist-electron/src/main/playground-controller.js'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'native-fixture', setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const { BrowserWindow, screen } = globalThis.__playgroundNative;' }));
} }] });
const { PlaygroundController } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
function setup() {
  nativeFault = '';
  const failures = []; let theme = 'light';
  const controller = new PlaygroundController({ preload: 'playground.cjs', url, theme: () => theme, failed: (...value) => failures.push(value) });
  onLoad = win => controller.command(win.webContents, win.webContents.mainFrame, 'ready');
  return { controller, failures, dark() { theme = 'dark'; } };
}
test('concurrent opening creates one independent window; source authorization and theme', async () => {
  const { controller, failures, dark } = setup();
  const start = instances.length;
  assert.deepEqual(await Promise.all([controller.open(), controller.open(), controller.open()]), [true, true, true]);
  assert.equal(instances.length - start, 1);
  const win = controller.window;
  assert.equal(win.options.parent, undefined); assert.equal(win.options.modal, undefined); assert.equal(win.options.alwaysOnTop, undefined);
  assert.equal(win.options.webPreferences.sandbox, true); assert.equal(win.options.webPreferences.nodeIntegration, false);
  assert.throws(() => controller.command({}, win.webContents.mainFrame, 'ready'));
  assert.throws(() => controller.command(win.webContents, { url }, 'ready'));
  assert.throws(() => controller.command(win.webContents, win.webContents.mainFrame, 'settings'));
  win.minimized = true; await controller.open(); assert.equal(win.minimized, false);
  dark(); controller.publishTheme(); assert.equal(win.color, '#17211c'); assert.deepEqual(win.lastEvent, ['dogcow:playground-theme', 'dark']);
  win.emit('close'); win.destroy(); await controller.open(); assert.notEqual(controller.window, win); assert.equal(controller.window.options.width, 800);
  controller.dispose(); assert.equal(await controller.open(), false); assert.deepEqual(failures, []);
});
test('load failure and renderer crash release resources and allow retry', async () => {
  const { controller, failures } = setup();
  onLoad = async () => { throw Error('fixture failure'); };
  assert.equal(await controller.open(), false); assert.equal(controller.window, undefined); assert.equal(instances.at(-1).destroyed, true); assert.equal(failures.length, 1);
  onLoad = win => controller.command(win.webContents, win.webContents.mainFrame, 'ready');
  assert.equal(await controller.open(), true);
  const win = controller.window; win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(win.destroyed, true); assert.equal(controller.window, undefined); assert.equal(failures.length, 2);
  assert.equal(await controller.open(), true); controller.dispose();
});
test('closing or disposal during loading cannot show an obsolete window', async () => {
  const { controller, failures } = setup();
  onLoad = win => { queueMicrotask(() => win.destroy()); };
  assert.equal(await controller.open(), false);
  assert.equal(instances.at(-1).shown, 0);
  onLoad = () => { queueMicrotask(() => controller.dispose()); };
  assert.equal(await controller.open(), false); assert.equal(instances.at(-1).shown, 0);
  assert.equal(failures.length, 0);
});

for (const stage of ['create', 'initialize', 'load', 'show']) {
  test(`${stage} failure cleans partial native state, reports once and retries with a new window`, async () => {
    const { controller, failures } = setup();
    const before = instances.length;
    nativeFault = stage;
    assert.equal(await controller.open(), false);
    assert.equal(controller.window, undefined);
    assert.equal(failures.length, 1);
    assert.match(failures[0][1], /^[a-f0-9-]{36}$/);
    if (instances.length > before) assert.equal(instances.at(-1).destroyed, true);
    nativeFault = '';
    assert.equal(await controller.open(), true);
    assert.equal(instances.length, before + (stage === 'create' ? 1 : 2));
    controller.dispose();
  });
}
test('concurrent callers wait for actual renderer readiness before any window is shown', async () => {
  const { controller } = setup();
  onLoad = () => {};
  const first = controller.open();
  const second = controller.open();
  const win = controller.window;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(win.shown, 0);
  controller.command(win.webContents, win.webContents.mainFrame, 'ready');
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(win.shown, 1);
  controller.dispose();
});
test('readiness timeout cleans the window and permits a fresh retry', async t => {
  const { controller, failures } = setup();
  onLoad = () => {};
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const pending = controller.open();
    const win = controller.window;
    await Promise.resolve();
    t.mock.timers.tick(10000);
    assert.equal(await pending, false);
    assert.equal(win.destroyed, true);
    assert.equal(failures.length, 1);
    onLoad = win => controller.command(win.webContents, win.webContents.mainFrame, 'ready');
    assert.equal(await controller.open(), true);
    controller.dispose();
  } finally { t.mock.timers.reset(); }
});

for (const [event, expectedStage, args] of [
  ['preload-error', 'preload', [{}, 'fixture.cjs', new Error('preload root')]],
  ['did-fail-load', 'page', [{}, -6, 'ERR_FILE_NOT_FOUND', url, true]],
  ['render-process-gone', 'renderer', [{}, { reason: 'crashed', exitCode: 17 }]],
]) {
  test(`${event} during startup preserves specific stage and root cause`, async () => {
    const records = []; const failures = [];
    const controller = new PlaygroundController({ preload: 'fixture', url, theme: () => 'light', record: async r => records.push(r), failed: (...v) => failures.push(v) });
    onLoad = win => { win.webContents.emit(event, ...args); };
    assert.equal(await controller.open(), false);
    assert.equal(records.length, 1); assert.equal(records[0].stage, expectedStage);
    if (expectedStage === 'renderer') assert.equal(records[0].errors.at(-1).code, '17');
    assert.equal(failures[0][1], records[0].correlationId);
    controller.dispose();
  });
}
