import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCafe, parseCafe } from '../../dist-electron/src/shared/cafe/state.js';
import { applyCafeAction } from '../../dist-electron/src/shared/cafe/commands.js';
import { defaultPlan, CAFE_KEY } from '../../dist-electron/src/shared/cafe/content.js';
import { simulateWeek } from '../../dist-electron/src/shared/cafe/simulation.js';
import {
  serviceTimeline,
  serviceTime,
  serviceTotals,
  guestPhase,
} from '../../dist-electron/src/shared/cafe/service.js';
import { Cafe } from '../../dist-electron/src/main/cafe.js';
const opened = (seats = 6) =>
  applyCafeAction(emptyCafe(42), {
    action: 'setup',
    setup: { location: 'campus', machine: 'starter', seats, positioning: 'express' },
  });
const begin = (state = opened(), plan = defaultPlan()) =>
  applyCafeAction(state, { action: 'open', runId: 'week-one', plan });

test('visual trace preserves simulated totals, randomness and original state', () => {
  const state = opened(),
    before = structuredClone(state),
    guests = [];
  const traced = simulateWeek(state, defaultPlan(), undefined, (visit) => guests.push(visit));
  const plain = simulateWeek(state, defaultPlan());
  assert.deepEqual(traced, plain);
  assert.deepEqual(state, before);
  const report = traced.reports.at(-1);
  assert.equal(guests.length, report.demand);
  assert.equal(new Set(guests.map((g) => g.id)).size, guests.length);
  assert.equal(guests.filter((g) => g.outcome === 'served').length, report.served);
  assert.equal(
    guests.reduce((n, g) => n + g.revenue, 0),
    report.revenue,
  );
  assert.equal(
    guests.reduce((n, g) => n + g.cost, 0),
    report.cogs,
  );
  for (const hour of report.hours) {
    const matches = guests.filter(
      (g) => g.day === hour.day && Math.floor((g.arrival % 1440) / 60) === hour.hour,
    );
    assert.equal(matches.filter((g) => g.outcome === 'queue').length, hour.queueLost);
    assert.equal(matches.filter((g) => g.outcome === 'stock').length, hour.stockLost);
    assert.equal(matches.filter((g) => g.outcome === 'seats').length, hour.seatLost);
  }
});
test('guests progress through entry, queue, brewing, drinking and departure using recorded times', () => {
  const timeline = serviceTimeline(begin());
  const dine = timeline.guests.find((g) => g.outcome === 'served' && g.dineIn && g.leaves > g.ready + 8);
  const takeout = timeline.guests.find((g) => g.outcome === 'served' && !g.dineIn);
  assert.equal(guestPhase(dine, dine.arrival - 4), null);
  assert.equal(guestPhase(dine, dine.arrival - 2), 'entering');
  assert.equal(guestPhase(dine, dine.starts + 0.01), 'brewing');
  assert.equal(guestPhase(dine, dine.ready + 0.1), 'to-seat');
  assert.equal(guestPhase(dine, dine.ready + 4), 'drinking');
  assert.equal(guestPhase(dine, dine.leaves - 1), 'leaving');
  assert.equal(guestPhase(dine, dine.leaves), null);
  assert.equal(guestPhase(takeout, takeout.ready + 0.1), 'leaving');
  const queue = timeline.guests.find((g) => g.outcome === 'queue');
  assert.ok(queue);
  assert.equal(guestPhase(queue, queue.arrival + 0.1), 'queueing');
});
test('every seated guest owns an actual configured seat and reservations never overlap', () => {
  const timeline = serviceTimeline(begin(opened(4)));
  for (let seat = 0; seat < 4; seat++) {
    const guests = timeline.guests.filter((g) => g.seat === seat).sort((a, b) => a.arrival - b.arrival);
    for (let i = 1; i < guests.length; i++) assert.ok(guests[i].arrival >= guests[i - 1].leaves);
  }
  for (const g of timeline.guests)
    if (g.outcome === 'served' && g.dineIn) assert.ok(g.seat >= 0 && g.seat < 4);
  const noSeats = serviceTimeline(begin(opened(0)));
  assert.ok(noSeats.guests.some((g) => g.outcome === 'seats'));
  assert.ok(noSeats.guests.every((g) => g.seat === null));
});
test('live progress is saved independently and reconstructs exactly without advancing finances', () => {
  const original = opened(),
    run = begin(original);
  const timeline = serviceTimeline(run);
  const advanced = applyCafeAction(run, { action: 'advance', runId: 'week-one', cursor: 240 });
  assert.deepEqual(advanced.finance, original.finance);
  assert.equal(advanced.reports.length, 0);
  assert.equal(advanced.week, 1);
  const restored = parseCafe(JSON.stringify(advanced));
  assert.equal(restored.run.cursor, 240);
  assert.deepEqual(serviceTimeline(restored), timeline);
  assert.throws(() => applyCafeAction(advanced, { action: 'advance', runId: 'week-one', cursor: 239 }));
  assert.throws(() => applyCafeAction(advanced, { action: 'advance', runId: 'stale', cursor: 500 }));
  assert.throws(() =>
    applyCafeAction(advanced, { action: 'advance', runId: 'week-one', cursor: timeline.duration + 1 }),
  );
  assert.throws(() => applyCafeAction(advanced, { action: 'loan', amount: 100000 }));
});
test('skip and fully watched weeks settle identically, once, and preserve old save compatibility', () => {
  const original = opened(),
    run = begin(original),
    timeline = serviceTimeline(run);
  const watched = applyCafeAction(run, { action: 'advance', runId: 'week-one', cursor: timeline.duration });
  const finish = { action: 'finish', runId: 'week-one' };
  assert.deepEqual(applyCafeAction(run, finish), applyCafeAction(watched, finish));
  assert.deepEqual(
    applyCafeAction(run, finish),
    applyCafeAction(original, { action: 'week', plan: defaultPlan() }),
  );
  const report = applyCafeAction(run, finish).reports.at(-1);
  assert.deepEqual(serviceTotals(timeline, serviceTime(timeline, timeline.duration).absolute), {
    served: report.served,
    revenue: report.revenue,
    lost: report.demand - report.served,
  });
  const legacy = JSON.stringify(original);
  assert.deepEqual(parseCafe(legacy), original);
  assert.equal(serviceTimeline(original), undefined);
});
test('service commands retain idempotency across restarts and reject new mutation while unsaved', () => {
  const values = new Map();
  const store = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  let service = new Cafe(store, 42);
  const execute = (payload, id) => {
    const request = { ...payload, requestId: id, revision: service.view().state.revision };
    service.execute(request);
    service.confirmSaved();
    return request;
  };
  execute(
    { action: 'setup', setup: { location: 'campus', machine: 'starter', seats: 6, positioning: 'express' } },
    'setup',
  );
  execute({ action: 'open', runId: 'r1', plan: defaultPlan() }, 'open');
  execute({ action: 'advance', runId: 'r1', cursor: 120 }, 'advance');
  service = new Cafe(store, 999);
  assert.equal(service.view().state.run.cursor, 120);
  const request = execute({ action: 'finish', runId: 'r1' }, 'finish');
  const saved = values.get(CAFE_KEY);
  service.execute(request);
  assert.equal(values.get(CAFE_KEY), saved);
  assert.equal(service.view().state.reports.length, 1);
  assert.equal(service.view().timeline, undefined);
  assert.throws(() =>
    service.execute({
      action: 'finish',
      runId: 'r1',
      requestId: 'again',
      revision: service.view().state.revision,
    }),
  );
});
test('malformed run data is rejected without replacing original bytes', () => {
  for (const run of [
    { id: 'x', cursor: -1, plan: defaultPlan() },
    { id: 'x', cursor: 1.5, plan: defaultPlan() },
    { id: '', cursor: 0, plan: defaultPlan() },
  ]) {
    assert.throws(() => parseCafe(JSON.stringify({ ...opened(), run })));
  }
});
