import type { Snapshot } from './contracts.js';
export const CAPSULE_METRICS = {
  countdown: '下班倒计时', 'income-today': '今日已赚（估算）', 'income-month': '本月已赚（估算）',
  'stolen-duration': '今日偷出时长', 'stolen-amount': '今日偷出金额（估算）',
  'task-progress': '今日任务完成度', 'worked-today': '今日已工作', clock: '当前时间',
} as const;
export type CapsuleMetric = keyof typeof CAPSULE_METRICS;
import { localDate, matchesDate } from '../domain/tasks/model.js';
export function statusMetric(state: Pick<Snapshot, 'income' | 'tasks' | 'taskError'>, metric: CapsuleMetric) {
  const data = state.income.snapshot;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const amount = (v: unknown) => finite(v) ? `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const duration = (v: unknown) => {
    if (!finite(v)) return '—';
    const s = Math.max(0, Math.floor(v));
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  const labels: Record<CapsuleMetric, string> = { countdown: '下班', 'income-today': '今日已赚', 'income-month': '本月已赚', 'stolen-duration': '今日偷出', 'stolen-amount': '今日偷出', 'task-progress': '今日任务', 'worked-today': '已工作', clock: '时间' };
  let value = '—';
  const available = !!state.income.settings && !state.income.calculationError && !!data;
  if (metric === 'clock') value = finite(state.income.now) ? new Date(state.income.now).toLocaleTimeString('zh-CN', { hour12: false }) : '—';
  else if (metric === 'task-progress') {
    const tasks = state.tasks.tasks.filter(t => matchesDate(t, localDate(new Date(state.income.now))));
    value = state.taskError ? '—' : tasks.length ? `${tasks.filter(t => t.done).length}/${tasks.length}` : '今日无任务';
  } else if ((metric === 'stolen-duration' || metric === 'stolen-amount') && state.income.settings && !state.income.settings.stealMode) value = '偷时间未开启';
  else if (available) {
    if (metric === 'income-today') value = amount(data.earnedToday);
    if (metric === 'income-month') value = amount(data.earnedMonth);
    if (metric === 'stolen-amount') value = amount(data.stolenAmount);
    if (metric === 'stolen-duration') value = duration(data.stolenSeconds);
    if (metric === 'worked-today') value = duration(data.elapsedSeconds);
    if (metric === 'countdown') {
      const statuses: Record<string, string> = { 'rest-day': '今日休息', 'after-work': '已下班', 'leave-day': '今日请假', 'paid-leave': '带薪请假', 'unpaid-leave': '扣薪请假', 'pending-clock': '待补上班卡' };
      value = statuses[String(data.status)] ?? duration(data.remainingSeconds);
    }
  }
  return { label: labels[metric], value, tooltip: `${CAPSULE_METRICS[metric]}：${value}${metric === 'stolen-amount' ? '（不是额外工资）' : ''}` };
}
