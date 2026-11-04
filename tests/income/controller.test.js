import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncomeController } from '../../app/income/src/controller.js';
import { validateSettings } from '../../app/income/src/calculator.js';
import { createAttendance, setAttendanceTimes } from '../../app/income/src/attendance.js';
import { SETTINGS_KEY, PREVIOUS_SETTINGS_KEY, V2_SETTINGS_KEY, LEGACY_SETTINGS_KEY } from '../../app/income/src/storage.js';

const base = {
  monthlySalary: 8400, startTime: '09:00', endTime: '17:00',
  workdays: [1, 2, 3, 4, 5], calendarMode: 'weekly',
};
const at = (hour, minute = 0, day = 4) => new Date(2026, 10, day, hour, minute);
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);
const holidayData = (year) => ({
  year, papers: ['https://example.test/holidays/' + year],
  days: [{ date: year + '-01-01', isOffDay: true, name: '测试元旦' }],
});
const ready = (year) => ({
  status: 'ready', data: holidayData(year), source: 'network',
  updatedAt: at(10).getTime(), refreshFailed: false,
});

function harness({ items = [], failRead = false, failWrite = false, loader = ready, initialNow = at(10) } = {}) {
  let current = new Date(initialNow);
  let writeBlocked = failWrite;
  let intervalCallback;
  let timerCount = 0;
  const clears = [];
  const writes = [];
  const calls = [];
  const values = new Map(items);
  const storage = {
    getItem(key) {
      if (failRead) throw new Error('denied');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (writeBlocked) throw new Error('full');
      writes.push([key, value]);
      values.set(key, value);
    },
  };
  const controller = createIncomeController({
    storage, now: () => current,
    calendarLoader: (year, options) => { calls.push([year, options]); return loader(year, options); },
    setIntervalImpl(callback, delay) {
      timerCount += 1;
      assert.equal(delay, 1000);
      intervalCallback = callback;
      return 'one-income-timer';
    },
    clearIntervalImpl: (id) => clears.push(id),
  });
  return {
    controller, storage, values, writes, calls, clears,
    get timerCount() { return timerCount; },
    advance(date) { current = new Date(date); },
    fire() { intervalCallback(); },
    allowWrite() { writeBlocked = false; },
  };
}

function saved(settings = base, attendance = createAttendance(at(10))) {
  return JSON.stringify({
    version: 4, settings: validateSettings(settings).settings, leaves: [], attendance,
  });
}

test('creates one clock owner without a view and never writes empty setup', (t) => {
  const h = harness();
  t.after(() => h.controller.destroy());
  assert.equal(h.timerCount, 1);
  assert.equal(h.writes.length, 0);
  assert.equal(h.controller.getState().settings, null);
  h.advance(at(11, 0, 5));
  h.fire();
  assert.equal(h.writes.length, 0);
  assert.deepEqual(h.controller.getState().attendance.modeDays, []);

  const result = h.controller.updateSettings(base);
  assert.equal(result.applied, true);
  assert.equal(result.persisted, true);
  const writes = h.writes.length;
  h.advance(at(15, 0, 5));
  h.fire();
  assert.equal(h.timerCount, 1);
  assert.equal(h.writes.length, writes);
  closeTo(h.controller.getState().snapshot.earnedToday, 300);
  assert.equal(h.controller.getState().now.getHours(), 15);
});

test('subscription is immediate, independently copied, and hiding views does not stop the clock', (t) => {
  const h = harness();
  t.after(() => h.controller.destroy());
  h.controller.updateSettings(base);
  let firstCalls = 0;
  let secondCalls = 0;
  const unsubscribe = h.controller.subscribe((state) => {
    firstCalls += 1;
    state.settings.monthlySalary = 0;
    state.attendance.modeDays.push({ date: 'bad' });
    state.now.setFullYear(1900);
  });
  h.controller.subscribe((state) => {
    secondCalls += 1;
    assert.equal(state.settings.monthlySalary, 8400);
    assert.equal(state.now.getFullYear(), 2026);
    assert.equal(state.attendance.modeDays.length, 1);
  });
  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 1);
  unsubscribe();
  h.advance(at(11));
  h.fire();
  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 2);
  closeTo(h.controller.getState().snapshot.earnedToday, 100);
  const copy = h.controller.getState();
  copy.leaves.push({ id: 'foreign' });
  assert.deepEqual(h.controller.getState().leaves, []);
});

test('invalid settings keep the last valid snapshot and do not write', (t) => {
  const h = harness();
  t.after(() => h.controller.destroy());
  h.controller.updateSettings(base);
  const before = h.controller.getState();
  const count = h.writes.length;
  const result = h.controller.updateSettings({ ...base, monthlySalary: '' });
  assert.deepEqual([result.applied, result.persisted], [false, false]);
  assert.ok(result.errors.monthlySalary);
  assert.equal(h.writes.length, count);
  assert.deepEqual(h.controller.getState(), before);
});

test('write failure applies memory once and retry saves the same latest state', (t) => {
  const h = harness({ failWrite: true });
  t.after(() => h.controller.destroy());
  const result = h.controller.updateSettings(base);
  assert.deepEqual([result.applied, result.persisted], [true, false]);
  assert.equal(h.controller.getState().storageStatus.writeStatus, 'failed');
  assert.equal(h.controller.getState().storageStatus.canRetry, true);
  assert.equal(h.values.has(SETTINGS_KEY), false);
  closeTo(h.controller.getState().snapshot.earnedToday, 50);
  h.allowWrite();
  const retry = h.controller.retrySave();
  assert.deepEqual([retry.applied, retry.persisted], [true, true]);
  assert.equal(h.controller.getState().storageStatus.writeStatus, 'saved');
  assert.equal(h.controller.getState().storageStatus.canRetry, false);
  assert.equal(JSON.parse(h.values.get(SETTINGS_KEY)).settings.monthlySalary, 8400);
  assert.equal(h.writes.length, 1);
});

test('leave and clock commands update shared subscribers through one persisted snapshot', (t) => {
  const h = harness({ initialNow: at(10, 30) });
  t.after(() => h.controller.destroy());
  h.controller.updateSettings({ ...base, stealMode: true, clockMode: true });
  const observed = [[], []];
  h.controller.subscribe((state) => observed[0].push(state.snapshot?.stolenAmount));
  h.controller.subscribe((state) => observed[1].push(state.snapshot?.stolenAmount));
  closeTo(h.controller.getState().snapshot.lateAmount, 75);
  const proposed = setAttendanceTimes(h.controller.getState().attendance, {
    date: '2026-11-04', startAt: at(9).getTime(), endAt: null, source: 'backfill',
  }, at(10, 30));
  assert.equal(proposed.ok, true);
  assert.equal(h.controller.commitAttendance(proposed.attendance).applied, true);
  assert.equal(h.controller.getState().snapshot.lateAmount, 0);

  const leave = { id: 'one-leave', date: '2026-11-04', fullDay: false, startTime: '09:00', endTime: '10:00', paid: true };
  assert.equal(h.controller.saveLeave(leave).applied, true);
  assert.equal(h.controller.getState().snapshot.elapsedSeconds, 1800);
  closeTo(h.controller.getState().snapshot.earnedToday, 75);
  assert.equal(h.controller.saveLeave({ ...leave, paid: false }, leave.id).applied, true);
  closeTo(h.controller.getState().snapshot.earnedToday, 25);
  assert.equal(h.controller.removeLeave(leave.id).applied, true);
  closeTo(h.controller.getState().snapshot.earnedToday, 75);
  assert.equal(h.controller.getState().snapshot.elapsedSeconds, 5400);
  assert.deepEqual(observed[0], observed[1]);
  const stored = JSON.parse(h.values.get(SETTINGS_KEY));
  assert.equal(stored.leaves.length, 0);
  assert.equal(stored.attendance.days[0].clockIn.source, 'backfill');
});

test('invalid leave and attendance proposals cannot replace shared valid state', (t) => {
  const h = harness();
  t.after(() => h.controller.destroy());
  h.controller.updateSettings(base);
  const before = h.controller.getState();
  const count = h.writes.length;
  assert.equal(h.controller.saveLeave({ id: 'bad', date: 'bad', paid: false, fullDay: true }).applied, false);
  assert.equal(h.controller.commitAttendance({ trackingFrom: 'bad' }).applied, false);
  assert.equal(h.controller.removeLeave('missing').applied, false);
  assert.deepEqual(h.controller.getState(), before);
  assert.equal(h.writes.length, count);
});

test('a new local date stamps mode exactly once while normal ticks never save', (t) => {
  const h = harness();
  t.after(() => h.controller.destroy());
  h.controller.updateSettings(base);
  const count = h.writes.length;
  h.advance(at(0, 0, 5));
  h.fire();
  assert.equal(h.writes.length, count + 1);
  assert.equal(h.controller.getState().attendance.modeDays.length, 2);
  h.advance(at(0, 1, 5));
  h.fire();
  assert.equal(h.writes.length, count + 1);
});

test('loaded current-day mode evidence avoids another startup write', (t) => {
  const attendance = createAttendance(at(10));
  attendance.modeDays.push({ date: '2026-11-04', stealMode: false, clockMode: false });
  const h = harness({ items: [[SETTINGS_KEY, saved(base, attendance)]] });
  t.after(() => h.controller.destroy());
  assert.equal(h.controller.getState().storageStatus.readStatus, 'loaded');
  assert.equal(h.writes.length, 0);
  closeTo(h.controller.getState().snapshot.earnedToday, 50);
});

test('legacy migration keeps exact clock facts and every previous key as a backup', (t) => {
  const startedAt = at(9).getTime() + 123;
  const finishedAt = at(17).getTime() + 321;
  const previous = JSON.stringify({
    version: 3, settings: base, leaves: [],
    attendance: { trackingFrom: '2026-11-04', days: [{
      date: '2026-11-04', events: [{ type: 'start', at: startedAt }, { type: 'finish', at: finishedAt }],
    }] },
  });
  const old2 = '{"version":2,"backup":"untouched"}';
  const old1 = '{"version":1,"backup":"untouched"}';
  const h = harness({
    initialNow: at(18),
    items: [[PREVIOUS_SETTINGS_KEY, previous], [V2_SETTINGS_KEY, old2], [LEGACY_SETTINGS_KEY, old1]],
  });
  t.after(() => h.controller.destroy());
  const state = h.controller.getState();
  assert.equal(state.storageStatus.readStatus, 'migration');
  assert.equal(state.storageStatus.writeStatus, 'saved');
  assert.equal(state.attendance.days[0].clockIn.at, startedAt);
  assert.equal(state.attendance.days[0].clockOut.at, finishedAt);
  assert.equal(state.settings.salaryMode, 'net');
  assert.equal(state.settings.stealMode, false);
  assert.ok(state.migrationNotice);
  assert.equal(h.values.get(PREVIOUS_SETTINGS_KEY), previous);
  assert.equal(h.values.get(V2_SETTINGS_KEY), old2);
  assert.equal(h.values.get(LEGACY_SETTINGS_KEY), old1);
  assert.ok(h.values.has(SETTINGS_KEY));
});

test('bad stored data remains untouched and cannot turn into an automatic blank save', (t) => {
  const bad = '{broken';
  const h = harness({ items: [[SETTINGS_KEY, bad]] });
  t.after(() => h.controller.destroy());
  assert.equal(h.controller.getState().storageStatus.readStatus, 'invalid');
  h.advance(at(12));
  h.fire();
  assert.equal(h.writes.length, 0);
  assert.equal(h.values.get(SETTINGS_KEY), bad);
  assert.equal(h.controller.getState().snapshot, null);
});

test('calendar requests merge both years, share an in-flight job and respect the check interval', async (t) => {
  const h = harness();
  t.after(() => h.controller.destroy());
  h.controller.updateSettings({ ...base, calendarMode: 'cn' });
  assert.equal(h.controller.getState().calendar.busy, true);
  await h.controller.refreshCalendar();
  assert.deepEqual(h.calls.map(([year]) => year), [2026, 2027]);
  assert.deepEqual(h.controller.getState().calendarContext.readyYears, [2026, 2027]);
  assert.equal(h.controller.getState().calendar.busy, false);
  assert.equal(h.controller.getState().calculationError, null);
  closeTo(h.controller.getState().snapshot.earnedToday, 50);
  const writes = h.writes.length;
  await h.controller.refreshCalendar();
  assert.equal(h.calls.length, 2);
  assert.equal(h.writes.length, writes);
  await h.controller.refreshCalendar(true);
  assert.equal(h.calls.length, 4);
  assert.equal(h.calls.at(-1)[1].force, true);
  assert.equal(h.calls.at(-1)[1].storage, h.storage);
});

test('unavailable China calendar pauses calculations and never silently switches modes', async (t) => {
  const h = harness({ loader: () => ({ status: 'unavailable', refreshFailed: true }) });
  t.after(() => h.controller.destroy());
  h.controller.updateSettings({ ...base, calendarMode: 'cn' });
  const result = await h.controller.refreshCalendar();
  assert.equal(result.applied, false);
  assert.equal(h.controller.getState().settings.calendarMode, 'cn');
  assert.equal(h.controller.getState().snapshot, null);
  assert.equal(h.controller.getState().calculationError.code, 'calendar-unavailable');
  assert.equal(h.controller.getState().payrollResult.netSalary, 8400);
  h.controller.updateSettings(base);
  assert.equal(h.controller.getState().calculationError, null);
  closeTo(h.controller.getState().snapshot.earnedToday, 50);
});

test('a failed refresh keeps an already validated context and reports degraded freshness', async (t) => {
  let failing = false;
  const h = harness({ loader: (year) => {
    if (failing) throw new Error('offline');
    return ready(year);
  } });
  t.after(() => h.controller.destroy());
  h.controller.updateSettings({ ...base, calendarMode: 'cn' });
  await h.controller.refreshCalendar();
  failing = true;
  await h.controller.refreshCalendar(true);
  const state = h.controller.getState();
  assert.deepEqual(state.calendarContext.readyYears, [2026, 2027]);
  assert.equal(state.calendar.results[2026].refreshFailed, true);
  assert.equal(state.calculationError, null);
});

test('no-workdays and invalid payroll are exposed without inventing income values', async (t) => {
  const h = harness({ loader: (year) => year === 2026 ? {
    status: 'ready', source: 'network', data: {
      year, papers: ['https://example.test/closed'],
      days: Array.from({ length: 30 }, (_, index) => ({
        date: '2026-11-' + String(index + 1).padStart(2, '0'), isOffDay: true, name: '测试休息',
      })),
    },
  } : ready(year) });
  t.after(() => h.controller.destroy());
  h.controller.updateSettings({ ...base, calendarMode: 'cn' });
  await h.controller.refreshCalendar();
  assert.equal(h.controller.getState().calculationError.code, 'no-workdays');
  assert.equal(h.controller.getState().snapshot, null);
  const result = h.controller.updateSettings({ ...base, monthlySalary: Number.MAX_VALUE, salaryMode: 'gross' });
  assert.equal(result.applied, true);
  assert.equal(h.controller.getState().calculationError.code, 'payroll-invalid');
  assert.equal(h.controller.getState().snapshot, null);
  assert.equal(h.controller.getState().payrollResult.valid, false);
});

test('destroy clears the only timer and asynchronous completion cannot notify or mutate state', async () => {
  const resolvers = [];
  const h = harness({ loader: (year) => new Promise((resolve) => resolvers.push(() => resolve(ready(year)))) });
  h.controller.updateSettings({ ...base, calendarMode: 'cn' });
  let notifications = 0;
  h.controller.subscribe(() => { notifications += 1; });
  const job = h.controller.refreshCalendar();
  await Promise.resolve();
  assert.equal(resolvers.length, 2);
  const before = h.controller.getState();
  const count = notifications;
  h.controller.destroy();
  h.controller.destroy();
  resolvers.forEach((resolve) => resolve());
  await job;
  h.advance(at(15));
  h.fire();
  assert.equal(notifications, count);
  assert.deepEqual(h.controller.getState(), before);
  assert.deepEqual(h.clears, ['one-income-timer']);
  assert.equal(h.controller.updateSettings(base).applied, false);
  assert.equal((await h.controller.refreshCalendar()).applied, false);
});
