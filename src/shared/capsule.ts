import type { Snapshot } from './contracts.js';
import { localDate, matchesDate } from '../domain/tasks/model.js';

export const CAPSULE_SIZE = { width: 240, height: 32 } as const;
export const CAPSULE_METRICS = {
  countdown: '下班倒计时', 'income-today': '今日已赚（估算）', 'income-month': '本月已赚（估算）',
  'stolen-duration': '今日偷出时长', 'stolen-amount': '今日偷出金额（估算）',
  'task-progress': '今日任务完成度', 'worked-today': '今日已工作', clock: '当前时间',
} as const;
export type CapsuleMetric = keyof typeof CAPSULE_METRICS;
export type WindowMode = 'expanded' | 'capsule';
export interface Rectangle { x: number; y: number; width: number; height: number }
export interface WindowPreferences {
  version: 1;
  revision: number;
  mode: WindowMode;
  metric: CapsuleMetric;
  alwaysOnTop: boolean;
  expanded: { bounds: Rectangle; maximized: boolean; fullscreen: boolean };
  capsule: { x: number; y: number } | null;
}
export interface WindowSnapshot extends WindowPreferences {
  phase: 'idle' | 'preparing' | 'applying' | 'restoring';
  dirty: boolean;
  warning: string;
}
export const WINDOW_ERRORS = {
  WINDOW_INVALID_INPUT: '窗口设置无效，请重新选择。',
  WINDOW_REVISION_CONFLICT: '窗口设置已变化，请重新确认后保存。',
  WINDOW_BUSY: '窗口正在切换，请稍后再试。',
  WINDOW_DRAFT_BLOCKED: '请先完成或关闭当前操作，再收成胶囊。',
  WINDOW_PREPARE_TIMEOUT: '未能确认草稿保存，窗口未收起，请重试。',
  WINDOW_DATA_SAVE_FAILED: '修改尚未保存，请先重试保存，再收成胶囊。',
  WINDOW_FULLSCREEN_TIMEOUT: '全屏切换未完成，请退出全屏后重试。',
  WINDOW_TOPMOST_FAILED: '未能调整置顶状态，请重试。',
  WINDOW_MODE_FAILED: '窗口切换失败，已尝试恢复，请重试。',
  WINDOW_RESTORE_FAILED: '窗口恢复失败，请保留应用并重新打开窗口。',
  WINDOW_PREFERENCES_SAVE_FAILED: '本次已生效，窗口设置尚未保存，请重试。',
  WINDOW_PREFERENCES_INVALID: '窗口配置无法完整读取，已使用安全设置；保存时会保留原文件备份。',
} as const;
export type WindowError = keyof typeof WINDOW_ERRORS;
export const isMetric = (v: unknown): v is CapsuleMetric => typeof v === 'string' && Object.hasOwn(CAPSULE_METRICS, v);
export const isMode = (v: unknown): v is WindowMode => v === 'expanded' || v === 'capsule';
export function validRect(v: unknown): v is Rectangle {
  if (!v || typeof v !== 'object') return false;
  const r = v as Rectangle;
  return [r.x, r.y, r.width, r.height].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e7) && r.width > 0 && r.height > 0;
}
export function fitBounds(bounds: Rectangle, areas: Rectangle[], minimum = { width: 1, height: 1 }): Rectangle {
  const area = areas.reduce((best, a) => {
    const overlap = (r: Rectangle) => Math.max(0, Math.min(bounds.x + bounds.width, r.x + r.width) - Math.max(bounds.x, r.x)) * Math.max(0, Math.min(bounds.y + bounds.height, r.y + r.height) - Math.max(bounds.y, r.y));
    return overlap(a) > overlap(best) ? a : best;
  }, areas[0] ?? { x: 0, y: 0, width: 1280, height: 820 });
  const width = Math.min(area.width, Math.max(minimum.width, bounds.width));
  const height = Math.min(area.height, Math.max(minimum.height, bounds.height));
  return { x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))), width: Math.round(width), height: Math.round(height) };
}
/** Preserve the current top-right corner, correcting only overflow on that display. */
export function anchoredBounds(current: Rectangle, size: { width: number; height: number }, area: Rectangle): Rectangle {
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  return fitBounds({ x: current.x + current.width - width, y: current.y, width, height }, [area]);
}
export interface WindowTransition {
  nonce: string;
  stage: 'exit' | 'enter' | 'reset';
  target: WindowMode;
}
export function capsuleValue(state: Snapshot, metric: CapsuleMetric) {
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
