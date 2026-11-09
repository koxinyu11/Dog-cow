import { COINS_KEY, coinsView, exchangeCoins, parseCoins, spendCoins, type CoinOutcome, type CoinSource, type CoinsState, type CoinsView, type MoneyLedgers } from '../shared/coins.js';
import { localDate } from '../domain/tasks/model.js';

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Owns the 狗牛币 wallet. Money facts are read from the title ledgers, never written back. */
export class Coins {
  private state: CoinsState | null = null;
  private error = '';
  private savedState: CoinsState | null = null;
  private pending: CoinOutcome | undefined;

  constructor(private readonly store: Store, private readonly ledgers: () => MoneyLedgers | null) {}

  load() {
    this.error = '';
    this.pending = undefined;
    try {
      this.state = parseCoins(this.store.getItem(COINS_KEY));
      this.savedState = this.state;
    } catch {
      this.state = null;
      this.savedState = null;
      this.error = '钱包数据异常，已锁定保护；原数据未被覆盖。';
    }
  }

  view(today = localDate()): CoinsView {
    return { ...coinsView(this.pending ? this.savedState : this.state, this.ledgers(), today, this.error),
      ...(this.pending ? { pendingSave: { ...this.pending } } : {}) };
  }

  /** A retry acknowledges the existing candidate; it never executes another exchange or spend. */
  confirmSaved(): CoinOutcome | undefined {
    const outcome = this.pending;
    this.savedState = this.state;
    this.pending = undefined;
    return outcome;
  }

  exchange(today = localDate()): number {
    if (this.pending) throw Error('钱包修改尚未保存，请先重试保存。');
    const ledgers = this.ledgers();
    if (!this.state || !ledgers) throw Error(this.error || '职称记录不可用，暂时无法兑换。');
    const result = exchangeCoins(this.state, ledgers, today, Date.now());
    if (!result.coins) throw Error('暂无可兑换的金额。');
    this.save(result.state, { kind: 'exchange', coins: result.coins, balanceBefore: this.state.balance, sources: Object.keys(result.state.entries.at(-1)!.yuan!) as CoinSource[] });
    return result.coins;
  }

  spend(item: string, price: number) {
    if (this.pending) throw Error('钱包修改尚未保存，请先重试保存。');
    if (!this.state) throw Error(this.error || '钱包不可用。');
    this.save(spendCoins(this.state, item, price, Date.now()), { kind: 'purchase', item });
  }

  owns(item: string) {
    return !!(this.pending ? this.savedState : this.state)?.owned.includes(item);
  }

  /** Storage is the repository candidate; public balance/ownership wait for disk acknowledgment. */
  private save(next: CoinsState, outcome: CoinOutcome) {
    if (this.pending) throw Error('钱包修改尚未保存，请先重试保存。');
    this.store.setItem(COINS_KEY, JSON.stringify(next));
    this.state = next;
    this.pending = outcome;
  }
}
