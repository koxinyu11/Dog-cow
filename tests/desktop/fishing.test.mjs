import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFishing, parseFishing, rollRound, breakChance, wearChance, durabilityLeft, FISHING_KEY, fishingView, fishingPool, categories, species, rarities, fishCount, MYTHIC_CHANCE, EMPTY_SHARE, TINY_SHARE } from '../../dist-electron/src/shared/fishing.js';
import { emptyCoins, COINS_KEY, parseCoins } from '../../dist-electron/src/shared/coins.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { Fishing } from '../../dist-electron/src/main/fishing.js';
import { Repository } from '../../dist-electron/src/main/repository.js';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const sequence = (...values) => { let i = 0; return () => values[i++] ?? .5; };
function poolRoll(spot, category, id, bait = 'plain') {
  let before = 0;
  for (const { entry, chance } of fishingPool(spot, category, bait)) {
    if (entry.id === id) return (before + chance / 2) / categories.find(c => c.id === category).share;
    before += chance;
  }
  throw Error(`Not in pool: ${id}`);
}
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
  state.round = rollRound(state, 'round', sequence(.05));
  assert.equal(state.round.result.kind, 'empty');
  assert.equal(fishingView(state, 0).state.round.result, undefined);
  assert.deepEqual(parseFishing(JSON.stringify(state)), state);
  const junk = rollRound(emptyFishing(), 'junk', sequence(.82, .1));
  assert.equal(junk.result.species, 'badge');
});
test('rods within capacity never break, overload rises gradually and is bounded', () => {
  assert.equal(breakChance(2, 2), 0);
  assert.ok(breakChance(3, 2) > 0);
  assert.ok(breakChance(6, 2) > breakChance(3, 2));
  assert.equal(breakChance(100, 2), .95);
  const state = emptyFishing(); state.spot = 'river';
  assert.equal(rollRound(state, 'big', sequence(.9, .999, .99, 0)).result.kind, 'broken');
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
test('catalog shares sum to one and every category has entries at both spots', () => {
  const total = EMPTY_SHARE + TINY_SHARE + categories.reduce((sum, c) => sum + c.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  for (const c of categories) for (const spot of ['pond', 'river']) assert.ok(species.some(s => s.category === c.id && (s.spot === spot || s.spot === 'any') && s.weight > 0), `${c.id}@${spot}`);
  assert.equal(new Set(species.map(s => s.id)).size, species.length);
  assert.equal(species.length, 100);
  assert.equal(fishCount, 72);
  assert.deepEqual(Object.fromEntries(categories.map(c => [c.id, species.filter(s => s.category === c.id).length])), { creature: 10, junk: 8, treasure: 10, fish: 72 });
});
test('creatures and objects enter bag and book; visitors only enter book; treasure never breaks', () => {
  const creature = rollRound(emptyFishing(), 'c', sequence(.76, 0, .5));
  assert.equal(creature.result.kind, 'creature');
  assert.equal(creature.result.species, 'crayfish');
  const river = emptyFishing(); river.spot = 'river';
  const otter = rollRound(river, 'o', sequence(.76, poolRoll('river', 'creature', 'otter'), .5));
  assert.equal(otter.result.species, 'otter');
  assert.equal(otter.result.value, undefined);
  const treasure = rollRound(river, 't', sequence(.837, poolRoll('river', 'treasure', 'compass'), .5, 0));
  assert.equal(treasure.result.kind, 'treasure');
  assert.equal(treasure.result.species, 'compass');
  const state = emptyFishing();
  state.round = { ...otter, rod: 'bamboo' };
  const x = setup(0, undefined, state);
  x.run('reel', undefined, 'o'); x.saved();
  assert.equal(x.fishing.view().state.bag.length, 0);
  assert.equal(x.fishing.view().state.book.otter.count, 1);
  assert.equal(x.fishing.view().state.total, 0);
});
test('river unlock counts discovered fish only, and legacy saves still parse', () => {
  const initial = emptyFishing();
  initial.book = Object.fromEntries(['crayfish', 'snail', 'badge', 'key', 'wish', 'crucian', 'minnow', 'perch', 'salt'].map(id => [id, { count: 1, largest: .1 }]));
  const x = setup(0, undefined, initial);
  assert.throws(() => x.run('spot', 'river'), /5 种/);
  const legacy = { ...emptyFishing(), bag: [{ id: 'b', species: 'bottle', kg: .1, value: 2, locked: false }], last: { kind: 'junk', name: '旧工牌', species: 'badge', kg: .05, value: 1 } };
  assert.equal(parseFishing(JSON.stringify(legacy)).bag[0].species, 'bottle');
});
test('tiny fish dominates, big fish stay rare, and some mussels carry pearls', () => {
  const tiny = rollRound(emptyFishing(), 'w', sequence(.5, .5));
  assert.equal(tiny.result.species, 'wheat');
  const river = emptyFishing(); river.spot = 'river';
  assert.equal(rollRound(river, 'w2', sequence(.6, .5)).result.species, 'wheat');
  const pearl = rollRound(river, 'p', sequence(.76, .5, .5, .01));
  assert.equal(pearl.result.species, 'pearl');
  assert.equal(pearl.result.kind, 'treasure');
  assert.equal(rollRound(river, 'm', sequence(.76, .5, .5, .5)).result.species, 'mussel');
  // A middle roll lands near the low end of the size range.
  const carp = rollRound(river, 'c', sequence(.9, poolRoll('river', 'fish', 'carp'), .5, .9)).result;
  assert.equal(carp.species, 'carp');
  assert.ok(carp.kg < 1.5);
  let rare = 0, top = new Map();
  const n = 20000; let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) { const r = rollRound(emptyFishing(), `r${i}`, rnd).result; if (r.species) top.set(r.species, (top.get(r.species) ?? 0) + 1); const e = species.find(s => s.id === r.species); if (e && e.rarity >= 2) rare++; }
  assert.ok(Math.abs(top.get('wheat') / n - .35) < .02);
  for (const [id, count] of top) if (id !== 'wheat') assert.ok(count / n < .05, id);
  assert.ok(rare / n < .03);
});
test('rod wear is free for half its life, then rises and caps; better rods last longer', () => {
  assert.equal(wearChance(19, 40), 0);
  assert.ok(wearChance(30, 40) > 0 && wearChance(30, 40) < .25);
  assert.equal(wearChance(40, 40), .25);
  assert.equal(wearChance(4000, 40), .6);
  assert.equal(wearChance(40, 400), 0);
  const worn = emptyFishing(); worn.wear.bamboo = 40;
  const r = rollRound(worn, 'w', sequence(.9, 0, .5, .1)).result;
  assert.equal(r.kind, 'broken'); assert.equal(r.cause, 'wear');
  const fresh = rollRound(emptyFishing(), 'f', sequence(.9, 0, .5, .1)).result;
  assert.equal(fresh.kind, 'fish');
  assert.equal(rollRound(worn, 'e', sequence(.05)).result.kind, 'empty');
});
test('reeling adds wear; a break, a first purchase and a rescue start fresh; legacy saves default to new', () => {
  const x = setup(100, () => .5);
  x.run('cast'); x.saved();
  const round = x.fishing.view().state.round.id;
  x.run('reel', undefined, round); x.saved();
  assert.equal(x.fishing.view().state.wear.bamboo, 1);
  assert.ok(durabilityLeft(x.fishing.view().state, 'bamboo') < 1);
  x.run('buyRod', 'wood'); x.saved();
  assert.equal(x.fishing.view().state.wear.wood, 0);
  const state = emptyFishing(); state.wear.bamboo = 33;
  state.round = { id: 'b', rod: 'bamboo', signal: '明显绷紧', wait: 5, result: { kind: 'broken', name: '断', kg: 1, cause: 'wear' } };
  const y = setup(0, undefined, state);
  y.run('reel', undefined, 'b'); y.saved();
  assert.equal(y.fishing.view().state.wear.bamboo, 0);
  const legacy = emptyFishing(); delete legacy.wear;
  assert.deepEqual(parseFishing(JSON.stringify(legacy)).wear, { bamboo: 0, wood: 0, pro: 0, collector: 0 });
  assert.throws(() => parseFishing(JSON.stringify({ ...emptyFishing(), wear: { bamboo: -1 } })));
});
test('new catches record when they were caught; older catches without a time still parse', () => {
  const x = setup(0, () => .5);
  const game = new Fishing(x.store, x.coins, () => .5, () => 1_800_000_000_000);
  const saved = () => { x.coins.confirmSaved(); game.confirmSaved(); };
  game.execute({ action: 'cast', requestId: 'c' }); saved();
  game.execute({ action: 'reel', requestId: 'r', roundId: game.view().state.round.id }); saved();
  assert.equal(game.view().state.bag[0].at, 1_800_000_000_000);
  const legacy = { ...emptyFishing(), bag: [{ id: 'o', species: 'wheat', kg: .02, value: 1, locked: false }] };
  assert.equal(parseFishing(JSON.stringify(legacy)).bag[0].at, undefined);
  assert.throws(() => parseFishing(JSON.stringify({ ...legacy, bag: [{ ...legacy.bag[0], at: -5 }] })));
});

test('every catalog entry is reachable and round-trips through the current save format', () => {
  const type = { fish: .9, creature: .76, junk: .82, treasure: .837 };
  for (const entry of species) {
    assert.ok(entry.name && entry.note && entry.rarity >= 0 && entry.rarity < rarities.length, entry.id);
    assert.ok(entry.min > 0 && entry.min <= entry.max && entry.max * 1.15 <= 100, entry.id);
    const state = emptyFishing(); state.spot = entry.spot === 'any' ? 'pond' : entry.spot; state.equipped = 'collector';
    const rnd = entry.id === 'wheat' ? sequence(.5, .5)
      : entry.id === 'pearl' ? sequence(.76, poolRoll('river', 'creature', 'mussel'), .5, 0)
      : sequence(type[entry.category], poolRoll(state.spot, entry.category, entry.id), .5, .999);
    state.round = rollRound(state, entry.id, rnd);
    assert.equal(state.round.result.species, entry.id, entry.id);
    assert.equal(state.round.result.value === undefined, !!entry.visitor, entry.id);
    assert.deepEqual(parseFishing(JSON.stringify(state)).round, JSON.parse(JSON.stringify(state.round)), entry.id);
  }
});

test('ten mythic entries reserve exactly 0.01% per eligible cast under both baits', () => {
  const mythic = species.filter(s => s.rarity === 5);
  assert.equal(mythic.length, 10);
  assert.equal(new Set(mythic.map(s => s.shape)).size, 10);
  for (const entry of mythic) { assert.equal(entry.castChance, 1 / 10000); assert.equal(entry.weight, 0); }
  assert.equal(MYTHIC_CHANCE, .0001);
  for (const spot of ['pond', 'river']) for (const bait of ['plain', 'worm']) for (const category of categories) {
    const pool = fishingPool(spot, category.id, bait);
    assert.ok(Math.abs(pool.reduce((sum, s) => sum + s.chance, 0) - category.share) < 1e-12);
    assert.equal(new Set(pool.map(s => s.entry.id)).size, pool.length);
    assert.equal(pool.some(s => s.entry.id === 'pearl' || s.entry.id === 'wheat'), false);
    for (const { entry, chance } of pool) {
      assert.ok(entry.spot === spot || entry.spot === 'any');
      assert.ok(Number.isFinite(chance) && chance > 0);
      if (entry.rarity === 5) assert.equal(chance, .0001);
    }
    assert.equal(pool.filter(s => s.entry.rarity === 5).length, category.id === 'fish' ? 4 : category.id === 'treasure' ? 1 : 0);
  }
});

test('mythic interval edges select one species without leaking into a second draw or bait bonus', () => {
  for (const spot of ['pond', 'river']) for (const bait of ['plain', 'worm']) for (const category of ['fish', 'treasure']) {
    const state = emptyFishing(); state.spot = spot; state.bait = bait; state.equipped = 'collector';
    const fixed = species.filter(s => s.spot === spot && s.category === category && s.rarity === 5);
    const share = category === 'fish' ? .16 : .004;
    const type = category === 'fish' ? .9 : .837;
    for (let i = 0; i < fixed.length; i++) {
      const lower = i * .0001, upper = (i + 1) * .0001;
      for (const point of [lower + 1e-10, (lower + upper) / 2, upper - 1e-10]) {
        const result = rollRound(state, 'mythic', sequence(type, point / share, .5, .999)).result;
        assert.equal(result.species, fixed[i].id, `${spot}/${bait}/${category}/${point}`);
      }
      const after = rollRound(state, 'after', sequence(type, (upper + 1e-10) / share, .5, .999)).result;
      assert.notEqual(after.species, fixed[i].id);
      if (i + 1 < fixed.length) assert.equal(after.species, fixed[i + 1].id);
      else assert.ok(species.find(s => s.id === after.species).rarity < 5);
    }
  }
});

test('original 34 IDs, discoveries, locked catches and an unrevealed old round remain intact', () => {
  const ids = 'wheat crucian minnow medaka loach perch salt koi betta moon carp silver grass catfish yellowcat momo mandarin gold cloud crayfish snail turtle crab mussel otter badge key keycap bottle mug trophy wish pearl compass'.split(' ');
  assert.equal(ids.length, 34);
  const legacy = emptyFishing();
  legacy.book = Object.fromEntries(ids.map(id => [id, { count: 2, largest: .5 }]));
  legacy.bag = ids.filter(id => id !== 'otter').map(id => ({ id: `old-${id}`, species: id, kg: .5, value: 2, locked: true }));
  legacy.round = { id: 'old-round', rod: 'bamboo', signal: '轻轻晃动', wait: 7, result: { kind: 'fish', name: '日落锦鲤', species: 'koi', kg: 1, value: 15, newDiscovery: false } };
  assert.deepEqual(parseFishing(JSON.stringify(legacy)), legacy);
});

test('a mythic result survives reload, is hidden before reeling, and retries without rerolling or duplicating', () => {
  let draws = 0;
  const random = sequence(.9, .00005 / .16, .5, .999);
  const x = setup(0, () => { draws++; return random(); });
  x.run('cast', undefined, undefined, 'rare-cast'); x.saved();
  const round = x.fishing.view().state.round;
  assert.equal(round.result, undefined);
  const reloaded = new Fishing(x.store, x.coins, () => { throw Error('must not reroll'); });
  reloaded.execute({ action: 'reel', roundId: round.id, requestId: 'rare-reel' });
  assert.equal(reloaded.view().pending, true);
  assert.equal(reloaded.view().state.bag.length, 0);
  reloaded.confirmSaved();
  reloaded.execute({ action: 'reel', roundId: round.id, requestId: 'rare-reel' });
  const saved = reloaded.view().state;
  assert.equal(saved.bag.length, 1);
  assert.equal(saved.bag[0].species, 'star-koi');
  assert.equal(saved.book['star-koi'].count, 1);
  assert.equal(draws, 6);
});
