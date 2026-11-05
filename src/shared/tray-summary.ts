import { INCOME_STATUS_LABELS } from './income-status.js';
import type { Snapshot } from './contracts.js';
import { localDate, matchesDate } from '../domain/tasks/model.js';
import { sortedHopes } from './hope-summary.js';
import { statusMetric } from './status-metrics.js';
export function traySummary(state: Pick<Snapshot, 'income' | 'tasks' | 'taskError' | 'board' | 'hopeHolidays'>) {
  const today = localDate(new Date(state.income.now));
  const tasks = state.tasks.tasks.filter(task => matchesDate(task, today));
  const done = tasks.filter(task => task.done).length;
  const next = tasks.filter(task => !task.done).sort((a, b) => (a.hasTime ? a.startTime : '99:99').localeCompare(b.hasTime ? b.startTime : '99:99'))[0];
  const countdown = statusMetric(state, 'countdown').value;
  const ready = !!state.income.settings && !state.income.calculationError && !!state.income.snapshot;
  const status = String(state.income.snapshot?.status ?? '');
  const counting = /^\d+:\d{2}:\d{2}$/.test(countdown);
  return {
    worked: statusMetric(state, 'worked-today').value,
    month: statusMetric(state, 'income-month').value,
    countdown: counting ? countdown : '—',
    status: !state.income.settings ? '未设置' : !ready ? '暂不可用' : INCOME_STATUS_LABELS[status] ?? '状态待更新',
    tone: !ready || countdown === '待补上班卡' ? 'warning' as const : status === 'working' ? 'working' as const : 'rest' as const,
    tasks: { unavailable: !!state.taskError, done, total: tasks.length, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0,
      next: next && !state.taskError ? { title: next.title, time: next.hasTime ? next.startTime : '' } : null },
    hopes: sortedHopes(state.board.fun?.hopes ?? [], today, state.hopeHolidays ?? []).map(({ hope, at }) => ({
      id: hope.id, name: hope.name, emoji: hope.emoji ?? '✨', days: at?.days ?? null, date: at?.date ?? '',
      label: at?.label ?? '',
    })),
  };
}
export type TraySummary = ReturnType<typeof traySummary>;
