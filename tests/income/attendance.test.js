import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAttendance, validateAttendance, migrateLegacyAttendance, setModeDay,
  setAttendanceTimes, applyAttendanceAction, getAttendanceDay,
} from '../../app/income/src/attendance.js';

const date = '2026-11-04';
const time = (hour, minute = 0, day = 4) => new Date(2026, 10, day, hour, minute);
const empty = () => createAttendance(time(0));
const fact = (at) => ({ at, recordedAt: at, updatedAt: at, source: 'recorded' });

function action(attendance, name, at) {
  const result = applyAttendanceAction(attendance, name, at);
  assert.equal(result.ok, true, result.message);
  return result.attendance;
}

function clocks(attendance, startAt, endAt, now = time(18)) {
  const result = setAttendanceTimes(attendance, { date, startAt, endAt, source: 'backfill' }, now);
  assert.equal(result.ok, true, result.message);
  return result.attendance;
}

test('新建记录不伪造上下班或每日模式', () => {
  assert.deepEqual(empty(), { trackingFrom: date, days: [], modeDays: [] });
  assert.equal(validateAttendance(empty()).valid, true);
});

test('新版缺少 modeDays 或打卡事实字段时拒绝加载', () => {
  assert.equal(validateAttendance({ trackingFrom: date, days: [] }).valid, false);
  assert.equal(validateAttendance({ ...empty(), days: [{ date, breaks: [] }] }).valid, false);
});

test('未开始上下班也可单独记录午休，工作区间保持为空', () => {
  const original = empty();
  const paused = action(original, 'pause', time(12));
  const during = getAttendanceDay(paused, date, time(12, 30));
  assert.equal(during.state, 'paused');
  assert.equal(during.startedAt, null);
  assert.deepEqual(during.workIntervals, []);
  assert.deepEqual(during.breakIntervals, [{ start: time(12).getTime(), end: time(12, 30).getTime() }]);
  assert.equal(during.breakSeconds, 1800);
  assert.deepEqual(original, empty());

  const resumed = action(paused, 'resume', time(13));
  const after = getAttendanceDay(resumed, date, time(14));
  assert.equal(after.state, 'not-started');
  assert.equal(after.breakSeconds, 3600);
  assert.deepEqual(after.workIntervals, []);
});

test('一天支持多段不重叠午休', () => {
  let attendance = action(empty(), 'pause', time(12));
  attendance = action(attendance, 'resume', time(12, 30));
  attendance = action(attendance, 'pause', time(15));
  attendance = action(attendance, 'resume', time(15, 15));
  assert.equal(attendance.days[0].breaks.length, 2);
  assert.equal(getAttendanceDay(attendance, date, time(16)).breakSeconds, 2700);
});

test('重复午休或没有午休时继续均被拒绝且保留原事实', () => {
  const paused = action(empty(), 'pause', time(12));
  const before = JSON.stringify(paused);
  assert.equal(applyAttendanceAction(paused, 'pause', time(12, 1)).code, 'already-paused');
  assert.equal(applyAttendanceAction(empty(), 'resume', time(12)).code, 'not-paused');
  assert.equal(JSON.stringify(paused), before);
});

test('下班必须同时提供实际开始时间', () => {
  const result = setAttendanceTimes(empty(), { date, startAt: null, endAt: time(17).getTime(), source: 'backfill' }, time(18));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'missing-start');
  assert.equal(applyAttendanceAction(empty(), 'finish', time(17)).code, 'missing-start');
});

test('补录实际上下班保留事实时间和本次操作时间', () => {
  const attendance = clocks(empty(), time(9).getTime(), time(17).getTime());
  assert.deepEqual(attendance.days[0].clockIn, {
    at: time(9).getTime(), recordedAt: time(18).getTime(), updatedAt: time(18).getTime(), source: 'backfill',
  });
  const day = getAttendanceDay(attendance, date, time(19));
  assert.equal(day.state, 'finished');
  assert.equal(day.startedAt, time(9).getTime());
  assert.equal(day.finishedAt, time(17).getTime());
  assert.deepEqual(day.workIntervals, [{ start: time(9).getTime(), end: time(17).getTime() }]);
});

test('更正迟到事实只改实际值，首次记录时间和未改另一项原样保留', () => {
  const original = clocks(empty(), time(9).getTime(), time(17).getTime());
  const unchangedOut = structuredClone(original.days[0].clockOut);
  const changed = clocks(original, time(9, 30).getTime(), time(17).getTime(), time(19));
  assert.equal(changed.days[0].clockIn.at, time(9, 30).getTime());
  assert.equal(changed.days[0].clockIn.recordedAt, time(18).getTime());
  assert.equal(changed.days[0].clockIn.updatedAt, time(19).getTime());
  assert.deepEqual(changed.days[0].clockOut, unchangedOut);
  assert.equal(original.days[0].clockIn.at, time(9).getTime());
});

test('整组原值重交不会改任何事实的来源或更新时间', () => {
  let attendance = action(empty(), 'start', time(9));
  attendance = action(attendance, 'finish', time(17));
  const saved = structuredClone(attendance);
  const result = setAttendanceTimes(attendance, {
    date, startAt: time(9).getTime(), endAt: time(17).getTime(), source: 'backfill',
  }, time(19));
  assert.equal(result.ok, true);
  assert.deepEqual(result.attendance, saved);
});

test('补开始并当场下班时，两项事实分别保留补录和现场来源', () => {
  const result = setAttendanceTimes(empty(), {
    date, startAt: time(9).getTime(), endAt: time(17).getTime(),
    source: 'backfill', startSource: 'backfill', endSource: 'recorded',
  }, time(17));
  assert.equal(result.ok, true);
  assert.equal(result.attendance.days[0].clockIn.source, 'backfill');
  assert.equal(result.attendance.days[0].clockOut.source, 'recorded');
  assert.equal(result.attendance.days[0].clockIn.recordedAt, time(17).getTime());
  assert.equal(result.attendance.days[0].clockOut.at, time(17).getTime());
});

test('未传单项来源的旧调用继续沿用整组 source', () => {
  const result = setAttendanceTimes(empty(), {
    date, startAt: time(9).getTime(), endAt: time(17).getTime(), source: 'backfill',
  }, time(18));
  assert.equal(result.ok, true);
  assert.equal(result.attendance.days[0].clockIn.source, 'backfill');
  assert.equal(result.attendance.days[0].clockOut.source, 'backfill');
});

test('任何无效来源均原子拒绝，不改原事实', () => {
  const attendance = clocks(empty(), time(9).getTime(), time(17).getTime());
  const original = JSON.stringify(attendance);
  for (const override of [{ source: 'invalid' }, { startSource: 'invalid' }, { endSource: null }]) {
    const result = setAttendanceTimes(attendance, {
      date, startAt: time(9, 30).getTime(), endAt: time(17).getTime(), source: 'backfill', ...override,
    }, time(19));
    assert.deepEqual(result, { ok: false, code: 'invalid-source', message: '打卡来源无效，原记录未修改。' });
    assert.equal(JSON.stringify(attendance), original);
  }
});

test('更正单项时使用其单独来源，未变另一项完整保持原样', () => {
  const first = setAttendanceTimes(empty(), {
    date, startAt: time(9).getTime(), endAt: time(17).getTime(),
    source: 'backfill', endSource: 'recorded',
  }, time(17));
  assert.equal(first.ok, true);
  const original = structuredClone(first.attendance);
  const changed = setAttendanceTimes(first.attendance, {
    date, startAt: time(9, 30).getTime(), endAt: time(17).getTime(),
    source: 'backfill', startSource: 'recorded', endSource: 'backfill',
  }, time(18));
  assert.equal(changed.ok, true);
  assert.equal(changed.attendance.days[0].clockIn.source, 'recorded');
  assert.equal(changed.attendance.days[0].clockIn.updatedAt, time(18).getTime());
  assert.equal(changed.attendance.days[0].clockIn.recordedAt, original.days[0].clockIn.recordedAt);
  assert.deepEqual(changed.attendance.days[0].clockOut, original.days[0].clockOut);
  assert.deepEqual(first.attendance, original);
});

test('已有午休后可补全天上下班并扣除午休工作区间', () => {
  let attendance = action(empty(), 'pause', time(12));
  attendance = action(attendance, 'resume', time(13));
  attendance = clocks(attendance, time(9).getTime(), time(17).getTime());
  assert.deepEqual(getAttendanceDay(attendance, date, time(19)).workIntervals, [
    { start: time(9).getTime(), end: time(12).getTime() },
    { start: time(13).getTime(), end: time(17).getTime() },
  ]);
});

test('上下班修正与已有午休冲突时整组拒绝，不静默裁剪事实', () => {
  let attendance = action(empty(), 'pause', time(12));
  attendance = action(attendance, 'resume', time(13));
  attendance = clocks(attendance, time(9).getTime(), time(17).getTime());
  const previous = JSON.stringify(attendance);
  for (const [startAt, endAt] of [[time(12, 30).getTime(), time(17).getTime()], [time(9).getTime(), time(12, 30).getTime()]]) {
    const result = setAttendanceTimes(attendance, { date, startAt, endAt, source: 'backfill' }, time(19));
    assert.equal(result.code, 'conflicting-breaks');
    assert.equal(JSON.stringify(attendance), previous);
  }
});

test('未结束午休在下班时自然截止，原始午休 end 仍保留 null', () => {
  let attendance = action(empty(), 'start', time(9));
  attendance = action(attendance, 'pause', time(12));
  attendance = action(attendance, 'finish', time(12, 30));
  const day = getAttendanceDay(attendance, date, time(18));
  assert.equal(day.state, 'finished');
  assert.equal(day.breakSeconds, 1800);
  assert.equal(attendance.days[0].breaks[0].end, null);
  assert.equal(applyAttendanceAction(attendance, 'resume', time(18)).code, 'already-finished');
  assert.equal(applyAttendanceAction(attendance, 'pause', time(18)).code, 'already-finished');
});

test('清空两项上下班可保留仅午休事实，无事实时移除日期', () => {
  let attendance = action(empty(), 'start', time(9));
  attendance = action(attendance, 'pause', time(12));
  const breakOnly = clocks(attendance, null, null, time(13));
  assert.equal(breakOnly.days[0].clockIn, null);
  assert.equal(breakOnly.days[0].clockOut, null);
  assert.equal(breakOnly.days[0].breaks.length, 1);
  assert.equal(getAttendanceDay(breakOnly, date, time(13)).state, 'paused');
  const withOnlyClocks = clocks(empty(), time(9).getTime(), time(17).getTime());
  assert.deepEqual(clocks(withOnlyClocks, null, null, time(19)).days, []);
});

test('未来、跨日或上下班乱序输入被拒绝', () => {
  assert.equal(setAttendanceTimes(empty(), { date, startAt: time(18).getTime(), endAt: null, source: 'backfill' }, time(17)).code, 'future-time');
  assert.equal(setAttendanceTimes(empty(), { date, startAt: time(9, 0, 5).getTime(), endAt: null, source: 'backfill' }, time(18, 0, 5)).code, 'invalid-time');
  assert.equal(setAttendanceTimes(empty(), { date: '2026-11-05', startAt: null, endAt: null, source: 'backfill' }, time(17)).code, 'invalid-date');
  assert.equal(setAttendanceTimes(empty(), { date, startAt: time(17).getTime(), endAt: time(9).getTime(), source: 'backfill' }, time(18)).code, 'invalid-order');
});

test('可补历史日期，操作时间回退仍被拒绝', () => {
  const historical = setAttendanceTimes(empty(), {
    date, startAt: time(9).getTime(), endAt: time(17).getTime(), source: 'backfill',
  }, time(10, 0, 5));
  assert.equal(historical.ok, true);
  assert.equal(historical.attendance.days[0].clockIn.recordedAt, time(10, 0, 5).getTime());
  assert.equal(applyAttendanceAction(historical.attendance, 'pause', time(9, 0, 5)).code, 'clock-backwards');
});

test('每日模式必须满足父子依赖，并按日期独立保存', () => {
  assert.equal(setModeDay(empty(), { stealMode: false, clockMode: true }, time(9)).code, 'invalid-mode');
  const first = setModeDay(empty(), { stealMode: true, clockMode: true }, time(9));
  assert.equal(first.ok, true);
  const second = setModeDay(first.attendance, { stealMode: false, clockMode: false }, time(9, 0, 5));
  assert.equal(second.ok, true);
  assert.deepEqual(second.attendance.modeDays, [
    { date, stealMode: true, clockMode: true },
    { date: '2026-11-05', stealMode: false, clockMode: false },
  ]);
  assert.deepEqual(second.attendance.days, []);
});

test('旧版事件迁移保留全部 at 并建立对应事实，不伪造模式', () => {
  const events = [
    { type: 'start', at: time(9).getTime() },
    { type: 'pause', at: time(12).getTime() },
    { type: 'resume', at: time(13).getTime() },
    { type: 'finish', at: time(17).getTime() },
  ];
  const legacy = { trackingFrom: date, days: [{ date, events }] };
  const original = JSON.stringify(legacy);
  const result = migrateLegacyAttendance(legacy);
  assert.equal(result.valid, true);
  const day = result.attendance.days[0];
  assert.deepEqual(day.clockIn, fact(events[0].at));
  assert.deepEqual(day.breaks[0].start, fact(events[1].at));
  assert.deepEqual(day.breaks[0].end, fact(events[2].at));
  assert.deepEqual(day.clockOut, fact(events[3].at));
  assert.deepEqual(result.attendance.modeDays, []);
  assert.equal(JSON.stringify(legacy), original);
});

test('旧版以暂停结束的事件链迁移保持未闭合事实', () => {
  const result = migrateLegacyAttendance({ trackingFrom: date, days: [{ date, events: [
    { type: 'start', at: time(9).getTime() },
    { type: 'pause', at: time(12).getTime() },
    { type: 'finish', at: time(17).getTime() },
  ] }] });
  assert.equal(result.valid, true);
  assert.equal(result.attendance.days[0].breaks[0].end, null);
  assert.equal(getAttendanceDay(result.attendance, date, time(18)).breakSeconds, 5 * 3600);
});

test('旧版错误事件链不能迁移为有效事实', () => {
  for (const events of [
    [{ type: 'pause', at: time(12).getTime() }],
    [{ type: 'start', at: time(9).getTime() }, { type: 'start', at: time(10).getTime() }],
    [{ type: 'start', at: time(10).getTime() }, { type: 'finish', at: time(9).getTime() }],
  ]) {
    assert.equal(migrateLegacyAttendance({ trackingFrom: date, days: [{ date, events }] }).valid, false);
  }
});

test('跨日未结束的事实只计算到当地午夜并提示复核', () => {
  let attendance = action(empty(), 'start', time(9));
  attendance = action(attendance, 'pause', time(12));
  const original = JSON.stringify(attendance);
  const previous = getAttendanceDay(attendance, date, time(10, 0, 5));
  assert.equal(previous.state, 'unfinished');
  assert.equal(previous.needsReview, true);
  assert.equal(previous.breakSeconds, 12 * 3600);
  assert.deepEqual(previous.workIntervals, [{ start: time(9).getTime(), end: time(12).getTime() }]);
  assert.equal(JSON.stringify(attendance), original);
});

test('首次操作/更新时间、事实日期和午休重叠均校验', () => {
  const base = clocks(empty(), time(9).getTime(), time(17).getTime());
  const badFact = structuredClone(base);
  badFact.days[0].clockIn.updatedAt = time(8).getTime();
  assert.equal(validateAttendance(badFact).valid, false);
  const badDate = structuredClone(base);
  badDate.days[0].clockIn.at = time(9, 0, 3).getTime();
  assert.equal(validateAttendance(badDate).valid, false);
  const overlapping = structuredClone(base);
  overlapping.days[0].breaks = [
    { id: 'one', start: fact(time(12).getTime()), end: fact(time(13).getTime()) },
    { id: 'two', start: fact(time(12, 30).getTime()), end: fact(time(14).getTime()) },
  ];
  assert.equal(validateAttendance(overlapping).valid, false);
});


test('午休补录支持多段、修改、删除，冲突和未来时间拒绝且不改原数据', () => {
  const base = clocks(empty(), time(9).getTime(), time(18).getTime());
  const save = (attendance, breaks) => setAttendanceTimes(attendance, {
    date, startAt: time(9).getTime(), endAt: time(18).getTime(), source: 'backfill', breaks,
  }, time(19));
  const first = { id: 'lunch', startAt: time(12).getTime(), endAt: time(13).getTime() };
  const second = { id: 'rest', startAt: time(15).getTime(), endAt: time(15, 15).getTime() };
  const added = save(base, [second, first]);
  assert.equal(added.ok, true);
  assert.equal(added.attendance.days[0].breaks.length, 2);
  assert.equal(added.attendance.days[0].breaks[0].start.source, 'backfill');
  assert.equal(getAttendanceDay(added.attendance, date, time(19)).breakSeconds, 4500);
  const before = structuredClone(added.attendance);
  for (const invalid of [
    { ...second, startAt: time(12, 30).getTime() },
    { ...second, endAt: time(15).getTime() },
    { ...second, endAt: time(20).getTime() },
    { ...second, startAt: time(8).getTime() },
    { ...second, startAt: null, endAt: null },
  ]) assert.equal(save(added.attendance, [first, invalid]).ok, false);
  assert.deepEqual(added.attendance, before);
  const modified = save(added.attendance, [{ ...first, endAt: time(13, 30).getTime() }]);
  assert.equal(modified.ok, true);
  assert.equal(modified.attendance.days[0].breaks[0].start.recordedAt, before.days[0].breaks[0].start.recordedAt);
  assert.equal(save(modified.attendance, []).attendance.days[0].breaks.length, 0);
});

test('仅午休可补录且保留进行中的午休', () => {
  const running = action(empty(), 'pause', time(12));
  const entry = running.days[0].breaks[0];
  const values = { date, startAt: null, endAt: null, source: 'backfill',
    breaks: [{ id: entry.id, startAt: entry.start.at, endAt: null }] };
  const preserved = setAttendanceTimes(running, values, time(14));
  assert.equal(preserved.ok, true);
  assert.deepEqual(preserved.attendance.days[0].breaks, running.days[0].breaks);
  values.breaks[0].endAt = time(13).getTime();
  const ended = setAttendanceTimes(running, values, time(14));
  assert.equal(ended.ok, true);
  assert.equal(ended.attendance.days[0].clockIn, null);
  assert.equal(ended.attendance.days[0].breaks[0].end.source, 'backfill');
});
