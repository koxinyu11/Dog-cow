import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emptyFishing, FISHING_KEY, fishingPool, fishingCategories, parseFishing, repairPrice, repairedWear, rods, rollRound, skinAvailable, species, EMPTY_SHARE, TINY_SHARE } from '../../dist-electron/src/shared/fishing.js';
import { emptyGear, parseGear, rodSkins } from '../../dist-electron/src/shared/fishing-gear.js';
import { Fishing } from '../../dist-electron/src/main/fishing.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { emptyCoins, COINS_KEY } from '../../dist-electron/src/shared/coins.js';
import { Repository } from '../../dist-electron/src/main/repository.js';

const sequence = (...values) => { let i = 0; return () => values[i++] ?? .5; };
const bookOf = entries => Object.fromEntries(entries.map(entry => [entry.id, { count: 1, largest: entry.min }]));
function setup(state = emptyFishing(), balance = 1000, random = () => .5) {
  const values = new Map([[FISHING_KEY, JSON.stringify(state)], [COINS_KEY, JSON.stringify({ ...emptyCoins(), balance })]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const coins = new Coins(storage, () => ({})); coins.load();
  const game = new Fishing(storage, coins, random);
  const saved = () => { coins.confirmSaved(); game.confirmSaved(); };
  let serial = 0;
  const run = (action, id, requestId = `gear-${++serial}`, roundId) => game.execute({ action, id, requestId, roundId });
  return { values, storage, coins, game, saved, run };
}
const experienced = () => { const state = emptyFishing(); state.book = bookOf(species.filter(s => s.category === 'fish').slice(0, 10)); return state; };

test('old fishing saves gain only empty gear and keep the current rod, bag, discoveries and round', () => {
  const state = experienced(); delete state.gear;
  state.wear.bamboo = 12;
  state.round = { id: 'legacy', rod: 'bamboo', signal: '轻轻晃动', wait: 5, result: { kind: 'fish', name: '麦穗鱼', species: 'wheat', kg: .02, value: 1 } };
  const parsed = parseFishing(JSON.stringify(state));
  assert.deepEqual(parsed.gear, emptyGear());
  delete parsed.gear;
  assert.deepEqual(parsed, state);
});

test('malformed gear and hidden reservation fields lock the save without overwriting it', () => {
  const invalid = [null, {}, { ...emptyGear(), skin: 'mint' }, { ...emptyGear(), skins: ['default', 'alien'] },
    { ...emptyGear(), guard: 'yes' }, ...[-1, .5, 1000].map(n => ({ ...emptyGear(), stock: { scout: n, magnet: 0, guard: 0 } }))];
  for (const gear of invalid) assert.throws(() => parseGear(gear), /装备记录/);
  const state = emptyFishing(); state.gear.stock.guard = -1;
  const x = setup(); const raw = JSON.stringify(state); x.values.set(FISHING_KEY, raw);
  assert.throws(() => x.game.view()); assert.equal(x.values.get(FISHING_KEY), raw);
  const round = { ...emptyFishing(), round: { id: 'bad', rod: 'bamboo', wait: 5, signal: '轻轻晃动', result: { kind: 'empty', name: '水草' }, supply: 'guard' } };
  assert.throws(() => parseFishing(JSON.stringify(round)), /鱼竿记录/);
});

test('four paid skins have fixed prices; cosmetics never alter any rod or random outcome', () => {
  assert.equal(rodSkins.length, 7);
  assert.deepEqual(rodSkins.filter(s => s.price > 0).map(s => s.price), [18, 45, 90, 160]);
  assert.equal(new Set(rodSkins.map(s => s.id)).size, 7);
  for (const rod of rods) {
    const state = emptyFishing(); state.equipped = rod.id;
    const expected = rollRound(state, 'same-round', sequence(.9, .3, .5, .999));
    for (const skin of rodSkins) {
      state.gear.skin = skin.id;
      assert.deepEqual(rollRound(state, 'same-round', sequence(.9, .3, .5, .999)), expected, `${rod.id}/${skin.id}`);
    }
  }
});

test('skin purchase equips only after persistence, dedupes across reload and refuses an unowned skin', () => {
  const x = setup();
  assert.throws(() => x.run('skin', 'mint'), /未解锁/);
  x.run('buySkin', 'mint', 'buy-mint');
  assert.equal(x.game.view().state.gear.skin, 'default'); assert.equal(x.coins.view().balance, 1000);
  x.saved(); assert.equal(x.game.view().state.gear.skin, 'mint'); assert.equal(x.coins.view().balance, 982);
  const reload = new Fishing(x.storage, x.coins);
  reload.execute({ action: 'buySkin', id: 'mint', requestId: 'buy-mint' });
  assert.equal(x.coins.view().balance, 982);
  assert.throws(() => reload.execute({ action: 'buySkin', id: 'mint', requestId: 'buy-again' }), /已经拥有/);
  x.run('skin', 'default'); x.saved(); assert.equal(x.game.view().state.gear.skin, 'default');
  assert.ok(x.game.view().state.gear.skins.includes('mint'));
  const poor = setup(emptyFishing(), 17); const before = poor.values.get(FISHING_KEY);
  assert.throws(() => poor.run('buySkin', 'mint'), /不足/); assert.equal(poor.values.get(FISHING_KEY), before);
});

test('collection and mythic reward skins unlock for free and remain owned after earning', () => {
  const frost = rodSkins.find(s => s.id === 'frost'), galaxy = rodSkins.find(s => s.id === 'galaxy');
  const state = emptyFishing(); state.book = bookOf(species.slice(0, 29));
  assert.equal(skinAvailable(state, frost), false);
  state.book = bookOf(species.slice(0, 30));
  assert.equal(skinAvailable(state, frost), true); assert.equal(skinAvailable(state, galaxy), false);
  const x = setup(state); x.run('skin', 'frost'); x.saved();
  assert.equal(x.coins.view().balance, 1000); assert.ok(x.game.view().state.gear.skins.includes('frost'));
  const earned = x.game.view().state; earned.book = {};
  assert.equal(skinAvailable(earned, frost), true);
  const mythic = emptyFishing(); mythic.book = bookOf([species.find(s => s.id === 'offwork-watch')]);
  const y = setup(mythic); y.run('skin', 'galaxy'); y.saved();
  assert.equal(y.game.view().state.gear.skin, 'galaxy'); assert.equal(y.coins.view().balance, 1000);
});

test('rod break and emergency rescue preserve a purchased skin', () => {
  const state = emptyFishing(); state.gear.skins.push('sunset'); state.gear.skin = 'sunset';
  state.round = { id: 'break', rod: 'bamboo', signal: '明显绷紧', wait: 5, result: { kind: 'broken', name: '断竿', kg: 20 } };
  const x = setup(state); x.run('reel', undefined, 'break-reel', 'break'); x.saved();
  assert.equal(x.game.view().state.rods.bamboo, 0); assert.equal(x.game.view().state.gear.skin, 'sunset');
  x.run('rescue'); x.saved(); assert.equal(x.game.view().state.gear.skin, 'sunset');
});

test('supply purchases enforce unlocks, pack sizes, capacity and exactly one wallet debit', () => {
  const beginner = setup(); assert.throws(() => beginner.run('buySupply', 'scout'), /10 种/);
  const x = setup(experienced()); x.run('buySupply', 'scout', 'supply-once');
  assert.equal(x.game.view().state.gear.stock.scout, 0); x.saved();
  assert.equal(x.game.view().state.gear.stock.scout, 10); assert.equal(x.coins.view().balance, 990);
  x.run('buySupply', 'scout', 'supply-once'); assert.equal(x.coins.view().balance, 990);
  x.run('buySupply', 'magnet'); x.saved(); x.run('buySupply', 'guard'); x.saved();
  assert.deepEqual(x.game.view().state.gear.stock, { ...emptyGear().stock, scout: 10, magnet: 10, guard: 1 });
  assert.equal(x.coins.view().balance, 972); assert.equal(x.game.view().state.gear.guard, false);
  const full = experienced(); full.gear.stock.scout = 995;
  const y = setup(full); assert.throws(() => y.run('buySupply', 'scout'), /最多/); assert.equal(y.coins.view().balance, 1000);
});

test('bait selection is exclusive and unavailable stock or guard cannot be enabled', () => {
  const x = setup(experienced());
  assert.throws(() => x.run('bait', 'scout'), /用完/); assert.throws(() => x.run('guard', 'on'), /购买/);
  assert.throws(() => x.run('guard', 'yes'), /无效/);
  x.run('buySupply', 'scout'); x.saved(); x.run('bait', 'scout'); x.saved();
  assert.equal(x.game.view().state.bait, 'scout');
  x.run('bait', 'plain'); x.saved(); assert.equal(x.game.view().state.bait, 'plain');
  assert.throws(() => x.run('bait', 'worm'), /饵盒/);
});

test('exploration triples only undiscovered regular fish relative to discovered fish without stacking worm', () => {
  const book = { crucian: { count: 1, largest: .5 } };
  const pool = fishingPool('pond', 'fish', 'scout', book);
  const chance = id => pool.find(s => s.entry.id === id).chance;
  assert.ok(Math.abs(chance('minnow') / chance('crucian') - 3 * 28 / 32) < 1e-12);
  assert.ok(Math.abs(chance('koi') / chance('crucian') - 3 * 6 / 32) < 1e-12);
  const allKnown = bookOf(species);
  assert.deepEqual(fishingPool('pond', 'fish', 'scout', allKnown), fishingPool('pond', 'fish', 'plain', allKnown));
});

test('treasure bait shifts 0.8 percentage points from junk, with all ten fixed encounters unchanged', () => {
  for (const bait of ['plain', 'worm', 'scout', 'magnet']) for (const spot of ['pond', 'river']) {
    const categories = fishingCategories(bait);
    assert.ok(Math.abs(EMPTY_SHARE + TINY_SHARE + categories.reduce((s, c) => s + c.share, 0) - 1) < 1e-12);
    for (const category of categories) {
      const pool = fishingPool(spot, category.id, bait);
      assert.ok(Math.abs(pool.reduce((s, e) => s + e.chance, 0) - category.share) < 1e-12);
      for (const e of pool.filter(e => e.entry.rarity === 5)) assert.equal(e.chance, .0001);
    }
  }
  assert.ok(Math.abs(fishingCategories('magnet').find(c => c.id === 'treasure').share - .018) < 1e-12);
  assert.ok(Math.abs(fishingCategories('magnet').find(c => c.id === 'junk').share - .022) < 1e-12);
  const state = emptyFishing(); state.bait = 'magnet'; state.equipped = 'collector';
  for (const [type, kind] of [[.5819, 'junk'], [.5821, 'treasure'], [.5999, 'treasure'], [.6001, 'fish']])
    assert.equal(rollRound(state, 'boundary', sequence(type, .5, .5, .999)).result.kind, kind);
});

test('supply reservation stays hidden and survives closing before reeling, with fallback after last use', () => {
  const state = experienced(); state.bait = 'scout'; state.gear.stock.scout = 1;
  const x = setup(state, 100, sequence(.05));
  x.run('cast', undefined, 'cast-once'); x.saved();
  const publicRound = x.game.view().state.round;
  assert.equal(publicRound.supply, undefined); assert.equal(publicRound.result, undefined);
  assert.equal(x.game.view().state.gear.stock.scout, 1);
  const stored = parseFishing(x.values.get(FISHING_KEY)); assert.equal(stored.round.supply, 'scout');
  const reload = new Fishing(x.storage, x.coins, () => { throw Error('must not reroll'); });
  assert.throws(() => reload.execute({ action: 'bait', id: 'plain', requestId: 'change-in-flight' }), /收回/);
  reload.execute({ action: 'reel', roundId: publicRound.id, requestId: 'reel-once' });
  assert.equal(reload.view().state.gear.stock.scout, 1); assert.equal(reload.view().pending, true);
  reload.confirmSaved();
  reload.execute({ action: 'reel', roundId: publicRound.id, requestId: 'reel-once' });
  assert.equal(reload.view().state.gear.stock.scout, 0); assert.equal(reload.view().state.bait, 'plain');
});

test('guard protects an overloaded mythic catch and spends one only on persisted reeling', () => {
  const state = emptyFishing(); state.spot = 'river'; state.gear.guard = true; state.gear.stock.guard = 1;
  const x = setup(state, 0, sequence(.9, 0, .99, 0));
  x.run('cast'); x.saved();
  const round = x.game.view().state.round;
  assert.equal(x.game.view().state.gear.stock.guard, 1);
  assert.equal(parseFishing(x.values.get(FISHING_KEY)).round.result.protected, true);
  x.run('reel', undefined, 'guard-reel', round.id);
  assert.equal(x.game.view().state.gear.stock.guard, 1); x.saved();
  x.run('reel', undefined, 'guard-reel', round.id);
  const saved = x.game.view().state;
  assert.equal(saved.rods.bamboo, 1); assert.equal(saved.gear.stock.guard, 0); assert.equal(saved.gear.guard, false);
  assert.equal(saved.bag.length, 1); assert.equal(saved.bag[0].species, 'galaxy-dragon');
  assert.equal(saved.last.protected, true); assert.ok(saved.gear.skins.includes('galaxy'));
});

test('guard stays in inventory for empty, tiny and safe catches', () => {
  for (const random of [sequence(.05), sequence(.5), sequence(.9, .3, 0, .999)]) {
    const state = emptyFishing(); state.gear.guard = true; state.gear.stock.guard = 1;
    const x = setup(state, 0, random); x.run('cast'); x.saved();
    const round = x.game.view().state.round; x.run('reel', undefined, 'safe', round.id); x.saved();
    assert.equal(x.game.view().state.gear.stock.guard, 1); assert.equal(x.game.view().state.last.protected, undefined);
  }
});

test('repair charges 30% of the equipped rod, restores 50 points and cannot revive broken rods', () => {
  assert.deepEqual(rods.map(r => repairPrice(r.id)), [3, 14, 54, 195]);
  for (const rod of rods) {
    const state = emptyFishing(); state.rods[rod.id] = 1; state.equipped = rod.id; state.wear[rod.id] = rod.durability * 2;
    const x = setup(state); x.run('repair', undefined, 'repair-once'); x.saved();
    assert.equal(x.game.view().state.wear[rod.id], rod.durability / 2);
    assert.equal(x.coins.view().balance, 1000 - repairPrice(rod.id));
    x.run('repair', undefined, 'repair-once'); assert.equal(x.coins.view().balance, 1000 - repairPrice(rod.id));
  }
  assert.equal(repairedWear(1, 40), 0);
  assert.throws(() => setup().run('repair'), /无需/);
  const broken = emptyFishing(); broken.rods.bamboo = 0; broken.wear.bamboo = 20;
  assert.throws(() => setup(broken).run('repair'), /断掉/);
  const worn = emptyFishing(); worn.wear.bamboo = 30;
  const poor = setup(worn, 2); const raw = poor.values.get(FISHING_KEY);
  assert.throws(() => poor.run('repair'), /不足/); assert.equal(poor.values.get(FISHING_KEY), raw);
});

test('a failed real disk save retries the same cosmetic purchase and reloads one debit', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-gear-save-'));
  try {
    const blocker = path.join(directory, 'blocked'); await writeFile(blocker, 'file');
    const repo = new Repository(blocker);
    repo.values.set(FISHING_KEY, JSON.stringify(emptyFishing())); repo.values.set(COINS_KEY, JSON.stringify({ ...emptyCoins(), balance: 100 }));
    const coins = new Coins(repo.storage, () => ({})); coins.load();
    const game = new Fishing(repo.storage, coins);
    game.execute({ action: 'buySkin', id: 'mint', requestId: 'persistent-purchase' });
    assert.equal(await repo.flush(), false); assert.equal(game.view().state.gear.skin, 'default'); assert.equal(coins.view().balance, 100);
    await rm(blocker); await mkdir(blocker);
    assert.equal(await repo.flush(), true); coins.confirmSaved(); game.confirmSaved();
    const reload = new Repository(blocker); await reload.load(); assert.equal(reload.readError, '');
    const wallet = new Coins(reload.storage, () => ({})); wallet.load(); const restored = new Fishing(reload.storage, wallet);
    restored.execute({ action: 'buySkin', id: 'mint', requestId: 'persistent-purchase' });
    assert.equal(restored.view().state.gear.skin, 'mint'); assert.equal(wallet.view().balance, 82);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
