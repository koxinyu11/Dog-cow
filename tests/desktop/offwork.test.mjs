import test from 'node:test';
import assert from 'node:assert/strict';
import { offworkNotice, shouldCelebrateOffwork } from '../../dist-electron/src/shared/offwork.js';
const date = '2026-11-04';
const at = (time) => new Date(`${date}T${time}`).getTime();
function income(time = '17:55:00') {
  return { now: at(time), settings: { endTime: '18:00', stealMode: true, clockMode: true }, snapshot: { status: 'working' }, attendance: { days: [{ date, clockIn: { at: at('09:00:00') }, clockOut: null }] }, calculationError: null };
}
test('notice enters at ten minutes and switches copy at minute boundaries', () => {
  assert.equal(offworkNotice(income('17:49:59')), null);
  assert.equal(offworkNotice(income('17:50:00')).seconds, 600);
  assert.equal(offworkNotice(income('17:59:00')).text, '准备收工');
  assert.equal(offworkNotice(income('18:00:00')).text, '到点啦，今天辛苦了');
  assert.match(offworkNotice(income('18:01:00')).text, /椅子/);
  assert.match(offworkNotice(income('18:10:00')).text, /满杯/);
  assert.match(offworkNotice(income('18:30:00')).text, /早点收工/);
});
test('no notice for leave, rest, finished, missing clock-in, calculation errors or overnight stale attendance', () => {
  for (const modify of [s => s.snapshot.fullDayLeave = true, s => s.snapshot.status = 'rest-day', s => s.attendance.days[0].clockOut = { at: at('18:00:00') }, s => s.calculationError = { code: 'invalid' }, s => s.snapshot.pendingClockIn = true]) {
    const s = income(); modify(s); assert.equal(offworkNotice(s), null);
  }
  const s = income('18:30:00'); s.attendance.days = []; assert.equal(offworkNotice(s), null);
  s.settings.clockMode = false; assert.equal(offworkNotice(s), null);
});
test('celebration requires first current-day recorded finish with persisted result', () => {
  const before = income(); const after = income('18:00:00');
  after.attendance.days[0].clockOut = { at: after.now };
  const result = { applied: true, persisted: true, snapshot: { income: after } };
  assert.equal(shouldCelebrateOffwork('finish', 'recorded', date, before, result), true);
  for (const [action, method, day, prior, outcome] of [
    ['edit', 'recorded', date, before, result], ['finish', 'backfill', date, before, result],
    ['finish', 'recorded', '2026-11-03', before, result], ['finish', 'recorded', date, after, result],
    ['finish', 'recorded', date, before, { ...result, applied: false }],
    ['finish', 'recorded', date, before, { ...result, persisted: false }],
  ]) assert.equal(shouldCelebrateOffwork(action, method, day, prior, outcome), false);
});
test('header notice follows the frozen elastic end instead of global end',()=>{
 const s=income('18:05:00');s.snapshot.scheduledEndAt=at('19:00:00');
 assert.equal(offworkNotice(s),null);
 s.now=at('18:55:00');assert.equal(offworkNotice(s).seconds,300);
 s.now=at('19:05:00');assert.equal(offworkNotice(s).kind,'overtime');
});
