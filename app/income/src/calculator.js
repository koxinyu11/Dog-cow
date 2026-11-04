import { getMonthPlan } from './calendar.js';
import { getLeaveIntervalsForDay } from './leave.js';
import { getAttendanceDay } from './attendance.js';
import { DEFAULT_PAYROLL_CONFIG, validatePayrollConfig, calculatePayroll } from './payroll.js';

export const DEFAULT_SETTINGS = {
  monthlySalary: '',
  startTime: '09:00',
  endTime: '18:00',
  workdays: [1, 2, 3, 4, 5],
  calendarMode: 'cn',
  lunchCountsAsWork: true,
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  stealMode: false,
  clockMode: false,
  salaryMode: 'net',
  payroll: DEFAULT_PAYROLL_CONFIG,
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
  const salaryMode = fallback('salaryMode');
  const payrollCheck = validatePayrollConfig(fallback('payroll'));
  const validStart = validTime(input.startTime);
  const validEnd = validTime(input.endTime);

  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
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
  if (typeof clockMode !== 'boolean') errors.clockMode = '请选择是否开启上下班模式。';
  if (clockMode === true && stealMode !== true) errors.clockMode = '请先开启偷时间模式，再开启上下班模式。';
  if (salaryMode !== 'net' && salaryMode !== 'gross') errors.salaryMode = '请选择税后月薪或税前月薪。';
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
      monthlySalary,
      startTime: input.startTime,
      endTime: input.endTime,
      workdays: [...new Set(input.workdays)],
      calendarMode: input.calendarMode,
      lunchCountsAsWork,
      lunchStartTime,
      lunchEndTime,
      stealMode,
      clockMode,
      salaryMode,
      payroll: payrollCheck.config,
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

function summarizeDay(day, settings, now, leaves, attendance) {
  const current = now.getTime();
  const start = timestamp(day.date, settings.startTime);
  const end = timestamp(day.date, settings.endTime);
  const midnight = timestamp(day.date, '00:00');
  const nextDay = new Date(midnight);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = nextDay.getTime();
  let standard = day.isWorkday ? [{ start, end }] : [];
  if (settings.lunchCountsAsWork === false) {
    standard = subtractIntervals(standard, [{
      start: timestamp(day.date, settings.lunchStartTime),
      end: timestamp(day.date, settings.lunchEndTime),
    }]);
  }

  const allLeaves = getLeaveIntervalsForDay(leaves, day.date, midnight, dayEnd);
  const standardLeaves = intersectIntervals(allLeaves, standard);
  const paidLeaves = standardLeaves.filter((interval) => interval.paid);
  const unpaidLeaves = standardLeaves.filter((interval) => !interval.paid);
  const expectedWork = subtractIntervals(standard, standardLeaves);
  const expectedSoFar = intersectIntervals(expectedWork, [{ start: midnight, end: Math.min(current, dayEnd) }]);
  const dailySeconds = intervalSeconds(standard);
  const scheduledElapsed = intervalSeconds(standard, current);
  const paidLeaveTotal = intervalSeconds(paidLeaves);
  const unpaidLeaveTotal = intervalSeconds(unpaidLeaves);
  const paidLeaveElapsed = intervalSeconds(paidLeaves, current);
  const unpaidLeaveElapsed = intervalSeconds(unpaidLeaves, current);
  const fullDayLeave = dailySeconds > 0 && paidLeaveTotal + unpaidLeaveTotal >= dailySeconds;
  const attendanceDay = attendance ? getAttendanceDay(attendance, day.date, now) : null;
  const rawDay = attendance?.days.find((entry) => entry.date === day.date);
  const modeDay = attendance?.modeDays?.find((entry) => entry.date === day.date);
  const hasFacts = Boolean(rawDay?.clockIn || rawDay?.clockOut || rawDay?.breaks?.length);
  const hasClockIn = attendanceDay?.startedAt !== null && attendanceDay?.startedAt !== undefined;
  const hasClockOut = attendanceDay?.finishedAt !== null && attendanceDay?.finishedAt !== undefined;
  const breaks = attendanceDay?.breakIntervals ?? [];
  const clockEnabled = settings.stealMode === true && settings.clockMode === true;
  const clockEvidence = modeDay?.clockMode === true || hasClockIn || hasClockOut;
  const canSteal = settings.stealMode === true && day.isWorkday && !fullDayLeave;
  const early = canSteal && clockEnabled && hasClockOut
    ? intersectIntervals(expectedSoFar, [{ start: attendanceDay.finishedAt, end }]) : [];
  const rawLate = !canSteal || !clockEnabled ? []
    : hasClockIn
      ? intersectIntervals(expectedSoFar, [{ start, end: attendanceDay.startedAt }])
      : modeDay?.clockMode === true ? expectedSoFar : [];
  // A missing start plus an independently known finish must never double-count.
  const late = subtractIntervals(rawLate, early);
  const lunch = canSteal ? subtractIntervals(
    intersectIntervals(breaks, expectedSoFar), [...late, ...early],
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
  const earlySeconds = intervalSeconds(early);
  const lunchStolenSeconds = intervalSeconds(lunch);
  const standardExpectedSeconds = intervalSeconds(expectedSoFar);
  return {
    ...day, start, end, standard, standardLeaves, dailySeconds, scheduledElapsed,
    paidLeaveTotal, unpaidLeaveTotal, paidLeaveElapsed, unpaidLeaveElapsed,
    fullDayLeave, attendanceDay, hasFacts,
    actual: intervalSeconds(actualIntervals),
    actualBreakSeconds: attendanceDay?.breakSeconds ?? 0,
    standardExpectedSeconds,
    lateSeconds,
    earlySeconds,
    lunchStolenSeconds,
    stolenSeconds: lateSeconds + earlySeconds + lunchStolenSeconds,
    pendingClockIn: canSteal && clockEnabled && modeDay?.clockMode === true
      && !hasClockIn && standardExpectedSeconds > 0,
    earnedSeconds: scheduledElapsed - unpaidLeaveElapsed,
    forecastSeconds: dailySeconds - unpaidLeaveTotal,
    extraWorkSeconds: intervalSeconds(subtractIntervals(actualIntervals, standard)),
  };
}

export function calculateSnapshot(settings, now = new Date(), context, leaves = [], attendance) {
  const plan = getMonthPlan(settings, now.getFullYear(), now.getMonth(), context);
  const todayKey = dateKey(now);
  const current = now.getTime();
  const days = plan.days.map((day) => summarizeDay(day, settings, now, leaves, attendance));
  const today = days.find((day) => day.date === todayKey);
  const plannedMonthSeconds = days.reduce((total, day) => total + day.dailySeconds, 0);
  if (!(plannedMonthSeconds > 0)) {
    const error = new Error('本月没有可计薪的计划工作时段，请检查排班设置。');
    error.code = 'no-workdays';
    throw error;
  }
  const payrollResult = calculatePayroll({
    monthlySalary: settings.monthlySalary,
    salaryMode: settings.salaryMode,
    payroll: settings.payroll,
  }, now);
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
  const unfinishedDates = attendance ? attendance.days.filter((day) => (
    day.date < todayKey && getAttendanceDay(attendance, day.date, now).needsReview
  )).map((day) => day.date) : [];
  let status;

  if (!today.isWorkday) {
    status = 'rest-day';
  } else if (today.fullDayLeave) {
    status = today.unpaidLeaveTotal === 0 ? 'paid-leave'
      : today.paidLeaveTotal === 0 ? 'unpaid-leave' : 'leave-day';
  } else if (current < today.start) {
    status = 'before-work';
  } else if (today.pendingClockIn) {
    status = 'pending-clock';
  } else if (current >= today.end || (
    settings.stealMode && settings.clockMode
    && today.attendanceDay?.finishedAt !== null && today.attendanceDay?.finishedAt !== undefined
    && today.attendanceDay.finishedAt <= current
  )) {
    status = 'after-work';
  } else if (activeLeave) {
    status = activeLeave.paid ? 'paid-leave' : 'unpaid-leave';
  } else {
    status = settings.stealMode && activeBreak ? 'paused' : 'working';
  }

  return {
    status,
    attendanceState,
    monthLabel: String(plan.year).padStart(4, '0') + '-' + String(plan.month).padStart(2, '0'),
    monthlyWorkdays: plan.workdayCount,
    plannedMonthSeconds,
    perSecond,
    earningPerSecond: activeStandard && activeLeave?.paid !== false ? perSecond : 0,
    dailyIncome: incomeFor(today.dailySeconds),
    earnedToday: incomeFor(today.earnedSeconds),
    earnedMonth: incomeFor(sum('earnedSeconds')),
    expectedMonthIncome: incomeFor(sum('forecastSeconds')),
    expectedDeduction: incomeFor(sum('unpaidLeaveTotal')),
    elapsedSeconds: today.actual,
    paidLeaveSecondsToday: today.paidLeaveElapsed,
    unpaidLeaveSecondsToday: today.unpaidLeaveElapsed,
    remainingSeconds: !today.isWorkday || today.fullDayLeave
      ? 0 : Math.ceil(Math.max(0, (today.end - current) / 1000)),
    dailySeconds: today.dailySeconds,
    progress: today.dailySeconds > 0 ? boundedRatio(today.scheduledElapsed, today.dailySeconds) : 0,
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
