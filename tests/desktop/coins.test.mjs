import test from 'node:test';
import assert from 'node:assert/strict';
import { COINS_KEY, coinsView, emptyCoins, exchangeCoins, parseCoins, spendCoins } from '../../dist-electron/src/shared/coins.js';
import { Coins } from '../../dist-electron/src/main/coins.js';

const TODAY = '2026-11-06';
const ledgers = () => ({ steal: { '2026-11-04': 12_345, '2026-11-05': 5_000, [TODAY]: 9_900 }, owed: { '2026-11-05': 4_250 } });

test('exchange converts finished days only, with steal 1:1 and owed 1:5', () => {
  const { state, coins } = exchangeCoins(emptyCoins(), ledgers(), TODAY, 1);
  // steal: 123.45 + 50 = 173.45 → 173 yuan; owed: 42.5 → 42 yuan × 5
  assert.equal(coins, 173 + 210);
  assert.equal(state.balance, 383);
  assert.equal(state.used.steal[TODAY], undefined);
  assert.deepEqual(state.entries.at(-1).yuan, { steal: 173, owed: 42 });
});

test('the same money cannot be exchanged twice; remainders wait for more', () => {
  const first = exchangeCoins(emptyCoins(), ledgers(), TODAY, 1).state;
  const again = exchangeCoins(first, ledgers(), TODAY, 2);
  assert.equal(again.coins, 0);
  assert.equal(again.state, first);
  const view = coinsView(first, ledgers(), TODAY);
  assert.equal(view.pending.steal.coins, 0);
  assert.equal(view.pending.steal.todayYuan, 99);
  // the 0.45 + 0.50 remainders only become a yuan once more money arrives
  const grown = { ...ledgers(), owed: { '2026-11-05': 4_250, '2026-11-03': 60 } };
  assert.equal(exchangeCoins(first, grown, TODAY, 3).coins, 5);
});

test('a lowered ledger never claws coins back; a raised one pays the difference only', () => {
  const first = exchangeCoins(emptyCoins(), ledgers(), TODAY, 1).state;
  const lowered = { steal: { '2026-11-04': 100, '2026-11-05': 0 }, owed: {} };
  assert.equal(exchangeCoins(first, lowered, TODAY, 2).coins, 0);
  assert.equal(coinsView(first, lowered, TODAY).balance, 383);
  const raised = { ...ledgers(), steal: { ...ledgers().steal, '2026-11-05': 7_000 } };
  assert.equal(exchangeCoins(first, raised, TODAY, 3).coins, 20);
});

test('yesterday becomes exchangeable the next day', () => {
  const tomorrow = '2026-11-07';
  assert.equal(exchangeCoins(emptyCoins(), ledgers(), tomorrow, 1).coins, 173 + 99 + 210);
});

test('spend checks balance and one-time ownership', () => {
  const rich = exchangeCoins(emptyCoins(), ledgers(), TODAY, 1).state;
  assert.throws(() => spendCoins(rich, 'wall', 999, 2), /不足/);
  const bought = spendCoins(rich, 'wall', 300, 2);
  assert.equal(bought.balance, 83);
  assert.throws(() => spendCoins(bought, 'wall', 1, 3), /已经拥有/);
});

test('parse round-trips and a broken wallet locks without being overwritten', () => {
  const state = exchangeCoins(emptyCoins(), ledgers(), TODAY, 1).state;
  assert.deepEqual(parseCoins(JSON.stringify(state)), state);
  assert.throws(() => parseCoins('{"version":1,"balance":-3}'));
  const data = new Map([[COINS_KEY, '{broken']]);
  const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const wallet = new Coins(store, ledgers);
  wallet.load();
  assert.match(wallet.view(TODAY).error, /锁定/);
  assert.throws(() => wallet.exchange(TODAY));
  assert.equal(data.get(COINS_KEY), '{broken');
});

test('wallet service persists and refuses an empty exchange', () => {
  const data = new Map();
  const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const wallet = new Coins(store, ledgers);
  wallet.load();
  assert.equal(wallet.exchange(TODAY), 383);
  assert.throws(() => wallet.exchange(TODAY), /暂无/);
  const reloaded = new Coins(store, ledgers);
  reloaded.load();
  assert.equal(reloaded.view(TODAY).balance, 383);
  const locked = new Coins(store, () => null);
  locked.load();
  assert.throws(() => locked.exchange(TODAY), /不可用/);
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Repository } from '../../dist-electron/src/main/repository.js';
import { collectLegacy, validateLegacy } from '../../src/migration/transfer.js';
import { COIN_WALLPAPERS, coinItem, isWallpaperUnlocked } from '../../dist-electron/src/shared/wallpapers.js';

test('the real repository accepts the wallet key, saves it and includes it in backups', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dogcow-coins-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const repo = new Repository(dir);
  await repo.load();
  const wallet = new Coins(repo.storage, ledgers);
  wallet.load();
  assert.equal(wallet.exchange(TODAY), 383);
  assert.equal(await repo.flush(), true);
  const reload = new Repository(dir);
  await reload.load();
  assert.equal(JSON.parse(reload.storage.getItem(COINS_KEY)).balance, 383);
  const values = collectLegacy({ getItem: reload.storage.getItem, length: reload.values.size, key: (i) => [...reload.values.keys()][i] });
  assert.equal(JSON.parse(values[COINS_KEY]).balance, 383);
});

test('backup validation rejects a broken wallet', () => {
  const base = collectLegacy({ getItem: () => null, length: 0 });
  assert.doesNotThrow(() => validateLegacy({ ...base, [COINS_KEY]: JSON.stringify(emptyCoins()) }));
  assert.throws(() => validateLegacy({ ...base, [COINS_KEY]: '{"version":1,"balance":-1}' }), /狗牛币/);
});

test('coin wallpapers unlock only by purchase, at the shared price', () => {
  const [mint, iou] = COIN_WALLPAPERS;
  assert.deepEqual([mint.price, iou.price], [500, 1000]);
  assert.equal(isWallpaperUnlocked(mint.id, undefined, [], []), false);
  const rich = exchangeCoins(emptyCoins(), { steal: { '2026-11-01': 60_000 } }, TODAY, 1).state;
  const bought = spendCoins(rich, coinItem(mint.id), mint.price, 2);
  assert.equal(bought.balance, 100);
  assert.equal(isWallpaperUnlocked(mint.id, undefined, [], bought.owned), true);
  assert.equal(isWallpaperUnlocked(iou.id, undefined, [], bought.owned), false);
  assert.throws(() => spendCoins(bought, coinItem(iou.id), iou.price, 3), /不足/);
});
