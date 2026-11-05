import { validDate } from '../../domain/tasks/model.js';
import { RETIRED_IDS, RULES_VERSION, titleById } from './catalog/index.js';
import { met, viewOf } from './engine.js';
import { isLedger, isSignal } from './signals.js';
import type { TitlesState } from './types.js';

export const TITLES_KEY = 'dogcow.titles.v1';
const MAX_KEYS = 20_000;

export const emptyTitles = (today: string): TitlesState => ({
  version: 1, rules: RULES_VERSION, enabledAt: today, keys: {}, ledgers: {}, unlocked: [],
  worn: '', manual: false, showInHeader: true, unseen: [], pendingToast: [],
});

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Parses stored data. `null` raw means first run. Throws on a broken structure so
 * the caller can lock titles without overwriting. Unknown ids/signals are dropped,
 * and when the stored rule version is current, unlocks the facts do not support are dropped.
 */
export function parseTitles(raw: string | null, today: string): TitlesState {
  if (raw === null) return emptyTitles(today);
  const v: unknown = JSON.parse(raw);
  if (!record(v) || v.version !== 1 || !Number.isInteger(v.rules) || !validDate(v.enabledAt) || !record(v.keys) || !record(v.ledgers)
    || !Array.isArray(v.unlocked) || typeof v.worn !== 'string' || typeof v.manual !== 'boolean' || typeof v.showInHeader !== 'boolean'
    || !Array.isArray(v.unseen) || !Array.isArray(v.pendingToast))
    throw Error('职称数据格式无效。');
  const keys: TitlesState['keys'] = {};
  for (const [id, list] of Object.entries(v.keys)) {
    if (!Array.isArray(list) || list.length > MAX_KEYS || !list.every((k) => typeof k === 'string' && k.length <= 200)) throw Error('职称记录无效。');
    if (isSignal(id)) keys[id] = [...new Set(list as string[])];
  }
  const ledgers: TitlesState['ledgers'] = {};
  for (const [id, ledger] of Object.entries(v.ledgers)) {
    if (!record(ledger) || Object.keys(ledger).length > MAX_KEYS) throw Error('职称台账无效。');
    const clean: Record<string, number | string> = {};
    for (const [day, value] of Object.entries(ledger)) {
      if (!validDate(day) || !((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || (typeof value === 'string' && value.length <= 100)))
        throw Error('职称台账无效。');
      clean[day] = value;
    }
    if (isLedger(id)) ledgers[id] = clean;
  }
  const seen = new Set<string>();
  const unlocked: TitlesState['unlocked'] = [];
  for (const item of v.unlocked) {
    if (!record(item) || typeof item.id !== 'string' || !Number.isFinite(item.at) || (item.label !== undefined && typeof item.label !== 'string'))
      throw Error('职称解锁记录无效。');
    if (seen.has(item.id) || (!titleById.has(item.id) && !RETIRED_IDS.includes(item.id))) continue;
    seen.add(item.id);
    unlocked.push({ id: item.id, at: Number(item.at), ...(item.label ? { label: String(item.label).slice(0, 20) } : {}) });
  }
  const state: TitlesState = { version: 1, rules: Number(v.rules), enabledAt: v.enabledAt as string, keys, ledgers, unlocked,
    worn: v.worn, manual: v.manual, showInHeader: v.showInHeader, unseen: [], pendingToast: [] };
  if (state.rules === RULES_VERSION) {
    // Same rules as now: an unlock must still be backed by its facts (guards hand-edited imports).
    const view = viewOf({ ...state, unlocked: [] });
    const supported = (id: string) => { const title = titleById.get(id); return !title || 'unlocked' in title.when || met(title.when, view); };
    state.unlocked = state.unlocked.filter((item) => supported(item.id));
  }
  const owned = new Set(state.unlocked.map((item) => item.id));
  const ids = (list: unknown[]) => [...new Set(list.filter((id): id is string => typeof id === 'string' && owned.has(id)))];
  state.unseen = ids(v.unseen);
  state.pendingToast = ids(v.pendingToast);
  if (!owned.has(state.worn)) state.worn = '';
  state.rules = RULES_VERSION;
  return state;
}
