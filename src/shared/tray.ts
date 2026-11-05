import type { Snapshot } from './contracts.js';
import { statusMetric } from './status-metrics.js';
export const TRAY_DISPLAYS = { icon: '仅图标', 'income-today': '今日收入', countdown: '下班倒计时' } as const;
export type TrayDisplay = keyof typeof TRAY_DISPLAYS;
export const isTrayDisplay = (v: unknown): v is TrayDisplay => typeof v === 'string' && Object.hasOwn(TRAY_DISPLAYS, v);
export const TRAY_ERRORS = {
  TRAY_PANEL_FAILED: '面板暂不可用，请重试。',
  TRAY_UNAVAILABLE: '菜单栏不可用，请重试。',
  TRAY_RENDER_FAILED: '菜单栏更新失败，请重试。',
  TRAY_INVALID_INPUT: '显示选项无效，请重新选择。',
  TRAY_REVISION_CONFLICT: '设置已变化，请重新选择。',
  TRAY_SAVE_FAILED: '本次已生效，设置未保存。',
} as const;
export interface TrayState { supported: boolean; available: boolean; errorCode?: string; correlationId?: string }
export function trayView(state: Pick<Snapshot, 'income' | 'tasks' | 'taskError'>, display: TrayDisplay) {
  const metric = (id: 'income-today' | 'countdown') => state.income.settings ? statusMetric(state, id) : { value: '未设置', tooltip: '尚未设置工作规则' };
  const income = metric('income-today');
  const countdown = metric('countdown');
  return { display, title: display === 'icon' ? '' : display === 'income-today' ? income.value : countdown.value, income, countdown };
}
export type TrayView = ReturnType<typeof trayView>;

export const TRAY_PANEL_METHODS = ['bootstrap', 'trayPreferences', 'retryTray', 'copyTrayDiagnostics', 'trayPanelAction'] as const;
export interface TrayPanelData {
  sequence: number;
  view: TrayView;
  summary: import('./tray-summary.js').TraySummary;
  configured: boolean;
  calculationError: boolean;
  revision: number;
  dirty: boolean;
  warning: string;
  correlationId: string;
  canSwitch: boolean;
  tray?: TrayState;
  theme: 'light' | 'dark';
}
export type TrayPanelPhase = 'opening' | 'open' | 'closing' | 'hidden';
export function panelBounds(anchor: { x: number; y: number; width: number; height: number }, area: { x: number; y: number; width: number; height: number }, height: number) {
  const width = Math.min(344, area.width);
  const h = Math.min(Math.max(200, height), area.height);
  return { x: Math.round(Math.max(area.x, Math.min(anchor.x + anchor.width / 2 - width / 2, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(anchor.y + anchor.height + 6, area.y + area.height - h))), width, height: h };
}

export const PANEL_INSET = 12;
export const PANEL_ARROW_SAFE_EDGE = 40;
/** Arrow coordinate relative to panel card, clamped clear of its rounded corners. */
export function panelArrowLeft(anchor: { x: number; width: number }, bounds: { x: number; width: number }) {
  const cardWidth = Math.max(0, bounds.width - PANEL_INSET * 2);
  const safeEdge = Math.min(PANEL_ARROW_SAFE_EDGE, cardWidth / 2);
  return Math.round(Math.max(safeEdge, Math.min(anchor.x + anchor.width / 2 - bounds.x - PANEL_INSET, cardWidth - safeEdge)));
}
export interface TrayPanelEvent { data: TrayPanelData; phase: TrayPanelPhase; arrowLeft: number }

export function trustedPanelCommand(method: string, url: string, devUrl?: string) {
  return (TRAY_PANEL_METHODS as readonly string[]).includes(method) && url === (devUrl ? `${devUrl}/?surface=tray` : 'dogcow://app/index.html?surface=tray');
}
