import { TITLES, rarityOf, rarityRank, seriesById, titleById } from './catalog/index.js';
import type { LedgerId, SignalId } from './signals.js';
import type { Condition, Signal, TitleCard, TitleDef, TitleId, TitleView, TitlesState, TitlesView } from './types.js';

/** Read-only view over stored facts; conditions and collectors only see this. */
export function viewOf(state: TitlesState): TitleView {
  const sets = new Map<string, Set<string>>();
  const set = (signal: SignalId) => {
    let found = sets.get(signal);
    if (!found) sets.set(signal, (found = new Set(state.keys[signal] ?? [])));
    return found;
  };
  return {
    count: (signal) => set(signal).size,
    has: (signal, key) => set(signal).has(key),
    keys: (signal) => [...set(signal)],
    ledger: (id: LedgerId) => state.ledgers[id] ?? {},
    unlockedCount: state.unlocked.length,
  };
}

export function met(when: Condition, view: TitleView): boolean {
  if ('count' in when) return view.count(when.count) >= when.atLeast;
  if ('unlocked' in when) return view.unlockedCount >= when.unlocked;
  if ('custom' in when) return when.custom(view);
  const values = Object.values(view.ledger('sum' in when ? when.sum : when.any)).filter((v): v is number => typeof v === 'number');
  if ('sum' in when) return values.reduce((total, value) => total + value, 0) >= when.atLeast;
  return values.some((value) => value >= when.atLeast);
}

/**
 * Records signals and unlocks every newly satisfied title.
 * Pure: returns a new state. Never revokes; repeated signals are no-ops.
 */
export function applySignals(previous: TitlesState, signals: Signal[], now: number, titles: readonly TitleDef[] = TITLES) {
  const state: TitlesState = structuredClone(previous);
  let changed = false;
  for (const signal of signals) {
    if (signal.date < state.enabledAt) continue;
    if (signal.kind === 'key') {
      const list = (state.keys[signal.signal] ??= []);
      if (!list.includes(signal.key)) { list.push(signal.key); changed = true; }
    } else {
      const ledger = (state.ledgers[signal.ledger] ??= {});
      if (ledger[signal.key] !== signal.value) { ledger[signal.key] = signal.value; changed = true; }
    }
  }
  const unlocked = evaluate(state, now, titles);
  return { state, unlocked, changed: changed || unlocked.length > 0 };
}

/** Unlocks satisfied titles in place, repeating so meta titles see earlier unlocks. */
function evaluate(state: TitlesState, now: number, titles: readonly TitleDef[]): TitleId[] {
  const fresh: TitleId[] = [];
  for (let progress = true; progress; ) {
    progress = false;
    const owned = new Set(state.unlocked.map((item) => item.id));
    const view = viewOf(state);
    for (const title of titles) {
      if (owned.has(title.id) || !met(title.when, view)) continue;
      const label = title.nameAt?.(view) ?? undefined;
      state.unlocked.push({ id: title.id, at: now, ...(label ? { label } : {}) });
      fresh.push(title.id);
      progress = true;
    }
  }
  if (!fresh.length) return fresh;
  state.unseen = [...new Set([...state.unseen, ...fresh])];
  state.pendingToast = [...new Set([...state.pendingToast, ...fresh])];
  if (!state.manual) state.worn = bestOf(fresh) ?? state.worn;
  return fresh;
}

/** Highest rarity among ids; later ids win ties. */
function bestOf(ids: TitleId[]) {
  let best: TitleDef | undefined;
  for (const id of ids) {
    const title = titleById.get(id);
    if (title && (!best || rarityRank(title.tier) >= rarityRank(best.tier))) best = title;
  }
  return best?.id;
}

export type TitlesAction =
  | { action: 'wear'; id: TitleId }
  | { action: 'unwear' }
  | { action: 'seen'; ids: TitleId[] }
  | { action: 'toast-shown'; ids: TitleId[] }
  | { action: 'show'; value: boolean };

export function changeTitles(previous: TitlesState, input: TitlesAction): TitlesState {
  const state = structuredClone(previous);
  const owned = (id: TitleId) => state.unlocked.some((item) => item.id === id);
  switch (input.action) {
    case 'wear':
      if (!owned(input.id)) throw Error('这个职称还没有获聘。');
      state.worn = input.id; state.manual = true; break;
    case 'unwear': state.worn = ''; state.manual = true; break;
    case 'seen': state.unseen = state.unseen.filter((id) => !input.ids.includes(id)); break;
    case 'toast-shown': state.pendingToast = state.pendingToast.filter((id) => !input.ids.includes(id)); break;
    case 'show': state.showInHeader = input.value; break;
  }
  return state;
}

/** Renderer-facing data: unlocked titles only. */
export function titlesView(state: TitlesState | null, error = ''): TitlesView {
  if (!state) return { error, showInHeader: false, worn: '', unseen: [], pendingToast: [], items: [] };
  const items: TitleCard[] = [];
  for (const entry of state.unlocked) {
    const title = titleById.get(entry.id);
    const series = title && seriesById.get(title.series);
    if (!title || !series) continue;
    items.push({ id: title.id, name: entry.label ?? title.name, copy: title.copy, rule: title.rule, rarity: rarityOf(title.tier),
      series: series.id, seriesName: series.name, icon: series.icon, color: series.color, at: entry.at });
  }
  return { error, showInHeader: state.showInHeader, worn: state.worn, unseen: state.unseen, pendingToast: state.pendingToast, items };
}
