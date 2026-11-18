import test from 'node:test';
import assert from 'node:assert/strict';
import { clearingPrice, reserveOrders, auction } from '../../dist-electron/src/shared/market/auction.js';
import { STRATEGIES, wealth } from '../../dist-electron/src/shared/market/model.js';
import { createMarket, stepMarket, assertMarket, convertFund, payDividend, updateFunds, strategySignal, roundTripCost,
  fundPlanOrders, settleFundPlans, generateOrders, operate } from '../../dist-electron/src/shared/market/simulation.js';

test('240 distinct companies, 18 backed ETFs and 300 funded accounts cover every strategy', () => {
  const market = createMarket(71);
  assert.equal(market.securities.length, 258);
  assert.equal(new Set(market.securities.map(s => s.name)).size, 258);
  assert.equal(market.funds.length, 18);
  assert.equal(market.accounts.length, 300);
  assert.deepEqual(new Set(market.accounts.map(a => a.strategy)), new Set(STRATEGIES));
  assert.ok(market.accounts.every(a => a.cash > 0));
  assertMarket(market);
});

test('auction uses maximum-volume clearing and leaves prices unchanged without a cross', () => {
  const orders = [
    { account: 0, security: 0, side: 'buy', price: 110, quantity: 7 },
    { account: 1, security: 0, side: 'buy', price: 100, quantity: 5 },
    { account: 2, security: 0, side: 'sell', price: 95, quantity: 6 },
    { account: 3, security: 0, side: 'sell', price: 105, quantity: 8 },
  ];
  assert.equal(clearingPrice(orders, 100), 105);
  assert.equal(clearingPrice([{ ...orders[0], price: 90 }, orders[2]], 100), null);
  const market = createMarket(72);
  const before = market.securities[0].price;
  assert.deepEqual(auction(market, 0, [{ ...orders[0], price: 1 }]), []);
  assert.equal(market.securities[0].price, before);
});

test('reservations enforce one shared cash balance and reject malformed orders', () => {
  const market = createMarket(73);
  const account = market.accounts[0];
  const price = Math.floor(account.cash / 2);
  const orders = reserveOrders(market, [0, 1, 2].map(security => ({ account: 0, security, side: 'buy', price, quantity: 100 })));
  const committed = orders.reduce((sum, o) => sum + o.price * o.quantity + Math.ceil(o.price * o.quantity * 0.001), 0);
  assert.ok(committed <= account.cash);
  assert.equal(orders.reduce((sum, o) => sum + o.quantity, 0), 1);
  assert.throws(() => reserveOrders(market, [{ account: 0, security: 0, side: 'buy', price: NaN, quantity: 1 }]), /委托无效/);
  const held = account.holdings[0];
  const sells = reserveOrders(market, [1, 2].map(() => ({ account: 0, security: 0, side: 'sell', price: 100, quantity: held })));
  assert.equal(sells.reduce((sum, o) => sum + o.quantity, 0), held);
});

test('actual trades transfer shares and cash, collect fees and do not self-trade', () => {
  const market = createMarket(74);
  const seller = market.accounts.find(a => a.holdings[0] > 0 && a.id !== 1);
  const buyer = market.accounts[1];
  const price = market.securities[0].price;
  const oldCash = buyer.cash, oldHoldings = buyer.holdings[0];
  const orders = reserveOrders(market, [
    { account: buyer.id, security: 0, side: 'buy', price, quantity: 5 },
    { account: seller.id, security: 0, side: 'sell', price, quantity: 5 },
  ]);
  const trades = auction(market, 0, orders);
  assert.equal(trades.length, 1);
  assert.equal(buyer.holdings[0], oldHoldings + 5);
  assert.equal(buyer.cash, oldCash - price * 5 - Math.ceil(price * 5 * 0.001));
  updateFunds(market);
  assertMarket(market);
  assert.deepEqual(auction(market, 0, [
    { account: seller.id, security: 0, side: 'buy', price, quantity: 1 },
    { account: seller.id, security: 0, side: 'sell', price, quantity: 1 },
  ]), []);
});

test('ETF redemption and recreation transfer underlying assets without increasing wealth', () => {
  const market = createMarket(75);
  const fund = market.funds[3];
  const account = market.accounts[fund.id % 25];
  const before = wealth(market, account);
  const holdings = [...account.holdings];
  assert.ok(convertFund(market, account.id, fund.id, 1, false));
  assert.equal(account.holdings[fund.id], holdings[fund.id] - 1);
  assert.equal(account.holdings[fund.basket[0].security], holdings[fund.basket[0].security] + 1);
  assert.equal(wealth(market, account), before);
  assertMarket(market);
  assert.ok(convertFund(market, account.id, fund.id, 1, true));
  assert.deepEqual(account.holdings, holdings);
  assert.equal(wealth(market, account), before);
  assertMarket(market);
  assert.equal(convertFund(market, 299, fund.id, fund.units, false), false);
  assert.throws(() => convertFund(market, 0, fund.id, -1, true), /参数无效/);
});

test('dividends deduct issuer cash and price, preserve total investor value including ETFs', () => {
  const market = createMarket(76);
  const s = market.securities[0];
  const before = market.accounts.reduce((sum, a) => sum + wealth(market, a), 0);
  const navs = market.funds.map(f => f.nav);
  const price = s.price;
  payDividend(market, 0, 3);
  updateFunds(market);
  assert.equal(s.price, price - 3);
  assert.deepEqual(market.funds.map(f => f.nav), navs);
  assert.equal(market.accounts.reduce((sum, a) => sum + wealth(market, a), 0), before);
  assertMarket(market);
  assert.throws(() => payDividend(market, 0, s.financials.cash), /金额无效/);
});

test('strategy rules react differently to the same public information; fees prevent free round trips', () => {
  const f = createMarket(77).securities[0].published;
  const value = strategySignal('value', 100, 80, f, 0.003, 0, 0, 0, 0);
  const trend = strategySignal('trend', 100, 80, f, 0.003, 0, 0, 0, 0);
  assert.ok(value < 0 && trend > 0);
  assert.ok(roundTripCost(1000, 10, 10) > 0);
  assert.throws(() => createMarket(1, 'normal', { orderFraction: 0 }), /参数无效/);
});

test('fixed-seed simulation is reproducible and undisclosed profits do not affect immediate orders', () => {
  const a = createMarket(78), b = createMarket(78);
  // Changing a private fact between disclosure times must not influence tick-one decisions.
  b.securities[0].financials.profit *= 10;
  stepMarket(a); stepMarket(b);
  assert.deepEqual(a.accounts, b.accounts);
  assert.deepEqual(a.securities.map(s => s.price), b.securities.map(s => s.price));
  const c = createMarket(79), d = createMarket(79);
  for (let i = 0; i < 60; i++) { stepMarket(c); stepMarket(d); }
  assert.deepEqual(c, d);
  assertMarket(c);
});

test('all five scenarios retain cash/share conservation through disclosure and dividend boundaries', () => {
  for (const scenario of ['normal', 'thin', 'boom', 'panic', 'concentration']) {
    const market = createMarket(80, scenario);
    for (let i = 0; i < 250; i++) { stepMarket(market); if (i % 30 === 0) assertMarket(market); }
    assertMarket(market);
    assert.ok(market.trades > 0, scenario);
    assert.ok(market.dividends > 0, scenario);
  }
});

test('economic paths stay identical across execution parameters and a temporary sentiment shock', () => {
  const normal = createMarket(91);
  const differentTrades = createMarket(91, 'normal', { orderFraction: 0.003 });
  const panic = createMarket(91, 'panic');
  for (let i = 0; i < 480; i++) { stepMarket(normal); stepMarket(differentTrades); stepMarket(panic); }
  const facts = m => m.securities.slice(0, 240).map(s => s.financials);
  assert.deepEqual(facts(normal), facts(differentTrades));
  assert.deepEqual(facts(normal), facts(panic));
  assert.ok(Math.abs(panic.sentiment) < 0.006);
  assert.equal(normal.economicState, differentTrades.economicState);
  assertMarket(panic);
});

test('reported growth cannot feed back into structural demand and long-run demand respects capacity', () => {
  const a = createMarket(92), b = createMarket(92);
  b.securities[0].financials.growth = 0.9;
  for (let minute = 30; minute <= 10080; minute += 30) {
    a.minute = b.minute = minute;
    operate(a); operate(b);
  }
  assert.equal(a.securities[0].baseDemand, b.securities[0].baseDemand);
  assert.equal(a.securities[0].structuralGrowth, b.securities[0].structuralGrowth);
  assert.ok(a.securities.slice(0, 240).every(s => s.baseDemand <= s.marketCapacity));
  assert.ok(a.securities.slice(0, 240).every(s => Math.abs(s.structuralGrowth) < 0.01));
  assertMarket(a);
});

test('ETF market-maker quotes follow backed NAV without assigning a new market price', () => {
  const market = createMarket(93);
  const fund = market.funds[3];
  market.securities[fund.id].price *= 3;
  const before = market.securities[fund.id].price;
  const quotes = generateOrders(market).filter(o => o.account === fund.id % 25 && o.security === fund.id);
  assert.equal(quotes.length, 2);
  assert.ok(quotes.every(o => Math.abs(o.price / fund.nav - 1) < 0.01));
  assert.equal(market.securities[fund.id].price, before);
  assert.ok(market.securities[fund.id].published.revenue > 0);
  assert.ok(market.securities[fund.id].published.quality > 0);
  market.minute = 60;
  const investorQuotes = generateOrders(market).filter(o => o.security >= 240 && market.accounts[o.account].strategy !== 'maker');
  assert.ok(investorQuotes.length > 0);
  assert.ok(investorQuotes.every(o => Math.abs(o.price / market.funds[o.security - 240].nav - 1) < 0.01001));
});

test('incomplete ETF basket acquisition cannot mint units; partial fills retain real inventory', () => {
  const market = createMarket(94);
  const fund = market.funds[3];
  const account = market.accounts[fund.id % 25];
  market.fundPlans.push({ fund: fund.id, account: account.id, create: true, units: 2, started: 0, stage: 'acquire', remaining: [] });
  const orders = fundPlanOrders(market);
  const leg = orders.find(o => o.fundPlan === fund.id && o.side === 'buy');
  assert.ok(leg);
  assert.equal(fund.units, 1000);
  const seller = market.accounts.find(a => a.id !== account.id && a.holdings[leg.security] > 0);
  const oldHeld = account.holdings[leg.security];
  const trades = auction(market, leg.security, reserveOrders(market, [
    { ...leg, quantity: 1 }, { account: seller.id, security: leg.security, side: 'sell', price: leg.price, quantity: 1 },
  ]));
  settleFundPlans(market, trades);
  updateFunds(market);
  assert.equal(account.holdings[leg.security], oldHeld + 1);
  fundPlanOrders(market);
  assert.equal(fund.units, 1000);
  assert.equal(market.fundPlans[0].stage, 'acquire');
  assertMarket(market);
});

test('ETF conversion is followed by real distribution; partial distribution and expiry preserve assets', () => {
  const market = createMarket(95);
  const fund = market.funds[3];
  const account = market.accounts[fund.id % 25];
  assert.ok(convertFund(market, account.id, fund.id, 2, false));
  market.fundPlans.push({ fund: fund.id, account: account.id, create: true, units: 2, started: 0, stage: 'acquire', remaining: [] });
  const order = fundPlanOrders(market).find(o => o.fundPlan === fund.id);
  assert.equal(fund.units, 1000);
  assert.equal(market.fundPlans[0].stage, 'distribute');
  const trades = auction(market, fund.id, reserveOrders(market, [order,
    { account: 1, security: fund.id, side: 'buy', price: Math.ceil(fund.nav), quantity: 1 },
  ]));
  settleFundPlans(market, trades);
  assert.equal(market.fundPlans[0].remaining[0].quantity, 1);
  assert.equal(market.completedArbitrages, 0);
  settleFundPlans(market, []);
  assert.equal(market.fundPlans[0].remaining[0].quantity, 1);
  const held = [...account.holdings];
  const expiring = market.fundPlans.length;
  market.minute = 61;
  market.securities[fund.id].price = Math.round(fund.nav);
  fundPlanOrders(market);
  assert.equal(market.expiredArbitrages, expiring);
  assert.equal(market.fundPlans.filter(p => p.fund === fund.id).length, 0);
  assert.deepEqual(account.holdings, held);
  updateFunds(market);
  assertMarket(market);
});

test('a complete redemption arbitrage sells only delivered underlying shares and acknowledges completion', () => {
  const market = createMarket(96);
  const fund = market.funds[3];
  const account = market.accounts[fund.id % 25];
  market.fundPlans.push({ fund: fund.id, account: account.id, create: false, units: 1, started: 0, stage: 'acquire', remaining: [] });
  const orders = fundPlanOrders(market);
  assert.equal(fund.units, 999);
  const trades = [];
  for (const order of orders) {
    trades.push(...auction(market, order.security, reserveOrders(market, [order,
      { account: 1, security: order.security, side: 'buy', price: market.securities[order.security].price, quantity: 1 },
    ])));
  }
  settleFundPlans(market, trades);
  assert.equal(market.completedArbitrages, 1);
  assert.equal(market.fundPlans.filter(p => p.fund === fund.id).length, 0);
  updateFunds(market);
  assertMarket(market);
});

test('ETF inventory replenishment buys a real basket while redemption preserves quoting inventory', () => {
  const market = createMarket(97);
  const fund = market.funds[3];
  const account = market.accounts[fund.id % 25];
  // Transfer inventory to another funded holder: depletion must not destroy fund shares.
  market.accounts[299].holdings[fund.id] += account.holdings[fund.id];
  account.holdings[fund.id] = 0;
  market.securities[fund.id].price = Math.round(fund.nav * 0.97);
  const units = fund.units;
  const orders = fundPlanOrders(market);
  const plan = market.fundPlans.find(p => p.fund === fund.id);
  assert.ok(plan.create);
  assert.equal(plan.stage, 'acquire');
  assert.ok(orders.some(o => o.fundPlan === fund.id && o.security < 240 && o.side === 'buy'));
  assert.equal(fund.units, units);
  assertMarket(market);
});
