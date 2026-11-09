import { validDate } from '../domain/tasks/model.js';

/**
 * 狗牛币 wallet. Coins come only from finished days of the title money ledgers
 * (`steal`, `owed`, cents per day). Each day remembers how many cents were already
 * exchanged, so the same money can never be exchanged twice; a later lower ledger
 * value just means nothing is left for that day — coins are never clawed back.
 */
export const COINS_KEY = 'dogcow.coins.v1';
export const COIN_SOURCES = ['steal', 'owed'] as const;
export type CoinSource = typeof COIN_SOURCES[number];
/** Coins per whole yuan. */
export const COIN_RATES: Record<CoinSource, number> = { steal: 1, owed: 5 };
const MAX_ENTRIES = 100;
const MAX_DAYS = 20_000;

export interface CoinEntry {
  at: number;
  kind: 'exchange' | 'spend';
  /** Signed coin change. */
  coins: number;
  /** Exchange: yuan taken from each source. */
  yuan?: Partial<Record<CoinSource, number>>;
  /** Spend: what was bought. */
  item?: string;
}
export interface CoinsState {
  version: 1;
  balance: number;
  /** Source → day → cents already exchanged. */
  used: Record<CoinSource, Record<string, number>>;
  owned: string[];
  entries: CoinEntry[];
}
export type MoneyLedgers = Partial<Record<CoinSource, Record<string, number | string>>>;

/** Returned only after the shared repository confirms the wallet write. */
export type CoinOutcome =
  | { kind: 'exchange'; coins: number; balanceBefore: number; sources: CoinSource[] }
  | { kind: 'purchase'; item: string };

export interface CoinSourceView { yuan: number; coins: number; todayYuan: number }
export interface CoinsView {
  pendingSave?: CoinOutcome;
  error: string;
  balance: number;
  rates: Record<CoinSource, number>;
  pending: Record<CoinSource, CoinSourceView>;
  owned: string[];
  entries: CoinEntry[];
}

export const emptyCoins = (): CoinsState => ({ version: 1, balance: 0, used: { steal: {}, owed: {} }, owned: [], entries: [] });

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** `null` raw means first run. Throws on a broken structure so the caller can lock the wallet without overwriting it. */
export function parseCoins(raw: string | null): CoinsState {
  if (raw === null) return emptyCoins();
  const v: unknown = JSON.parse(raw);
  if (!record(v) || v.version !== 1 || !count(v.balance) || !record(v.used) || !Array.isArray(v.owned) || !Array.isArray(v.entries)
    || !v.owned.every((id) => typeof id === 'string' && id.length <= 100))
    throw Error('狗牛币数据格式无效。');
  const used = { steal: {}, owed: {} } as CoinsState['used'];
  for (const source of COIN_SOURCES) {
    const days = v.used[source] ?? {};
    if (!record(days) || Object.keys(days).length > MAX_DAYS) throw Error('狗牛币兑换记录无效。');
    for (const [day, cents] of Object.entries(days)) {
      if (!validDate(day) || !count(cents)) throw Error('狗牛币兑换记录无效。');
      used[source][day] = cents;
    }
  }
  const entries = v.entries.filter((e): e is CoinEntry => record(e) && Number.isFinite(e.at) && (e.kind === 'exchange' || e.kind === 'spend')
    && Number.isSafeInteger(e.coins)).slice(-MAX_ENTRIES);
  return { version: 1, balance: v.balance, used, owned: [...new Set(v.owned as string[])], entries };
}

/** Per finished day: cents not yet exchanged. Today and later are excluded because today's amount is still an estimate. */
function remaining(state: CoinsState, ledgers: MoneyLedgers, source: CoinSource, today: string): [string, number][] {
  return Object.entries(ledgers[source] ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && validDate(entry[0]) && entry[0] < today)
    .map(([day, cents]) => [day, Math.max(0, cents - (state.used[source][day] ?? 0))] as [string, number])
    .filter(([, cents]) => cents > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

export function coinsView(state: CoinsState | null, ledgers: MoneyLedgers | null, today: string, error = ''): CoinsView {
  const pending = {} as Record<CoinSource, CoinSourceView>;
  for (const source of COIN_SOURCES) {
    const cents = state && ledgers ? remaining(state, ledgers, source, today).reduce((sum, [, c]) => sum + c, 0) : 0;
    const todayCents = ledgers?.[source]?.[today];
    const yuan = Math.floor(cents / 100);
    pending[source] = { yuan, coins: yuan * COIN_RATES[source], todayYuan: typeof todayCents === 'number' ? Math.floor(todayCents / 100) : 0 };
  }
  return { error: state && ledgers ? error : error || '狗牛币暂不可用。', balance: state?.balance ?? 0, rates: COIN_RATES, pending,
    owned: state?.owned ?? [], entries: (state?.entries ?? []).slice(-10).reverse() };
}

/**
 * Exchanges every whole yuan of finished days. Cents are consumed oldest day first,
 * so a sub-yuan remainder stays on the newest day for next time.
 */
export function exchangeCoins(state: CoinsState, ledgers: MoneyLedgers, today: string, at: number): { state: CoinsState; coins: number } {
  const used = { steal: { ...state.used.steal }, owed: { ...state.used.owed } };
  const yuan: Partial<Record<CoinSource, number>> = {};
  let coins = 0;
  for (const source of COIN_SOURCES) {
    const days = remaining(state, ledgers, source, today);
    const whole = Math.floor(days.reduce((sum, [, c]) => sum + c, 0) / 100);
    if (!whole) continue;
    let left = whole * 100;
    for (const [day, cents] of days) {
      const take = Math.min(cents, left);
      used[source][day] = (used[source][day] ?? 0) + take;
      left -= take;
      if (!left) break;
    }
    yuan[source] = whole;
    coins += whole * COIN_RATES[source];
  }
  if (!coins) return { state, coins: 0 };
  const entries = [...state.entries, { at, kind: 'exchange' as const, coins, yuan }].slice(-MAX_ENTRIES);
  return { state: { ...state, balance: state.balance + coins, used, entries }, coins };
}

/** Buys a one-time item. Owning it already or a short balance is refused. */
export function spendCoins(state: CoinsState, item: string, price: number, at: number): CoinsState {
  if (!item || item.length > 100 || !Number.isSafeInteger(price) || price <= 0) throw Error('兑换项目无效。');
  if (state.owned.includes(item)) throw Error('已经拥有了。');
  if (state.balance < price) throw Error('狗牛币不足。');
  const entries = [...state.entries, { at, kind: 'spend' as const, coins: -price, item }].slice(-MAX_ENTRIES);
  return { ...state, balance: state.balance - price, owned: [...state.owned, item], entries };
}
