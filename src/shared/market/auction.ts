import type { Market, Order, Trade } from './model.js';

export const feeFor = (notional: number, bps: number) => Math.ceil(notional * bps / 10_000);

/** One uniform clearing price: maximum executable volume, then minimum imbalance,
 * then nearest previous price. All orders are minute-local IOC during calibration. */
export function clearingPrice(orders: readonly Order[], previous: number): number | null {
  const buys = orders.filter(o => o.side === 'buy');
  const sells = orders.filter(o => o.side === 'sell');
  if (!buys.length || !sells.length) return null;
  const candidates = [...new Set(orders.map(o => o.price))];
  let best: { price: number; volume: number; imbalance: number } | undefined;
  for (const price of candidates) {
    const demand = buys.reduce((sum, o) => sum + (o.price >= price ? o.quantity : 0), 0);
    const supply = sells.reduce((sum, o) => sum + (o.price <= price ? o.quantity : 0), 0);
    const volume = Math.min(demand, supply);
    const imbalance = Math.abs(demand - supply);
    if (volume && (!best || volume > best.volume || (volume === best.volume &&
      (imbalance < best.imbalance || (imbalance === best.imbalance &&
        (Math.abs(price - previous) < Math.abs(best.price - previous) ||
          (Math.abs(price - previous) === Math.abs(best.price - previous) && price < best.price)))))))
      best = { price, volume, imbalance };
  }
  return best?.price ?? null;
}

/** Reserve cash across ALL securities before selecting a clearing price. No naked orders. */
export function reserveOrders(market: Market, orders: readonly Order[]): Order[] {
  const cash = market.accounts.map(a => a.cash);
  const holdings = market.accounts.map(a => [...a.holdings]);
  const result: Order[] = [];
  for (const order of orders) {
    const { account, security, side, price, quantity } = order;
    if (!market.accounts[account] || !market.securities[security] || !['buy', 'sell'].includes(side)
      || !Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0)
      throw Error('市场委托无效。');
    let available = Math.min(quantity, side === 'sell' ? holdings[account][security]
      : Math.floor(cash[account] / (price * (1 + market.parameters.feeBps / 10_000))));
    if (side === 'buy') {
      while (available > 0 && available * price + feeFor(available * price, market.parameters.feeBps) > cash[account]) available--;
      cash[account] -= available * price + feeFor(available * price, market.parameters.feeBps);
    } else holdings[account][security] -= available;
    if (available) result.push({ ...order, quantity: available });
  }
  return result;
}

export function auction(market: Market, security: number, orders: readonly Order[]): Trade[] {
  const asset = market.securities[security];
  const price = clearingPrice(orders, asset.price);
  if (price === null) return [];
  const buys = orders.filter(o => o.side === 'buy' && o.price >= price).map(o => ({ ...o })).sort((a, b) => b.price - a.price);
  const sells = orders.filter(o => o.side === 'sell' && o.price <= price).map(o => ({ ...o })).sort((a, b) => a.price - b.price);
  const trades: Trade[] = [];
  let buy = 0, sell = 0;
  while (buy < buys.length && sell < sells.length) {
    const bid = buys[buy], ask = sells[sell];
    // Self-crosses do not generate price or volume. Account order rotates each tick upstream.
    if (bid.account === ask.account) {
      if (bid.quantity <= ask.quantity) buy++; else sell++;
      continue;
    }
    const buyer = market.accounts[bid.account], seller = market.accounts[ask.account];
    let quantity = Math.min(bid.quantity, ask.quantity, seller.holdings[security],
      Math.floor(buyer.cash / (price * (1 + market.parameters.feeBps / 10_000))));
    while (quantity > 0 && quantity * price + feeFor(quantity * price, market.parameters.feeBps) > buyer.cash) quantity--;
    if (!quantity) { if (!seller.holdings[security]) sell++; else buy++; continue; }
    const notional = quantity * price;
    const fee = feeFor(notional, market.parameters.feeBps);
    buyer.cash -= notional + fee;
    seller.cash += notional - fee;
    buyer.holdings[security] += quantity;
    seller.holdings[security] -= quantity;
    for (const a of [buyer, seller]) { a.fees += fee; a.turnover += notional; }
    market.treasury += fee * 2;
    market.notional += notional;
    market.filled += quantity * 2;
    market.trades++;
    asset.volume += quantity;
    asset.lastTrade = market.minute;
    asset.price = price;
    bid.quantity -= quantity;
    ask.quantity -= quantity;
    trades.push({ buyer: buyer.id, seller: seller.id, security, price, quantity,
      ...(bid.fundPlan === undefined ? {} : { buyerPlan: bid.fundPlan }),
      ...(ask.fundPlan === undefined ? {} : { sellerPlan: ask.fundPlan }),
      ...(bid.clientOrder === undefined ? {} : { buyerOrder: bid.clientOrder }),
      ...(ask.clientOrder === undefined ? {} : { sellerOrder: ask.clientOrder }) });
    if (!bid.quantity) buy++;
    if (!ask.quantity) sell++;
  }
  return trades;
}
