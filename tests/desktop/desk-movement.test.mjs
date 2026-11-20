import assert from 'node:assert/strict';
import test from 'node:test';
import { deskMoves, pauseDeskSession, prepareDeskSession, resumeDeskSession, seatedQuick, walkingBreak } from '../../dist-electron/src/shared/desk-movement.js';

test('the one-minute routine uses only seated moves and the walking break has its own duration', () => {
  assert.ok(seatedQuick.every(move => deskMoves[move].seated));
  assert.equal(seatedQuick.reduce((sum, move) => sum + deskMoves[move].seconds, 0), 60);
  assert.equal(deskMoves[walkingBreak[0]].seconds, 180);
});

test('pausing preserves the remaining time and starting again cannot reset a running segment', () => {
  const running = resumeDeskSession(prepareDeskSession(seatedQuick), 1000);
  assert.equal(resumeDeskSession(running, 2000), running);
  const paused = pauseDeskSession(running, 6500);
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.remaining, 24500);
  assert.equal(pauseDeskSession(paused, 15000), paused);
  assert.equal(resumeDeskSession(paused, 15000).deadline, 39500);
});

test('an interruption after the deadline advances only to the next ready action', () => {
  const running = resumeDeskSession(prepareDeskSession(seatedQuick), 0);
  const next = pauseDeskSession(running, 120000);
  assert.equal(next.phase, 'ready');
  assert.equal(next.index, 1);
  assert.equal(next.remaining, 30000);
  assert.equal(pauseDeskSession(resumeDeskSession(next, 120000), 150000).phase, 'finished');
});

test('custom plans validate action filters, ordering and reminder settings', async () => {
  const { defaultDeskPlan, deskMoveSource, validDeskPlan } = await import('../../dist-electron/src/shared/desk-movement.js');
  assert.equal(validDeskPlan(defaultDeskPlan), true);
  assert.equal(validDeskPlan({ ...defaultDeskPlan, moves: ['rise'] }), false);
  assert.equal(validDeskPlan({ ...defaultDeskPlan, seatedOnly: false, moves: ['calves', 'rise'] }), true);
  assert.equal(validDeskPlan({ ...defaultDeskPlan, excluded: ['髋腿'] }), false);
  assert.equal(validDeskPlan({ ...defaultDeskPlan, moves: ['chest', 'chest'] }), false);
  assert.equal(validDeskPlan({ ...defaultDeskPlan, reminder: true, days: [] }), false);
  assert.match(deskMoveSource('calves'), /strength-exercises\/#calf-raises$/);
});

test('the local store persists plans and records, with a single reminder per scheduled date', async () => {
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { defaultDeskPlan } = await import('../../dist-electron/src/shared/desk-movement.js');
  const { DeskMovementStore } = await import('../../dist-electron/src/main/desk-movement-store.js');
  const folder = await mkdtemp(join(tmpdir(), 'dogcow-movement-test-'));
  const file = join(folder, 'activity.json');
  try {
    await writeFile(file, JSON.stringify({
      plan: defaultDeskPlan, records: [{ id: 'v2', date: '2026-11-18', seconds: 60 }], lastReminder: '',
    }));
    const store = new DeskMovementStore(file);
    await store.load();
    const scheduled = new Date(2026, 10, 19, 15, 0);
    const plan = { ...defaultDeskPlan, reminder: true, days: [scheduled.getDay()] };
    await store.setPlan(plan);
    assert.equal(await store.tick(new Date(2026, 10, 19, 14, 59)), false);
    assert.equal(await store.tick(scheduled), true);
    assert.equal(await store.tick(scheduled), false);
    store.dismiss(true);
    const retryTime = Date.now() + 600_000;
    assert.equal(await store.tick(new Date(retryTime - 1000)), false);
    assert.equal(await store.tick(new Date(retryTime + 1000)), true);
    store.dismiss(false);
    await store.setWeight(60);
    const segments = [{ move: 'walk', milliseconds: 31_000 }, { move: 'chest', milliseconds: 17_500 }];
    await store.record('first-completed-session', segments, 60);
    await store.record('first-completed-session', segments, 60);
    await store.setWeight(72);
    const reloaded = new DeskMovementStore(file);
    await reloaded.load();
    assert.deepEqual(reloaded.view().plan, plan);
    assert.equal(reloaded.view().records.length, 2);
    assert.equal(reloaded.view().records[0].seconds, 60);
    assert.equal(reloaded.view().records[0].kcal, undefined);
    assert.equal(reloaded.view().records[1].seconds, 48);
    assert.deepEqual(reloaded.view().records[1].segments, segments);
    assert.ok(Math.abs(reloaded.view().records[1].kcal - 48.5 * 1.3 * 60 / 3600) < 1e-9);
    assert.equal(reloaded.view().weightKg, 72);
    assert.equal(await reloaded.tick(scheduled), false);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('the catalog contains 50 exercises plus walking and every item has an approved source and MET category', async () => {
  const { deskMoveIds, movementSourcePages, metCategories, maxMovementSeconds, validDeskPlan, defaultDeskPlan } = await import('../../dist-electron/src/shared/desk-movement.js');
  assert.equal(deskMoveIds.filter(id => id !== 'walk').length, 50);
  assert.equal(new Set(deskMoveIds.map(id => deskMoves[id].label)).size, 51);
  for (const id of deskMoveIds) {
    const move = deskMoves[id];
    assert.ok(movementSourcePages.includes(move.source.split('#')[0]), id);
    assert.ok(Object.values(metCategories).includes(move.met), id);
  }
  assert.ok(maxMovementSeconds > 390);
  assert.equal(validDeskPlan({ ...defaultDeskPlan, seatedOnly: false, moves: deskMoveIds }), true);
});

test('movement calories use active time, ignore paused time, and add unrounded values', async () => {
  const { activeMovementMs, movementKcal, validDeskSegments } = await import('../../dist-electron/src/shared/desk-movement.js');
  const ready = prepareDeskSession(seatedQuick);
  assert.equal(activeMovementMs(ready, 3000), 0);
  const running = resumeDeskSession(ready, 3000);
  const paused = pauseDeskSession(running, 7500);
  assert.equal(activeMovementMs(paused, 18000), 4500);
  assert.equal(activeMovementMs(resumeDeskSession(paused, 18000), 20000), 6500);
  const segments = [{ move: 'march', milliseconds: 6500 }, { move: 'chest', milliseconds: 12345 }];
  assert.equal(validDeskSegments(segments), true);
  assert.equal(validDeskSegments([{ move: 'chest', milliseconds: 31000 }]), false);
  assert.equal(validDeskSegments([{ move: 'unknown', milliseconds: 1000 }]), false);
  assert.ok(Math.abs(movementKcal(segments, 60) - (1.5 * 6.5 + 1.3 * 12.345) * 60 / 3600) < 1e-9);
});
