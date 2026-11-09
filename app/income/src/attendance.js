import { buildFlexDay, flexSettings, validFlexDay } from './flex.js';
const ACTIONS = new Set(['start', 'pause', 'resume', 'finish']);

function localDateKey(date) {
  return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function parseDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return localDateKey(date) === value ? date : null;
}

function validTimestamp(value) {
  return Number.isInteger(value) && Number.isFinite(new Date(value).getTime());
}

function validNow(now) {
  return now instanceof Date && validTimestamp(now.getTime()) && parseDateKey(localDateKey(now)) !== null;
}

function normalizeFact(raw, date) {
  if (!raw || typeof raw !== 'object' || !validTimestamp(raw.at)
      || !validTimestamp(raw.recordedAt) || !validTimestamp(raw.updatedAt)
      || raw.updatedAt < raw.recordedAt || raw.at > raw.updatedAt
      || localDateKey(new Date(raw.at)) !== date
      || (raw.source !== 'recorded' && raw.source !== 'backfill')) return null;
  return { at: raw.at, recordedAt: raw.recordedAt, updatedAt: raw.updatedAt, source: raw.source };
}

function dayFacts(day) {
  return [day.clockIn, day.clockOut, ...day.breaks.flatMap((entry) => [entry.start, entry.end])].filter(Boolean);
}

function failure(code, message) {
  return { ok: false, code, message };
}

export function createAttendance(now = new Date()) {
  if (!validNow(now)) throw new RangeError('设备日期无效，无法记录打卡。');
  return { trackingFrom: localDateKey(now), days: [], modeDays: [] };
}

export function validateAttendance(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const errors = {};
  if (!parseDateKey(input.trackingFrom)) errors.trackingFrom = '开始记录日期必须是有效日期。';
  if (!Array.isArray(input.days)) errors.days = '打卡事实必须是日期记录列表。';
  if (!Array.isArray(input.modeDays)) errors.modeDays = '缺少有效的每日模式记录。';
  if (Object.keys(errors).length) return { valid: false, attendance: null, errors };

  const days = [];
  const dates = new Set();
  for (const day of input.days) {
    if (!day || !parseDateKey(day.date) || day.date < input.trackingFrom || dates.has(day.date)
        || !Array.isArray(day.breaks)) {
      errors.days = '打卡日期无效、重复，或早于开始记录日期。';
      break;
    }
    const clockIn = day.clockIn === null ? null : normalizeFact(day.clockIn, day.date);
    const clockOut = day.clockOut === null ? null : normalizeFact(day.clockOut, day.date);
    if ((day.clockIn !== null && !clockIn) || (day.clockOut !== null && !clockOut)
        || (clockOut && (!clockIn || clockOut.at < clockIn.at))) {
      errors.days = '上下班事实无效；下班前必须有不晚于下班的实际开始时间。';
      break;
    }
    if (day.flex !== undefined && (!clockIn || !validFlexDay(day.flex,day.date,clockIn.at))) {
      errors.days = '当天弹性排班记录无效，原记录未改动。';
      break;
    }
    const breaks = [];
    const ids = new Set();
    let previousEnd = -Infinity;
    for (const entry of day.breaks) {
      const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
      const start = normalizeFact(entry?.start, day.date);
      const end = entry?.end === null ? null : normalizeFact(entry?.end, day.date);
      if (!id || ids.has(id) || !start || (entry.end !== null && !end)
          || start.at < previousEnd || (end && end.at < start.at)
          || (clockIn && start.at < clockIn.at)
          || (clockOut && (start.at > clockOut.at || (end && end.at > clockOut.at)))) {
        errors.days = '午休事实无效、重叠、乱序，或与上下班时间冲突。';
        break;
      }
      ids.add(id);
      breaks.push({ id, start, end });
      previousEnd = end?.at ?? Infinity;
    }
    if (errors.days) break;
    if (!clockIn && !clockOut && breaks.length === 0) {
      errors.days = '空日期记录应移除，不应伪造打卡事实。';
      break;
    }
    dates.add(day.date);
    days.push({ date: day.date, clockIn, clockOut, breaks, ...(day.flex ? {flex:{...day.flex}} : {}) });
  }

  const modeDays = [];
  const modeDates = new Set();
  for (const mode of input.modeDays) {
    if (!mode || !parseDateKey(mode.date) || mode.date < input.trackingFrom || modeDates.has(mode.date)
        || typeof mode.stealMode !== 'boolean' || typeof mode.clockMode !== 'boolean'
        || (!mode.stealMode && mode.clockMode)) {
      errors.modeDays = '每日模式日期无效或重复，且上下班打卡模式必须依赖偷懒模式。';
      break;
    }
    modeDates.add(mode.date);
    modeDays.push({ date: mode.date, stealMode: mode.stealMode, clockMode: mode.clockMode });
  }
  if (Object.keys(errors).length) return { valid: false, attendance: null, errors };
  days.sort((first, second) => first.date.localeCompare(second.date));
  modeDays.sort((first, second) => first.date.localeCompare(second.date));
  return { valid: true, attendance: { trackingFrom: input.trackingFrom, days, modeDays }, errors };
}

export function migrateLegacyAttendance(raw) {
  const invalid = () => ({ valid: false, attendance: null, errors: { days: '旧版打卡事件链无效，未迁移原数据。' } });
  if (!raw || !parseDateKey(raw.trackingFrom) || !Array.isArray(raw.days)) return invalid();
  const attendance = { trackingFrom: raw.trackingFrom, days: [], modeDays: [] };
  const dates = new Set();
  const fact = (at) => ({ at, recordedAt: at, updatedAt: at, source: 'recorded' });
  for (const oldDay of raw.days) {
    if (!oldDay || !parseDateKey(oldDay.date) || oldDay.date < raw.trackingFrom || dates.has(oldDay.date)
        || !Array.isArray(oldDay.events) || oldDay.events.length === 0) return invalid();
    const day = { date: oldDay.date, clockIn: null, clockOut: null, breaks: [] };
    let state = 'not-started';
    let previousAt = -Infinity;
    for (const event of oldDay.events) {
      if (!event || !ACTIONS.has(event.type) || !validTimestamp(event.at) || event.at < previousAt
          || localDateKey(new Date(event.at)) !== day.date) return invalid();
      if (state === 'not-started' && event.type === 'start') {
        day.clockIn = fact(event.at);
        state = 'working';
      } else if (state === 'working' && event.type === 'pause') {
        day.breaks.push({ id: `legacy-${day.date}-${day.breaks.length + 1}`, start: fact(event.at), end: null });
        state = 'paused';
      } else if (state === 'paused' && event.type === 'resume') {
        day.breaks.at(-1).end = fact(event.at);
        state = 'working';
      } else if ((state === 'working' || state === 'paused') && event.type === 'finish') {
        day.clockOut = fact(event.at);
        state = 'finished';
      } else return invalid();
      previousAt = event.at;
    }
    dates.add(day.date);
    attendance.days.push(day);
  }
  return validateAttendance(attendance);
}

function prepareChange(attendance, now) {
  const checked = validateAttendance(attendance);
  if (!checked.valid) return failure('invalid-attendance', '打卡事实格式无效，原数据未改动。');
  if (!validNow(now)) return failure('invalid-time', '设备时间无效，无法记录。');
  const date = localDateKey(now);
  if (date < checked.attendance.trackingFrom) return failure('before-tracking', '当前日期早于开始记录日期。');
  if (checked.attendance.days.some((day) => dayFacts(day).some((fact) => fact.updatedAt > now.getTime()))) {
    return failure('clock-backwards', '设备时间早于已记录的操作，请校准时间；原事实保持不变。');
  }
  return { ok: true, attendance: checked.attendance, date, at: now.getTime() };
}

export function setModeDay(attendance, modes, now = new Date()) {
  const prepared = prepareChange(attendance, now);
  if (!prepared.ok) return prepared;
  if (typeof modes?.stealMode !== 'boolean' || typeof modes?.clockMode !== 'boolean'
      || (!modes.stealMode && modes.clockMode)) {
    return failure('invalid-mode', '请先开启偷懒模式，再启用上下班打卡。');
  }
  const next = { date: prepared.date, stealMode: modes.stealMode, clockMode: modes.clockMode };
  const index = prepared.attendance.modeDays.findIndex((mode) => mode.date === prepared.date);
  if (index < 0) prepared.attendance.modeDays.push(next);
  else prepared.attendance.modeDays[index] = next;
  prepared.attendance.modeDays.sort((left, right) => left.date.localeCompare(right.date));
  return { ok: true, attendance: prepared.attendance };
}

/** Correct today's departure without rebuilding any other attendance facts. */
export function undoClockOut(attendance, target, now = new Date()) {
  const prepared = prepareChange(attendance, now);
  if (!prepared.ok) return prepared;
  if (target?.date !== prepared.date) return failure('undo-date', '只能撤回今天的下班记录，历史日期请修改实际时间。');
  const day = prepared.attendance.days.find((item) => item.date === target.date);
  if (!day?.clockOut) return failure('undo-missing', '今天的下班记录已撤回，请查看最新状态。');
  const expected = target.expectedClockOut;
  if (!expected || day.clockOut.at !== expected.at || day.clockOut.updatedAt !== expected.updatedAt)
    return failure('undo-conflict', '下班时间已变化，请查看最新记录后再撤回。');
  day.clockOut = null;
  const checked = validateAttendance(prepared.attendance);
  return checked.valid ? { ok: true, attendance: checked.attendance }
    : failure('undo-invalid', '考勤记录存在冲突，未撤回下班。');
}

export function setAttendanceTimes(attendance, values, now = new Date()) {
  const prepared = prepareChange(attendance, now);
  if (!prepared.ok) return prepared;
  const { date, startAt, endAt, source } = values ?? {};
  const startSource = values?.startSource === undefined ? source : values.startSource;
  const endSource = values?.endSource === undefined ? source : values.endSource;
  const validSource = (value) => value === 'recorded' || value === 'backfill';
  if ((source !== undefined && !validSource(source)) || !validSource(startSource) || !validSource(endSource)) {
    return failure('invalid-source', '打卡来源无效，原记录未修改。');
  }
  if (!parseDateKey(date) || date < attendance.trackingFrom || date > prepared.date) {
    return failure('invalid-date', '请选择开始记录后、不晚于今天的日期。');
  }
  for (const at of [startAt, endAt]) {
    if (at !== null && (!validTimestamp(at) || localDateKey(new Date(at)) !== date)) {
      return failure('invalid-time', '实际上下班时间必须属于所选日期。');
    }
    if (at !== null && at > prepared.at) return failure('future-time', '不能记录未来的实际上下班时间。');
  }
  if (endAt !== null && startAt === null) return failure('missing-start', '请同时补填实际开始时间，才能记录下班。');
  if (startAt !== null && endAt !== null && startAt > endAt) return failure('invalid-order', '实际下班时间不能早于开始时间。');

  const index = prepared.attendance.days.findIndex((day) => day.date === date);
  const day = index < 0 ? { date, clockIn: null, clockOut: null, breaks: [] } : prepared.attendance.days[index];
  const changeFact = (previous, at, factSource) => at === null ? null : previous?.at === at ? previous : {
    at, recordedAt: previous?.recordedAt ?? prepared.at, updatedAt: prepared.at, source: factSource,
  };
  if (values.flex !== undefined) {
    if (day.clockIn || !validFlexDay(values.flex,date,startAt)) return failure('invalid-flex','今天已打卡或弹性排班无效，请核对实际时间。');
    day.flex = {...values.flex};
  } else if (day.flex && startAt !== null) {
    const rebuilt = buildFlexDay(flexSettings(day.flex),date,startAt);
    if (!rebuilt.flex) return failure(rebuilt.code,rebuilt.message);
    day.flex = rebuilt.flex;
  }
  if (startAt === null) delete day.flex;
  day.clockIn = changeFact(day.clockIn, startAt, startSource);
  day.clockOut = changeFact(day.clockOut, endAt, endSource);
  if (values.breaks !== undefined) {
    if (!Array.isArray(values.breaks)) return failure('invalid-breaks', '午休记录格式无效。');
    const ids = new Set();
    const breaks = [];
    for (const entry of values.breaks) {
      if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id))
        return failure('invalid-breaks', '午休记录重复或无效。');
      ids.add(entry.id);
      const previous = day.breaks.find((item) => item.id === entry.id);
      for (const [position, at] of [entry.startAt, entry.endAt].entries()) {
        if (position === 1 && at === null && previous?.end === null) continue;
        if (!validTimestamp(at) || localDateKey(new Date(at)) !== date || at > prepared.at)
          return failure('invalid-break-time', '请填写所选日期内、不晚于现在的午休时间。');
      }
      if (entry.endAt !== null && entry.endAt <= entry.startAt)
        return failure('invalid-break-order', '午休结束时间必须晚于开始时间。');
      if (entry.endAt === null && !previous)
        return failure('missing-break-end', '请填写午休结束时间。');
      breaks.push({ id: entry.id, start: changeFact(previous?.start, entry.startAt, 'backfill'),
        end: changeFact(previous?.end, entry.endAt, 'backfill') });
    }
    day.breaks = breaks.sort((a, b) => a.start.at - b.start.at);
  }
  if (!day.clockIn && !day.clockOut && day.breaks.length === 0) {
    if (index >= 0) prepared.attendance.days.splice(index, 1);
  } else if (index < 0) prepared.attendance.days.push(day);
  const checked = validateAttendance(prepared.attendance);
  return checked.valid ? { ok: true, attendance: checked.attendance }
    : failure('conflicting-breaks', '上下班时间与已有午休冲突，请核对后再修改；原事实未改动。');
}

export function applyAttendanceAction(attendance, action, now = new Date()) {
  const prepared = prepareChange(attendance, now);
  if (!prepared.ok) return prepared;
  if (!ACTIONS.has(action)) return failure('invalid-action', '请选择有效的打卡动作。');
  let day = prepared.attendance.days.find((entry) => entry.date === prepared.date);
  if (action === 'start') {
    if (day?.clockIn) return failure('already-started', '今天已有实际开始时间，请通过修改实际时间进行更正。');
    return setAttendanceTimes(prepared.attendance, { date: prepared.date, startAt: prepared.at, endAt: null, source: 'recorded' }, now);
  }
  if (action === 'finish') {
    if (day?.clockOut) return failure('already-finished', '今天已有下班时间，请通过修改实际时间进行更正。');
    return setAttendanceTimes(prepared.attendance, { date: prepared.date, startAt: day?.clockIn?.at ?? null, endAt: prepared.at, source: 'recorded' }, now);
  }
  if (day?.clockOut) return failure('already-finished', '今天已下班，不能继续记录午休。');
  if (!day) {
    day = { date: prepared.date, clockIn: null, clockOut: null, breaks: [] };
    prepared.attendance.days.push(day);
    prepared.attendance.days.sort((left, right) => left.date.localeCompare(right.date));
  }
  const openBreak = day.breaks.at(-1)?.end === null ? day.breaks.at(-1) : null;
  const fact = { at: prepared.at, recordedAt: prepared.at, updatedAt: prepared.at, source: 'recorded' };
  if (action === 'pause') {
    if (openBreak) return failure('already-paused', '当前已在午休，请先继续上班。');
    day.breaks.push({ id: `${prepared.date}-${prepared.at}-${day.breaks.length + 1}`, start: fact, end: null });
  } else {
    if (!openBreak) return failure('not-paused', '当前没有进行中的午休。');
    openBreak.end = fact;
  }
  return { ok: true, attendance: prepared.attendance };
}

export function getAttendanceDay(attendance, date, now = new Date()) {
  const dayDate = parseDateKey(date);
  if (!dayDate || !validNow(now)) throw new RangeError('请选择有效的日期和当前时间。');
  const day = attendance.days.find((entry) => entry.date === date);
  if (!day) return {
    state: 'not-started', workIntervals: [], breakIntervals: [], breakSeconds: 0,
    startedAt: null, finishedAt: null, needsReview: false,
  };
  dayDate.setHours(0, 0, 0, 0);
  const midnight = dayDate.getTime();
  dayDate.setHours(24, 0, 0, 0);
  const cap = Math.min(now.getTime(), dayDate.getTime(), day.clockOut?.at ?? Infinity);
  const breakIntervals = day.breaks.map((entry) => ({
    start: Math.max(midnight, entry.start.at), end: Math.min(entry.end?.at ?? cap, cap),
  })).filter((interval) => interval.end > interval.start);
  let workIntervals = day.clockIn && cap > day.clockIn.at ? [{ start: day.clockIn.at, end: cap }] : [];
  for (const rest of breakIntervals) {
    workIntervals = workIntervals.flatMap((interval) => {
      if (rest.end <= interval.start || rest.start >= interval.end) return [interval];
      const pieces = [];
      if (rest.start > interval.start) pieces.push({ start: interval.start, end: rest.start });
      if (rest.end < interval.end) pieces.push({ start: rest.end, end: interval.end });
      return pieces;
    });
  }
  const openBreak = day.breaks.at(-1)?.end === null;
  const pastUnfinished = date < localDateKey(now) && !day.clockOut && (day.clockIn !== null || openBreak);
  const state = pastUnfinished ? 'unfinished' : day.clockOut ? 'finished'
    : openBreak ? 'paused' : day.clockIn ? 'working' : 'not-started';
  return {
    state, workIntervals, breakIntervals,
    breakSeconds: Math.floor(breakIntervals.reduce((total, interval) => total + interval.end - interval.start, 0) / 1000),
    startedAt: day.clockIn?.at ?? null,
    finishedAt: day.clockOut?.at ?? null,
    needsReview: Boolean(pastUnfinished || dayFacts(day).some((fact) => fact.updatedAt > now.getTime())),
  };
}
