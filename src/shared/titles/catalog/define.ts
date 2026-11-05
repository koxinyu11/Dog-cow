import type { LedgerId, SignalId } from '../signals.js';
import type { Condition, SeriesDef, TitleDef, Tier } from '../types.js';

export interface Catalog {
  series: SeriesDef[];
  titles: TitleDef[];
}

type Step = [id: string, name: string, threshold: number, copy: string];

/** Builds a tiered series where each step is "signal count ≥ threshold". */
export function countLadder(series: string, signal: SignalId, rule: (n: number) => string, steps: Step[]): TitleDef[] {
  return ladder(series, steps, (n) => ({ count: signal, atLeast: n }), rule);
}

/** Builds a tiered series where each step is "ledger sum ≥ threshold". */
export function sumLadder(series: string, ledger: LedgerId, rule: (n: number) => string, steps: Step[]): TitleDef[] {
  return ladder(series, steps, (n) => ({ sum: ledger, atLeast: n }), rule);
}

function ladder(series: string, steps: Step[], when: (n: number) => Condition, rule: (n: number) => string): TitleDef[] {
  return steps.map(([id, name, n, copy], index) => ({
    id, series, name, copy, tier: (index + 1) as Tier, rule: rule(n), when: when(n),
  }));
}

export const hidden = (series: string, id: string, name: string, copy: string, rule: string, when: Condition,
  nameAt?: TitleDef['nameAt']): TitleDef => ({ id, series, tier: 'hidden', name, copy, rule, when, ...(nameAt ? { nameAt } : {}) });
