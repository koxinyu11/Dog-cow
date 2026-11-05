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
export { INCOME_STATUS_LABELS as labels } from '../shared/income-status';
export const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const dateLabel = (value: string) => {
  const d = new Date(`${value}T12:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekNames[d.getDay()]}`;
};
