import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSnapshot, DEFAULT_SETTINGS, formatDuration, validateSettings } from '../../app/income/src/calculator.js';

const baseSettings = {
  monthlySalary: 8400,
  startTime: '09:00',
  endTime: '17:00',
  workdays: [1, 2, 3, 4, 5],
  calendarMode: 'weekly',
};

function settings(overrides = {}) {
  const result = validateSettings({ ...baseSettings, ...overrides });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  return result.settings;
}

function onWednesday(hours, minutes = 0, seconds = 0, milliseconds = 0) {
  return new Date(2026, 10, 4, hours, minutes, seconds, milliseconds);
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, 'Expected ' + actual + ' to be approximately ' + expected);
}

function leave(overrides = {}) {
  return {
    id: 'leave-1', date: '2026-11-04', fullDay: true,
    startTime: '', endTime: '', paid: false, ...overrides,
  };
}

test('defaults use calendar mode without a fixed monthly divisor', () => {
  assert.equal(DEFAULT_SETTINGS.monthlySalary, '');
  assert.equal(DEFAULT_SETTINGS.calendarMode, 'cn');
  assert.equal(Object.hasOwn(DEFAULT_SETTINGS, 'monthlyWorkdays'), false);
});

test('normalizes form salary and deduplicates selected weekdays', () => {
  const result = validateSettings({ ...baseSettings, monthlySalary: '8400.50', workdays: [1, 2, 1] });
  assert.equal(result.valid, true);
  assert.equal(result.settings.monthlySalary, 8400.5);
  assert.deepEqual(result.settings.workdays, [1, 2]);
  assert.equal(Object.hasOwn(result.settings, 'monthlyWorkdays'), false);
});

test('November 2026 uses 21 real workdays and 400 yuan per scheduled day', () => {
  const snapshot = calculateSnapshot(settings(), onWednesday(10));
  assert.equal(snapshot.monthLabel, '2026-11');
  assert.equal(snapshot.monthlyWorkdays, 21);
  assert.equal(snapshot.plannedMonthSeconds, 21 * 8 * 3600);
  assert.equal(snapshot.dailyIncome, 400);
  assert.equal(snapshot.dailySeconds, 8 * 3600);
  closeTo(snapshot.perSecond, 1 / 72);
  closeTo(snapshot.earnedToday, 50);
  closeTo(snapshot.earnedMonth, 850);
  assert.equal(snapshot.expectedMonthIncome, 8400);
  assert.equal(snapshot.expectedDeduction, 0);
});

const workdayCases = [
  { time: [8], status: 'before-work', elapsed: 0, remaining: 32400, earned: 0 },
  { time: [9], status: 'working', elapsed: 0, remaining: 28800, earned: 0 },
  { time: [10, 30], status: 'working', elapsed: 5400, remaining: 23400, earned: 75 },
  { time: [17], status: 'after-work', elapsed: 28800, remaining: 0, earned: 400 },
  { time: [20], status: 'after-work', elapsed: 28800, remaining: 0, earned: 400 },
];
for (const scenario of workdayCases) {
  test('workday ' + scenario.time.join(':') + ' uses clock-derived status and amounts', () => {
    const snapshot = calculateSnapshot(settings(), onWednesday(...scenario.time));
    assert.equal(snapshot.status, scenario.status);
    assert.equal(snapshot.elapsedSeconds, scenario.elapsed);
    assert.equal(snapshot.remainingSeconds, scenario.remaining);
    closeTo(snapshot.earnedToday, scenario.earned);
    closeTo(snapshot.progress, scenario.elapsed / 28800);
    assert.equal(snapshot.earningPerSecond, scenario.status === 'working' ? snapshot.perSecond : 0);
  });
}

test('a rest day preserves prior monthly earnings while today stays zero', () => {
  const snapshot = calculateSnapshot(settings(), new Date(2026, 10, 7, 12));
  assert.equal(snapshot.status, 'rest-day');
  for (const field of ['elapsedSeconds', 'remainingSeconds', 'earnedToday', 'progress', 'dailySeconds', 'dailyIncome', 'earningPerSecond']) {
    assert.equal(snapshot[field], 0, field);
  }
  closeTo(snapshot.earnedMonth, 2000);
  closeTo(snapshot.perSecond, 1 / 72);
});

test('custom weekend-only schedules normalize against their real four dates', () => {
  const snapshot = calculateSnapshot(settings({ workdays: [6] }), new Date(2026, 10, 7, 10));
  assert.equal(snapshot.status, 'working');
  assert.equal(snapshot.monthlyWorkdays, 4);
  assert.equal(snapshot.dailyIncome, 2100);
  assert.equal(snapshot.elapsedSeconds, 3600);
  closeTo(snapshot.earnedToday, 262.5);
});

test('zero salary preserves the schedule without non-finite values', () => {
  const snapshot = calculateSnapshot(settings({ monthlySalary: 0 }), onWednesday(10));
  assert.equal(snapshot.status, 'working');
  for (const field of ['perSecond', 'earningPerSecond', 'dailyIncome', 'earnedToday', 'earnedMonth', 'expectedMonthIncome', 'expectedDeduction']) {
    assert.equal(snapshot[field], 0, field);
  }
  assert.equal(snapshot.elapsedSeconds, 3600);
});

test('MAX_VALUE salaries remain finite with and without unpaid leave', () => {
  const config = settings({ monthlySalary: Number.MAX_VALUE });
  for (const leaves of [[], [leave()]]) {
    const snapshot = calculateSnapshot(config, new Date(2026, 10, 30, 23, 59, 59), undefined, leaves);
    for (const [field, value] of Object.entries(snapshot)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), field);
    }
    assert.equal(snapshot.earnedMonth, snapshot.expectedMonthIncome);
  }
  assert.equal(calculateSnapshot(config, new Date(2026, 10, 30, 23)).earnedMonth, Number.MAX_VALUE);
});

test('updated salary and hours immediately recalculate the current result', () => {
  const snapshot = calculateSnapshot(settings({ monthlySalary: 16800, startTime: '10:00', endTime: '18:00' }), onWednesday(11));
  assert.equal(snapshot.dailyIncome, 800);
  assert.equal(snapshot.elapsedSeconds, 3600);
  assert.equal(snapshot.remainingSeconds, 25200);
  closeTo(snapshot.earnedToday, 100);
});

test('background returns and clock corrections recalculate without retained ticks', () => {
  const config = settings();
  calculateSnapshot(config, onWednesday(9));
  const later = calculateSnapshot(config, onWednesday(15, 45));
  assert.equal(later.elapsedSeconds, 24300);
  assert.equal(later.remainingSeconds, 4500);
  closeTo(later.earnedToday, 337.5);
  const earlier = calculateSnapshot(config, onWednesday(10));
  assert.equal(earlier.elapsedSeconds, 3600);
  closeTo(earlier.earnedToday, 50);
});

test('midnight resets today while preserving earned monthly income', () => {
  const config = settings();
  const previous = calculateSnapshot(config, new Date(2026, 10, 4, 23, 59, 59));
  const next = calculateSnapshot(config, new Date(2026, 10, 5, 0));
  assert.equal(previous.earnedToday, 400);
  assert.equal(next.status, 'before-work');
  assert.equal(next.earnedToday, 0);
  assert.equal(next.elapsedSeconds, 0);
  assert.equal(next.remainingSeconds, 17 * 3600);
  assert.equal(next.earnedMonth, previous.earnedMonth);
});

test('crossing months rebuilds the denominator and monthly accrued amount', () => {
  const config = settings();
  const previous = calculateSnapshot(config, new Date(2026, 10, 30, 23));
  const next = calculateSnapshot(config, new Date(2026, 11, 1, 10));
  assert.equal(previous.earnedMonth, 8400);
  assert.equal(next.monthLabel, '2026-12');
  assert.equal(next.monthlyWorkdays, 23);
  closeTo(next.dailyIncome, 8400 / 23);
  closeTo(next.earnedMonth, 8400 / (23 * 8));
});

test('subsecond boundaries floor accrued seconds and ceil the countdown', () => {
  const config = settings();
  const before = calculateSnapshot(config, onWednesday(8, 59, 59, 999));
  const started = calculateSnapshot(config, onWednesday(9, 0, 0, 500));
  const ending = calculateSnapshot(config, onWednesday(16, 59, 59, 999));
  assert.equal(before.status, 'before-work');
  assert.equal(before.elapsedSeconds, 0);
  assert.equal(before.remainingSeconds, 28801);
  assert.equal(started.elapsedSeconds, 0);
  assert.equal(started.remainingSeconds, 28800);
  assert.equal(ending.elapsedSeconds, 28799);
  assert.equal(ending.remainingSeconds, 1);
});

test('full paid leave accrues income without counting attendance', () => {
  const snapshot = calculateSnapshot(settings(), new Date(2026, 10, 16, 13), undefined, [leave({ date: '2026-11-16', paid: true })]);
  assert.equal(snapshot.status, 'paid-leave');
  assert.equal(snapshot.fullDayLeave, true);
  assert.equal(snapshot.elapsedSeconds, 0);
  assert.equal(snapshot.paidLeaveSecondsToday, 4 * 3600);
  assert.equal(snapshot.remainingSeconds, 0);
  assert.equal(snapshot.progress, 0.5);
  assert.equal(snapshot.earningPerSecond, snapshot.perSecond);
  closeTo(snapshot.earnedToday, 200);
  closeTo(snapshot.earnedMonth, 4200);
  assert.equal(snapshot.expectedMonthIncome, 8400);
});

test('full unpaid leave removes only elapsed unpaid seconds from current accrual', () => {
  const snapshot = calculateSnapshot(settings(), new Date(2026, 10, 16, 13), undefined, [leave({ date: '2026-11-16' })]);
  assert.equal(snapshot.status, 'unpaid-leave');
  assert.equal(snapshot.fullDayLeave, true);
  assert.equal(snapshot.elapsedSeconds, 0);
  assert.equal(snapshot.unpaidLeaveSecondsToday, 4 * 3600);
  assert.equal(snapshot.earnedToday, 0);
  assert.equal(snapshot.earningPerSecond, 0);
  closeTo(snapshot.earnedMonth, 4000);
  closeTo(snapshot.expectedDeduction, 400);
  closeTo(snapshot.expectedMonthIncome, 8000);
});

test('four unpaid hours affect attendance and pay without changing the denominator', () => {
  const partial = leave({ fullDay: false, startTime: '09:00', endTime: '13:00' });
  const snapshot = calculateSnapshot(settings(), onWednesday(15), undefined, [partial]);
  assert.equal(snapshot.status, 'working');
  assert.equal(snapshot.fullDayLeave, false);
  assert.equal(snapshot.elapsedSeconds, 2 * 3600);
  assert.equal(snapshot.unpaidLeaveSecondsToday, 4 * 3600);
  assert.equal(snapshot.progress, 0.75);
  assert.equal(snapshot.plannedMonthSeconds, 21 * 8 * 3600);
  closeTo(snapshot.earnedToday, 100);
  closeTo(snapshot.earnedMonth, 900);
  closeTo(snapshot.expectedDeduction, 200);
  closeTo(snapshot.expectedMonthIncome, 8200);
});

test('partial paid leave retains the current earning rate and does not count as work', () => {
  const partial = leave({ fullDay: false, startTime: '09:00', endTime: '13:00', paid: true });
  const snapshot = calculateSnapshot(settings(), onWednesday(11), undefined, [partial]);
  assert.equal(snapshot.status, 'paid-leave');
  assert.equal(snapshot.fullDayLeave, false);
  assert.equal(snapshot.elapsedSeconds, 0);
  assert.equal(snapshot.paidLeaveSecondsToday, 7200);
  assert.equal(snapshot.earningPerSecond, snapshot.perSecond);
  closeTo(snapshot.earnedToday, 100);
  assert.equal(snapshot.expectedMonthIncome, 8400);
});

test('unpaid leave is clipped to scheduled hours and excludes off-duty portions', () => {
  const partial = leave({ fullDay: false, startTime: '07:00', endTime: '11:00' });
  const snapshot = calculateSnapshot(settings(), onWednesday(10), undefined, [partial]);
  assert.equal(snapshot.status, 'unpaid-leave');
  assert.equal(snapshot.unpaidLeaveSecondsToday, 3600);
  assert.equal(snapshot.earningPerSecond, 0);
  closeTo(snapshot.expectedDeduction, 100);
  const outside = calculateSnapshot(settings(), onWednesday(10), undefined, [
    leave({ fullDay: false, startTime: '18:00', endTime: '19:00' }),
  ]);
  assert.equal(outside.expectedDeduction, 0);
  assert.equal(outside.status, 'working');
});

test('future unpaid leave changes forecast but does not pre-deduct current income', () => {
  const baseline = calculateSnapshot(settings(), onWednesday(10));
  const snapshot = calculateSnapshot(settings(), onWednesday(10), undefined, [leave({ date: '2026-11-16' })]);
  assert.equal(snapshot.earnedMonth, baseline.earnedMonth);
  closeTo(snapshot.expectedMonthIncome, 8000);
});

test('leave on rest days and other months does not deduct this month', () => {
  const leaves = [leave({ date: '2026-11-07' }), leave({ id: 'leave-2', date: '2026-12-01' })];
  const snapshot = calculateSnapshot(settings(), new Date(2026, 10, 7, 12), undefined, leaves);
  assert.equal(snapshot.status, 'rest-day');
  assert.equal(snapshot.fullDayLeave, false);
  assert.equal(snapshot.expectedMonthIncome, 8400);
  assert.equal(snapshot.expectedDeduction, 0);
  closeTo(snapshot.earnedMonth, 2000);
});

test('adjacent paid and unpaid parts covering the shift produce a mixed leave day', () => {
  const leaves = [
    leave({ fullDay: false, startTime: '09:00', endTime: '13:00', paid: true }),
    leave({ id: 'leave-2', fullDay: false, startTime: '13:00', endTime: '17:00' }),
  ];
  const snapshot = calculateSnapshot(settings(), onWednesday(15), undefined, leaves);
  assert.equal(snapshot.status, 'leave-day');
  assert.equal(snapshot.fullDayLeave, true);
  assert.equal(snapshot.remainingSeconds, 0);
  assert.equal(snapshot.elapsedSeconds, 0);
  closeTo(snapshot.earnedToday, 200);
  closeTo(snapshot.expectedDeduction, 200);
});

test('editing, deleting and backdating leave recomputes totals rather than applying deltas', () => {
  const config = settings();
  const now = onWednesday(13);
  const unpaid = calculateSnapshot(config, now, undefined, [leave()]);
  const paid = calculateSnapshot(config, now, undefined, [leave({ paid: true })]);
  const removed = calculateSnapshot(config, now);
  assert.equal(unpaid.earnedToday, 0);
  closeTo(paid.earnedToday, 200);
  assert.equal(paid.elapsedSeconds, 0);
  assert.equal(removed.elapsedSeconds, 4 * 3600);
  assert.equal(paid.earnedMonth, removed.earnedMonth);
  const backdated = calculateSnapshot(config, now, undefined, [leave({ date: '2026-11-02' })]);
  closeTo(removed.earnedMonth - backdated.earnedMonth, 400);
});

test('at month end accrued income equals the forecast with paid and unpaid leave', () => {
  for (const leaves of [[], [leave({ paid: true })], [leave()], [
    leave({ fullDay: false, startTime: '09:00', endTime: '13:00' }),
  ]]) {
    const snapshot = calculateSnapshot(settings(), new Date(2026, 10, 30, 23, 59, 59), undefined, leaves);
    assert.equal(snapshot.earnedMonth, snapshot.expectedMonthIncome);
  }
});

test('China calendar overrides close a weekday and open a makeup weekend', () => {
  const config = settings({ calendarMode: 'cn' });
  const context = { readyYears: [2026], overrides: {
    '2026-11-04': { isOffDay: true, name: '测试假日' },
    '2026-11-07': { isOffDay: false, name: '测试补班' },
  } };
  const holiday = calculateSnapshot(config, onWednesday(10), context);
  const makeup = calculateSnapshot(config, new Date(2026, 10, 7, 10), context);
  assert.equal(holiday.status, 'rest-day');
  assert.equal(holiday.todayKind, 'holiday');
  assert.equal(holiday.todayName, '测试假日');
  assert.equal(makeup.status, 'working');
  assert.equal(makeup.todayKind, 'makeup');
  assert.equal(makeup.monthlyWorkdays, 21);
});

test('unavailable China calendar never silently switches to weekly mode', () => {
  assert.throws(
    () => calculateSnapshot(settings({ calendarMode: 'cn' }), onWednesday(10), { readyYears: [], overrides: {} }),
    { code: 'calendar-unavailable' },
  );
});

test('a fully closed month reports no-workdays rather than dividing by zero', () => {
  const overrides = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [
    '2026-11-' + String(index + 1).padStart(2, '0'),
    { isOffDay: true, name: '测试休息' },
  ]));
  assert.throws(
    () => calculateSnapshot(settings({ calendarMode: 'cn' }), onWednesday(10), { readyYears: [2026], overrides }),
    { code: 'no-workdays' },
  );
});

const invalidCases = [
  ['monthlySalary', ''], ['monthlySalary', '   '], ['monthlySalary', -1],
  ['monthlySalary', NaN], ['monthlySalary', Infinity], ['monthlySalary', true], ['monthlySalary', null],
  ['startTime', ''], ['startTime', '24:00'], ['startTime', '09:60'], ['startTime', '9:00'],
  ['endTime', ''], ['endTime', '25:00'], ['endTime', '09:00'], ['endTime', '08:00'],
  ['workdays', []], ['workdays', [7]], ['workdays', [-1]], ['workdays', [1.5]],
  ['workdays', ['1']], ['workdays', Array(1)], ['calendarMode', ''], ['calendarMode', 'manual'],
];
for (const [field, value] of invalidCases) {
  test('rejects invalid ' + field + ': ' + String(value), () => {
    const result = validateSettings({ ...baseSettings, [field]: value });
    assert.equal(result.valid, false);
    assert.equal(result.settings, null);
    assert.ok(result.errors[field]);
  });
}

test('overnight shifts are explicitly rejected', () => {
  const result = validateSettings({ ...baseSettings, startTime: '22:00', endTime: '06:00' });
  assert.equal(result.valid, false);
  assert.match(result.errors.endTime, /当天/);
});

test('formats padded durations and tolerates non-finite display inputs', () => {
  for (const [seconds, expected] of [[0, '00:00:00'], [59, '00:00:59'], [60, '00:01:00'],
    [3661, '01:01:01'], [28800, '08:00:00'], [-1, '00:00:00'], [Infinity, '00:00:00']]) {
    assert.equal(formatDuration(seconds), expected);
  }
});


function fact(date, hours, minutes = 0, seconds = 0, milliseconds = 0) {
  const at = new Date(date + 'T' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
    + ':' + String(seconds).padStart(2, '0')).getTime() + milliseconds;
  return { at, recordedAt: at, updatedAt: at, source: 'recorded' };
}

function trackedDay(date, events) {
  const day = { date, clockIn: null, clockOut: null, breaks: [] };
  for (const [type, hours, minutes = 0, seconds = 0, milliseconds = 0] of events) {
    const value = fact(date, hours, minutes, seconds, milliseconds);
    if (type === 'start') day.clockIn = value;
    if (type === 'finish') day.clockOut = value;
    if (type === 'pause') day.breaks.push({ id: 'break-' + day.breaks.length, start: value, end: null });
    if (type === 'resume') day.breaks.at(-1).end = value;
  }
  return day;
}

function attendance(events = [], trackingFrom = '2026-11-04', modeEvidence = true) {
  return {
    trackingFrom,
    days: events.length === 0 ? [] : [trackedDay('2026-11-04', events)],
    modeDays: modeEvidence ? [{ date: '2026-11-04', stealMode: true, clockMode: true }] : [],
  };
}

const clockModes = { stealMode: true, clockMode: true };
const lunchMode = { stealMode: true, clockMode: false };

test('old settings receive compatible lunch, mode and net-salary defaults', () => {
  const config = settings();
  assert.equal(config.lunchCountsAsWork, true);
  assert.equal(config.lunchStartTime, '12:00');
  assert.equal(config.lunchEndTime, '13:00');
  assert.equal(config.stealMode, false);
  assert.equal(config.clockMode, false);
  assert.equal(config.salaryMode, 'net');
  assert.ok(config.payroll && typeof config.payroll === 'object');
});

const invalidLunchCases = [
  ['lunchCountsAsWork', null], ['lunchCountsAsWork', 'true'], ['lunchCountsAsWork', 0],
  ['lunchCountsAsWork', undefined], ['lunchStartTime', ''], ['lunchStartTime', '24:00'],
  ['lunchStartTime', undefined], ['lunchEndTime', '13:60'], ['lunchEndTime', null],
];
for (const [field, value] of invalidLunchCases) {
  test('explicit invalid lunch setting is rejected: ' + field + ' ' + String(value), () => {
    const result = validateSettings({ ...baseSettings, [field]: value });
    assert.equal(result.valid, false);
    assert.ok(result.errors[field]);
  });
}

test('excluded lunch must be inside the shift and leave positive standard working time', () => {
  for (const [lunchStartTime, lunchEndTime, errorField] of [
    ['08:00', '13:00', 'lunchStartTime'], ['12:00', '18:00', 'lunchEndTime'],
    ['13:00', '12:00', 'lunchEndTime'], ['12:00', '12:00', 'lunchEndTime'],
    ['09:00', '17:00', 'lunchEndTime'],
  ]) {
    const result = validateSettings({ ...baseSettings, lunchCountsAsWork: false, lunchStartTime, lunchEndTime });
    assert.equal(result.valid, false);
    assert.ok(result.errors[errorField]);
  }
});

test('clock mode cannot be enabled without its parent and booleans remain strict', () => {
  assert.ok(validateSettings({ ...baseSettings, stealMode: false, clockMode: true }).errors.clockMode);
  assert.ok(validateSettings({ ...baseSettings, stealMode: 'true' }).errors.stealMode);
  assert.ok(validateSettings({ ...baseSettings, clockMode: 1 }).errors.clockMode);
  assert.ok(validateSettings({ ...baseSettings, salaryMode: 'monthly' }).errors.salaryMode);
});

test('automatic income excludes configured standard lunch even without attendance', () => {
  const snapshot = calculateSnapshot(settings({ lunchCountsAsWork: false }), onWednesday(12, 30));
  assert.equal(snapshot.dailySeconds, 7 * 3600);
  assert.equal(snapshot.plannedMonthSeconds, 21 * 7 * 3600);
  assert.equal(snapshot.elapsedSeconds, 3 * 3600);
  assert.equal(snapshot.earningPerSecond, 0);
  closeTo(snapshot.earnedToday, 400 * 3 / 7);
});

test('default mode automatically earns and estimates normal work without a start click', () => {
  const snapshot = calculateSnapshot(settings(), onWednesday(11), undefined, [], attendance());
  assert.equal(snapshot.status, 'working');
  assert.equal(snapshot.attendanceState, 'not-started');
  assert.equal(snapshot.elapsedSeconds, 2 * 3600);
  closeTo(snapshot.earnedToday, 100);
  closeTo(snapshot.earnedMonth, 900);
  assert.equal(snapshot.earningPerSecond, snapshot.perSecond);
  assert.equal(snapshot.stolenAmount, 0);
  assert.equal(snapshot.pendingClockIn, false);
});

test('disabled stealing ignores recorded time differences while preserving the facts', () => {
  const record = attendance([['start', 9, 10], ['pause', 12], ['resume', 13], ['finish', 16, 30]]);
  const original = JSON.stringify(record);
  const snapshot = calculateSnapshot(settings(), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.attendanceState, 'finished');
  assert.equal(snapshot.elapsedSeconds, 8 * 3600);
  for (const field of ['lateAmount', 'earlyAmount', 'lunchStolenAmount', 'stolenAmount', 'stolenMonthAmount']) {
    assert.equal(snapshot[field], 0, field);
  }
  closeTo(snapshot.earnedToday, 400);
  assert.equal(JSON.stringify(record), original);
});

test('lunch-only mode supports pauses without a fabricated start fact', () => {
  const record = attendance([['pause', 12], ['resume', 13]]);
  const snapshot = calculateSnapshot(settings(lunchMode), onWednesday(13, 30), undefined, [], record);
  assert.equal(record.days[0].clockIn, null);
  assert.equal(snapshot.elapsedSeconds, 3.5 * 3600);
  assert.equal(snapshot.lunchStolenSeconds, 3600);
  closeTo(snapshot.lunchStolenAmount, 50);
  assert.equal(snapshot.lateAmount, 0);
  assert.equal(snapshot.earlyAmount, 0);
  closeTo(snapshot.earnedToday, 225);
});

test('lunch-only mode excludes arrival and departure differences from theft and actual estimates', () => {
  const record = attendance([['start', 9, 10], ['pause', 12], ['resume', 13], ['finish', 16, 30]]);
  const snapshot = calculateSnapshot(settings(lunchMode), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.elapsedSeconds, 7 * 3600);
  assert.equal(snapshot.stolenSeconds, 3600);
  closeTo(snapshot.stolenAmount, 50);
  assert.equal(snapshot.lateAmount, 0);
  assert.equal(snapshot.earlyAmount, 0);
});

test('09:10 without a clock-in temporarily accrues 8.33 yuan late time only on an enabled day', () => {
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(9, 10), undefined, [], attendance());
  assert.equal(snapshot.status, 'pending-clock');
  assert.equal(snapshot.pendingClockIn, true);
  assert.deepEqual(snapshot.pendingDates, ['2026-11-04']);
  assert.equal(snapshot.elapsedSeconds, 0);
  assert.equal(snapshot.lateSeconds, 600);
  closeTo(snapshot.lateAmount, 50 / 6);
  closeTo(snapshot.earnedToday, 50 / 6);
  assert.equal(snapshot.earlySeconds, 0);
});

test('backfilling a real 09:00 start removes temporary lateness without applying a money delta', () => {
  const record = attendance();
  const pending = calculateSnapshot(settings(clockModes), onWednesday(9, 10), undefined, [], record);
  record.days.push(trackedDay('2026-11-04', [['start', 9]]));
  record.days[0].clockIn.source = 'backfill';
  record.days[0].clockIn.recordedAt = onWednesday(9, 10).getTime();
  record.days[0].clockIn.updatedAt = onWednesday(9, 10).getTime();
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(9, 10), undefined, [], record);
  assert.equal(snapshot.pendingClockIn, false);
  assert.equal(snapshot.lateSeconds, 0);
  assert.equal(snapshot.stolenMonthAmount, 0);
  assert.equal(snapshot.elapsedSeconds, 600);
  assert.equal(snapshot.earnedToday, pending.earnedToday);
});

test('historical dates without facts or mode evidence are never inferred as whole-day lateness', () => {
  const record = attendance([], '2026-11-02');
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(9, 10), undefined, [], record);
  closeTo(snapshot.lateMonthAmount, 50 / 6);
  closeTo(snapshot.earnedMonth, 800 + 50 / 6);
  assert.deepEqual(snapshot.pendingDates, ['2026-11-04']);
  assert.equal(snapshot.historyEstimatedDays, 3);
});

test('real historical clock facts can be recalculated without inventing a mode-day fact', () => {
  const record = attendance([], '2026-11-02', false);
  record.days.push(trackedDay('2026-11-03', [['start', 9, 10], ['finish', 17]]));
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(10), undefined, [], record);
  closeTo(snapshot.lateMonthAmount, 50 / 6);
  assert.equal(snapshot.pendingClockIn, false);
  assert.deepEqual(snapshot.pendingDates, []);
  assert.equal(snapshot.elapsedSeconds, 3600);
});

test('historical enabled days without a start remain explicitly pending', () => {
  const record = attendance([], '2026-11-02');
  record.modeDays.unshift({ date: '2026-11-03', stealMode: true, clockMode: true });
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(9, 10), undefined, [], record);
  assert.deepEqual(snapshot.pendingDates, ['2026-11-03', '2026-11-04']);
  closeTo(snapshot.lateMonthAmount, 400 + 50 / 6);
  assert.equal(snapshot.expectedMonthIncome, 8400);
});

test('late, lunch and early parts sum to 83.33 yuan without overlapping', () => {
  const record = attendance([['start', 9, 10], ['pause', 12], ['resume', 13], ['finish', 16, 30]]);
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.elapsedSeconds, 6 * 3600 + 20 * 60);
  assert.equal(snapshot.lateSeconds, 600);
  assert.equal(snapshot.lunchStolenSeconds, 3600);
  assert.equal(snapshot.earlySeconds, 1800);
  assert.equal(snapshot.stolenSeconds, 6000);
  closeTo(snapshot.lateAmount, 50 / 6);
  closeTo(snapshot.lunchStolenAmount, 50);
  closeTo(snapshot.earlyAmount, 25);
  closeTo(snapshot.stolenAmount, 250 / 3);
  closeTo(snapshot.earnedToday, 400);
});

test('confirmed departure settles the full day immediately and stops earning', () => {
  const record = attendance([['start', 9], ['finish', 16, 30]]);
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(16, 40), undefined, [], record);
  assert.equal(snapshot.status, 'after-work');
  assert.equal(snapshot.earlySeconds, 1800);
  closeTo(snapshot.earlyAmount, 25);
  closeTo(snapshot.earnedToday, 400);
  assert.equal(snapshot.earningPerSecond, 0);
  assert.equal(snapshot.remainingSeconds, 0);
});

test('finishing early fills the day and freezes the settlement at the departure time', () => {
  const record = attendance([['start', 9], ['finish', 15]]);
  const now = calculateSnapshot(settings(clockModes), onWednesday(15), undefined, [], record);
  const later = calculateSnapshot(settings(clockModes), onWednesday(16), undefined, [], record);
  const end = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  closeTo(now.earnedToday, 400);
  closeTo(later.earnedToday, 400);
  closeTo(end.earnedToday, 400);
  assert.equal(now.earlySeconds, 7200);
  assert.equal(later.earlySeconds, 7200);
  assert.equal(end.earlySeconds, 7200);
  assert.equal(now.elapsedSeconds, later.elapsedSeconds);
});

test('a missing clock-out never fabricates early departure, including after standard end', () => {
  const record = attendance([['start', 9]]);
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(18), undefined, [], record);
  assert.equal(snapshot.earlyAmount, 0);
  assert.equal(snapshot.elapsedSeconds, 9 * 3600);
  assert.equal(snapshot.extraWorkSeconds, 3600);
  closeTo(snapshot.earnedToday, 400);
  assert.equal(snapshot.earningPerSecond, 0);
});

test('a pause continuing to departure is split from the later early-departure interval', () => {
  const record = attendance([['start', 9], ['pause', 16], ['finish', 16, 30]]);
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.lunchStolenSeconds, 1800);
  assert.equal(snapshot.earlySeconds, 1800);
  assert.equal(snapshot.stolenSeconds, 3600);
  closeTo(snapshot.stolenAmount, 50);
});

test('early work offsets departure settlement without increasing the day salary', () => {
  const record = attendance([['start', 8], ['finish', 16]]);
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.elapsedSeconds, 8 * 3600);
  assert.equal(snapshot.extraWorkSeconds, 3600);
  assert.equal(snapshot.earlySeconds, 0);
  closeTo(snapshot.stolenAmount, 0);
  closeTo(snapshot.earnedToday, 400);
});

test('ordinary excluded standard lunch creates no stolen time', () => {
  const record = attendance([['start', 9], ['pause', 12], ['resume', 13], ['finish', 17]]);
  const snapshot = calculateSnapshot(settings({ ...clockModes, lunchCountsAsWork: false }), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.dailySeconds, 7 * 3600);
  assert.equal(snapshot.elapsedSeconds, 7 * 3600);
  assert.equal(snapshot.lunchStolenSeconds, 0);
  closeTo(snapshot.earnedToday, 400);
});

test('a long excluded lunch counts only its extra working-hour portion', () => {
  const record = attendance([['start', 9], ['pause', 12], ['resume', 14], ['finish', 17]]);
  const snapshot = calculateSnapshot(settings({ ...clockModes, lunchCountsAsWork: false }), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.actualBreakSeconds, 7200);
  assert.equal(snapshot.lunchStolenSeconds, 3600);
  closeTo(snapshot.stolenAmount, 400 / 7);
});

test('actual work during excluded lunch remains extra work without extra salary', () => {
  const record = attendance([['start', 9], ['finish', 17]]);
  const snapshot = calculateSnapshot(settings({ ...clockModes, lunchCountsAsWork: false }), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.elapsedSeconds, 8 * 3600);
  assert.equal(snapshot.extraWorkSeconds, 3600);
  assert.equal(snapshot.stolenAmount, 0);
  closeTo(snapshot.earnedToday, 400);
});

test('full paid leave pays automatically and never generates pending or stolen time', () => {
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(13), undefined, [leave({ paid: true })], attendance());
  assert.equal(snapshot.status, 'paid-leave');
  assert.equal(snapshot.elapsedSeconds, 0);
  assert.equal(snapshot.pendingClockIn, false);
  assert.equal(snapshot.stolenAmount, 0);
  closeTo(snapshot.earnedToday, 200);
});

test('paid and unpaid leave are removed from lateness rather than counted as stolen time', () => {
  for (const paid of [true, false]) {
    const partial = leave({ fullDay: false, startTime: '09:00', endTime: '11:00', paid });
    const record = attendance([['start', 11]]);
    const snapshot = calculateSnapshot(settings(clockModes), onWednesday(13), undefined, [partial], record);
    assert.equal(snapshot.elapsedSeconds, 2 * 3600);
    assert.equal(snapshot.lateSeconds, 0);
    assert.equal(snapshot.stolenAmount, 0);
    closeTo(snapshot.earnedToday, paid ? 200 : 100);
    closeTo(snapshot.expectedDeduction, paid ? 0 : 100);
  }
});

test('leave overlapping a recorded pause cannot also become lunch stolen money', () => {
  const partial = leave({ fullDay: false, startTime: '12:00', endTime: '13:00', paid: true });
  const record = attendance([['start', 9], ['pause', 12], ['resume', 13]]);
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(14), undefined, [partial], record);
  assert.equal(snapshot.lunchStolenSeconds, 0);
  assert.equal(snapshot.stolenAmount, 0);
  closeTo(snapshot.earnedToday, 250);
});

test('unpaid leave inside excluded lunch never deducts the hour a second time', () => {
  const partial = leave({ fullDay: false, startTime: '12:00', endTime: '13:00' });
  const record = attendance([['pause', 12], ['resume', 13]]);
  const snapshot = calculateSnapshot(settings({ ...lunchMode, lunchCountsAsWork: false }), onWednesday(17), undefined, [partial], record);
  assert.equal(snapshot.expectedDeduction, 0);
  assert.equal(snapshot.lunchStolenAmount, 0);
  closeTo(snapshot.earnedToday, 400);
});

test('future records and future unpaid leave do not pre-accrue theft or pre-deduct income', () => {
  const record = attendance();
  record.days.push(trackedDay('2026-11-05', [['start', 10], ['finish', 15]]));
  record.modeDays.push({ date: '2026-11-05', stealMode: true, clockMode: true });
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(9), undefined, [
    leave({ date: '2026-11-16' }),
  ], record);
  assert.equal(snapshot.stolenMonthAmount, 0);
  closeTo(snapshot.earnedMonth, 800);
  closeTo(snapshot.expectedMonthIncome, 8000);
});

test('mode switches recompute the same facts without changing the automatic wage', () => {
  const record = attendance([['start', 9, 10], ['pause', 12], ['resume', 13], ['finish', 16, 30]]);
  const original = JSON.stringify(record);
  const off = calculateSnapshot(settings(), onWednesday(17), undefined, [], record);
  const lunch = calculateSnapshot(settings(lunchMode), onWednesday(17), undefined, [], record);
  const both = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  assert.equal(off.stolenAmount, 0);
  closeTo(lunch.stolenAmount, 50);
  closeTo(both.stolenAmount, 250 / 3);
  assert.equal(off.earnedToday, lunch.earnedToday);
  assert.equal(lunch.earnedToday, both.earnedToday);
  assert.equal(JSON.stringify(record), original);
});

test('editing arrival, departure and pause facts can decrease the recalculated total', () => {
  const record = attendance([['start', 9, 10], ['pause', 12], ['resume', 13], ['finish', 16, 30]]);
  const before = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  const day = record.days[0];
  day.clockIn = { ...fact(day.date, 9), source: 'backfill', recordedAt: onWednesday(9, 10).getTime(), updatedAt: onWednesday(17).getTime() };
  day.clockOut = { ...fact(day.date, 17), source: 'backfill' };
  const corrected = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  closeTo(corrected.stolenAmount, 50);
  assert.ok(corrected.stolenAmount < before.stolenAmount);
  day.breaks[0].end = { ...fact(day.date, 12, 30), source: 'backfill', updatedAt: onWednesday(17).getTime() };
  const shorter = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  closeTo(shorter.stolenAmount, 25);
  closeTo(shorter.stolenMonthAmount, 25);
});

test('recorded timestamps survive a clock correction and no future early interval is counted', () => {
  const record = attendance([['start', 10], ['finish', 17]]);
  const original = JSON.stringify(record);
  const earlier = calculateSnapshot(settings(clockModes), onWednesday(9, 30), undefined, [], record);
  assert.equal(earlier.elapsedSeconds, 0);
  assert.equal(earlier.earlySeconds, 0);
  closeTo(earlier.earnedToday, 25);
  assert.equal(JSON.stringify(record), original);
});

test('rest days cannot create pay or stolen money from old facts', () => {
  const record = attendance([['start', 9], ['finish', 10]]);
  const snapshot = calculateSnapshot(settings({ ...clockModes, workdays: [6] }), onWednesday(13), undefined, [], record);
  assert.equal(snapshot.status, 'rest-day');
  assert.equal(snapshot.earnedToday, 0);
  assert.equal(snapshot.stolenAmount, 0);
  assert.equal(snapshot.pendingClockIn, false);
  assert.equal(snapshot.elapsedSeconds, 3600);
});

test('total money uses summed seconds instead of adding independently rounded display amounts', () => {
  const record = attendance([['start', 9, 1], ['pause', 12], ['resume', 12, 1], ['finish', 16, 59]]);
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], record);
  assert.equal(snapshot.stolenSeconds, 180);
  closeTo(snapshot.stolenAmount, 2.5);
  assert.equal(Number(snapshot.stolenAmount.toFixed(2)), 2.5);
  const roundedParts = [snapshot.lateAmount, snapshot.lunchStolenAmount, snapshot.earlyAmount]
    .reduce((total, value) => total + Number(value.toFixed(2)), 0);
  closeTo(roundedParts, 2.49);
});

test('ordinary net salaries are used directly without a second payroll deduction', () => {
  const snapshot = calculateSnapshot(settings(), onWednesday(17), undefined, [], attendance());
  assert.equal(snapshot.payrollResult.valid, true);
  assert.equal(snapshot.payrollResult.netSalary, 8400);
  assert.equal(snapshot.expectedMonthIncome, 8400);
  assert.equal(snapshot.dailyIncome, 400);
});

test('zero and MAX_VALUE net salaries keep automatic income and each category finite', () => {
  const record = attendance([['start', 10], ['pause', 12], ['resume', 13], ['finish', 16]]);
  for (const monthlySalary of [0, Number.MAX_VALUE]) {
    const snapshot = calculateSnapshot(settings({ ...clockModes, monthlySalary }), onWednesday(17), undefined, [], record);
    for (const [field, value] of Object.entries(snapshot)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), field);
    }
    assert.equal(snapshot.stolenSeconds, 3 * 3600);
    if (monthlySalary === 0) assert.equal(snapshot.stolenAmount, 0);
  }
});

test('invalid payroll configuration is reported on the settings field', () => {
  for (const payroll of [null, [], { taxMonth: 0 }]) {
    const result = validateSettings({ ...baseSettings, payroll });
    assert.equal(result.valid, false);
    assert.ok(result.errors.payroll);
  }
});

test('gross income is converted once and the same net salary drives wages and stolen categories', () => {
  const noContributions = Object.fromEntries(['pension', 'medical', 'unemployment', 'fund']
    .map((id) => [id, { method: 'none', rate: 0, amount: 0 }]));
  const config = settings({
    ...clockModes,
    monthlySalary: 10000,
    salaryMode: 'gross',
    payroll: { taxMonth: 1, items: noContributions },
  });
  const record = attendance([['start', 9, 10], ['pause', 12], ['resume', 13], ['finish', 16, 30]]);
  const gross = calculateSnapshot(config, onWednesday(17), undefined, [], record);
  const net = calculateSnapshot(settings({ ...clockModes, monthlySalary: 9850 }), onWednesday(17), undefined, [], record);
  assert.equal(gross.payrollResult.tax, 150);
  assert.equal(gross.payrollResult.netSalary, 9850);
  assert.equal(gross.expectedMonthIncome, 9850);
  for (const field of ['perSecond', 'dailyIncome', 'earnedToday', 'earnedMonth', 'lateAmount',
    'earlyAmount', 'lunchStolenAmount', 'stolenAmount', 'stolenMonthAmount']) {
    closeTo(gross[field], net[field]);
  }
  const unpaid = calculateSnapshot(config, onWednesday(17), undefined, [
    leave({ date: '2026-11-16' }),
  ], record);
  assert.equal(unpaid.payrollResult.tax, 150);
  assert.equal(unpaid.payrollResult.netSalary, 9850);
  closeTo(unpaid.expectedDeduction, 9850 / 21);
  closeTo(unpaid.expectedMonthIncome, 9850 * 20 / 21);
});

test('an uncomputable gross payroll reports an error rather than charging the gross salary', () => {
  const config = settings({ monthlySalary: Number.MAX_VALUE, salaryMode: 'gross' });
  assert.throws(() => calculateSnapshot(config, onWednesday(10)), { code: 'payroll-invalid' });
});


test('early starts earn immediately, cap at daily pay and settle only the remaining gap', () => {
  for (const [start, finish, expectedBefore, gap] of [[9, 15, 300, 100], [8, 15, 350, 50], [8, 16, 400, 0]]) {
    const running = attendance([['start', start]]);
    const before = calculateSnapshot(settings(clockModes), onWednesday(finish), undefined, [], running);
    closeTo(before.earnedToday, expectedBefore);
    const record = attendance([['start', start], ['finish', finish]]);
    const original = JSON.stringify(record);
    for (const hour of [finish, 17, 23]) {
      const after = calculateSnapshot(settings(clockModes), onWednesday(hour), undefined, [], record);
      closeTo(after.earnedToday, 400);
      closeTo(after.earlyAmount, gap);
      assert.equal(after.remainingSeconds, 0);
      assert.equal(after.earningPerSecond, 0);
      assert.equal(after.progress, 1);
    }
    assert.equal(JSON.stringify(record), original);
  }
  const early = calculateSnapshot(settings(clockModes), onWednesday(8, 30), undefined, [], attendance([['start', 8]]));
  closeTo(early.earnedToday, 25);
  assert.equal(early.status, 'working');
  assert.equal(early.earningPerSecond, early.perSecond);
  const capped = calculateSnapshot(settings(clockModes), onWednesday(17), undefined, [], attendance([['start', 6]]));
  closeTo(capped.earnedToday, 400);
  assert.equal(capped.earningPerSecond, 0);
});

test('settlement keeps leave deductions and theft categories disjoint with early work', () => {
  const record = attendance([['start', 8], ['pause', 12], ['resume', 13], ['finish', 15]]);
  const deduction = leave({ fullDay: false, startTime: '16:00', endTime: '17:00' });
  const snapshot = calculateSnapshot(settings(clockModes), onWednesday(15), undefined, [deduction], record);
  closeTo(snapshot.payableToday, 350);
  closeTo(snapshot.earnedToday, 350);
  closeTo(snapshot.earlyAmount, 0);
  closeTo(snapshot.lunchStolenAmount, 50);
  closeTo(snapshot.stolenAmount, 50);
  closeTo(snapshot.expectedDeduction, 50);
  assert.equal(snapshot.stolenSeconds, snapshot.lateSeconds + snapshot.lunchStolenSeconds + snapshot.earlySeconds);
});

test('early settlement before scheduled start works and historical monthly totals stay capped', () => {
  const record = attendance([['start', 7], ['finish', 8]]);
  const now = calculateSnapshot(settings(clockModes), onWednesday(8), undefined, [], record);
  assert.equal(now.status, 'after-work');
  closeTo(now.earnedToday, 400);
  closeTo(now.earlyAmount, 350);
  const endOfMonth = calculateSnapshot(settings(clockModes), new Date(2026, 10, 30, 23), undefined, [], record);
  closeTo(endOfMonth.earnedMonth, endOfMonth.expectedMonthIncome);
  assert.ok(endOfMonth.earnedMonth <= 8400);
});


test('old settings default to monthly; daily validation only requires the active amount', () => {
  const old = settings();
  assert.equal(old.payBasis, 'monthly');
  assert.equal(old.dailySalary, '');
  const daily = settings({ payBasis: 'daily', dailySalary: '200.50', monthlySalary: '' });
  assert.equal(daily.dailySalary, 200.5);
  assert.equal(daily.monthlySalary, '');
  for (const dailySalary of ['', -1, Infinity, NaN, true, null]) {
    assert.ok(validateSettings({ ...baseSettings, payBasis: 'daily', dailySalary }).errors.dailySalary);
  }
  assert.ok(validateSettings({ ...baseSettings, payBasis: 'weekly' }).errors.payBasis);
});

test('daily pay is stable across months with different workday counts and ignores the monthly tax toggle', () => {
  const config = settings({ payBasis: 'daily', dailySalary: 200, monthlySalary: 8400, salaryMode: 'gross' });
  const november = calculateSnapshot(config, onWednesday(17));
  const december = calculateSnapshot(config, new Date(2026, 11, 1, 17));
  closeTo(november.dailyIncome, 200);
  closeTo(december.dailyIncome, 200);
  closeTo(november.expectedMonthIncome, 200 * 21);
  closeTo(december.expectedMonthIncome, 200 * 23);
  assert.equal(november.payrollResult.tax, 0);
  assert.equal(november.payBasis, 'daily');
  closeTo(calculateSnapshot(config, onWednesday(13)).earnedToday, 100);
  closeTo(calculateSnapshot(config, new Date(2026, 10, 30, 23)).earnedMonth, 4200);
  closeTo(calculateSnapshot(settings({ payBasis: 'daily', dailySalary: 0 }), onWednesday(17)).earnedToday, 0);
});

test('daily early work, settlement and unpaid leave use the fixed daily amount', () => {
  const config = settings({ ...clockModes, payBasis: 'daily', dailySalary: 200 });
  const running = attendance([['start', 8]]);
  closeTo(calculateSnapshot(config, onWednesday(15), undefined, [], running).earnedToday, 175);
  const finished = attendance([['start', 8], ['finish', 15]]);
  const before = JSON.stringify(finished);
  const closed = calculateSnapshot(config, onWednesday(15), undefined, [], finished);
  closeTo(closed.earnedToday, 200);
  closeTo(closed.earlyAmount, 25);
  closeTo(closed.stolenAmount, 25);
  closeTo(calculateSnapshot(config, onWednesday(23), undefined, [], finished).earnedToday, 200);
  assert.equal(JSON.stringify(finished), before);
  const unpaid = leave({ fullDay: false, startTime: '16:00', endTime: '17:00' });
  const reduced = calculateSnapshot(config, onWednesday(15), undefined, [unpaid], finished);
  closeTo(reduced.earnedToday, 175);
  closeTo(reduced.earlyAmount, 0);
  closeTo(reduced.expectedDeduction, 25);
  closeTo(reduced.expectedMonthIncome, 4175);
});

test('daily rates use cents and overflow reports an explicit error instead of nonfinite income', () => {
  const snapshot = calculateSnapshot(settings({ payBasis: 'daily', dailySalary: 123.45 }), onWednesday(17));
  closeTo(snapshot.dailyIncome, 123.45);
  assert.throws(() => calculateSnapshot(settings({ payBasis: 'daily', dailySalary: Number.MAX_VALUE }), onWednesday(17)), (error) => error.code === 'daily-income-overflow');
});
