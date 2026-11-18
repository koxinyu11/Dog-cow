import { auction, feeFor, reserveOrders } from './auction.js';
import { recordCandle } from './indicators.js';
import { clamp, DEFAULT_PARAMETERS, economicRandom, INDUSTRIES, publicValue, random, STRATEGIES, wealth,
  type Financials, type FundPlan, type Market, type Order, type Parameters, type Scenario, type Security, type Strategy, type Trade } from './model.js';

const SHARE_SUPPLY = 100_000;
const FUND_UNITS = 1_000;
const MAKERS = 25;
const PERIOD: Record<Strategy, number> = { value: 30, growth: 20, dividend: 60, turnaround: 30, trend: 3,
  reversion: 1, factor: 15, rotation: 15, event: 5, speculator: 3, maker: 1, sentiment: 5 };
const snapshot = (f: Financials): Financials => ({ ...f });
const neutralFinancials = (): Financials => ({ revenue: 0, profit: 0, cash: 0, debt: 0, growth: 0, quality: 0, dividend: 0 });

export function createMarket(seed: number, scenario: Scenario = 'normal', overrides: Partial<Parameters> = {}): Market {
  const parameters = { ...DEFAULT_PARAMETERS, ...overrides };
  if (!Number.isInteger(seed) || !['normal', 'thin', 'boom', 'panic', 'concentration'].includes(scenario)
    || !Object.values(parameters).every(Number.isFinite) || parameters.feeBps < 0 || parameters.feeBps > 100
    || parameters.spreadBps < 1 || parameters.spreadBps > 500 || parameters.orderFraction <= 0 || parameters.orderFraction > 0.1
    || parameters.fundamentalWeight < 0 || parameters.fundamentalWeight > 1) throw Error('市场模拟参数无效。');
  const market: Market = { seed, randomState: seed >>> 0, economicState: (seed ^ 0x9e3779b9) >>> 0,
    minute: 0, scenario, parameters, securities: [], funds: [], accounts: [],
    sectors: INDUSTRIES.map(() => 0), sentiment: 0, fundPlans: [], treasury: 0, initialCash: 0, initialIssuerCash: 0, operatingCash: 0, dividends: 0,
    submitted: 0, filled: 0, notional: 0, trades: 0, etfArbitrages: 0, completedArbitrages: 0, expiredArbitrages: 0, events: [] };
  const prefixes = ['狗牛', '摸鱼', '午后', '星河', '远山', '长青', '金麦', '云帆', '晴川', '新芽', '丰禾', '海岳', '青石', '飞驰', '晨光', '四季', '山海', '启明', '白露', '栖木'];
  for (let id = 0; id < 240; id++) {
    const industry = Math.floor(id / 20);
    const phase = id % 5;
    const quality = 0.3 + random(market) * 0.6;
    const margin = 0.06 + quality * 0.18;
    const growth = [0.035, 0.02, 0.004, -0.015, -0.005][phase] + (random(market) - 0.5) * 0.015;
    const revenue = Math.round((80_000_000 + random(market) * 320_000_000) * (1 + industry * 0.08));
    const debt = Math.round(revenue * (phase === 4 ? 2 : 0.2 + random(market) * 0.6));
    const f: Financials = { revenue, profit: Math.round(revenue * margin - debt * 0.008),
      cash: Math.round(revenue * (phase === 1 ? 0.15 : 0.4 + random(market) * 0.5)), debt, growth, quality, dividend: 0 };
    const security: Security = { id, name: `${prefixes[id % 20]}${INDUSTRIES[industry]}`, industry, price: 0, initialPrice: 0,
      previous: 0, momentum: 0, supply: SHARE_SUPPLY, volume: 0, lastTrade: -1, history: [], financials: f,
      published: snapshot(f), margin, capacity: revenue * 1.3, sensitivity: 0.5 + random(market),
      payout: phase === 2 ? 0.45 : phase === 1 ? 0 : 0.15, news: 0, totalDividends: 0,
      growthAnchor: growth * 0.2, structuralGrowth: growth * 0.2, baseDemand: revenue,
      marketCapacity: revenue * (1.4 + quality * 0.8) };
    security.price = Math.round(publicValue(security) * (0.88 + random(market) * 0.24));
    security.initialPrice = security.previous = security.price;
    security.history = [security.price];
    market.securities.push(security);
  }
  const ranked = [...market.securities].sort((a, b) => b.initialPrice - a.initialPrice);
  const baskets = [ranked.slice(0, 60), ranked.slice(120), market.securities.slice(0, 240),
    ...INDUSTRIES.map((_, industry) => market.securities.filter(s => s.industry === industry)),
    [...market.securities].sort((a, b) => b.payout - a.payout).slice(0, 30),
    [...market.securities].sort((a, b) => b.published.growth - a.published.growth).slice(0, 30),
    [...market.securities].sort((a, b) => publicValue(b) / b.price - publicValue(a) / a.price).slice(0, 30)];
  const names = ['狗牛大盘', '狗牛小盘', '狗牛全市场', ...INDUSTRIES, '狗牛红利', '狗牛成长', '狗牛价值'];
  for (let i = 0; i < baskets.length; i++) {
    const id = 240 + i;
    const basket = baskets[i].map(s => ({ security: s.id, quantity: 1 }));
    const nav = baskets[i].reduce((sum, s) => sum + s.price, 0);
    market.funds.push({ id, name: `${names[i]} ETF`, basket, units: FUND_UNITS, cash: 0, nav, creations: 0, redemptions: 0 });
    const f = neutralFinancials();
    market.securities.push({ id, name: `${names[i]} ETF`, industry: i >= 3 && i < 15 ? i - 3 : -1,
      price: nav, initialPrice: nav, previous: nav, momentum: 0, supply: FUND_UNITS, volume: 0, lastTrade: -1,
      history: [nav], financials: f, published: snapshot(f), margin: 0, capacity: 0, sensitivity: 0, payout: 0, news: 0,
      totalDividends: 0, growthAnchor: 0, structuralGrowth: 0, baseDemand: 0, marketCapacity: 0 });
  }
  for (let id = 0; id < 300; id++) {
    const strategy = id < MAKERS ? 'maker' : STRATEGIES.filter(s => s !== 'maker')[(id - MAKERS) % 11];
    const identity = id < MAKERS ? 'maker' : strategy === 'speculator' ? 'whale'
      : ['sentiment', 'trend', 'reversion'].includes(strategy) ? 'retail-pool' : 'institution';
    market.accounts.push({ id, strategy, identity, cash: 0, holdings: Array(258).fill(0), initialWealth: 0, fees: 0, turnover: 0,
      patience: 0.6 + random(market) * 0.8, bias: (random(market) - 0.5) * 0.06,
      watch: Array.from({ length: 12 }, () => Math.floor(random(market) * 258)) });
  }
  for (const s of market.securities) {
    const reserved = s.id < 240 ? market.funds.reduce((sum, f) => sum + (f.basket.some(b => b.security === s.id) ? f.units : 0), 0) : 0;
    let remaining = s.supply - reserved;
    const maker = market.accounts[s.id % MAKERS];
    const inventory = Math.floor(remaining * 0.3);
    maker.holdings[s.id] = inventory;
    remaining -= inventory;
    for (let i = 0; i < 15; i++) {
      const owner = market.accounts[MAKERS + Math.floor(random(market) * (300 - MAKERS))];
      const quantity = i === 14 ? remaining : Math.floor(remaining / (15 - i));
      owner.holdings[s.id] += quantity;
      remaining -= quantity;
    }
  }
  for (const account of market.accounts) {
    const portfolio = wealth(market, account);
    const reserve = account.strategy === 'maker' ? 1.2 : account.identity === 'whale' ? 0.8 : 0.4;
    account.cash = Math.round(portfolio * reserve);
    account.initialWealth = wealth(market, account);
  }
  market.initialCash = market.accounts.reduce((sum, a) => sum + a.cash, 0);
  market.initialIssuerCash = market.securities.slice(0, 240).reduce((sum, s) => sum + s.financials.cash, 0);
  updateFunds(market);
  assertMarket(market);
  return market;
}

/** Operating randomness affects demand/costs, never directly assigns a traded price. */
export function operate(market: Market): void {
  // A cycle changes the level of demand, rather than compounding into structural growth.
  market.sectors = market.sectors.map(value => clamp(value * 0.93 + (economicRandom(market) - 0.5) * 0.003, -0.08, 0.08));
  if (market.minute % 240 === 0) {
    const industry = Math.floor(economicRandom(market) * 12);
    const impact = (economicRandom(market) - 0.5) * 0.025;
    market.sectors[industry] = clamp(market.sectors[industry] + impact, -0.08, 0.08);
    market.events.push({ minute: market.minute, industry, impact, title: impact > 0 ? '行业需求回暖' : '行业订单降温' });
  }
  if (market.minute === 120 && market.scenario === 'boom') {
    market.sectors[8] = 0.06;
    market.events.push({ minute: 120, industry: 8, impact: 0.06, title: '科技行业新增订单' });
  }
  if (market.minute === 120 && market.scenario === 'panic') {
    market.sentiment = -0.2;
    market.events.push({ minute: 120, industry: -1, impact: -0.2, title: '市场风险偏好下降' });
  }
  const energyCost = Math.max(0, market.sectors[6]) * 0.15;
  for (const s of market.securities.slice(0, 240)) {
    const f = s.financials;
    const headroom = clamp(1 - s.baseDemand / s.marketCapacity, 0, 1);
    const anchor = s.growthAnchor * (s.growthAnchor > 0 ? headroom : 1);
    s.structuralGrowth = s.structuralGrowth * 0.95 + anchor * 0.05;
    s.baseDemand = clamp(s.baseDemand * (1 + s.structuralGrowth / 8), 1_000_000, s.marketCapacity);
    const demand = s.baseDemand * (1 + market.sectors[s.industry] * s.sensitivity);
    f.revenue = Math.round(Math.max(1_000_000, Math.min(s.capacity,
      f.revenue * 0.7 + demand * 0.3 + f.revenue * (economicRandom(market) - 0.5) * 0.002)));
    const interest = f.debt * 0.008;
    f.profit = Math.round(f.revenue * (s.margin - (s.industry === 6 ? -energyCost : energyCost)) - interest);
    const retained = Math.round(f.profit / 8);
    f.cash += retained;
    market.operatingCash += retained;
    // Distress consumes cash and shrinks productive capacity; no automatic bailout.
    if (f.cash < 0) {
      const financing = -f.cash;
      f.debt += financing;
      f.cash = 0;
      market.operatingCash += financing;
      s.capacity *= 0.995;
    }
    if (f.cash > f.revenue * 0.3 && f.growth > 0.01) {
      const investment = Math.round(f.revenue * 0.002 * f.quality);
      f.cash -= investment;
      market.operatingCash -= investment;
      s.capacity += investment * 4;
    }
    if (market.minute % 240 === 0) {
      const oldRevenue = s.published.revenue;
      f.growth = clamp(f.revenue / oldRevenue - 1, -0.1, 0.1);
      s.news = clamp((f.profit - s.published.profit) / Math.max(1, Math.abs(s.published.profit)), -0.4, 0.4);
      const dividend = Math.floor(Math.max(0, Math.min(f.profit * s.payout, f.cash * 0.08)) / s.supply);
      if (dividend) payDividend(market, s.id, dividend);
      f.dividend = dividend;
      s.published = snapshot(f);
    }
  }
  for (const fund of market.funds) {
    const dividend = Math.floor(fund.cash / fund.units);
    if (dividend && market.minute % 240 === 0) {
      for (const account of market.accounts) account.cash += account.holdings[fund.id] * dividend;
      fund.cash -= dividend * fund.units;
      const s = market.securities[fund.id];
      s.totalDividends += dividend;
      s.price = Math.max(1, s.price - dividend);
      s.previous = Math.max(1, s.previous - dividend);
    }
  }
  updateFunds(market);
  market.events = market.events.slice(-100);
}

export function payDividend(market: Market, security: number, perShare: number): void {
  const s = market.securities[security];
  if (security >= 240 || !Number.isSafeInteger(perShare) || perShare <= 0 || perShare * s.supply > s.financials.cash)
    throw Error('公司分红金额无效。');
  for (const account of market.accounts) account.cash += account.holdings[security] * perShare;
  for (const fund of market.funds) {
    const member = fund.basket.find(b => b.security === security);
    if (member) fund.cash += member.quantity * fund.units / (fund.unitSize ?? 1) * perShare;
  }
  const paid = perShare * s.supply;
  s.financials.cash -= paid;
  market.dividends += paid;
  s.totalDividends += perShare;
  s.price = Math.max(1, s.price - perShare);
  s.previous = Math.max(1, s.previous - perShare);
}

export function updateFunds(market: Market): void {
  for (const fund of market.funds) {
    fund.nav = fund.basket.reduce((sum, b) => sum + market.securities[b.security].price * b.quantity, 0) / (fund.unitSize ?? 1) + fund.cash / fund.units;
    const facts = neutralFinancials();
    let weight = 0, news = 0;
    for (const member of fund.basket) {
      const s = market.securities[member.security];
      const f = s.published;
      const fraction = member.quantity * fund.units / (fund.unitSize ?? 1) / s.supply;
      for (const key of ['revenue', 'profit', 'cash', 'debt'] as const) facts[key] += f[key] * fraction;
      const value = s.price * member.quantity;
      weight += value;
      facts.growth += f.growth * value;
      facts.quality += f.quality * value;
      facts.dividend += f.dividend * member.quantity / (fund.unitSize ?? 1);
      news += s.news * value;
    }
    facts.growth /= weight;
    facts.quality /= weight;
    const security = market.securities[fund.id];
    security.published = facts;
    security.news = news / weight;
  }
}

/** In-kind primary-market conversion: transfers actual shares/cash, never invents assets. */
export function convertFund(market: Market, accountId: number, fundId: number, units: number, create: boolean): boolean {
  const account = market.accounts[accountId];
  const fund = market.funds.find(f => f.id === fundId);
  if (!account || !fund || !Number.isSafeInteger(units) || units <= 0) throw Error('ETF 申赎参数无效。');
  const lot = fund.unitSize ?? 1;
  if (units % lot !== 0) throw Error('ETF 申赎必须为完整篮子。');
  const cash = create ? Math.ceil(fund.cash * units / fund.units) : Math.floor(fund.cash * units / fund.units);
  if (create) {
    if (account.cash < cash || fund.basket.some(b => account.holdings[b.security] < b.quantity * units / lot)) return false;
    for (const b of fund.basket) account.holdings[b.security] -= b.quantity * units / lot;
    account.cash -= cash;
    fund.cash += cash;
    account.holdings[fundId] += units;
    fund.units += units;
    fund.creations += units;
  } else {
    if (account.holdings[fundId] < units || units >= fund.units) return false;
    for (const b of fund.basket) account.holdings[b.security] += b.quantity * units / lot;
    account.cash += cash;
    fund.cash -= cash;
    account.holdings[fundId] -= units;
    fund.units -= units;
    fund.redemptions += units;
  }
  market.securities[fundId].supply = fund.units;
  updateFunds(market);
  return true;
}

/** The strategy boundary receives public facts only, not latent company financials. */
export function strategySignal(strategy: Strategy, price: number, fair: number, f: Readonly<Financials>,
  momentum: number, news: number, sector: number, bias: number, noise: number): number {
  const value = clamp(fair / price - 1, -0.6, 0.6);
  switch (strategy) {
    case 'value': return value * 0.8 + bias;
    case 'growth': return value * 0.35 + f.growth * 4 + bias;
    case 'dividend': return value * 0.5 + f.dividend * 4 / price * 2 - 0.025 + bias;
    case 'turnaround': return value * 0.6 + news * 0.7 - (f.debt > f.cash * 4 ? 0.05 : 0) + bias;
    case 'trend': return momentum * 90 + bias;
    case 'reversion': return value * 0.15 - momentum * 70 + bias;
    case 'factor': return value * 0.4 + f.growth * 1.5 + (f.quality - 0.6) * 0.08 + momentum * 15 + bias;
    case 'rotation': return sector * 3 + value * 0.2 + momentum * 20 + bias;
    case 'event': return news * 0.8 + sector * 1.5 + bias;
    case 'speculator': return momentum * 60 + news * 0.5 + sector * 2 + bias + noise * 0.08;
    case 'maker': return value * 0.1;
    case 'sentiment': return momentum * 80 + news * 0.4 + noise * 0.15 + bias;
  }
}

export function generateOrders(market: Market): Order[] {
  const result: Order[] = [];
  const { parameters } = market;
  // Rotate reservation priority so a fixed security/account does not always consume cash first.
  for (let offset = 0; offset < market.accounts.length; offset++) {
    const a = market.accounts[(offset + market.minute) % market.accounts.length];
    if (a.identity === 'player') continue;
    if ((market.minute + a.id) % Math.max(1, Math.round(PERIOD[a.strategy] * a.patience))) continue;
    if (market.scenario === 'thin' && a.strategy !== 'maker' && random(market) < 0.85) continue;
    const equity = wealth(market, a);
    const owned = a.holdings.flatMap((quantity, id) => quantity ? [id] : []);
    const watched = a.strategy === 'maker'
      ? market.securities.filter(s => s.id % MAKERS === a.id).map(s => s.id)
      : [...new Set([...a.watch, ...owned])];
    const start = market.minute % Math.max(1, watched.length);
    const candidates = a.strategy === 'maker' ? watched : Array.from({ length: Math.min(12, watched.length) }, (_, i) => watched[(start + i) % watched.length]);
    for (const id of candidates) {
      const s = market.securities[id];
      const fund = id >= 240 ? market.funds[id - 240] : undefined;
      const fair = fund?.nav ?? publicValue(s);
      const sector = s.industry < 0 ? 0 : market.sectors[s.industry];
      const signal = strategySignal(a.strategy, s.price, fair, s.published, s.momentum, s.news, sector, a.bias, random(market) - 0.5);
      const fraction = parameters.orderFraction * (a.identity === 'whale' ? 2 : 1) * (market.scenario === 'thin' ? 0.3 : 1);
      const size = Math.max(1, Math.floor(equity * fraction / s.price));
      if (a.strategy === 'maker') {
        const plan = market.fundPlans.find(p => p.account === a.id);
        // Preserve acquired legs while continuing to quote the unencumbered inventory.
        const locked = plan?.stage === 'acquire' ? plan.create
          ? (market.funds[plan.fund - 240].basket.find(b => b.security === id)?.quantity ?? 0) * plan.units / (market.funds[plan.fund - 240].unitSize ?? 1)
          : id === plan.fund ? plan.units : 0 : 0;
        const inventorySkew = clamp((a.holdings[id] * s.price / equity - 0.06) * 0.03, -0.004, 0.004);
        const center = fund ? fund.nav * (1 - inventorySkew * 0.25)
          : s.price * (1 + clamp((fair / s.price - 1) * parameters.fundamentalWeight, -0.015, 0.015) - inventorySkew);
        const spread = parameters.spreadBps / 10_000;
        result.push({ account: a.id, security: id, side: 'buy', price: Math.max(1, Math.floor(center * (1 - spread))), quantity: size });
        const distributing = plan?.stage === 'distribute' && plan.remaining.some(leg => leg.security === id && leg.quantity > 0);
        const sellSize = distributing ? 0 : Math.min(size, Math.max(0, a.holdings[id] - locked));
        if (sellSize) result.push({ account: a.id, security: id, side: 'sell', price: Math.max(1, Math.ceil(center * (1 + spread))), quantity: sellSize });
        continue;
      }
      let adjusted = signal;
      if (['sentiment', 'trend', 'speculator'].includes(a.strategy)) adjusted += market.sentiment;
      if (market.scenario === 'concentration' && a.identity === 'whale' && s.industry === 11)
        adjusted += market.minute < 240 ? 0.3 : market.minute < 480 ? -0.4 : 0;
      if (Math.abs(adjusted) < 0.015) continue;
      const side = adjusted > 0 ? 'buy' : 'sell';
      if (side === 'buy' && a.holdings[id] * s.price > equity * (a.identity === 'whale' ? 0.3 : 0.12)) continue;
      // ETF NAV is observable basket value: all participants quote against that value,
      // while their strategy still determines direction, urgency, size and participation.
      const band = fund ? 0.01 : 0.035;
      const aggression = clamp(adjusted * 0.12, -band, band);
      const price = Math.max(1, Math.round((fund?.nav ?? s.price) * (1 + aggression)));
      result.push({ account: a.id, security: id, side, price, quantity: size });
    }
  }
  return result;
}

export function fundPlanOrders(market: Market): Order[] {
  const orders: Order[] = [];
  const expired = new Set<number>();
  for (const plan of [...market.fundPlans]) {
    if (market.minute - plan.started >= 60) {
      market.fundPlans.splice(market.fundPlans.indexOf(plan), 1);
      market.expiredArbitrages++;
      expired.add(plan.fund);
    }
  }
  for (const fund of market.funds) {
    if (expired.has(fund.id)) continue;
    const account = market.accounts[fund.id % MAKERS];
    const price = market.securities[fund.id].price;
    const premium = price / fund.nav - 1;
    let plan = market.fundPlans.find(p => p.fund === fund.id);
    // Retain a quoting buffer: redeeming that buffer can remove the only executable ask
    // and strand the last traded price below a rising NAV, despite a funded current bid.
    const targetInventory = Math.max(2, Math.ceil(wealth(market, account) * market.parameters.orderFraction * 3 / fund.nav));
    const inventory = account.holdings[fund.id];
    const lot = fund.unitSize ?? 1;
    const replenish = inventory < targetInventory;
    if (!plan && (replenish || Math.abs(premium) > 0.008)) {
      const create = replenish || premium > 0;
      const available = create ? Math.max(1, targetInventory - inventory) : Math.max(0, inventory - targetInventory);
      const units = Math.floor(Math.min(100 * lot, available, Math.floor(account.cash * 0.03 / fund.nav)) / lot) * lot;
      if (units < 1) continue;
      plan = { fund: fund.id, account: account.id, create, units, started: market.minute, stage: 'acquire', remaining: [] };
      market.fundPlans.push(plan);
    }
    if (!plan) continue;
    if (plan.stage === 'acquire' && convertFund(market, account.id, fund.id, plan.units, plan.create)) {
      plan.stage = 'distribute';
      plan.remaining = plan.create ? [{ security: fund.id, quantity: plan.units }]
        : fund.basket.map(b => ({ security: b.security, quantity: b.quantity * plan!.units / lot }));
      market.etfArbitrages++;
    }
    const legs = plan.stage === 'distribute' ? plan.remaining
      : plan.create ? fund.basket.map(b => ({ security: b.security, quantity: Math.max(0, b.quantity * plan!.units / lot - account.holdings[b.security]) }))
        : [{ security: fund.id, quantity: Math.max(0, plan.units - account.holdings[fund.id]) }];
    for (const leg of legs) {
      if (!leg.quantity) continue;
      const s = market.securities[leg.security];
      const reference = leg.security === fund.id ? fund.nav : s.price;
      const sell = plan.stage === 'distribute';
      // Reserve and auction still enforce actual cash, inventory, fees and counterparties.
      const urgency = Math.min(leg.security >= 240 ? 0.01 : 0.035, 0.007 + (market.minute - plan.started) * 0.001);
      orders.push({ account: account.id, security: leg.security, side: sell ? 'sell' : 'buy',
        price: Math.max(1, Math.round(reference * (1 + (sell ? -urgency : urgency)))), quantity: leg.quantity, fundPlan: fund.id });
    }
  }
  return orders;
}

export function settleFundPlans(market: Market, trades: readonly Trade[]): void {
  for (const trade of trades) {
    if (trade.sellerPlan === undefined) continue;
    const plan = market.fundPlans.find(p => p.fund === trade.sellerPlan && p.account === trade.seller && p.stage === 'distribute');
    const leg = plan?.remaining.find(l => l.security === trade.security);
    if (leg) leg.quantity = Math.max(0, leg.quantity - trade.quantity);
  }
  for (const plan of [...market.fundPlans]) {
    if (plan.stage === 'distribute' && plan.remaining.every(l => l.quantity === 0)) {
      market.fundPlans.splice(market.fundPlans.indexOf(plan), 1);
      market.completedArbitrages++;
    }
  }
}

export function stepMarket(market: Market, externalOrders: readonly Order[] = []): Trade[] {
  market.minute++;
  const opening = market.securities.map(s => s.price);
  market.sentiment *= 0.99;
  for (const s of market.securities) { s.previous = s.price; s.volume = 0; s.news *= 0.995; }
  if (market.minute % 30 === 0) operate(market);
  updateFunds(market);
  const planOrders = fundPlanOrders(market);
  const reserved = reserveOrders(market, [...externalOrders, ...planOrders, ...generateOrders(market)]);
  market.submitted += reserved.reduce((sum, o) => sum + o.quantity, 0);
  const books: Order[][] = Array.from({ length: 258 }, () => []);
  for (const order of reserved) books[order.security].push(order);
  // Every order uses the same start-of-tick information; NAV updates after all auctions.
  const trades: Trade[] = [];
  for (let id = 0; id < 258; id++) trades.push(...auction(market, id, books[id]));
  settleFundPlans(market, trades);
  updateFunds(market);
  for (const s of market.securities) {
    s.candles = recordCandle(s.candles ?? [], market.minute, opening[s.id], s.price, s.volume);
    s.momentum = s.momentum * 0.9 + (s.price / s.previous - 1) * 0.1;
    if (market.minute % 5 === 0) { s.history.push(s.price); if (s.history.length > 289) s.history.shift(); }
  }
  return trades;
}

/** Includes ETF underlying inventory and undistributed cash, not just displayed balances. */
export function assertMarket(market: Market): void {
  const count = (n: number) => Number.isSafeInteger(n) && n >= 0;
  const cash = market.accounts.reduce((sum, a) => sum + a.cash, 0) + market.funds.reduce((sum, f) => sum + f.cash, 0) + market.treasury;
  if (cash !== market.initialCash + market.dividends + (market.externalCash ?? 0)) throw Error(`市场资金不守恒：${cash}。`);
  const issuerCash = market.securities.slice(0, 240).reduce((sum, s) => sum + s.financials.cash, 0);
  if (issuerCash !== market.initialIssuerCash + market.operatingCash - market.dividends) throw Error('公司现金账不平。');
  for (const a of market.accounts) {
    if (!count(a.cash) || a.holdings.length !== 258 || !a.holdings.every(count)) throw Error(`账户资产无效：${a.id}。`);
  }
  for (const s of market.securities) {
    let supply = market.accounts.reduce((sum, a) => sum + a.holdings[s.id], 0);
    if (s.id < 240) for (const f of market.funds) {
      const member = f.basket.find(b => b.security === s.id);
      if (member) supply += member.quantity * f.units / (f.unitSize ?? 1);
    }
    if (!count(s.price) || s.price < 1 || !count(s.supply) || supply !== s.supply) throw Error(`证券份额不守恒：${s.id}。`);
  }
  for (const f of market.funds) {
    const nav = f.basket.reduce((sum, b) => sum + market.securities[b.security].price * b.quantity, 0) / (f.unitSize ?? 1) + f.cash / f.units;
    if (!count(f.cash) || !count(f.units) || f.units < 1 || !Number.isFinite(f.nav) || Math.abs(nav - f.nav) > 0.0001)
      throw Error(`ETF 资产账不平：${f.id}。`);
  }
}

export function strategyReturns(market: Market): Record<Strategy, number> {
  return Object.fromEntries(STRATEGIES.map(strategy => {
    const accounts = market.accounts.filter(a => a.strategy === strategy);
    const before = accounts.reduce((sum, a) => sum + a.initialWealth, 0);
    return [strategy, accounts.reduce((sum, a) => sum + wealth(market, a), 0) / before - 1];
  })) as Record<Strategy, number>;
}

/** Cost of an immediate round trip at unchanged price; used to quantify fee leakage. */
export function roundTripCost(price: number, quantity: number, feeBps: number): number {
  return feeFor(price * quantity, feeBps) * 2;
}
