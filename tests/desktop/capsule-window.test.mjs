import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { WindowStateStore } from '../../dist-electron/src/main/window-state.js';

// Only native operations are stubbed: the controller, queue, ACK and file storage are real.
const screen = new EventEmitter();
const display = { id: 1, workArea: { x: 0, y: 30, width: 1280, height: 800 } };
Object.assign(screen, { getAllDisplays: () => [display], getPrimaryDisplay: () => display, getDisplayMatching: () => display });
globalThis.__capsuleNative = { screen, Menu: { buildFromTemplate: () => ({ popup() {} }) }, dialog: { showMessageBox: async () => ({ response: 0 }) } };
const bundled = await build({ entryPoints: ['dist-electron/src/main/window-controller.js'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'native-window-fixture', setup(b) { b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const {screen, Menu, dialog} = globalThis.__capsuleNative;' })); } }] });
const { WindowController } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
class FakeWindow extends EventEmitter {
  bounds = { x: 200, y: 100, width: 1000, height: 700 }; top = false; full = false; max = false;
  failBounds = false; failTop = false;
  webContents = { send: (...args) => args[0] === 'dogcow:window-transition' ? this.visualAck?.(args[1]) : this.send?.(...args) };
  getBounds() { return { ...this.bounds }; } getNormalBounds() { return this.getBounds(); }
  isAlwaysOnTop() { return this.top; } isFullScreen() { return this.full; } isMaximized() { return this.max; }
  isDestroyed() { return false; }
  setBounds(b) { if (this.failBounds) { this.failBounds = false; throw Error('native bounds'); } this.bounds = { ...b }; }
  setMinimumSize() {} setResizable() {} setWindowButtonVisibility() {}
  setAlwaysOnTop(v) { if (this.failTop) throw Error('native layer'); this.top = v; }
  unmaximize() { this.max = false; } maximize() { this.max = true; }
  setFullScreen(v) { this.full = v; queueMicrotask(() => this.emit(v ? 'enter-full-screen' : 'leave-full-screen')); }
}
async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'capsule-window-test-'));
  const store = new WindowStateStore(directory); await store.load();
  const win = new FakeWindow(); let saved = true; let quitting = false; let queue = Promise.resolve();
  const deps = { broadcast() {}, saveData: async () => saved, enqueue(work) { const next = queue.then(work); queue = next.catch(() => {}); return next; }, quitting: () => quitting };
  const controller = new WindowController(win, store, deps);
  win.visualAck = transition => { if (transition.stage !== 'reset') queueMicrotask(() => controller.acknowledgeTransition({ nonce: transition.nonce, ready: true, reducedMotion: true })); };
  await controller.initialize();
  const ack = ready => { win.send = (channel, nonce) => { if (channel === 'dogcow:prepare-window-mode') queueMicrotask(() => controller.acknowledge({ nonce, ready })); }; };
  try { await run({ win, store, controller, ack, deps, setSaved: v => { saved = v; }, setQuitting: v => { quitting = v; } }); }
  finally { win.emit('closed'); await rm(directory, { recursive: true, force: true }); }
}
test('menu-style transition allows queued draft command before ACK without deadlock', () => fixture(async ({ controller, win, store, deps }) => {
  let draft = false;
  win.send = (channel, nonce) => { if (channel === 'dogcow:prepare-window-mode') void deps.enqueue(async () => { draft = true; controller.acknowledge({ nonce, ready: true }); }); };
  const result = await controller.request('capsule');
  assert.equal(draft, true); assert.equal(result.applied, true);
  assert.equal(win.bounds.height, 32); assert.equal(store.value.mode, 'capsule');
  const before = store.value.revision;
  assert.equal((await controller.request('capsule')).applied, true);
  assert.equal(store.value.revision, before);
  assert.equal((await controller.request('expanded')).applied, true);
  assert.equal(win.bounds.width, 1280);
}));
test('blocked draft, concurrent request and cancelled handshake preserve expanded mode', () => fixture(async ({ controller, ack }) => {
  ack(false); assert.equal((await controller.request('capsule')).errorCode, 'WINDOW_DRAFT_BLOCKED');
  controller.win.send = () => {};
  const pending = controller.request('capsule');
  const duplicate = controller.request('capsule');
  assert.equal(duplicate, pending);
  assert.equal((await controller.request('expanded')).errorCode, 'WINDOW_BUSY');
  controller.acknowledge({ nonce: 'stale', ready: true });
  controller.cancel(); await pending;
  assert.equal(controller.snapshot().mode, 'expanded');
  assert.equal(controller.phase, 'idle');
}));
test('business save failure prevents native switch; subsequent valid attempt recovers', () => fixture(async ({ controller, ack, setSaved }) => {
  ack(true); setSaved(false);
  assert.equal((await controller.request('capsule')).errorCode, 'WINDOW_DATA_SAVE_FAILED');
  assert.equal(controller.snapshot().mode, 'expanded');
  setSaved(true); assert.equal((await controller.request('capsule')).applied, true);
  assert.equal(controller.snapshot().warning, '');
}));
test('native failure rolls back; topmost failure and revision conflict do not persist incorrect choices', () => fixture(async ({ controller, win, store, ack }) => {
  ack(true); win.failBounds = true;
  assert.equal((await controller.request('capsule')).errorCode, 'WINDOW_MODE_FAILED');
  assert.equal(controller.snapshot().mode, 'expanded');
  assert.equal(store.value.mode, 'expanded');
  assert.equal((await controller.preferences({ metric: 'clock', expectedWindowRevision: -1 })).errorCode, 'WINDOW_REVISION_CONFLICT');
  win.failTop = true;
  assert.equal((await controller.preferences({ alwaysOnTop: true, expectedWindowRevision: store.value.revision })).errorCode, 'WINDOW_TOPMOST_FAILED');
  assert.equal(store.value.alwaysOnTop, false);
}));
test('preference save failure keeps actual applied value and remains retryable', () => fixture(async ({ controller, store }) => {
  const original = store.flush.bind(store); store.flush = async () => { store.dirty = true; store.warning = 'WINDOW_PREFERENCES_SAVE_FAILED'; return false; };
  const result = await controller.preferences({ alwaysOnTop: true, expectedWindowRevision: store.value.revision });
  assert.equal(result.applied, true); assert.equal(result.persisted, false);
  assert.equal(controller.snapshot().alwaysOnTop, true);
  store.flush = original;
  assert.equal((await controller.preferences({ expectedWindowRevision: store.value.revision })).persisted, true);
}));

test('switches preserve the current right edge and top, including after moving the capsule', () => fixture(async ({ controller, win, ack }) => {
  ack(true);
  win.bounds = { x: 80, y: 90, width: 1000, height: 700 };
  await controller.request('capsule');
  assert.deepEqual(win.bounds, { x: 840, y: 90, width: 240, height: 32 });
  win.bounds = { x: 950, y: 60, width: 240, height: 32 };
  await controller.request('expanded');
  assert.deepEqual(win.bounds, { x: 190, y: 60, width: 1000, height: 700 });
  await controller.request('capsule');
  assert.deepEqual(win.bounds, { x: 950, y: 60, width: 240, height: 32 });
}));
test('content animation failure restores original mode and always clears the visual overlay', () => fixture(async ({ controller, win, ack }) => {
  ack(true); const stages = [];
  win.visualAck = transition => {
    stages.push(transition.stage);
    if (transition.stage !== 'reset') queueMicrotask(() => controller.acknowledgeTransition({ nonce: transition.nonce, ready: false }));
  };
  assert.equal((await controller.request('capsule')).errorCode, 'WINDOW_MODE_FAILED');
  assert.equal(controller.snapshot().mode, 'expanded');
  assert.equal(stages.at(-1), 'reset');
}));
