import { validateSettings, calculateSnapshot } from './calculator.js';
import { createCalendarContext, loadHolidayYear } from './calendar.js';
import { validateLeaveRecord } from './leave.js';
import { createAttendance, setModeDay, validateAttendance } from './attendance.js';
import { calculatePayroll } from './payroll.js';
import { loadSettings, saveSettings } from './storage.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (date) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
].join('-');
const clone = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
};
const command = (applied, persisted, errors = {}, message = '') => ({ applied, persisted, errors, message });

export function createIncomeController({
  storage,
  now = () => new Date(),
  calendarLoader = loadHolidayYear,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
} = {}) {
  const readNow = () => new Date(now().getTime());
  const initialNow = readNow();
  const restored = loadSettings(storage, initialNow);
  const listeners = new Set();
  const calendarData = new Map();
  let destroyed = false;
  let calendarJob = null;
  let calendarJobYear = null;
  let calendarGeneration = 0;
  let lastCalendarAttemptYear = null;
  let lastCalendarAttemptTime = 0;
  let lastObservedDate = dateKey(initialNow);
  let interval = null;
  const state = {
    settings: restored.settings ?? null,
    leaves: restored.leaves ?? [],
    attendance: restored.attendance ?? createAttendance(initialNow),
    now: initialNow,
    snapshot: null,
    payrollResult: null,
    calendarContext: createCalendarContext([]),
    calendar: { busy: false, results: {} },
    calculationError: null,
    storageStatus: {
      readStatus: restored.status,
      writeStatus: 'idle',
      message: restored.status === 'invalid'
        ? '保存的数据格式无效，未自动载入，也未覆盖原数据。请核对后重新填写。'
        : restored.status === 'unavailable' ? '暂时无法读取本地设置，仍可在当前页面使用。' : '',
      canRetry: false,
    },
    migrationNotice: restored.status === 'migration'
      ? '已载入旧版工资、请假和实际时间；旧版备份保持不变，原月薪按税后计价，新模式默认关闭。' : '',
  };

  function getState() {
    return clone(state);
  }

  function emit() {
    if (destroyed) return;
    for (const listener of [...listeners]) {
      if (destroyed) break;
      try {
        // Each view gets its own copy, including Date and mutable record arrays.
        listener(getState());
      } catch {
        console.warn('[income:subscriber] 一个展示模块更新失败。');
      }
    }
  }

  function subscribe(listener) {
    if (destroyed) return () => {};
    listeners.add(listener);
    listener(getState());
    return () => listeners.delete(listener);
  }

  function recompute(at) {
    state.now = new Date(at.getTime());
    state.snapshot = null;
    state.payrollResult = null;
    state.calculationError = null;
    if (!state.settings) return;
    try {
      state.snapshot = calculateSnapshot(state.settings, at, state.calendarContext, state.leaves, state.attendance);
      state.payrollResult = state.snapshot.payrollResult;
    } catch (error) {
      state.payrollResult = calculatePayroll(state.settings, at);
      const code = error.code ?? 'unknown';
      const message = code === 'calendar-unavailable'
        ? (state.calendar.busy ? '正在加载调休日历，自动计价暂缓。' : '调休日历不可用，自动计价已暂停。可刷新重试，或明确选择仅按周排班。')
        : code === 'no-workdays' ? '本月没有计划工作时段，请调整排班。'
          : code === 'payroll-invalid' ? '税后估算未通过校验，请核对薪税设置；未使用税前金额计价。'
            : '暂时无法计算，请检查排班设置后重试。';
      state.calculationError = { code, message };
    }
  }

  function stopped() {
    return command(false, false, { general: '计价状态已停止，请重新打开应用。' }, '计价状态已停止。');
  }

  function withTodayMode(attendance, settings, at) {
    const existing = attendance.modeDays.find((entry) => entry.date === dateKey(at));
    if (existing?.stealMode === settings.stealMode && existing?.clockMode === settings.clockMode) {
      return { ok: true, attendance, changed: false };
    }
    const result = setModeDay(attendance, { stealMode: settings.stealMode, clockMode: settings.clockMode }, at);
    return { ...result, changed: result.ok };
  }

  function persist() {
    const saved = saveSettings(state.settings, state.leaves, state.attendance, storage);
    state.storageStatus.writeStatus = saved.ok ? 'saved' : 'failed';
    state.storageStatus.canRetry = !saved.ok;
    state.storageStatus.message = saved.ok ? ''
      : '修改已在当前页面生效，但本机保存失败。刷新或关闭后可能恢复之前的内容，请保留页面并重试保存。';
    return saved.ok;
  }

  function apply(settings, leaves, attendance, message) {
    if (destroyed) return stopped();
    const at = readNow();
    const modes = withTodayMode(attendance, settings, at);
    if (!modes.ok) return command(false, false, { general: modes.message }, modes.message);
    state.settings = settings;
    state.leaves = leaves;
    state.attendance = modes.attendance;
    const persisted = persist();
    recompute(at);
    emit();
    return command(true, persisted, {}, persisted ? message : state.storageStatus.message);
  }

  function updateSettings(raw) {
    if (destroyed) return stopped();
    const checked = validateSettings(raw);
    if (!checked.valid) return command(false, false, checked.errors, '输入尚未完成或无效，仍使用上次有效设置。');
    const result = apply(checked.settings, state.leaves, state.attendance, '设置已自动保存，金额已重算。');
    if (result.applied) {
      state.migrationNotice = '';
      if (state.settings.calendarMode === 'cn') void refreshCalendar();
    }
    return result;
  }

  function saveLeave(raw, editingId = null) {
    if (destroyed) return stopped();
    if (!state.settings) return command(false, false, { general: '请先填写有效工资与排班。' }, '请先填写工资与排班。');
    if (editingId !== null && !state.leaves.some((entry) => entry.id === editingId)) {
      return command(false, false, { general: '要修改的请假记录不存在。' }, '原记录未改动。');
    }
    const checked = validateLeaveRecord({ ...raw, ...(editingId === null ? {} : { id: editingId }) }, state.leaves, editingId);
    if (!checked.valid) return command(false, false, checked.errors, '请假输入无效或时段冲突，原有效记录保持不变。');
    const leaves = editingId === null ? [...state.leaves, checked.leave]
      : state.leaves.map((entry) => entry.id === editingId ? checked.leave : entry);
    return apply(state.settings, leaves, state.attendance, '请假记录已保存，今日与本月金额已重算。');
  }

  function removeLeave(id) {
    if (destroyed) return stopped();
    if (!state.settings || !state.leaves.some((entry) => entry.id === id)) {
      return command(false, false, { general: '要删除的请假记录不存在。' }, '原记录未改动。');
    }
    return apply(state.settings, state.leaves.filter((entry) => entry.id !== id), state.attendance, '请假记录已删除，金额已重算。');
  }

  function commitAttendance(rawAttendance) {
    if (destroyed) return stopped();
    if (!state.settings) return command(false, false, { general: '请先填写有效工资与排班。' }, '请先填写工资与排班。');
    const checked = validateAttendance(rawAttendance);
    if (!checked.valid) return command(false, false, checked.errors, '打卡事实无效，原记录保持不变。');
    return apply(state.settings, state.leaves, checked.attendance, '实际时间已保存，今日与本月金额已重算。');
  }

  function retrySave() {
    if (destroyed) return stopped();
    if (!state.settings) return command(false, false, { general: '还没有可保存的有效设置。' }, '请先填写有效设置。');
    return apply(state.settings, state.leaves, state.attendance, '当前有效设置与记录已保存。');
  }

  function refreshCalendar(force = false) {
    if (destroyed) return Promise.resolve(stopped());
    const at = readNow();
    const year = at.getFullYear();
    if (calendarJob && calendarJobYear === year) return calendarJob;
    const age = at.getTime() - lastCalendarAttemptTime;
    if (!force && lastCalendarAttemptYear === year && age >= 0 && age < DAY_MS) {
      return Promise.resolve(command(true, false, {}, '当前年度日历已检查，使用现有结果。'));
    }
    lastCalendarAttemptYear = year;
    lastCalendarAttemptTime = at.getTime();
    calendarJobYear = year;
    const generation = ++calendarGeneration;
    state.calendar.busy = true;
    recompute(at);
    emit();
    calendarJob = (async () => {
      const years = [year, year + 1];
      const outcomes = await Promise.allSettled(years.map((value) => Promise.resolve().then(() => calendarLoader(value, {
        now: at.getTime(), force, storage,
      }))));
      if (destroyed || generation !== calendarGeneration) return stopped();
      for (let index = 0; index < years.length; index += 1) {
        const value = years[index];
        const outcome = outcomes[index];
        const result = outcome.status === 'fulfilled' && outcome.value
          ? clone(outcome.value) : { status: 'unavailable', updatedAt: null, refreshFailed: true };
        if (result.status === 'ready') {
          calendarData.set(value, result.data);
          state.calendar.results[value] = result;
        } else if (calendarData.has(value)) {
          state.calendar.results[value] = { ...state.calendar.results[value], refreshFailed: true };
        } else {
          state.calendar.results[value] = result;
        }
      }
      state.calendarContext = createCalendarContext([...calendarData.entries()]
        .sort(([left], [right]) => left - right).map(([, data]) => data));
      const ready = state.calendarContext.readyYears.includes(year);
      return command(ready, false, ready ? {} : { calendar: '当前年度调休日历不可用。' },
        ready ? '调休日历已更新。' : '调休日历不可用，请重试或明确选择仅按周排班。');
    })().finally(() => {
      if (!destroyed && generation === calendarGeneration) {
        state.calendar.busy = false;
        calendarJob = null;
        recompute(readNow());
        emit();
      }
    });
    return calendarJob;
  }

  function tick() {
    if (destroyed) return;
    const at = readNow();
    const today = dateKey(at);
    if (today !== lastObservedDate) {
      lastObservedDate = today;
      if (state.settings) {
        const modes = withTodayMode(state.attendance, state.settings, at);
        if (modes.ok && modes.changed) {
          state.attendance = modes.attendance;
          persist();
        }
      }
      if (state.settings?.calendarMode === 'cn') void refreshCalendar();
    }
    recompute(at);
    emit();
  }

  function resume() {
    tick();
    if (!destroyed && state.settings?.calendarMode === 'cn') void refreshCalendar();
  }
  const document = globalThis.document;
  const window = globalThis.window;
  const onVisibility = () => { if (document.visibilityState === 'visible') resume(); };

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearIntervalImpl(interval);
    listeners.clear();
    document?.removeEventListener('visibilitychange', onVisibility);
    window?.removeEventListener('focus', resume);
    window?.removeEventListener('pageshow', resume);
  }

  if (state.settings) {
    const modes = withTodayMode(state.attendance, state.settings, initialNow);
    if (modes.ok) state.attendance = modes.attendance;
    if (restored.status === 'migration' || modes.changed) persist();
  }
  recompute(initialNow);
  interval = setIntervalImpl(tick, 1000);
  document?.addEventListener('visibilitychange', onVisibility);
  window?.addEventListener('focus', resume);
  window?.addEventListener('pageshow', resume);
  if (state.settings?.calendarMode === 'cn') void refreshCalendar();

  return {
    getState, subscribe, updateSettings, saveLeave, removeLeave, commitAttendance,
    refreshCalendar, tick, retrySave, destroy,
  };
}
