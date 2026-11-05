import test from 'node:test';
import assert from 'node:assert/strict';
import { traySummary } from '../../dist-electron/src/shared/tray-summary.js';
import { sortedHopes } from '../../dist-electron/src/shared/hope-summary.js';
const fixture = () => ({ income: { settings: {}, calculationError: null, now: new Date('2026-11-05T12:00:00').getTime(), snapshot: { status: 'working', earnedMonth: 3820, remainingSeconds: 3661, elapsedSeconds: 3600 } }, tasks: { tasks: [] }, taskError: '', board: { fun: { hopes: [] } }, hopeHolidays: [] });
const task = (id, done, startTime = '', date = '2026-11-05') => ({ id, title: id, date, done, startTime, hasTime: !!startTime });
test('summary uses actual work states rather than inferring working from numeric countdown', () => {
  const state = fixture();
  for (const [status, label] of [['working','工作中'], ['before-work','尚未上班'], ['paused','午休中'], ['pending-clock','待补上班卡'], ['after-work','已下班']]) {
    state.income.snapshot.status = status;
    assert.equal(traySummary(state).status, label);
  }
  assert.equal(traySummary(state).countdown, '—');
  assert.equal(traySummary(state).month, '¥3,820.00');
  state.income.calculationError = { code: 'error' };
  assert.equal(traySummary(state).status, '暂不可用');
  assert.equal(traySummary(state).worked, '—');
  state.income.settings = null;
  assert.equal(traySummary(state).status, '未设置');
});
test('task summary scopes today, includes due dates, orders timed pending tasks and preserves input', () => {
  const state = fixture();
  state.tasks.tasks = [task('done', true), task('later', false, '15:00'), task('first', false, '10:00'), task('undated', false), task('tomorrow', false, '', '2026-11-06'), { ...task('due', true, '', '2026-11-04'), dueDate: '2026-11-05' }];
  const before = structuredClone(state.tasks.tasks);
  const summary = traySummary(state).tasks;
  assert.equal(summary.total, 5); assert.equal(summary.done, 2); assert.equal(summary.percent, 40); assert.equal(summary.next.title, 'first');
  assert.deepEqual(state.tasks.tasks, before);
  state.taskError = 'read error'; assert.equal(traySummary(state).tasks.unavailable, true); assert.equal(traySummary(state).tasks.next, null);
  state.tasks.tasks = []; assert.equal(traySummary(state).tasks.percent, 0);
});
test('hope sorting shares recurrence rules, preserves emoji and ranks pending and past last', () => {
  const state = fixture();
  state.board.fun.hopes = [
    { id: 'past', name: '过去', date: '2026-10-01' },
    { id: 'holiday', name: '假期', date: '2026-01-01', repeat: 'holiday' },
    { id: 'salary', name: '发薪', emoji: '💰', date: '2026-01-10', repeat: 'month' },
    { id: 'friday', name: '周五', emoji: '🍻', date: '2026-10-30', repeat: 'week' },
  ];
  const summary = traySummary(state);
  assert.deepEqual(summary.hopes.map(h => h.id), ['friday', 'salary', 'holiday', 'past']);
  assert.equal(summary.hopes[0].days, 1); assert.equal(summary.hopes[1].days, 5); assert.equal(summary.hopes[1].emoji, '💰');
  assert.equal(summary.hopes[2].days, null);
  assert.deepEqual(sortedHopes(state.board.fun.hopes, '2026-11-05', []).map(h => h.hope.id), summary.hopes.map(h => h.id));
  state.hopeHolidays = [{ name: '元旦', date: '2027-01-01' }];
  assert.equal(traySummary(state).hopes.find(h => h.id === 'holiday').label, '元旦');
});
