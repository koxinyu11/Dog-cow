import { deskMoves, localMovementDate, type DeskMove, type DeskRecord } from '../../../shared/desk-movement';

export function dayTotals(records: readonly DeskRecord[]) {
  const totals = new Map<string, number>();
  for (const record of records) totals.set(record.date, (totals.get(record.date) ?? 0) + record.seconds);
  return totals;
}

/** Consecutive active days ending today, or yesterday when today has no activity yet. */
export function streak(totals: ReadonlyMap<string, number>, today = new Date()) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!totals.get(localMovementDate(day))) day.setDate(day.getDate() - 1);
  let count = 0;
  while (totals.get(localMovementDate(day))) { count++; day.setDate(day.getDate() - 1); }
  return count;
}

/** Daily activity target: the card ring fills and the calendar reaches its darkest level here. */
export const DAILY_TARGET_SECONDS = 180;
/** Indexed by Date#getDay (0 = Sunday). */
export const dayNames = ['日', '一', '二', '三', '四', '五', '六'] as const;
/** Monday-first display order of Date#getDay values. */
export const weekOrder = [1, 2, 3, 4, 5, 6, 0] as const;

/** 0 = none, 1–3 = light → full (full = the daily target). */
export function dayLevel(seconds = 0) {
  return seconds <= 0 ? 0 : seconds < 60 ? 1 : seconds < DAILY_TARGET_SECONDS ? 2 : 3;
}

export const planSeconds = (moves: readonly DeskMove[]) => moves.reduce((total, id) => total + deskMoves[id].seconds, 0);

export function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? (rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`) : `${rest} 秒`;
}
