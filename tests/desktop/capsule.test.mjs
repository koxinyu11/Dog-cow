import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { anchoredBounds, fitBounds, isMetric, capsuleValue } from '../../dist-electron/src/shared/capsule.js';
import { WindowStateStore } from '../../dist-electron/src/main/window-state.js';

const fixture = (overrides = {}) => ({ tasks: { tasks: [] }, taskError: '', income: { now: new Date('2026-11-05T12:00:00').getTime(), settings: { stealMode: true }, snapshot: { earnedToday: 0, stolenSeconds: 3661, remainingSeconds: 59, elapsedSeconds: 0 }, calculationError: null }, ...overrides });
test('capsule values distinguish unavailable data, zero, inactive modes and domain errors', () => {
  const s = fixture();
  assert.equal(capsuleValue(s, 'income-today').value, '¥0.00');
  assert.equal(capsuleValue(s, 'income-month').value, '—');
  assert.equal(capsuleValue(s, 'stolen-duration').value, '01:01:01');
  assert.equal(capsuleValue(s, 'task-progress').value, '今日无任务');
  s.taskError = 'read failure';
  assert.equal(capsuleValue(s, 'task-progress').value, '—');
  s.income.settings.stealMode = false;
  assert.equal(capsuleValue(s, 'stolen-duration').value, '偷时间未开启');
  s.income.snapshot.status = 'pending-clock';
  assert.equal(capsuleValue(s, 'countdown').value, '待补上班卡');
  s.income.calculationError = { code: 'error' };
  assert.equal(capsuleValue(s, 'countdown').value, '—');
  assert.equal(isMetric('toString'), false);
});
test('window recovery clamps fully offscreen bounds and handles small screens', () => {
  assert.deepEqual(fitBounds({ x: 5000, y: -1000, width: 240, height: 32 }, [{ x: 0, y: 30, width: 1000, height: 700 }]), { x: 760, y: 30, width: 240, height: 32 });
  assert.deepEqual(fitBounds({ x: 0, y: 0, width: 1280, height: 820 }, [{ x: 0, y: 30, width: 800, height: 500 }], { width: 900, height: 620 }), { x: 0, y: 30, width: 800, height: 500 });
});
async function profile(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'capsule-state-test-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
test('legacy bounds are loaded without inventing an old compact preference', () => profile(async directory => {
  await writeFile(path.join(directory, 'window-state.json'), JSON.stringify({ x: 200, y: 80, width: 1000, height: 700 }));
  const store = new WindowStateStore(directory); await store.load();
  assert.equal(store.value.mode, 'expanded'); assert.equal(store.value.expanded.bounds.x, 200);
}));
test('corrupt config remains untouched until explicit save and is backed up', () => profile(async directory => {
  const store = new WindowStateStore(directory);
  await writeFile(store.file, '{broken'); await store.load();
  assert.equal(await readFile(store.file, 'utf8'), '{broken');
  assert.equal(store.value.mode, 'expanded');
  store.update({ metric: 'clock' }); assert.equal(await store.flush(), false);
  assert.equal(await readFile(store.file, 'utf8'), '{broken');
  assert.equal(await store.flush(true), true);
  const backup = (await readdir(directory)).find(f => f.includes('.invalid-'));
  assert.equal(await readFile(path.join(directory, backup), 'utf8'), '{broken');
  assert.equal(JSON.parse(await readFile(store.file, 'utf8')).metric, 'clock');
}));
test('unknown metric preserves valid preferences and concurrent writes keep the newest revision', () => profile(async directory => {
  const store = new WindowStateStore(directory);
  await writeFile(store.file, JSON.stringify({ ...store.value, metric: 'unknown', alwaysOnTop: true }));
  await store.load(); assert.equal(store.value.metric, 'countdown'); assert.equal(store.value.alwaysOnTop, true);
  store.update({ metric: 'clock' }); const first = store.flush(true);
  store.update({ metric: 'task-progress' }); const second = store.flush(true);
  assert.equal(await first, true); assert.equal(await second, true);
  assert.equal(store.dirty, false);
  assert.equal(JSON.parse(await readFile(store.file, 'utf8')).metric, 'task-progress');
}));
test('write failure retains dirty state for retry', () => profile(async directory => {
  const blocker = path.join(directory, 'file'); await writeFile(blocker, 'not a directory');
  const store = new WindowStateStore(blocker); store.update({ metric: 'clock' });
  assert.equal(await store.flush(), false); assert.equal(store.dirty, true);
  assert.equal(store.warning, 'WINDOW_PREFERENCES_SAVE_FAILED');
}));

test('right anchor stays on the source display and only moves to correct overflow', () => {
  const area = { x: 0, y: 30, width: 1280, height: 800 };
  assert.deepEqual(anchoredBounds({ x: 800, y: 90, width: 240, height: 32 }, { width: 900, height: 620 }, area), { x: 140, y: 90, width: 900, height: 620 });
  assert.deepEqual(anchoredBounds({ x: 50, y: 790, width: 240, height: 32 }, { width: 900, height: 620 }, area), { x: 0, y: 210, width: 900, height: 620 });
  const second = { x: -1280, y: 30, width: 1280, height: 800 };
  assert.deepEqual(anchoredBounds({ x: -400, y: 90, width: 240, height: 32 }, { width: 900, height: 620 }, second), { x: -1060, y: 90, width: 900, height: 620 });
});
