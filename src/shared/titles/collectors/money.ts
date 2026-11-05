import type { Signal } from '../types.js';

/** Today's stolen amount (estimate). Overwrites today only; never accumulates. */
export function stealSignals(today: string, amount: unknown): Signal[] {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return [];
  return [{ kind: 'ledger', ledger: 'steal', key: today, value: Math.round(amount * 100), date: today }];
}
