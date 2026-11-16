import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFishing, parseFishing, rollRound, breakChance, FISHING_KEY, fishingView } from '../../dist-electron/src/shared/fishing.js';
import { emptyCoins, COINS_KEY, parseCoins } from '../../dist-electron/src/shared/coins.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { Fishing } from '../../dist-electron/src/main/fishing.js';
import { Repository } from '../../dist-electron/src/main/repository.js';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const sequence = (...values) => { let i = 0; return () => values[i++] ?? .5; };
function setup(balance = 1000, random = () => .5, initial = emptyFishing()) {
  const map = new Map([[COINS_KEY, JSON.stringify({ ...emptyCoins(), balance })], [FISHING_KEY, JSON.stringify(initial)]]);
  const store = { getItem: key => map.get(key) ?? null, setItem: (key, raw) => map.set(key, raw) };
  const coins = new Coins(store, () => ({})); coins.load();
  const fishing = new Fishing(store, coins, random);
  let serial = 0;
  const run = (action, id, roundId, requestId = `request-${++serial}`) => fishing.execute({ action, id, roundId, requestId });
  const saved = () => { coins.confirmSaved(); fishing.confirmSaved(); };
  return { map, coins, fishing, run, saved, store };
}

test('signal hides fish and junk outcomes, including on persisted reload', () => {
  const state = emptyFishing();
  state.round = rollRound(state, 'round', sequence(.1));
  assert.equal(state.round.result.kind, 'empty');
  assert.equal(fishingView(state, 0).state.round.result, undefined);
  assert.deepEqual(parseFishing(JSON.stringify(state)), state);
  const junk = rollRound(emptyFishing(), 'junk', sequence(.15, .1));
  assert.equal(junk.result.species, 'badge');
});
test('rods within capacity never break, overload rises gradually and is bounded', () => {
  assert.equal(breakChance(2, 2), 0);
  assert.ok(breakChance(3, 2) > 0);
  assert.ok(breakChance(6, 2) > breakChance(3, 2));
  assert.equal(breakChance(100, 2), .95);
  const state = emptyFishing(); state.spot = 'river';
  assert.equal(rollRound(state, 'big', sequence(.8, .999, .99, 0)).result.kind, 'broken');
});
test('failed save keeps the old public bag and retries the same catch exactly once', () => {
  const x = setup();
  x.run('cast');
  assert.equal(x.fishing.view().pending, true);
  assert.equal(x.fishing.view().state.round, null);
  x.saved();
  const round = x.fishing.view().state.round.id;
  const result = parseFishing(x.map.get(FISHING_KEY)).round.result;
  assert.equal(result.kind, 'fish');
  x.run('reel', undefined, round, 'reel-once');
  assert.equal(x.fishing.view().state.bag.length, 0);
  assert.throws(() => x.run('cast'), /尚未保存/);
  x.saved();
  assert.equal(x.fishing.view().state.bag.length, 1);
  x.run('reel', undefined, round, 'reel-once');
  assert.equal(x.fishing.view().state.bag.length, 1);
  assert.throws(() => x.run('reel', undefined, round), /已经结束/);
  assert.equal(x.fishing.view().state.book[result.species].count, 1);
});
test('sale and repeatable rod purchases share wallet updates; locked fish and discovery survive sales', () => {
  const initial = emptyFishing();
  initial.bag = [{ id: 'a', species: 'crucian', kg: .5, value: 2, locked: false }, { id: 'b', species: 'koi', kg: 1, value: 15, locked: true }];
  initial.book = { crucian: { count: 1, largest: .5 }, koi: { count: 1, largest: 1 } };
  const x = setup(100, undefined, initial);
  x.run('sellAll', undefined, undefined, 'sale');
  assert.equal(x.coins.view().balance, 100);
  assert.equal(x.fishing.view().state.bag.length, 2);
  x.saved();
  assert.equal(x.coins.view().balance, 102);
  assert.equal(x.fishing.view().state.bag.length, 1);
  assert.equal(Object.keys(x.fishing.view().state.book).length, 2);
  x.run('sellAll', undefined, undefined, 'sale');
  assert.equal(x.coins.view().balance, 102);
  x.run('buyRod', 'wood'); x.saved();
  x.run('buyRod', 'wood'); x.saved();
  assert.equal(x.fishing.view().state.rods.wood, 2);
  assert.equal(x.coins.view().balance, 12);
  assert.throws(() => x.run('buyRod', 'pro'), /不足/);
  assert.equal(x.coins.view().balance, 12);
  assert.equal(parseCoins(x.map.get(COINS_KEY)).entries.at(-1).kind, 'fishing');
});
test('broken rod loses only the current rod; free rescue requires no other rods', () => {
  const state = emptyFishing();
  state.round = { id: 'big', rod: 'bamboo', signal: '明显绷紧', wait: 5, result: { kind: 'broken', name: '断竿', kg: 30 } };
  const x = setup(0, undefined, state);
  x.run('reel', undefined, 'big'); x.saved();
  assert.equal(x.fishing.view().state.rods.bamboo, 0);
  assert.equal(x.fishing.view().balance, 0);
  x.run('rescue'); x.saved();
  assert.equal(x.fishing.view().state.rods.bamboo, 1);
  assert.throws(() => x.run('rescue'), /还有可用/);
});
test('invalid saves stay untouched; tools, locked spots and stale rounds are checked', () => {
  assert.throws(() => parseFishing('{"version":99}'));
  const x = setup(0);
  assert.throws(() => x.run('spot', 'river'), /5 种/);
  assert.throws(() => x.run('bait', 'worm'), /饵盒/);
  assert.throws(() => x.run('buyTool', 'float'), /不足/);
  x.map.set(FISHING_KEY, '{invalid');
  assert.throws(() => x.fishing.view());
  assert.equal(x.map.get(FISHING_KEY), '{invalid');
});
test('fish and coins persist together and reload through repository whitelist', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dogcow-fishing-'));
  try {
    const repo = new Repository(dir); await repo.load();
    repo.storage.setItem(COINS_KEY, JSON.stringify({ ...emptyCoins(), balance: 100 }));
    const coins = new Coins(repo.storage, () => ({})); coins.load();
    const fishing = new Fishing(repo.storage, coins);
    fishing.execute({ action: 'buyRod', id: 'wood', requestId: 'buy' });
    assert.equal(await repo.flush(), true); coins.confirmSaved(); fishing.confirmSaved();
    const reload = new Repository(dir); await reload.load();
    assert.equal(reload.readError, '');
    assert.equal(parseCoins(reload.storage.getItem(COINS_KEY)).balance, 55);
    assert.equal(parseFishing(reload.storage.getItem(FISHING_KEY)).rods.wood, 1);
    const previous = await readFile(repo.file, 'utf8');
    // A path failure must leave the prior snapshot and the same candidate available to retry.
    const blocker = path.join(dir, 'blocked'); await writeFile(blocker, 'file');
    const brokenRepo = new Repository(blocker); brokenRepo.values = new Map(repo.values);
    const wallet = new Coins(brokenRepo.storage, () => ({})); wallet.load();
    const game = new Fishing(brokenRepo.storage, wallet);
    game.execute({ action: 'buyRod', id: 'wood', requestId: 'retry-buy' });
    assert.equal(await brokenRepo.flush(), false);
    assert.equal(wallet.view().balance, 55);
    assert.equal(game.view().state.rods.wood, 1);
    await rm(blocker); await import('node:fs/promises').then(fs => fs.mkdir(blocker));
    assert.equal(await brokenRepo.flush(), true); wallet.confirmSaved(); game.confirmSaved();
    assert.equal(wallet.view().balance, 10);
    assert.equal(game.view().state.rods.wood, 2);
    assert.equal(await readFile(repo.file, 'utf8'), previous);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
