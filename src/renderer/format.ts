import { formatDuration } from '../../app/income/src/calculator.js';

export const money = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—';
export const duration = (value: unknown) =>
  typeof value === 'number' ? formatDuration(value) : '—';
export const time = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : new Date(value).toTimeString().slice(0, 8);
export const labels: Record<string, string> = {
  working: '工作中',
  'before-work': '尚未上班',
  'after-work': '已下班',
  'rest-day': '今日休息',
  'paid-leave': '带薪请假',
  'unpaid-leave': '扣薪请假',
  'leave-day': '今日请假',
  paused: '午休中',
  'pending-clock': '待补上班卡',
};
export const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const dateLabel = (value: string) => {
  const d = new Date(`${value}T12:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekNames[d.getDay()]}`;
};
