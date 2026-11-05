import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSnapshot, validateSettings, DEFAULT_SETTINGS } from '../../app/income/src/calculator.js';
import { createAttendance, setAttendanceTimes } from '../../app/income/src/attendance.js';
import { changeOwed, emptyOwed, owedSummary, parseOwed, validateOvertimeConfig } from '../../app/income/src/owed.js';

const at = (date, t) => new Date(`${date}T${t}`);
// Weekly calendar, Mon-Fri; 2026-11-05 is a Thursday, 2026-11-07 a Saturday.
const settings = (overtime) => {
  const checked = validateSettings({ ...DEFAULT_SETTINGS, monthlySalary: 10000, calendarMode: 'weekly', stealMode: true, clockMode: true, ...(overtime ? { overtime } : {}) });
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  return checked.settings;
};
function attend(days, now) {
  let a = createAttendance(at('2026-11-01', '00:00:00'));
  for (const [date, start, end] of days) {
    const r = setAttendanceTimes(a, { date, startAt: at(date, start).getTime(), endAt: end ? at(date, end).getTime() : null, source: 'recorded' }, now);
    assert.equal(r.ok, true, JSON.stringify(r));
    a = r.attendance;
  }
  return a;
}

test('old settings without overtime get defaults; invalid values are rejected', () => {
  const old = { ...DEFAULT_SETTINGS, monthlySalary: 1 };
  delete old.overtime;
  const parsed = validateSettings(old);
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.settings.overtime, { enabled: false, workdayRate: 1.5, restRate: 2, holidayRate: 3, minMinutes: 5 });
  assert.equal(validateSettings({ ...old, overtime: { enabled: 'yes' } }).valid, false);
  assert.equal(validateOvertimeConfig({ workdayRate: 0.5 }).valid, false);
  assert.equal(validateOvertimeConfig({ minMinutes: 2.5 }).valid, false);
  assert.equal(validateOvertimeConfig({ workdayRate: '2' }).config.workdayRate, 2);
});

test('early arrival, late leave and weekend work are split from real clock facts', () => {
  const now = at('2026-11-07', '20:00:00');
  const s = settings();
  const a = attend([
    ['2026-11-05', '08:30:00', '19:00:00'], // 30 min early, 60 min late
    ['2026-11-06', '08:57:00', '18:03:00'], // below the 5 minute threshold both ends
    ['2026-11-07', '10:00:00', '12:00:00'], // Saturday, 2 h
  ], now);
  const snap = calculateSnapshot(s, now, undefined, [], a);
  const day = (date) => snap.owedDays.find((d) => d.date === date);
  assert.deepEqual([day('2026-11-05').earlySeconds, day('2026-11-05').lateSeconds], [1800, 3600]);
  assert.equal(day('2026-11-07').restSeconds, 7200);
  assert.equal(day('2026-11-07').kind, 'weekend');
  const sum = owedSummary({ settings: s, snapshot: snap, data: emptyOwed(), now: now.getTime() });
  assert.deepEqual(sum.seconds, { early: 1800, late: 3600, rest: 7200, message: 0 });
  const ps = snap.perSecond;
  assert.ok(Math.abs(sum.parts.early - 1800 * ps * 1.5) < 1e-9);
  assert.ok(Math.abs(sum.parts.rest - 7200 * ps * 2) < 1e-9);
  assert.ok(Math.abs(sum.today - sum.parts.rest) < 1e-9);
  assert.ok(Math.abs(sum.days['2026-11-05'] - sum.parts.early - sum.parts.late) < 1e-9);
  assert.equal(sum.enabled, false);
});

test('no clock mode means no attendance-based overtime', () => {
  const now = at('2026-11-05', '20:00:00');
  const s = validateSettings({ ...DEFAULT_SETTINGS, monthlySalary: 10000, calendarMode: 'weekly' }).settings;
  const snap = calculateSnapshot(s, now, undefined, [], attend([['2026-11-05', '08:00:00', '20:00:00']], now));
  assert.equal(snap.owedDays.every((d) => !d.earlySeconds && !d.lateSeconds && !d.restSeconds), true);
});

test('messages: add, edit, remove, validation keeps input untouched', () => {
  const now = at('2026-11-05', '21:00:00').getTime();
  let n = 0;
  const id = () => `m${++n}`;
  const bad = changeOwed(emptyOwed(), { action: 'add', date: '2026-11-06', minutes: 0 }, now, id);
  assert.ok(bad.errors.date && bad.errors.minutes);
  let data = changeOwed(emptyOwed(), { action: 'add', date: '2026-11-05', minutes: 15, note: '老板 @ 我' }, now, id).data;
  data = changeOwed(data, { action: 'edit', id: 'm1', date: '2026-11-04', minutes: 20, note: '' }, now, id).data;
  assert.deepEqual([data.messages[0].date, data.messages[0].minutes], ['2026-11-04', 20]);
  assert.equal(changeOwed(data, { action: 'edit', id: 'nope', date: '2026-11-04', minutes: 5 }, now, id).data, undefined);
  assert.deepEqual(parseOwed(JSON.stringify(data)), data);
  assert.equal(changeOwed(data, { action: 'remove', id: 'm1' }, now, id).data.messages.length, 0);
  assert.throws(() => parseOwed('{"version":1,"messages":[{}],"unlocked":[]}'));
});
