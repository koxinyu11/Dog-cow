import type { IncomeState, Result } from './contracts.js';

const dateKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function offworkNotice(income: IncomeState) {
  const { settings, snapshot: s, now } = income;
  if (!settings || !s || income.calculationError || s.fullDayLeave || s.status === 'rest-day') return null;
  const day = income.attendance.days.find((item) => item.date === dateKey(now));
  if (day?.clockOut || s.attendanceState === 'finished' || s.pendingClockIn) return null;
  const end = new Date(`${dateKey(now)}T${settings.endTime}`).getTime();
  if (!Number.isFinite(end)) return null;
  const seconds = Math.ceil((end - now) / 1000);
  if (seconds > 600) return null;
  if (seconds > 0) return { kind: 'soon', seconds, text: seconds <= 60 ? '准备收工' : '自由即将抵达' };
  if (!(settings.stealMode && settings.clockMode && day?.clockIn)) return null;
  const minutes = Math.floor(-seconds / 60);
  return {
    kind: 'overtime', seconds: -seconds,
    text: minutes === 0 ? '到点啦，今天辛苦了' : minutes < 10 ? '下班铃响了，椅子还没放人？' : minutes < 30 ? '今日份努力，已经满杯了。' : '狗牛还在陪你，记得早点收工。',
  };
}

export function shouldCelebrateOffwork(action: string, method: string, date: string, before: IncomeState, result: Result) {
  const after = result.snapshot?.income;
  return action === 'finish' && method === 'recorded' && result.applied && result.persisted && !!after?.snapshot
    && !after.calculationError && date === dateKey(after.now) && date === dateKey(before.now)
    && !before.attendance.days.find((day) => day.date === date)?.clockOut
    && !!after.attendance.days.find((day) => day.date === date)?.clockOut;
}
