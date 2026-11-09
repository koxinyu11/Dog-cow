import type { Signal } from '../types.js';

/** Today's stolen amount (estimate). Overwrites today only; never accumulates. */
export function stealSignals(today: string, amount: unknown): Signal[] {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return [];
  return [{ kind: 'ledger', ledger: 'steal', key: today, value: Math.round(amount * 100), date: today }];
}

/** This month's per-day boss-owes amounts (yuan). Overwrites each listed day. */
export function owedSignals(days: Record<string, unknown>, month?: string, previous: Record<string, number | string> = {}): Signal[] {
  // Only a complete, explicitly scoped month can clear missing dates. Partial updates remain supported.
  const scoped = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const values = scoped ? { ...Object.fromEntries(Object.keys(previous).filter(date => date.startsWith(`${month}-`)).map(date => [date, 0])),
    ...Object.fromEntries(Object.entries(days).filter(([date]) => date.startsWith(`${month}-`))) } : days;
  return Object.entries(values).flatMap(([date, amount]) =>
    typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
      ? [{ kind: 'ledger' as const, ledger: 'owed' as const, key: date, value: Math.round(amount * 100), date }] : []);
}
