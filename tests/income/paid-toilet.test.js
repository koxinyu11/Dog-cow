import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSnapshot, validateSettings } from '../../app/income/src/calculator.js';
import { createAttendance, applyAttendanceAction, setAttendanceTimes } from '../../app/income/src/attendance.js';
import { createIncomeController } from '../../app/income/src/controller.js';
import { TOILET_KEY, validateToilet, loadToilet, changeToilet, endToilet, reviewToilet } from '../../app/income/src/paid-toilet.js';
const at = (h, m = 0, ms = 0) => new Date(2026, 10, 4, h, m, 0, ms);
const settings = overrides => validateSettings({ monthlySalary: 8400, startTime: '09:00', endTime: '17:00', workdays: [1, 2, 3, 4, 5], calendarMode: 'weekly', stealMode: true, clockMode: false, ...overrides }).settings;
const record = (id, start = at(10), end = at(10, 8)) => ({ id, startAt: +start, endAt: +end, status: 'completed' });
const empty = () => ({ version: 1, records: [] });
const calculate = (records = [], overrides = {}, attendance = createAttendance(at(9)), leaves = [], now = at(16)) => calculateSnapshot(settings(overrides), now, undefined, leaves, attendance, records);

test('eight minutes add only stolen time, preserving salary and actual work', () => {
  const before = calculate(); const after = calculate([record('a')]);
  assert.equal(after.toiletStolenSeconds, 480);
  assert.equal(after.stolenSeconds - before.stolenSeconds, 480);
  for (const key of ['earnedToday', 'earnedMonth', 'elapsedSeconds', 'actualBreakSeconds', 'earlyAmount', 'lateAmount']) assert.equal(after[key], before[key], key);
  assert.ok(Math.abs(after.toiletStolenAmount - 480 * after.perSecond) < 1e-10);
});
test('overlap is attributed once and milliseconds are rounded after combination', () => {
  const result = calculate([record('a'), record('b', at(10, 4), at(10, 12))]);
  assert.equal(result.toiletStolenSeconds, 720);
  assert.deepEqual(result.toiletDetails.map(item => item.addedSeconds), [480, 240]);
  const fragments = calculate([record('a', at(10, 0), at(10, 0, 700)), record('b', at(10, 1), at(10, 1, 700))]);
  assert.equal(fragments.toiletStolenSeconds, 1);
});
test('paid and unpaid leave, scheduled lunch and outside schedule are excluded', () => {
  const leaves = [{ id: 'leave', date: '2026-11-04', fullDay: false, startTime: '10:02', endTime: '10:06', paid: true }];
  assert.equal(calculate([record('a')], {}, undefined, leaves).toiletStolenSeconds, 240);
  assert.equal(calculate([record('a')], {}, undefined, [{ ...leaves[0], paid: false }]).toiletStolenSeconds, 240);
  assert.equal(calculate([record('a', at(12), at(13))], { lunchCountsAsWork: false, lunchStartTime: '12:00', lunchEndTime: '13:00' }).toiletStolenSeconds, 0);
  assert.equal(calculate([record('a', at(8), at(9))]).toiletStolenSeconds, 0);
});
test('clock facts bound activities and early-departure settlement stays unchanged', () => {
  const initial = createAttendance(at(9));
  const change = setAttendanceTimes(initial, { date: '2026-11-04', startAt: +at(10), endAt: +at(15), source: 'backfill' }, at(16));
  assert.equal(change.ok, true);
  const before = calculate([], { clockMode: true }, change.attendance);
  const after = calculate([record('a', at(9), at(11)), record('b', at(14), at(16))], { clockMode: true }, change.attendance);
  assert.equal(after.toiletStolenSeconds, 7200);
  assert.equal(after.earlySeconds, before.earlySeconds);
  assert.equal(after.lateSeconds, before.lateSeconds);
  assert.equal(after.stolenSeconds - before.stolenSeconds, 7200);
  assert.equal(calculate([record('a')], { clockMode: true }).toiletStolenSeconds, 0);
});
test('manual lunch remains a separate category and cannot be counted twice', () => {
  let attendance = createAttendance(at(9));
  attendance = applyAttendanceAction(attendance, 'pause', at(10)).attendance;
  attendance = applyAttendanceAction(attendance, 'resume', at(10, 8)).attendance;
  const result = calculate([record('a')], {}, attendance);
  assert.equal(result.toiletStolenSeconds, 0);
  assert.equal(result.lunchStolenSeconds, 480);
});
test('interrupted records never enter totals; running records are live estimates', () => {
  const item = { ...record('a'), endAt: null, status: 'running' };
  assert.equal(calculate([item], {}, undefined, [], at(10, 4)).toiletStolenSeconds, 240);
  assert.equal(calculate(reviewToilet({ version: 1, records: [item] }, 'sleep').data.records).toiletStolenSeconds, 0);
});
test('start, finish, cancel, review and editing enforce identity and time bounds', () => {
  const start = changeToilet(empty(), { action: 'start' }, +at(10), '', () => 'a');
  assert.equal(start.ok, true);
  assert.equal(changeToilet(start.data, { action: 'start' }, +at(10), '', () => 'b').ok, false);
  assert.equal(changeToilet(start.data, { action: 'end', recordId: 'missing' }, +at(11), '', () => '').errorCode, 'TOILET_CONFLICT');
  const end = changeToilet(start.data, { action: 'end', recordId: 'a' }, +at(10, 8), '', () => '');
  assert.equal(end.data.records[0].endAt, +at(10, 8));
  assert.equal(changeToilet(end.data, { action: 'end', recordId: 'a' }, +at(11), '', () => '').ok, false);
  assert.equal(changeToilet(end.data, { action: 'editEnd', recordId: 'a', endAt: +at(18) }, +at(11), '', () => '').errorCode, 'TOILET_TIME_INVALID');
  const reviewed = reviewToilet(start.data, 'sleep').data;
  const resolved = changeToilet(reviewed, { action: 'review', recordId: 'a', endAt: +at(10, 8) }, +at(11), '', () => '');
  assert.equal(resolved.data.records[0].status, 'completed');
  assert.equal(changeToilet(start.data, { action: 'cancel', recordId: 'a' }, +at(11), '', () => '').data.records.length, 0);
});
test('load preserves corrupt raw values and converts every unfinished record to review', () => {
  const raw = '{broken'; let writes = 0;
  const bad = loadToilet({ getItem: () => raw, setItem: () => writes++ });
  assert.ok(bad.error); assert.equal(writes, 0);
  assert.throws(() => validateToilet({ version: 1, records: [record('a'), record('a')] }));
  assert.throws(() => validateToilet({ version: 1, records: [{ ...record('a'), endAt: -1 }] }));
  const data = { version: 1, records: [{ ...record('a'), endAt: null, status: 'running' }] };
  assert.equal(loadToilet({ getItem: () => JSON.stringify(data) }).data.records[0].status, 'needs-review');
});
test('backfilled departure before activity start cannot create a negative interval', () => {
  const data = { version: 1, records: [{ ...record('a'), endAt: null, status: 'running' }] };
  const ended = endToilet(data, +at(9), 'offwork');
  assert.equal(ended.records[0].status, 'needs-review');
  assert.equal(ended.records[0].endAt, null);
});
test('controller publishes combined lunch and activity facts only after both are staged', () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  let now = at(10); const controller = createIncomeController({ storage, now: () => now, setIntervalImpl: () => 0, clearIntervalImpl: () => {} });
  controller.updateSettings(settings());
  const running = { version: 1, records: [{ ...record('a'), endAt: null, status: 'running' }] };
  controller.commitToilet(running);
  const observations = [];
  const off = controller.subscribe(state => observations.push({ state, disk: JSON.parse(storage.getItem(TOILET_KEY)) }));
  observations.length = 0;
  now = at(10, 8);
  const paused = applyAttendanceAction(controller.getState().attendance, 'pause', now);
  controller.commitAttendance(paused.attendance, endToilet(running, +now, 'lunch'));
  assert.equal(observations.length, 1);
  assert.equal(observations[0].state.toilet.records[0].endAt, +now);
  assert.equal(observations[0].disk.records[0].endAt, +now);
  assert.equal(observations[0].state.snapshot.toiletStolenSeconds, 480);
  off(); controller.destroy();
});
test('cross-month records contribute only the effective slice to each month', () => {
  const item = record('a', new Date(2026, 9, 30, 16, 55), new Date(2026, 10, 2, 9, 5));
  const oct = calculateSnapshot(settings(), new Date(2026, 9, 31, 23), undefined, [], createAttendance(at(9)), [item]);
  const nov = calculateSnapshot(settings(), new Date(2026, 10, 2, 10), undefined, [], createAttendance(at(9)), [item]);
  assert.equal(oct.toiletMonthAmount / oct.perSecond, 300);
  assert.equal(nov.toiletStolenSeconds, 300);
});
