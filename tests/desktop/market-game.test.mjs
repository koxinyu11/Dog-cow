import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StockMarket } from '../../dist-electron/src/main/market.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { Repository } from '../../dist-electron/src/main/repository.js';
import { emptyCoins, COINS_KEY } from '../../dist-electron/src/shared/coins.js';
import { MARKET_KEY } from '../../dist-electron/src/shared/market/game.js';
import { createPlayableMarket } from '../../dist-electron/src/shared/market/playable.js';
import { assertMarket, convertFund, updateFunds, payDividend } from '../../dist-electron/src/shared/market/simulation.js';
import { validateMarketGame } from '../../dist-electron/src/migration/market.js';
import { collectLegacy, validateLegacy } from '../../dist-electron/src/migration/transfer.js';

function fixture(store) {
  const values = new Map();
  store ??= { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  if (store.getItem(COINS_KEY) === null) store.setItem(COINS_KEY, JSON.stringify({ ...emptyCoins(), balance: 1000 }));
  const coins = new Coins(store, () => ({})); coins.load();
  let wall = 1800000000000, mono = 100000;
  const market = new StockMarket(store, coins, 791911, () => wall, () => mono);
  const ack = () => { market.confirmSaved(); coins.confirmSaved(); };
  const request = action => ({ ...action, requestId: `test-${++wall}`, revision: market.view().revision, createdAt: wall });
  const send = (action, confirm = true) => { const r = request(action); market.execute(r); if (confirm) ack(); return r; };
  market.execute({ action: 'view' }); ack();
  return { store, coins, market, ack, send, request, advance: (ms, running = true) => { mono += ms; market.clock(running); ack(); } };
}

test('playable ETFs split trading units while preserving real baskets, cash and primary creation lots', () => {
  const m = createPlayableMarket(201);
  assertMarket(m);
  assert.ok(m.funds.every(f => f.unitSize === 1000 && f.units === 1000000));
  assert.ok(m.funds.every(f => m.securities[f.id].price < 100000));
  const f = m.funds[3], a = m.accounts[f.id % 25], initial = a.cash;
  assert.throws(() => convertFund(m, a.id, f.id, 1, false), /完整篮子/);
  assert.ok(convertFund(m, a.id, f.id, 1000, false));
  assertMarket(m);
  assert.ok(convertFund(m, a.id, f.id, 1000, true));
  assert.equal(a.cash, initial);
  payDividend(m, 0, 2); updateFunds(m); assertMarket(m);
});

test('wallet transfer waits for shared disk acknowledgement, then deduplicates across game reload', () => {
  const f = fixture();
  const request = f.send({ action: 'deposit', amount: 100 }, false);
  assert.equal(f.market.view().pending, true);
  assert.equal(f.market.view().cash, 0);
  assert.equal(f.coins.view().balance, 1000);
  assert.throws(() => f.market.execute(request), /保存/);
  f.ack();
  assert.equal(f.coins.view().balance, 900);
  assert.equal(f.market.view().cash, 10000);
  const reopened = new StockMarket(f.store, f.coins, 1, () => request.createdAt);
  reopened.execute(request);
  assert.equal(reopened.view().cash, 10000);
  assert.equal(f.coins.view().balance, 900);
  assert.throws(() => reopened.execute({ ...request, amount: 101 }), /原参数/);
  f.send({ action: 'withdraw', amount: 50 });
  assert.equal(f.coins.view().balance, 950);
  assert.equal(f.market.view().available, 5000);
  assert.equal(f.coins.view().entries[0].kind, 'market');
});

test('pending buy orders reserve cash, block over-spend/withdraw and release on cancellation', () => {
  const f = fixture(); f.send({ action: 'deposit', amount: 100 });
  const request = f.send({ action: 'order', security: 243, side: 'buy', type: 'limit', price: 100, quantity: 50 });
  assert.equal(f.market.view().reserved, 5050);
  assert.equal(f.market.view().available, 4950);
  assert.throws(() => f.send({ action: 'withdraw', amount: 50 }), /余额不足/);
  assert.throws(() => f.send({ action: 'order', security: 244, side: 'buy', type: 'limit', price: 100, quantity: 50 }), /资金不足/);
  f.send({ action: 'cancel', orderId: request.requestId });
  assert.equal(f.market.view().available, 10000);
  assert.equal(f.market.view().orders.length, 0);
  assert.throws(() => f.send({ action: 'order', security: 243, side: 'sell', type: 'market', quantity: 1 }), /可卖/);
});

test('buy and sell fill against actual NPC counterparties, maintain cost basis and recover on restart', () => {
  const f = fixture(); f.send({ action: 'deposit', amount: 1000 });
  const raw = JSON.parse(f.store.getItem(MARKET_KEY));
  const fund = raw.market.funds.find(fund => raw.market.accounts[fund.id % 25].holdings[fund.id] > 1000);
  const asset = f.market.view().securities[fund.id];
  f.send({ action: 'order', security: fund.id, side: 'buy', type: 'limit', price: asset.price * 2, quantity: 1 });
  f.market.tick(); f.ack();
  let v = f.market.view();
  assert.equal(v.positions.find(p => p.security === fund.id).quantity, 1);
  assert.ok(v.positions.find(p => p.security === fund.id).cost > 0);
  assert.equal(v.fills[0].side, 'buy');
  assert.equal(v.orders.length, 0);
  const reopened = new StockMarket(f.store, f.coins, 0);
  assert.deepEqual(reopened.view().positions, v.positions);
  f.send({ action: 'order', security: fund.id, side: 'sell', type: 'limit', price: 1, quantity: 1 });
  assert.equal(f.market.view().positions[0].available, 0);
  assert.throws(() => f.send({ action: 'order', security: fund.id, side: 'sell', type: 'market', quantity: 1 }), /可卖/);
  f.market.tick(); f.ack();
  v = f.market.view();
  assert.equal(v.positions.length, 0);
  assert.equal(v.fills[0].side, 'sell');
  const s = JSON.parse(f.store.getItem(MARKET_KEY));
  assert.equal(s.costBasis[fund.id], 0);
  assertMarket(s.market);
  validateMarketGame(s);
});

test('market orders expire after one auction, limit orders persist and stale revisions cannot transact', () => {
  const f = fixture(); f.send({ action: 'deposit', amount: 100 });
  const stale = f.request({ action: 'deposit', amount: 1 });
  f.send({ action: 'order', security: 243, side: 'buy', type: 'limit', price: 1, quantity: 1 });
  assert.throws(() => f.market.execute(stale), /已更新/);
  f.send({ action: 'order', security: 244, side: 'buy', type: 'market', quantity: 1 });
  f.market.tick(); f.ack();
  assert.ok(f.market.view().orders.every(o => o.type === 'limit'));
  assert.ok(f.market.view().orders.some(o => o.security === 243));
});

test('main-process monotonic clock progresses in background but excludes sleep, stopped time and restart gaps', () => {
  const f = fixture(); const minute = f.market.view().minute;
  for (let i = 0; i < 6; i++) f.advance(10000);
  assert.equal(f.market.view().minute, minute + 1);
  f.advance(3 * 3600000);
  assert.equal(f.market.view().minute, minute + 1);
  for (let i = 0; i < 6; i++) f.advance(10000, false);
  assert.equal(f.market.view().minute, minute + 1);
  const reopened = new StockMarket(f.store, f.coins, 123);
  assert.equal(reopened.view().minute, minute + 1);
  for (let i = 0; i < 6; i++) f.advance(10000);
  assert.equal(f.market.view().minute, minute + 2);
});

test('invalid input, expired receipts and broken saves are refused without overwriting existing assets', () => {
  const f = fixture(); const original = f.store.getItem(MARKET_KEY);
  for (const amount of [-1, 0, 1.5, NaN, Number.MAX_SAFE_INTEGER]) assert.throws(() => f.send({ action: 'deposit', amount }));
  assert.equal(f.store.getItem(MARKET_KEY), original);
  assert.throws(() => f.market.execute({ ...f.request({ action: 'deposit', amount: 1 }), createdAt: 0 }), /过期/);
  const bad = JSON.parse(original); bad.market.accounts[300].cash = -1;
  f.store.setItem(MARKET_KEY, JSON.stringify(bad));
  assert.throws(() => f.market.view(), /存档无效/);
  assert.equal(f.store.getItem(MARKET_KEY), JSON.stringify(bad));
});

test('public view exposes no NPC positions, latent financials or random generator state', () => {
  const f = fixture(); const v = f.market.view();
  assert.equal(v.securities.length, 258);
  assert.equal(v.participants.reduce((sum, p) => sum + p.accounts, 0), 300);
  assert.equal('market' in v, false);
  assert.equal('randomState' in v, false);
  assert.equal(v.participants.some(p => 'holdings' in p), false);
  assert.equal(v.securities.filter(s => s.candles !== undefined).length, 1);
  assert.ok(v.securities[240].candles.length >= 60);
  assert.ok(f.market.view(1).securities[1].candles.length >= 60);
  const raw = JSON.parse(f.store.getItem(MARKET_KEY));
  raw.market.securities[0].financials.profit *= 2;
  f.store.setItem(MARKET_KEY, JSON.stringify(raw));
  assert.equal(f.market.view().securities[0].facts.profit, v.securities[0].facts.profit);
});

test('old closing-only saves remain usable and do not fabricate historical candles', () => {
  const f = fixture();
  const raw = JSON.parse(f.store.getItem(MARKET_KEY));
  for (const asset of raw.market.securities) delete asset.candles;
  f.store.setItem(MARKET_KEY, JSON.stringify(raw));
  const before = f.market.view().securities[240].history;
  assert.deepEqual(f.market.view().securities[240].candles, []);
  f.market.tick(); f.ack();
  assert.equal(f.market.view().securities[240].candles.length, 1);
  assert.deepEqual(f.market.view().securities[240].history, before);
});

test('market backups require the wallet and deeply validate share/cash conservation', () => {
  const f = fixture();
  const data = new Map([[COINS_KEY, f.store.getItem(COINS_KEY)], [MARKET_KEY, f.store.getItem(MARKET_KEY)]]);
  const source = { getItem: key => data.get(key) ?? null, length: data.size, key: i => [...data.keys()][i] };
  const pack = collectLegacy(source);
  assert.doesNotThrow(() => validateLegacy(pack));
  assert.throws(() => validateLegacy({ ...pack, [COINS_KEY]: null }), /钱包/);
  const raw = JSON.parse(pack[MARKET_KEY]); raw.market.accounts[0].holdings[0]++;
  assert.throws(() => validateLegacy({ ...pack, [MARKET_KEY]: JSON.stringify(raw) }), /存档无效/);
});

test('actual Repository disk failure keeps wallet and market unacknowledged; retry and reload debit once', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dogcow-market-'));
  try {
    const repo = new Repository(directory); await repo.load();
    const f = fixture(repo.storage); assert.ok(await repo.flush());
    const before = await readFile(repo.file, 'utf8');
    const request = f.send({ action: 'deposit', amount: 10 }, false);
    const flush = repo.flush.bind(repo); repo.flush = async () => false;
    assert.equal(await repo.flush(), false);
    assert.equal(await readFile(repo.file, 'utf8'), before);
    assert.equal(f.coins.view().balance, 1000);
    assert.equal(f.market.view().cash, 0);
    repo.flush = flush; assert.ok(await repo.flush()); f.ack();
    const restored = new Repository(directory); await restored.load();
    const coins = new Coins(restored.storage, () => ({})); coins.load();
    const market = new StockMarket(restored.storage, coins, 0, () => request.createdAt);
    market.execute(request);
    assert.equal(coins.view().balance, 990);
    assert.equal(market.view().cash, 1000);
    assert.equal(market.view().receipts.filter(id => id === request.requestId).length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
