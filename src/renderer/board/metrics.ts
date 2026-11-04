import { createContext, useContext } from 'react';
import { Briefcase, CalendarDays, ChartColumn, Clock, Drama, Hourglass, Landmark, Sprout, Wallet, Zap, type LucideIcon } from 'lucide-react';
import type { Snapshot } from '../../shared/contracts';
import { METRICS, type MetricId } from '../../shared/board';
import { localDate, matchesDate, weekDates } from '../../domain/tasks/model';
import { duration, money, weekNames } from '../format';

export const METRIC_ICON: Record<MetricId, LucideIcon> = {
  'income-today': Wallet,
  'income-month': Landmark,
  'per-second': Zap,
  countdown: Hourglass,
  'worked-today': Briefcase,
  progress: Sprout,
  'week-done': ChartColumn,
  'stolen-today': Drama,
  date: CalendarDays,
  clock: Clock,
};

export function computeMetrics(state: Snapshot): Record<MetricId, string> {
  const s = state.income.snapshot;
  const now = new Date(state.income.now);
  const today = localDate(now);
  const todays = state.tasks.tasks.filter((t) => matchesDate(t, today));
  const week = weekDates(today);
  const weekTasks = state.tasks.tasks.filter((t) => week.some((d) => matchesDate(t, d)));
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    'income-today': `¥${money(s?.earnedToday)}`,
    'income-month': `¥${money(s?.earnedMonth)}`,
    'per-second': num(s?.perSecond) !== undefined ? `${num(s?.perSecond)!.toFixed(4)} 元/秒` : '—',
    countdown:
      s?.status === 'rest-day' ? '今日休息' : s?.status === 'after-work' ? '已下班' : duration(s?.remainingSeconds),
    'worked-today': duration(s?.elapsedSeconds),
    progress: `${todays.length ? Math.round((todays.filter((t) => t.done).length / todays.length) * 100) : 100}%`,
    'week-done': `${weekTasks.filter((t) => t.done).length}/${weekTasks.length}`,
    'stolen-today': state.income.settings?.stealMode ? `¥${money(s?.stolenAmount)}` : '—',
    date: `${now.getMonth() + 1}月${now.getDate()}日 ${weekNames[now.getDay()]}`,
    clock: now.toLocaleTimeString('zh-CN', { hour12: false }),
  };
}

export interface BoardApi {
  metrics: Record<MetricId, string>;
  bindings: Record<string, MetricId>;
  bind: (key: string, metric: MetricId | null, anchor?: Element | null) => void;
}
export const BoardContext = createContext<BoardApi>({
  metrics: Object.fromEntries(Object.keys(METRICS).map((k) => [k, ''])) as Record<MetricId, string>,
  bindings: {},
  bind: () => {},
});
export const useBoardApi = () => useContext(BoardContext);
