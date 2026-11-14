import { goalMonths, treatCount } from './fun.js';
/** Display-only derivations for the salary converter; formulas stay in fun.ts. */
export const SHELF_MAX = 10;
export interface TreatShelf {
  /** Same value as treatCount (two decimals, floored). */
  count: number;
  whole: number;
  /** Progress toward the next item, 0 ≤ fraction < 1. */
  fraction: number;
  /** Yuan still needed for one more item. */
  remaining: number;
  shown: number;
  overflow: boolean;
}
export function treatShelf(price: number, earned: unknown): TreatShelf | null {
  const count = treatCount(price, earned);
  if (count === null) return null;
  const ratio = Math.max(0, earned as number) / price;
  const whole = Math.floor(ratio);
  const fraction = Math.min(Math.max(ratio - whole, 0), 0.9999);
  const remaining = Math.max(0.01, Math.ceil((price * (whole + 1) - Math.max(0, earned as number)) * 100) / 100);
  return { count, whole, fraction, remaining, shown: Math.min(whole, SHELF_MAX), overflow: whole > SHELF_MAX };
}
export interface GoalSpan {
  months: number;
  years: number;
  rest: number;
  /** month cells (of 12) when ≤ 12 months, otherwise year cells. */
  unit: 'month' | 'year';
  cells: number;
  filled: number;
  overflow: boolean;
}
export function goalSpan(price: number, monthIncome: unknown): GoalSpan | null {
  const months = goalMonths(price, monthIncome);
  if (months === null) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (months <= 12) return { months, years, rest, unit: 'month', cells: 12, filled: months, overflow: false };
  const yearCells = Math.ceil(months / 12);
  return { months, years, rest, unit: 'year', cells: Math.min(yearCells, SHELF_MAX), filled: Math.min(yearCells, SHELF_MAX), overflow: yearCells > SHELF_MAX };
}
/** "1 年 3 个月" / "8 个月" / "2 年". */
export function spanText(span: GoalSpan): string {
  if (span.months <= 12) return `${span.months} 个月`;
  return span.rest ? `${span.years.toLocaleString('zh-CN')} 年 ${span.rest} 个月` : `${span.years.toLocaleString('zh-CN')} 年`;
}
