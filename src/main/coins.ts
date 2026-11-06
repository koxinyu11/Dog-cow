import { COINS_KEY, coinsView, exchangeCoins, parseCoins, spendCoins, type CoinsState, type CoinsView, type MoneyLedgers } from '../shared/coins.js';
import { localDate } from '../domain/tasks/model.js';

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Owns the 狗牛币 wallet. Money facts are read from the title ledgers, never written back. */
export class Coins {
  private state: CoinsState | null = null;
  private error = '';

  constructor(private readonly store: Store, private readonly ledgers: () => MoneyLedgers | null) {}

  load() {
    this.error = '';
    try {
      this.state = parseCoins(this.store.getItem(COINS_KEY));
    } catch {
      this.state = null;
      this.error = '钱包数据异常，已锁定保护；原数据未被覆盖。';
    }
  }

  view(today = localDate()): CoinsView {
    return coinsView(this.state, this.ledgers(), today, this.error);
  }

  exchange(today = localDate()): number {
    const ledgers = this.ledgers();
    if (!this.state || !ledgers) throw Error(this.error || '职称记录不可用，暂时无法兑换。');
    const result = exchangeCoins(this.state, ledgers, today, Date.now());
    if (!result.coins) throw Error('暂无可兑换的金额。');
    this.save(result.state);
    return result.coins;
  }

  spend(item: string, price: number) {
    if (!this.state) throw Error(this.error || '钱包不可用。');
    this.save(spendCoins(this.state, item, price, Date.now()));
  }

  owns(item: string) {
    return !!this.state?.owned.includes(item);
  }

  /** Writes before replacing memory, so a failed write leaves the old balance in place. */
  private save(next: CoinsState) {
    this.store.setItem(COINS_KEY, JSON.stringify(next));
    this.state = next;
  }
}
