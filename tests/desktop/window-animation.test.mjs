import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WindowAnimation } from '../../dist-electron/src/main/window-animation.js';

const start = { x: 80, y: 90, width: 1000, height: 700 };
const end = { x: 840, y: 90, width: 240, height: 32 };
class Window extends EventEmitter {
  bounds = { ...start };
  calls = [];
  getBounds() { return { ...this.bounds }; }
  isDestroyed() { return false; }
  setBounds(bounds, animate) { this.bounds = bounds; this.calls.push({ bounds, animate }); if (animate) queueMicrotask(() => this.emit('resized')); }
}
test('macOS uses native animation, waits for completion and releases listeners', async () => {
  const win = new Window(); await new WindowAnimation(win, 'darwin').move(end, true);
  assert.equal(win.calls[0].animate, true);
  assert.deepEqual(win.bounds, end);
  assert.equal(win.listenerCount('resized'), 0);
});
test('reduced motion commits the target directly without native animation', async () => {
  const win = new Window(); await new WindowAnimation(win, 'darwin').move(end, false);
  assert.equal(win.calls.length, 1); assert.equal(win.calls[0].animate, undefined);
});
test('fallback interpolates with a fixed right anchor rather than drifting a pixel per frame', async () => {
  const win = new Window(); await new WindowAnimation(win, 'win32').move(end, true);
  assert.ok(win.calls.length > 2);
  assert.ok(win.calls.every(({ bounds }) => bounds.x + bounds.width === 1080 && bounds.y === 90));
  assert.deepEqual(win.bounds, end);
});
test('cancellation clears timers/listeners and rejects the interrupted operation', async () => {
  const win = new Window(); win.setBounds = function (bounds, animate) { if (!animate) this.bounds = bounds; };
  const animation = new WindowAnimation(win, 'darwin');
  const pending = animation.move(end, true);
  animation.cancel();
  await assert.rejects(pending, /cancelled/);
  assert.equal(win.listenerCount('resized'), 0);
});
