import { validateMarketGame } from '../migration/market.js';
import { MARKET_KEY, type MarketGameState, type MarketRequest, type MarketView, type PlayerOrder } from '../shared/market/game.js';
import { createPlayableMarket } from '../shared/market/playable.js';
import { assertMarket, stepMarket } from '../shared/market/simulation.js';
import { feeFor } from '../shared/market/auction.js';
import { STRATEGIES, wealth, type Order } from '../shared/market/model.js';
import type { Coins } from './coins.js';

interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void }
export class MarketError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
const refuse = (message: string): never => { throw new MarketError('MARKET_RULE', message); };
export const reservedCash = (s: MarketGameState) => s.orders.filter(o => o.side === 'buy')
  .reduce((sum, o) => sum + (o.price + feeFor(o.price, s.market.parameters.feeBps)) * o.remaining, 0);
const reservedShares = (s: MarketGameState, id: number) => s.orders.filter(o => o.side === 'sell' && o.security === id).reduce((sum, o) => sum + o.remaining, 0);

export function newMarketGame(seed: number): MarketGameState {
  const market = createPlayableMarket(seed);
  // A bounded pre-opening history; no player money participates in the warm-up.
  for (let i = 0; i < 480; i++) stepMarket(market);
  market.accounts.push({ id: 300, strategy: 'value', identity: 'player', cash: 0, holdings: Array(258).fill(0),
    initialWealth: 0, fees: 0, turnover: 0, patience: 1, bias: 0, watch: [] });
  market.externalCash = 0;
  const state: MarketGameState = { version: 1, revision: 0, market, player: 300, orders: [], fills: [], watchlist: [240, 242, 255],
    costBasis: Array(258).fill(0), realized: 0, dividends: 0, netTransfers: 0, receipts: [], receiptFloor: 0 };
  validateMarketGame(state);
  assertMarket(market);
  return state;
}

/** Main-process owner. The host serializes ALL calls with wallet and Repository commands. */
export class StockMarket {
  private before: MarketGameState | null = null;
  private cached: { raw: string | null; state: MarketGameState } | undefined;
  private elapsed = 0;
  private failure = '';
  private lastMono: number;
  constructor(private store: Store, private coins: Coins, private seed: number,
    private now = () => Date.now(), private monotonic = () => performance.now()) { this.lastMono = monotonic(); }

  private read(): MarketGameState {
    const raw = this.store.getItem(MARKET_KEY);
    if (this.cached?.raw === raw) return this.cached.state;
    const state: MarketGameState = raw === null ? newMarketGame(this.seed) : validateMarketGame(JSON.parse(raw));
    assertMarket(state.market);
    this.cached = { raw, state };
    return state;
  }
  confirmSaved() { this.before = null; }

  view(detail = 240): MarketView {
    const s = this.before ?? this.read(), m = s.market, player = m.accounts[s.player], wallet = this.coins.view();
    const reserved = reservedCash(s);
    const positions = player.holdings.flatMap((quantity, security) => quantity ? [{ security, quantity,
      available: quantity - reservedShares(s, security), cost: s.costBasis[security], value: quantity * m.securities[security].price }] : []);
    return { revision: s.revision, minute: m.minute, pending: !!this.before,
      nextTickMs: Math.max(0, 60000 - this.elapsed - Math.min(30000, Math.max(0, this.monotonic() - this.lastMono))),
      feeBps: m.parameters.feeBps, wallet: wallet.balance, walletError: wallet.error || (wallet.pendingSave ? '钱包尚未保存。' : ''),
      cash: player.cash, available: player.cash - reserved, reserved, positions, equity: wealth(m, player),
      ...(this.failure ? { engineError: this.failure } : {}),
      unrealized: positions.reduce((sum, p) => sum + p.value - p.cost, 0), realized: s.realized,
      dividends: s.dividends, netTransfers: s.netTransfers,
      securities: m.securities.map(asset => ({ id: asset.id, code: `${asset.id >= 240 ? 'ETF' : 'DC'}${String(asset.id + 1).padStart(3, '0')}`,
        name: asset.name, industry: asset.industry, kind: asset.id < 240 ? 'stock' : 'etf', price: asset.price,
        change: asset.price / asset.initialPrice - 1, volume: asset.volume, history: [...asset.history], facts: { ...asset.published },
        lastTrade: asset.lastTrade, supply: asset.supply,
        ...(asset.id === detail ? { candles: structuredClone(asset.candles ?? []) } : {}),
        ...(asset.id < 240 ? {} : { nav: m.funds[asset.id - 240].nav, members: m.funds[asset.id - 240].basket.length }) })),
      orders: structuredClone(s.orders), fills: structuredClone(s.fills), watchlist: [...s.watchlist],
      receipts: s.receipts.map(r => r.id), news: structuredClone(m.events).reverse(),
      participants: STRATEGIES.map(strategy => {
        const accounts = m.accounts.filter(a => a.strategy === strategy && a.identity !== 'player');
        return { strategy, accounts: accounts.length, value: accounts.reduce((sum, a) => sum + wealth(m, a), 0), cash: accounts.reduce((sum, a) => sum + a.cash, 0) };
      }) };
  }

  execute(request: MarketRequest) {
    if (!request || typeof request !== 'object' || typeof request.action !== 'string') refuse('操作参数无效。');
    if (request.action === 'view') {
      if (this.store.getItem(MARKET_KEY) === null && !this.before) {
        const state = this.read();
        this.save(state, state);
        this.elapsed = 0; this.lastMono = this.monotonic();
      }
      return;
    }
    if (this.before) throw new MarketError('MARKET_SAVE_FAILED', '上次操作尚未保存，请先重试保存。');
    if (this.failure) throw new MarketError('MARKET_TICK_FAILED', this.failure);
    const old = this.read();
    if (typeof request.requestId !== 'string' || !request.requestId || request.requestId.length > 100) refuse('操作编号无效。');
    const signature = JSON.stringify(request);
    const receipt = old.receipts.find(r => r.id === request.requestId);
    if (receipt) { if (receipt.signature !== signature) refuse('操作编号与原参数不一致。'); return; }
    if (!Number.isSafeInteger(request.createdAt) || request.createdAt <= old.receiptFloor
      || request.createdAt < this.now() - 86400000 || request.createdAt > this.now() + 5000)
      throw new MarketError('MARKET_EXPIRED', '操作已过期，请核对资产后重新提交。');
    if (request.revision !== old.revision) throw new MarketError('MARKET_STALE', '行情或账户已更新，请核对后重新提交。');
    const s = structuredClone(old), player = s.market.accounts[s.player];
    let walletDelta = 0;
    if (request.action === 'deposit' || request.action === 'withdraw') {
      const wallet = this.coins.view();
      if (wallet.error || wallet.pendingSave) refuse('钱包暂不可用，请先在主界面处理。');
      if (!Number.isSafeInteger(request.amount) || request.amount <= 0 || !Number.isSafeInteger(request.amount * 100)) refuse('请输入正整数狗牛币。');
      const delta = request.amount * 100 * (request.action === 'deposit' ? 1 : -1);
      if (delta > 0 && wallet.balance < request.amount) refuse('狗牛币不足，可在主窗口兑换或出售鱼获。');
      if (delta < 0 && player.cash - reservedCash(s) < -delta) refuse('可转出余额不足，请先撤销买入委托。');
      if (!Number.isSafeInteger(player.cash + delta) || !Number.isSafeInteger(s.netTransfers + delta)) refuse('金额超出范围。');
      player.cash += delta;
      s.market.externalCash = (s.market.externalCash ?? 0) + delta;
      s.netTransfers += delta;
      walletDelta = -delta / 100;
    } else if (request.action === 'order') {
      if (!Number.isInteger(request.security) || request.security < 0 || request.security > 257
        || !['buy', 'sell'].includes(request.side) || !['market', 'limit'].includes(request.type)
        || !Number.isSafeInteger(request.quantity) || request.quantity < 1 || request.quantity > 1000000) refuse('委托参数无效。');
      if (s.orders.length >= 32) refuse('最多保留 32 笔委托，请先撤单。');
      if (s.orders.some(o => o.security === request.security && o.side !== request.side)) refuse('请先撤销这只证券的反向委托。');
      const asset = s.market.securities[request.security];
      const band = request.security >= 240 ? 0.01 : 0.035;
      const reference = request.security >= 240 ? s.market.funds[request.security - 240].nav : asset.price;
      const price = request.type === 'market' ? Math.max(1, Math.round(reference * (1 + (request.side === 'buy' ? band : -band)))) : request.price;
      if (!Number.isSafeInteger(price) || price! < 1 || price! > 100000000) refuse('请输入有效的限价，最多两位小数。');
      const committed = (price! + feeFor(price!, s.market.parameters.feeBps)) * request.quantity;
      if (!Number.isSafeInteger(committed)) refuse('委托金额超出范围。');
      if (request.side === 'buy' && player.cash - reservedCash(s) < committed) refuse('可用资金不足，请先转入狗牛币或减少数量。');
      if (request.side === 'sell' && player.holdings[request.security] - reservedShares(s, request.security) < request.quantity) refuse('可卖数量不足。');
      s.orders.push({ id: request.requestId, security: request.security, side: request.side, type: request.type,
        price: price!, quantity: request.quantity, remaining: request.quantity, minute: s.market.minute });
    } else if (request.action === 'cancel') {
      if (!s.orders.some(o => o.id === request.orderId)) refuse('委托已成交或撤销，请刷新记录。');
      s.orders = s.orders.filter(o => o.id !== request.orderId);
    } else if (request.action === 'watch') {
      if (!Number.isInteger(request.security) || request.security < 0 || request.security > 257) refuse('证券无效。');
      s.watchlist = s.watchlist.includes(request.security) ? s.watchlist.filter(id => id !== request.security) : [...s.watchlist, request.security];
    } else refuse('不支持的操作。');
    s.revision++;
    s.receipts.push({ id: request.requestId, signature, at: request.createdAt });
    if (s.receipts.length > 128) s.receiptFloor = Math.max(s.receiptFloor, ...s.receipts.splice(0, s.receipts.length - 128).map(r => r.at));
    this.save(old, s, walletDelta);
  }

  /** Called every ten seconds by the host, including when the game window is closed.
   * Stalls/sleep never become catch-up ticks. No renderer can advance the clock. */
  clock(running: boolean): void {
    const now = this.monotonic(), delta = now - this.lastMono;
    this.lastMono = now;
    if (!running || delta < 0 || delta > 30000 || this.before || this.failure || this.store.getItem(MARKET_KEY) === null) return;
    this.elapsed += delta;
    if (this.elapsed < 60000) return;
    this.elapsed %= 60000;
    try { this.tick(); } catch (error) { this.failure = '行情推进失败，已暂停交易。原记录保留，请重试或查看诊断。'; throw error; }
  }

  retryClock() {
    if (!this.failure) return;
    this.tick();
    this.failure = '';
  }

  tick(): void {
    if (this.before) return;
    const old = this.read(), s = structuredClone(old), player = s.market.accounts[s.player];
    const beforeShares = [...player.holdings], beforeDividends = s.market.securities.map(a => a.totalDividends);
    const orders: Order[] = s.orders.map(o => ({ account: s.player, security: o.security, side: o.side, price: o.price, quantity: o.remaining, clientOrder: o.id }));
    const trades = stepMarket(s.market, orders);
    s.dividends += beforeShares.reduce((sum, quantity, id) => sum + quantity * (s.market.securities[id].totalDividends - beforeDividends[id]), 0);
    const quantities = [...beforeShares];
    for (const trade of trades) {
      const id = trade.buyer === s.player ? trade.buyerOrder : trade.seller === s.player ? trade.sellerOrder : undefined;
      if (!id) continue;
      const order = s.orders.find(o => o.id === id)!;
      const notional = trade.price * trade.quantity, fee = feeFor(notional, s.market.parameters.feeBps);
      order.remaining -= trade.quantity;
      if (order.side === 'buy') { s.costBasis[trade.security] += notional + fee; quantities[trade.security] += trade.quantity; }
      else {
        const basis = Math.round(s.costBasis[trade.security] * trade.quantity / quantities[trade.security]);
        s.costBasis[trade.security] -= basis;
        quantities[trade.security] -= trade.quantity;
        s.realized += notional - fee - basis;
      }
      s.fills.unshift({ id, minute: s.market.minute, security: trade.security, side: order.side, price: trade.price, quantity: trade.quantity, fee });
    }
    // Market IOC expires after one auction; unfilled limit orders continue reserving assets.
    s.orders = s.orders.filter(o => o.remaining > 0 && o.type === 'limit');
    s.fills = s.fills.slice(0, 100);
    s.revision++;
    this.save(old, s);
  }

  private save(old: MarketGameState, next: MarketGameState, walletDelta = 0) {
    validateMarketGame(next);
    assertMarket(next.market);
    const raw = JSON.stringify(next);
    // Repository.storage is synchronous in-memory staging; finish() atomically flushes BOTH keys.
    if (walletDelta) this.coins.market(walletDelta);
    this.store.setItem(MARKET_KEY, raw);
    this.cached = { raw, state: next };
    this.before = old;
  }
}
