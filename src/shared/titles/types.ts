import type { LedgerId, SignalId } from './signals.js';

/** Stable, never reused. Retired ids go to RETIRED_IDS in catalog/index.ts. */
export type TitleId = string;
export type SeriesId = string;
export type Tier = 1 | 2 | 3 | 4 | 5 | 'hidden';
/** Badge material; derived from tier so catalog entries never set it by hand. */
export type Rarity = 'intern' | 'regular' | 'special' | 'plate' | 'secret';

export interface SeriesDef {
  id: SeriesId;
  name: string;
  /** lucide-react icon name; the renderer maps it to a component. */
  icon: string;
  color: string;
  /** Silent series unlock without toast, unseen dot or auto-wear. */
  silent?: boolean;
}

/** Read-only facts a condition may inspect. Never exposes business state. */
export interface TitleView {
  count(signal: SignalId): number;
  has(signal: SignalId, key: string): boolean;
  keys(signal: SignalId): readonly string[];
  ledger(id: LedgerId): Readonly<Record<string, number | string>>;
  unlockedCount: number;
}

export type Condition =
  | { count: SignalId; atLeast: number }
  | { sum: LedgerId; atLeast: number }
  | { any: LedgerId; atLeast: number }
  | { unlocked: number }
  | { custom: (view: TitleView) => boolean };

export interface TitleDef {
  id: TitleId;
  series: SeriesId;
  tier: Tier;
  name: string;
  /** Playful condition copy, shown only after unlock. */
  copy: string;
  /** Plain rule, shown in the folded "正经说法" section after unlock. */
  rule: string;
  when: Condition;
  /** Optional personalised name, fixed at unlock time (e.g. the user's own dish). */
  nameAt?: (view: TitleView) => string | null;
}

/** A fact produced by a collector. `date` gates facts that predate enabledAt. */
export type Signal =
  | { kind: 'key'; signal: SignalId; key: string; date: string }
  | { kind: 'ledger'; ledger: LedgerId; key: string; value: number | string; date: string };

export interface TitlesState {
  version: 1;
  rules: number;
  enabledAt: string;
  keys: Partial<Record<SignalId, string[]>>;
  ledgers: Partial<Record<LedgerId, Record<string, number | string>>>;
  unlocked: Array<{ id: TitleId; at: number; label?: string }>;
  worn: TitleId | '';
  manual: boolean;
  showInHeader: boolean;
  unseen: TitleId[];
  pendingToast: TitleId[];
}

/** Display data for one unlocked title; the only title data the renderer receives. */
export interface TitleCard {
  id: TitleId;
  name: string;
  copy: string;
  rule: string;
  rarity: Rarity;
  series: SeriesId;
  seriesName: string;
  icon: string;
  color: string;
  at: number;
}

export interface TitlesView {
  error: string;
  showInHeader: boolean;
  worn: TitleId | '';
  unseen: TitleId[];
  pendingToast: TitleId[];
  /** Unlocked only, in unlock order. Locked titles are never sent. */
  items: TitleCard[];
}
