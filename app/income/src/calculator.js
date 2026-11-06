import { ACTIVITY_KINDS } from './paid-toilet.js';
const clockEnabledForToilet = settings => settings.stealMode && settings.clockMode;
import { DEFAULT_BONUS_CONFIG, validateBonusConfig } from './bonus.js';
import { getMonthPlan } from './calendar.js';
import { getLeaveIntervalsForDay } from './leave.js';
import { getAttendanceDay } from './attendance.js';
import { DEFAULT_OVERTIME_CONFIG, validateOvertimeConfig } from './owed.js';
import { DEFAULT_PAYROLL_CONFIG, validatePayrollConfig, calculatePayroll } from './payroll.js';

export const DEFAULT_SETTINGS = {
  monthlySalary: '',
  dailySalary: '',
  payBasis: 'monthly',
  startTime: '09:00',
  endTime: '18:00',
  workdays: [1, 2, 3, 4, 5],
  calendarMode: 'cn',
  lunchCountsAsWork: true,
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  stealMode: false,
  clockMode: false,
  flexEnabled: false,
  flexMode: 'shift',
  salaryMode: 'net',
  payroll: DEFAULT_PAYROLL_CONFIG,
  bonus: DEFAULT_BONUS_CONFIG,
  overtime: DEFAULT_OVERTIME_CONFIG,
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function validTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function validateSettings(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const errors = {};
  const monthlySalary = parseNumber(input.monthlySalary);
  const fallback = (field) => Object.hasOwn(input, field) ? input[field] : DEFAULT_SETTINGS[field];
  const lunchCountsAsWork = fallback('lunchCountsAsWork');
  const lunchStartTime = fallback('lunchStartTime');
  const lunchEndTime = fallback('lunchEndTime');
  const stealMode = fallback('stealMode');
  const clockMode = fallback('clockMode');
  const flexEnabled = fallback('flexEnabled');
  const flexMode = fallback('flexMode');
  const salaryMode = fallback('salaryMode');
  const payBasis = fallback('payBasis');
  const dailySalary = parseNumber(fallback('dailySalary'));
  const payrollCheck = validatePayrollConfig(fallback('payroll'));
  const bonusCheck = validateBonusConfig(fallback('bonus'));
  const overtimeCheck = validateOvertimeConfig(fallback('overtime'));
  const validStart = validTime(input.startTime);
  const validEnd = validTime(input.endTime);

  if (payBasis !== 'monthly' && payBasis !== 'daily') errors.payBasis = '请选择包月或按天计薪。';
  if (payBasis === 'daily' && (!Number.isFinite(dailySalary) || dailySalary < 0)) {
    errors.dailySalary = '请输入有效的到手日薪，金额不能小于 0。';
  }
  if (payBasis === 'monthly' && (!Number.isFinite(monthlySalary) || monthlySalary < 0)) {
    errors.monthlySalary = '请输入有效的月薪，金额不能小于 0。';
  }
  if (!validStart) errors.startTime = '请选择有效的上班时间。';
  if (!validEnd) errors.endTime = '请选择有效的下班时间。';
  if (validStart && validEnd && input.endTime <= input.startTime) {
    errors.endTime = '下班时间必须晚于上班时间，暂仅支持当天班次。';
  }
  if (!Array.isArray(input.workdays) || input.workdays.length === 0) {
    errors.workdays = '请至少选择一个工作日。';
  } else if (!Array.from(input.workdays).every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
    errors.workdays = '工作日必须是 0 至 6 的整数。';
  }
  if (input.calendarMode !== 'cn' && input.calendarMode !== 'weekly') {
    errors.calendarMode = '请选择中国节假日调休或仅按每周排班模式。';
  }
  if (typeof lunchCountsAsWork !== 'boolean') errors.lunchCountsAsWork = '请选择午休是否计入标准工作时间。';
  if (!validTime(lunchStartTime)) errors.lunchStartTime = '请选择有效的标准午休开始时间。';
  if (!validTime(lunchEndTime)) errors.lunchEndTime = '请选择有效的标准午休结束时间。';
  if (typeof stealMode !== 'boolean') errors.stealMode = '请选择是否开启偷时间模式。';
  if (typeof flexEnabled !== 'boolean') errors.flexEnabled = '请选择是否开启弹性打卡。';
  if (!['shift','exempt'].includes(flexMode)) errors.flexMode = '请选择有效的弹性模式。';
  if (typeof clockMode !== 'boolean') errors.clockMode = '请选择是否开启上下班模式。';
  if (clockMode === true && stealMode !== true) errors.clockMode = '请先开启偷时间模式，再开启上下班模式。';
  if (salaryMode !== 'net' && salaryMode !== 'gross') errors.salaryMode = '请选择税后月薪或税前月薪。';
  if (!bonusCheck.valid) errors.bonus = Object.values(bonusCheck.errors).join(' ');
  if (!overtimeCheck.valid) errors.overtime = Object.values(overtimeCheck.errors).join(' ');
  if (!payrollCheck.valid) errors.payroll = '工资换算配置无效，请检查社保、公积金及个税设置。';

  if (lunchCountsAsWork === false && validStart && validEnd
    && validTime(lunchStartTime) && validTime(lunchEndTime)) {
    if (lunchStartTime < input.startTime || lunchStartTime >= input.endTime) {
      errors.lunchStartTime = '标准午休开始时间必须在上下班时间内。';
    }
    if (lunchEndTime <= lunchStartTime || lunchEndTime > input.endTime) {
      errors.lunchEndTime = '标准午休结束时间必须晚于开始时间，且不晚于下班。';
    }
    if (lunchStartTime === input.startTime && lunchEndTime === input.endTime) {
      errors.lunchEndTime = '标准午休不能占满整个班次，请保留工作时间。';
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, settings: null, errors };
  return {
    valid: true,
    settings: {
      monthlySalary: Number.isFinite(monthlySalary) && monthlySalary >= 0 ? monthlySalary : '',
      dailySalary: Number.isFinite(dailySalary) && dailySalary >= 0 ? dailySalary : '',
      payBasis,
      startTime: input.startTime,
      endTime: input.endTime,
      workdays: [...new Set(input.workdays)],
      calendarMode: input.calendarMode,
      lunchCountsAsWork,
      lunchStartTime,
      lunchEndTime,
      stealMode,
      clockMode,
      flexEnabled,
      flexMode,
      salaryMode,
      payroll: payrollCheck.config,
      bonus: bonusCheck.config,
      overtime: overtimeCheck.config,
    },
    errors,
  };
}

function dateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function timestamp(date, time) {
  return new Date(date + 'T' + time + ':00').getTime();
}

function intersectIntervals(intervals, bounds) {
  return intervals.flatMap((interval) => bounds.map((bound) => ({
    ...interval,
    start: Math.max(interval.start, bound.start),
    end: Math.min(interval.end, bound.end),
  })).filter((interval) => interval.end > interval.start));
}

function subtractIntervals(intervals, excluded) {
  return excluded.reduce((remaining, cut) => remaining.flatMap((interval) => {
    if (cut.end <= interval.start || cut.start >= interval.end) return [interval];
    const pieces = [];
    if (cut.start > interval.start) pieces.push({ ...interval, end: cut.start });
    if (cut.end < interval.end) pieces.push({ ...interval, start: cut.end });
    return pieces;
  }), intervals);
}

function intervalSeconds(intervals, until = Infinity) {
  const milliseconds = intervals.reduce((total, interval) => (
    total + Math.max(0, Math.min(interval.end, until) - interval.start)
  ), 0);
  return Math.floor(milliseconds / 1000);
}

function boundedRatio(seconds, plannedSeconds) {
  return Math.max(0, Math.min(1, seconds / plannedSeconds));
}

function summarizeDay(day, settings, now, leaves, attendance, toiletRecords = []) {
  const current = now.getTime();
  const rawDay = attendance?.days.find((entry) => entry.date === day.date);
  const flex = rawDay?.flex;
  const baseStart = timestamp(day.date, flex?.baseStartTime ?? settings.startTime);
  const baseEnd = timestamp(day.date, flex?.baseEndTime ?? settings.endTime);
  const start = flex?.startAt ?? baseStart;
  const end = flex?.endAt ?? baseEnd;
  const lunchSettings = flex ?? settings;
  const midnight = timestamp(day.date, '00:00');
  const nextDay = new Date(midnight);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = nextDay.getTime();
  let standard = day.isWorkday ? [{ start, end }] : [];
  let payStandard = day.isWorkday ? [{start:baseStart,end:baseEnd}] : [];
  if (lunchSettings.lunchCountsAsWork === false) {
    const lunchWindow = [{start:timestamp(day.date,lunchSettings.lunchStartTime),end:timestamp(day.date,lunchSettings.lunchEndTime)}];
    standard = subtractIntervals(standard,lunchWindow);
    payStandard = subtractIntervals(payStandard,lunchWindow);
  }

  const allLeaves = getLeaveIntervalsForDay(leaves, day.date, midnight, dayEnd);
  const standardLeaves = intersectIntervals(allLeaves, standard);
  // Leave deductions and daily salary retain the frozen original schedule.
  const payLeaves = intersectIntervals(allLeaves,payStandard);
  const paidLeaves = payLeaves.filter((interval) => interval.paid);
  const unpaidLeaves = payLeaves.filter((interval) => !interval.paid);
  const expectedWork = subtractIntervals(standard, standardLeaves);

  const dailySeconds = intervalSeconds(payStandard);
  const scheduledElapsed = intervalSeconds(standard, current);
  const paidLeaveTotal = intervalSeconds(paidLeaves);
  const unpaidLeaveTotal = intervalSeconds(unpaidLeaves);
  const paidLeaveElapsed = intervalSeconds(paidLeaves, current);
  const unpaidLeaveElapsed = intervalSeconds(unpaidLeaves, current);
  const fullDayLeave = dailySeconds > 0 && paidLeaveTotal + unpaidLeaveTotal >= dailySeconds;
  const attendanceDay = attendance ? getAttendanceDay(attendance, day.date, now) : null;
  const modeDay = attendance?.modeDays?.find((entry) => entry.date === day.date);
  const hasFacts = Boolean(rawDay?.clockIn || rawDay?.clockOut || rawDay?.breaks?.length);
  const hasClockIn = attendanceDay?.startedAt !== null && attendanceDay?.startedAt !== undefined;
  const hasClockOut = attendanceDay?.finishedAt !== null && attendanceDay?.finishedAt !== undefined;
  const breaks = attendanceDay?.breakIntervals ?? [];
  const clockEnabled = settings.stealMode === true && settings.clockMode === true;
  const clockEvidence = modeDay?.clockMode === true || hasClockIn || hasClockOut;
  const canSteal = settings.stealMode === true && day.isWorkday && !fullDayLeave;
  const settled = clockEnabled && hasClockOut && attendanceDay.finishedAt <= current;
  // Freeze the earning timeline at a confirmed departure. Future facts cannot settle today.
  const earningUntil = settled ? attendanceDay.finishedAt : current;
  const expectedSoFar = intersectIntervals(expectedWork, [{ start: midnight, end: Math.min(earningUntil, dayEnd) }]);
  const rawLate = !canSteal || !clockEnabled || flex ? []
    : hasClockIn
      ? intersectIntervals(expectedSoFar, [{ start, end: attendanceDay.startedAt }])
      : modeDay?.clockMode === true ? expectedSoFar : [];
  const late = rawLate;
  const lunch = canSteal ? subtractIntervals(
    intersectIntervals(breaks, expectedSoFar), late,
  ) : [];

  let actualIntervals;
  if (clockEnabled && clockEvidence) {
    actualIntervals = hasClockIn ? subtractIntervals(
      intersectIntervals(attendanceDay.workIntervals, [{ start: midnight, end: dayEnd }]), allLeaves,
    ) : [];
  } else {
    // Without clock evidence the standard window is an estimate, never a saved fact.
    actualIntervals = settings.stealMode === true
      ? subtractIntervals(expectedSoFar, breaks) : expectedSoFar;
  }

  const lateSeconds = intervalSeconds(late);
  const forecastSeconds = dailySeconds - unpaidLeaveTotal;
  const extraWorkSeconds = intervalSeconds(subtractIntervals(actualIntervals, standard));
  const earlyWorkSeconds = clockEnabled && clockEvidence && day.isWorkday && !fullDayLeave
    ? extraWorkSeconds : 0;
  // Advance fixed salary for extra work, never exceed the day's payable amount.
  const beforeSettlement = Math.min(forecastSeconds, Math.max(0,
    intervalSeconds(standard, earningUntil) - intervalSeconds(unpaidLeaves, earningUntil) + earlyWorkSeconds,
  ));
  const earlySeconds = canSteal && settled ? forecastSeconds - beforeSettlement : 0;
  const earnedSeconds = settled && day.isWorkday && !fullDayLeave ? forecastSeconds : beforeSettlement;
  // Activity attribution is incremental; keep the existing early-departure settlement intact.
  let toiletBounds = subtractIntervals(expectedSoFar, [...breaks, ...late]);
  if (!canSteal) toiletBounds = [];
  if (clockEnabled) toiletBounds = hasClockIn
    ? intersectIntervals(toiletBounds, [{ start: attendanceDay.startedAt, end: Math.min(current, attendanceDay.finishedAt ?? current) }]) : [];
  const toiletDetails = [];
  let attributed = [];
  for (const record of [...toiletRecords].sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id))) {
    const raw = [{ start: record.startAt, end: record.status === 'completed' ? record.endAt : current }];
    const effective = record.status === 'needs-review' ? [] : intersectIntervals(raw, toiletBounds);
    const added = subtractIntervals(effective, attributed);
    attributed = [...attributed, ...added];
    if (record.startAt < dayEnd && (record.endAt ?? current) >= midnight) {
      toiletDetails.push({ id: record.id, kind: record.kind ?? 'toilet', effectiveSeconds: intervalSeconds(effective), addedSeconds: intervalSeconds(added) });
    }
  }
  const toiletStolenSeconds = intervalSeconds(attributed);
  const activitySeconds = Object.fromEntries(ACTIVITY_KINDS.map(kind => {
    const intervals = toiletRecords.filter(record => (record.kind ?? 'toilet') === kind && record.status !== 'needs-review')
      .flatMap(record => intersectIntervals([{ start: record.startAt, end: record.endAt ?? current }], toiletBounds));
    const unique = [];
    for (const interval of intervals) unique.push(...subtractIntervals([interval], unique));
    return [kind, intervalSeconds(unique)];
  }));
  const lunchStolenSeconds = intervalSeconds(lunch);
  const standardExpectedSeconds = intervalSeconds(expectedSoFar);
  // Boss-owes time only trusts real clock facts; estimates never create overtime.
  const owedWork = clockEnabled && hasClockIn ? subtractIntervals(
    intersectIntervals(attendanceDay.workIntervals, [{ start: midnight, end: dayEnd }]), allLeaves,
  ) : [];
  const owedEarlySeconds = day.isWorkday ? intervalSeconds(intersectIntervals(owedWork, [{ start: midnight, end: start }])) : 0;
  const owedLateSeconds = day.isWorkday ? intervalSeconds(intersectIntervals(owedWork, [{ start: end, end: dayEnd }])) : 0;
  const owedRestSeconds = day.isWorkday ? 0 : intervalSeconds(owedWork);
  return {
    ...day, start, end, standard, standardLeaves, dailySeconds, scheduledElapsed,
    paidLeaveTotal, unpaidLeaveTotal, paidLeaveElapsed, unpaidLeaveElapsed,
    fullDayLeave, attendanceDay, hasFacts, settled,
    extraWorkActive: clockEnabled && day.isWorkday && !fullDayLeave
      && !standard.some((interval) => current >= interval.start && current < interval.end)
      && actualIntervals.some((interval) => current >= interval.start && current <= interval.end),
    actual: intervalSeconds(actualIntervals),
    actualBreakSeconds: attendanceDay?.breakSeconds ?? 0,
    standardExpectedSeconds,
    lateSeconds,
    earlySeconds,
    lunchStolenSeconds,
    toiletStolenSeconds, toiletDetails, activitySeconds,
    stolenSeconds: lateSeconds + earlySeconds + lunchStolenSeconds + toiletStolenSeconds,
    pendingClockIn: canSteal && clockEnabled && modeDay?.clockMode === true
      && !hasClockIn && standardExpectedSeconds > 0,
    earnedSeconds, forecastSeconds, extraWorkSeconds,
    owedEarlySeconds, owedLateSeconds, owedRestSeconds,
  };
}

export function calculateSnapshot(settings, now = new Date(), context, leaves = [], attendance, toiletRecords = []) {
  const plan = getMonthPlan(settings, now.getFullYear(), now.getMonth(), context);
  const todayKey = dateKey(now);
  const current = now.getTime();
  const days = plan.days.map((day) => summarizeDay(day, settings, now, leaves, attendance, toiletRecords));
  const today = days.find((day) => day.date === todayKey);
  const plannedMonthSeconds = days.reduce((total, day) => total + day.dailySeconds, 0);
  if (!(plannedMonthSeconds > 0)) {
    const error = new Error('本月没有可计薪的计划工作时段，请检查排班设置。');
    error.code = 'no-workdays';
    throw error;
  }
  const daily = settings.payBasis === 'daily';
  // Daily input is take-home pay. Preserve the monthly tax preference but never apply it here.
  const payrollResult = calculatePayroll({
    monthlySalary: daily ? settings.dailySalary : settings.monthlySalary,
    salaryMode: daily ? 'net' : settings.salaryMode,
    payroll: settings.payroll,
  }, now);
  if (daily && payrollResult.valid) {
    const monthlyEstimate = payrollResult.netSalary * plan.workdayCount;
    if (!Number.isFinite(monthlyEstimate)) {
      const error = new Error('日薪与本月排班天数的乘积超出可计算范围，请减小金额。');
      error.code = 'daily-income-overflow';
      throw error;
    }
    payrollResult.netSalary = monthlyEstimate;
    payrollResult.assumption = '按到手日薪乘以本月排班天数估算，不代表每日发薪；不套用月薪薪税估算。';
  }
  if (!payrollResult.valid || !Number.isFinite(payrollResult.netSalary) || payrollResult.netSalary < 0) {
    const error = new Error('税后收入计算未完成，请检查工资换算配置。');
    error.code = 'payroll-invalid';
    throw error;
  }

  // Use net salary once; time-based unpaid leave never triggers a second tax calculation.
  const incomeFor = (seconds) => payrollResult.netSalary * boundedRatio(seconds, plannedMonthSeconds);
  const sum = (field) => days.reduce((total, day) => total + day[field], 0);
  const perSecond = payrollResult.netSalary / plannedMonthSeconds;
  const activeStandard = today.standard.some((interval) => current >= interval.start && current < interval.end);
  const activeLeave = today.standardLeaves.find((interval) => current >= interval.start && current < interval.end);
  const activeBreak = today.attendanceDay?.breakIntervals.some((interval) => current >= interval.start && current < interval.end)
    || (today.attendanceDay?.state === 'paused');
  const attendanceState = today.attendanceDay?.state ?? 'estimated';
  const started = settings.stealMode && settings.clockMode
    && today.attendanceDay?.startedAt != null && today.attendanceDay.startedAt <= current;
  const unfinishedDates = attendance ? attendance.days.filter((day) => (
    day.date < todayKey && getAttendanceDay(attendance, day.date, now).needsReview
  )).map((day) => day.date) : [];
  let status;

  if (!today.isWorkday) {
    status = 'rest-day';
  } else if (today.fullDayLeave) {
    status = today.unpaidLeaveTotal === 0 ? 'paid-leave'
      : today.paidLeaveTotal === 0 ? 'unpaid-leave' : 'leave-day';
  } else if (today.settled) {
    status = 'after-work';
  } else if (current < today.start && !started) {
    status = 'before-work';
  } else if (today.pendingClockIn) {
    status = 'pending-clock';
  } else if (current >= today.end) {
    status = 'after-work';
  } else if (activeLeave) {
    status = activeLeave.paid ? 'paid-leave' : 'unpaid-leave';
  } else {
    status = settings.stealMode && activeBreak ? 'paused' : 'working';
  }

  return {
    status,
    toiletAvailableReason: !settings.stealMode ? '开启偷时间模式后可记录。'
      : !activeStandard ? '当前不在有效工作时段。'
      : activeLeave ? '请假中，暂不能开始。'
      : activeBreak ? '午休中，暂不能开始。'
      : today.settled ? '今日已下班。'
      : clockEnabledForToilet(settings) && !started ? '上班打卡后可开始。' : '',
    activitySummaries: Object.fromEntries(Object.entries(today.activitySeconds).map(([kind, seconds]) => [kind, { seconds, amount: incomeFor(seconds) }])),
    toiletStolenSeconds: today.toiletStolenSeconds,
    toiletStolenAmount: incomeFor(today.toiletStolenSeconds),
    toiletMonthAmount: incomeFor(sum('toiletStolenSeconds')),
    toiletDetails: today.toiletDetails.map(item => ({ ...item, amount: incomeFor(item.addedSeconds), effectiveAmount: incomeFor(item.effectiveSeconds) })),
    toiletHistory: days.flatMap(day => day.toiletDetails.map(item => ({ ...item, date: day.date, amount: incomeFor(item.addedSeconds), effectiveAmount: incomeFor(item.effectiveSeconds) }))),
    scheduledStartAt: today.start,
    scheduledEndAt: today.end,
    flexMode: today.attendanceDay && attendance?.days.find(d=>d.date===todayKey)?.flex?.mode || null,
    attendanceState,
    monthLabel: String(plan.year).padStart(4, '0') + '-' + String(plan.month).padStart(2, '0'),
    monthlyWorkdays: plan.workdayCount,
    payBasis: daily ? 'daily' : 'monthly',
    plannedMonthSeconds,
    perSecond,
    earningPerSecond: !today.settled && today.isWorkday && today.earnedSeconds < today.forecastSeconds
      && ((activeStandard && activeLeave?.paid !== false) || today.extraWorkActive) ? perSecond : 0,
    dailyIncome: incomeFor(today.dailySeconds),
    payableToday: incomeFor(today.forecastSeconds),
    earnedToday: incomeFor(today.earnedSeconds),
    earnedMonth: incomeFor(sum('earnedSeconds')),
    expectedMonthIncome: incomeFor(sum('forecastSeconds')),
    expectedDeduction: incomeFor(sum('unpaidLeaveTotal')),
    elapsedSeconds: today.actual,
    paidLeaveSecondsToday: today.paidLeaveElapsed,
    unpaidLeaveSecondsToday: today.unpaidLeaveElapsed,
    remainingSeconds: !today.isWorkday || today.fullDayLeave || today.settled
      ? 0 : Math.ceil(Math.max(0, (today.end - current) / 1000)),
    dailySeconds: today.dailySeconds,
    progress: today.settled && !today.fullDayLeave && today.isWorkday ? 1
      : today.dailySeconds > 0 ? boundedRatio(today.scheduledElapsed, today.dailySeconds) : 0,
    fullDayLeave: today.fullDayLeave,
    todayName: today.name,
    todayKind: today.kind,
    actualBreakSeconds: today.actualBreakSeconds,
    stolenSeconds: today.stolenSeconds,
    stolenAmount: incomeFor(today.stolenSeconds),
    stolenMonthAmount: incomeFor(sum('stolenSeconds')),
    lateSeconds: today.lateSeconds,
    lateAmount: incomeFor(today.lateSeconds),
    earlySeconds: today.earlySeconds,
    earlyAmount: incomeFor(today.earlySeconds),
    lunchStolenSeconds: today.lunchStolenSeconds,
    lunchStolenAmount: incomeFor(today.lunchStolenSeconds),
    lateMonthAmount: incomeFor(sum('lateSeconds')),
    earlyMonthAmount: incomeFor(sum('earlySeconds')),
    lunchMonthAmount: incomeFor(sum('lunchStolenSeconds')),
    pendingClockIn: today.pendingClockIn,
    pendingDates: days.filter((day) => day.pendingClockIn && day.date <= todayKey).map((day) => day.date),
    extraWorkSeconds: today.extraWorkSeconds,
    standardExpectedSeconds: today.standardExpectedSeconds,
    historyEstimatedDays: days.filter((day) => day.isWorkday && day.date <= todayKey && !day.hasFacts).length,
    trackingFrom: attendance?.trackingFrom ?? null,
    unfinishedDates,
    owedDays: days.map((day) => ({
      date: day.date, kind: day.kind,
      earlySeconds: day.owedEarlySeconds, lateSeconds: day.owedLateSeconds, restSeconds: day.owedRestSeconds,
    })),
    payrollResult,
  };
}

export function formatDuration(seconds) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
}
