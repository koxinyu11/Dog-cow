import type { Signal } from '../types.js';

/** Today's stolen amount (estimate). Overwrites today only; never accumulates. */
export function stealSignals(today: string, amount: unknown): Signal[] {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return [];
  return [{ kind: 'ledger', ledger: 'steal', key: today, value: Math.round(amount * 100), date: today }];
}

/** This month's per-day boss-owes amounts (yuan). Overwrites each listed day. */
export function owedSignals(days: Record<string, unknown>): Signal[] {
  return Object.entries(days).flatMap(([date, amount]) =>
    typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
      ? [{ kind: 'ledger' as const, ledger: 'owed' as const, key: date, value: Math.round(amount * 100), date }] : []);
}
