/** Shared source validator: usable by legacy transfer code and compiled Electron code. */
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = v => Number.isSafeInteger(v) && v >= 0;
const finite = v => typeof v === 'number' && Number.isFinite(v);
const financials = f => record(f) && ['revenue', 'profit', 'cash', 'debt', 'growth', 'quality', 'dividend'].every(k => finite(f[k]));
const fail = () => { throw Error('狗牛市存档无效，原始数据已保留。'); };
export function validateMarketGame(s) {
  if (!record(s) || s.version !== 1 || !count(s.revision) || s.player !== 300 || !record(s.market)
    || !Array.isArray(s.orders) || s.orders.length > 32 || !Array.isArray(s.fills) || s.fills.length > 100
    || !Array.isArray(s.watchlist) || s.watchlist.length > 258 || new Set(s.watchlist).size !== s.watchlist.length
    || !s.watchlist.every(id => count(id) && id < 258) || !Array.isArray(s.costBasis) || s.costBasis.length !== 258 || !s.costBasis.every(count)
    || !Number.isSafeInteger(s.realized) || !count(s.dividends) || !Number.isSafeInteger(s.netTransfers)
    || !count(s.receiptFloor) || !Array.isArray(s.receipts) || s.receipts.length > 128) fail();
  const m = s.market;
  if (!count(m.minute) || !count(m.randomState) || !count(m.economicState) || !finite(m.sentiment)
    || !record(m.parameters) || !['feeBps', 'spreadBps', 'orderFraction', 'fundamentalWeight'].every(k => finite(m.parameters[k]))
    || m.parameters.feeBps < 0 || m.parameters.feeBps > 100
    || !Array.isArray(m.securities) || m.securities.length !== 258 || !Array.isArray(m.accounts) || m.accounts.length !== 301
    || !Array.isArray(m.funds) || m.funds.length !== 18 || !Array.isArray(m.sectors) || m.sectors.length !== 12 || !m.sectors.every(finite)
    || !Array.isArray(m.events) || m.events.length > 100 || !Array.isArray(m.fundPlans) || m.fundPlans.length > 18
    || !['treasury', 'initialCash', 'initialIssuerCash', 'dividends', 'submitted', 'filled', 'notional', 'trades', 'etfArbitrages', 'completedArbitrages', 'expiredArbitrages'].every(k => count(m[k]))
    || !Number.isSafeInteger(m.operatingCash) || !Number.isSafeInteger(m.externalCash) || m.externalCash !== s.netTransfers) fail();
  for (const [id, a] of m.accounts.entries()) {
    if (!record(a) || a.id !== id || !count(a.cash) || !Array.isArray(a.holdings) || a.holdings.length !== 258 || !a.holdings.every(count)
      || !['value','growth','dividend','turnaround','trend','reversion','factor','rotation','event','speculator','maker','sentiment'].includes(a.strategy)
      || !['maker','institution','whale','retail-pool','player'].includes(a.identity) || (a.identity === 'player') !== (id === 300)
      || !finite(a.initialWealth) || !count(a.fees) || !count(a.turnover) || !finite(a.patience) || a.patience <= 0 || !finite(a.bias)
      || !Array.isArray(a.watch) || a.watch.length > 258 || !a.watch.every(i => count(i) && i < 258)) fail();
  }
  for (const [id, asset] of m.securities.entries()) {
    if (!record(asset) || asset.id !== id || typeof asset.name !== 'string' || asset.name.length > 100 || !Number.isInteger(asset.industry)
      || !count(asset.price) || asset.price < 1 || !count(asset.initialPrice) || asset.initialPrice < 1 || !count(asset.previous) || asset.previous < 1
      || !count(asset.supply) || !count(asset.volume) || !Number.isInteger(asset.lastTrade) || !finite(asset.momentum) || !finite(asset.news)
      || !Array.isArray(asset.history) || asset.history.length > 289 || !asset.history.every(n => count(n) && n > 0)
      || !financials(asset.financials) || !financials(asset.published)
      || !['margin','capacity','sensitivity','payout','growthAnchor','structuralGrowth','baseDemand','marketCapacity'].every(k => finite(asset[k]))
      || !count(asset.totalDividends)) fail();
    if (asset.candles !== undefined && (!Array.isArray(asset.candles) || asset.candles.length > 289
      || !asset.candles.every((bar, i) => record(bar) && count(bar.time) && bar.time % 5 === 0
        && (i === 0 || bar.time > asset.candles[i - 1].time) && bar.time < m.minute
        && ['open','high','low','close'].every(k => count(bar[k]) && bar[k] > 0) && count(bar.volume)
        && bar.low <= Math.min(bar.open, bar.close) && bar.high >= Math.max(bar.open, bar.close) && bar.low <= bar.high))) fail();
  }
  for (const [i, f] of m.funds.entries()) {
    if (!record(f) || f.id !== 240 + i || f.unitSize !== 1000 || !count(f.units) || f.units < 1000 || f.units % 1000
      || !count(f.cash) || !finite(f.nav) || f.nav <= 0 || !count(f.creations) || !count(f.redemptions)
      || !Array.isArray(f.basket) || !f.basket.length || f.basket.length > 240
      || new Set(f.basket.map(b => b.security)).size !== f.basket.length
      || !f.basket.every(b => record(b) && count(b.security) && b.security < 240 && count(b.quantity) && b.quantity > 0)) fail();
  }
  for (const p of m.fundPlans) {
    if (!record(p) || !count(p.fund) || p.fund < 240 || p.fund > 257 || p.account !== p.fund % 25
      || typeof p.create !== 'boolean' || !count(p.units) || p.units < 1000 || p.units % 1000
      || !count(p.started) || p.started > m.minute || !['acquire','distribute'].includes(p.stage)
      || !Array.isArray(p.remaining) || p.remaining.length > 240 || !p.remaining.every(l => record(l) && count(l.security) && l.security < 258 && count(l.quantity))) fail();
  }
  const orderIds = new Set();
  for (const o of s.orders) {
    if (!record(o) || typeof o.id !== 'string' || !o.id || orderIds.has(o.id) || !count(o.security) || o.security > 257
      || !['buy','sell'].includes(o.side) || !['market','limit'].includes(o.type) || !count(o.price) || !o.price
      || !count(o.quantity) || !o.quantity || !count(o.remaining) || !o.remaining || o.remaining > o.quantity || !count(o.minute)) fail();
    orderIds.add(o.id);
  }
  for (const r of s.receipts) if (!record(r) || typeof r.id !== 'string' || !r.id || r.id.length > 100
    || typeof r.signature !== 'string' || r.signature.length > 2000 || !count(r.at)) fail();
  for (const f of s.fills) if (!record(f) || typeof f.id !== 'string' || !count(f.minute) || !count(f.security) || f.security > 257
    || !['buy','sell'].includes(f.side) || !count(f.price) || !f.price || !count(f.quantity) || !f.quantity || !count(f.fee)) fail();
  for (const e of m.events) if (!record(e) || !count(e.minute) || !Number.isInteger(e.industry) || e.industry < -1 || e.industry > 11
    || !finite(e.impact) || typeof e.title !== 'string' || e.title.length > 200) fail();
  const a = m.accounts[300];
  const reserved = s.orders.filter(o => o.side === 'buy').reduce((sum, o) => sum + (o.price + Math.ceil(o.price * m.parameters.feeBps / 10000)) * o.remaining, 0);
  if (!count(reserved) || reserved > a.cash) fail();
  for (let id = 0; id < 258; id++) {
    if (s.orders.filter(o => o.security === id && o.side === 'sell').reduce((sum, o) => sum + o.remaining, 0) > a.holdings[id]) fail();
    let supply = m.accounts.reduce((sum, account) => sum + account.holdings[id], 0);
    if (id < 240) for (const f of m.funds) supply += (f.basket.find(b => b.security === id)?.quantity ?? 0) * f.units / f.unitSize;
    if (supply !== m.securities[id].supply) fail();
  }
  const cash = m.accounts.reduce((sum, account) => sum + account.cash, 0) + m.funds.reduce((sum, f) => sum + f.cash, 0) + m.treasury;
  if (cash !== m.initialCash + m.dividends + m.externalCash) fail();
  return s;
}
