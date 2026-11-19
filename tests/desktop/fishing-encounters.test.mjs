import { extraFinds } from '../../dist-electron/src/shared/fishing-finds.js';
import { fishingTide, fishingShares } from '../../dist-electron/src/shared/fishing-tide.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { species, fishCount, emptyFishing, parseFishing, fishingPool, fishingCategories, rollRound, fishingView, FISHING_KEY } from '../../dist-electron/src/shared/fishing.js';
import { extraFish } from '../../dist-electron/src/shared/fishing-catalog.js';
import { charms, specialBaits, supplies, emptyGear, parseGear, MAX_SUPPLIES } from '../../dist-electron/src/shared/fishing-gear.js';
import { defaultLocation, fishingMaps } from '../../dist-electron/src/shared/fishing-maps.js';
import { eligibleSpecials } from '../../dist-electron/src/shared/fishing-encounters.js';
import { Fishing } from '../../dist-electron/src/main/fishing.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { COINS_KEY, emptyCoins } from '../../dist-electron/src/shared/coins.js';

const restricted = extraFish.filter(s => s.encounter?.chance);
const poolFor = (s, activity = 0) => fishingPool(s.spot, 'fish', s.bait, s.book, activity, s.location, s.gear.charm);
function prepared(entry) {
  const s = emptyFishing(); s.spot = entry.spot; s.location = defaultLocation(s.spot); s.equipped = 'collector'; s.rods.collector = 1;
  s.book = Object.fromEntries(species.filter(s => s.category === 'fish').slice(0, 30).map(s => [s.id, { count: 1, largest: s.min }]));
  if (entry.encounter?.zone) s.location.zone = entry.encounter.zone;
  if (entry.encounter?.layer) s.location.layer = entry.encounter.layer;
  if (entry.encounter?.bait) { s.bait = entry.encounter.bait; s.gear.stock[s.bait] = 2; }
  if (entry.encounter?.charm) { s.gear.charm = entry.encounter.charm; s.gear.charms = [s.gear.charm]; }
  return s;
}
function setup(s = emptyFishing(), balance = 2000, random = () => .5) {
  const data = new Map([[FISHING_KEY, JSON.stringify(s)], [COINS_KEY, JSON.stringify({ ...emptyCoins(), balance })]]);
  const store = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const coins = new Coins(store, () => ({})); coins.load();
  const game = new Fishing(store, coins, random, () => 1794916800000);
  let id = 0;
  const run = (action, value, roundId, requestId = `encounter-${++id}`) => game.execute({ action, id: value, roundId, requestId });
  const saved = () => { game.confirmSaved(); coins.confirmSaved(); };
  return { data, game, coins, run, saved };
}

test('200 fish are distinct and additions split into 64 regular / 32 habitat / 20 bait / 12 combo fish', () => {
  assert.equal(fishCount, 200); assert.equal(species.length, 250); assert.equal(extraFish.length, 128);
  assert.equal(new Set(species.map(s => s.name)).size, species.length);
  assert.equal(new Set(species.map(s => s.id)).size, species.length);
  assert.deepEqual([
    extraFish.filter(s => !s.encounter).length,
    extraFish.filter(s => s.encounter && !s.encounter.bait).length,
    restricted.filter(s => !s.encounter.charm).length,
    restricted.filter(s => s.encounter.charm).length,
  ], [64, 32, 20, 12]);
  assert.equal(specialBaits.length, 6); assert.equal(charms.length, 4);
  for (const entry of extraFish) {
    assert.ok(entry.note); assert.ok(entry.max * 1.15 <= 100);
    if (entry.encounter) {
      const r = entry.encounter;
      assert.ok(r.clue);
      if (r.zone) assert.ok(fishingMaps[entry.spot].zones.some(z => z.id === r.zone));
      if (r.bait) assert.ok(specialBaits.some(b => b.id === r.bait));
      if (r.charm) assert.ok(charms.some(c => c.id === r.charm));
    }
  }
});

test('every required ingredient and location independently gates each special encounter', () => {
  for (const entry of restricted) {
    const state = prepared(entry);
    assert.equal(poolFor(state).find(p => p.entry.id === entry.id).chance, entry.encounter.chance);
    assert.ok(eligibleSpecials(species, state).some(s => s.id === entry.id));
    for (const change of [
      s => { s.bait = 'plain'; },
      s => { s.spot = s.spot === 'pond' ? 'river' : 'pond'; s.location = defaultLocation(s.spot); },
      ...(entry.encounter.charm ? [s => { s.gear.charm = null; }] : []),
      ...(entry.encounter.zone ? [s => { s.location.zone = fishingMaps[s.spot].zones.find(z => z.id !== s.location.zone).id; }] : []),
      ...(entry.encounter.layer ? [s => { s.location.layer = s.location.layer === 'shallow' ? 'bottom' : 'shallow'; }] : []),
    ]) {
      const altered = structuredClone(state); change(altered);
      assert.ok(!poolFor(altered).some(p => p.entry.id === entry.id), entry.id);
    }
  }
});

test('all grounds, layers, baits, charms and activity levels normalize; old mythic rates are unchanged', () => {
  for (const spot of ['pond', 'river', 'lotus', 'bridge']) {
    const locations = fishingMaps[spot] ? fishingMaps[spot].zones.flatMap(z => ['shallow', 'bottom'].map(layer => ({ zone: z.id, layer }))) : [undefined];
    for (const location of locations) for (const bait of ['plain', 'worm', 'scout', 'magnet', ...specialBaits.map(b => b.id)])
      for (const charm of [null, ...charms.map(c => c.id)]) for (const activity of [0, .5, 1]) {
        for (const { id, share } of fishingCategories(bait, activity)) {
          const pool = fishingPool(spot, id, bait, {}, activity, location, charm);
          assert.ok(Math.abs(pool.reduce((n, p) => n + p.chance, 0) - share) < 1e-10);
          for (const p of pool) {
            assert.ok(p.chance > 0 && Number.isFinite(p.chance));
            if (p.entry.castChance) assert.equal(p.chance, p.entry.castChance * (1 + 9 * activity));
            if (p.entry.encounter?.chance) assert.equal(p.chance, p.entry.encounter.chance);
          }
        }
      }
  }
});

test('legacy equipment gains only new defaults; invalid charms and stocks preserve raw saves', () => {
  const state = emptyFishing(); state.gear = { skin: 'mint', skins: ['default', 'mint'], stock: { scout: 3, magnet: 7, guard: 2 }, guard: true };
  state.round = { id: 'old', rod: 'bamboo', signal: '轻轻晃动', wait: 5, supply: 'scout', result: { kind: 'empty', name: '水草' } };
  const parsed = parseFishing(JSON.stringify(state));
  assert.deepEqual(parsed.gear, { ...emptyGear(), skin: 'mint', skins: ['default', 'mint'], stock: { ...emptyGear().stock, scout: 3, magnet: 7, guard: 2 }, guard: true });
  assert.deepEqual(parsed.round, state.round);
  for (const gear of [
    { ...emptyGear(), charm: 'moon-bell' }, { ...emptyGear(), charms: ['alien'] },
    { ...emptyGear(), charms: ['moon-bell', 'moon-bell'] },
    ...[-1, .5, MAX_SUPPLIES + 1, null].map(n => ({ ...emptyGear(), stock: { ...emptyGear().stock, 'lotus-bait': n } })),
  ]) assert.throws(() => parseGear(gear), /装备记录/);
  const x = setup(); const raw = JSON.stringify({ ...state, gear: { ...emptyGear(), charm: 'alien' } }); x.data.set(FISHING_KEY, raw);
  assert.throws(() => x.game.view()); assert.equal(x.data.get(FISHING_KEY), raw);
});

test('charm purchases and bait packs enforce ownership, unlocks, wallet, stock limits and idempotency', () => {
  const novice = setup(); assert.throws(() => novice.run('buyCharm', 'moon-bell'), /10/); assert.throws(() => novice.run('buySupply', 'lotus-bait'), /10/);
  const state = prepared(restricted[0]); state.gear = emptyGear(); state.bait = 'plain';
  const x = setup(state);
  for (const charm of charms) {
    const balance = x.game.view().balance;
    const previousCharm = x.game.view().state.gear.charm;
    x.run('buyCharm', charm.id, undefined, `buy-${charm.id}`); assert.equal(x.game.view().state.gear.charm, previousCharm);
    x.saved(); assert.equal(x.game.view().balance, balance - charm.price); assert.equal(x.game.view().state.gear.charm, charm.id);
    x.run('buyCharm', charm.id, undefined, `buy-${charm.id}`); assert.equal(x.game.view().balance, balance - charm.price);
    assert.throws(() => x.run('buyCharm', charm.id), /已经拥有/);
  }
  for (const bait of specialBaits) {
    assert.throws(() => x.run('bait', bait.id), /用完/);
    x.run('buySupply', bait.id); x.saved(); x.run('bait', bait.id); x.saved();
    assert.equal(x.game.view().state.gear.stock[bait.id], bait.pack);
  }
  x.run('charm', 'none'); x.saved(); assert.equal(x.game.view().state.gear.charm, null);
  assert.throws(() => x.run('charm', 'alien'), /尚未拥有/);
  const poor = setup(state, 0); assert.throws(() => poor.run('buyCharm', 'moon-bell'), /不足/); assert.equal(poor.game.view().state.gear.charms.length, 0);
  const full = structuredClone(state); full.gear.stock['lotus-bait'] = MAX_SUPPLIES; const f = setup(full);
  assert.throws(() => f.run('buySupply', 'lotus-bait'), /最多/);
});

test('special result, bait reservation and charm freeze across reload, failed save and duplicate reel', () => {
  for (const entry of restricted) {
    const state = prepared(entry);
    const activity = fishingTide(1794916800000).activity;
    const pool = poolFor(state, activity);
    let before = 0; for (const p of pool) { if (p.entry.id === entry.id) break; before += p.chance; }
    const share = fishingCategories(state.bait, activity).find(c => c.id === 'fish').share;
    const draws = [.99999, (before + entry.encounter.chance / 2) / share, .2, .999]; let i = 0;
    const x = setup(state, 100, () => draws[i++] ?? .5);
    x.run('cast'); const frozen = parseFishing(x.data.get(FISHING_KEY));
    assert.equal(frozen.round.result.species, entry.id);
    x.saved(); assert.equal(x.game.view().state.round.result, undefined);
    assert.throws(() => x.run('charm', 'none'), /收回/); assert.throws(() => x.run('bait', 'plain'), /收回/);
    const reload = new Fishing({ getItem: k => x.data.get(k) ?? null, setItem: (k, v) => x.data.set(k, v) }, x.coins, () => { throw Error('must not reroll'); });
    reload.execute({ action: 'reel', roundId: frozen.round.id, requestId: 'same-reel' });
    assert.ok(reload.view().pending); assert.equal(reload.view().state.gear.stock[state.bait], 2);
    assert.throws(() => reload.execute({ action: 'cast', requestId: 'blocked' }), /尚未保存/);
    reload.confirmSaved();
    assert.equal(reload.view().state.gear.stock[state.bait], 1); assert.equal(reload.view().state.last.species, entry.id);
    const count = reload.view().state.bag.length;
    reload.execute({ action: 'reel', roundId: frozen.round.id, requestId: 'same-reel' });
    assert.equal(reload.view().state.bag.length, count); assert.equal(reload.view().state.gear.stock[state.bait], 1);
    assert.deepEqual(fishingView(frozen, 0).state.round.charm, state.gear.charm);
  }
});


test('22 non-fish finds add exactly 8 creatures, 6 objects and 8 treasures', () => {
  assert.equal(extraFinds.length, 22);
  assert.deepEqual(['creature', 'junk', 'treasure'].map(c => extraFinds.filter(s => s.category === c).length), [8, 6, 8]);
  assert.equal(extraFinds.filter(s => s.visitor).length, 2);
  assert.equal(extraFinds.filter(s => s.encounter).length, 4);
  for (const entry of extraFinds) assert.ok(entry.shape && entry.note && entry.min > 0 && entry.max <= 100);
});

test('treasure recipes require each condition; frozen results settle once and remain collectible', () => {
  for (const entry of extraFinds.filter(s => s.encounter)) {
    const state = prepared(entry);
    const pool = s => fishingPool(s.spot, 'treasure', s.bait, s.book, 0, s.location, s.gear.charm);
    const chosen = pool(state).find(p => p.entry.id === entry.id);
    assert.equal(chosen.chance, entry.encounter.chance);
    for (const change of [
      s => { s.bait = 'plain'; }, s => { s.gear.charm = null; },
      s => { s.spot = 'pond'; s.location = undefined; },
      s => { s.location.zone = fishingMaps[s.spot].zones.find(z => z.id !== s.location.zone).id; },
      s => { s.location.layer = s.location.layer === 'shallow' ? 'bottom' : 'shallow'; },
    ]) {
      const altered = structuredClone(state); change(altered);
      assert.ok(!pool(altered).some(p => p.entry.id === entry.id), entry.id);
    }
    // Locate the exact treasure interval at the same frozen activity as the command.
    const activity = fishingTide(1794916800000).activity;
    const shares = fishingCategories(state.bait, activity);
    const base = fishingShares(activity);
    const type = base.empty + base.tiny + shares.find(c => c.id === 'creature').share + shares.find(c => c.id === 'junk').share + shares.find(c => c.id === 'treasure').share / 2;
    const candidates = fishingPool(state.spot, 'treasure', state.bait, state.book, activity, state.location, state.gear.charm);
    let before = 0; for (const p of candidates) { if (p.entry.id === entry.id) break; before += p.chance; }
    const share = shares.find(c => c.id === 'treasure').share;
    const values = [type, (before + entry.encounter.chance / 2) / share, .5]; let n = 0;
    const x = setup(state, 1000, () => values[n++] ?? .5);
    x.run('cast'); x.saved();
    const frozen = parseFishing(x.data.get(FISHING_KEY));
    assert.equal(frozen.round.result.species, entry.id);
    assert.equal(frozen.round.result.kind, 'treasure');
    assert.equal(fishingView(frozen, 0).state.round.result, undefined);
    const restored = setup(frozen, 1000, () => { throw Error('No new draw after reload'); });
    restored.run('reel', undefined, frozen.round.id, 'treasure-reel'); restored.saved();
    assert.equal(restored.game.view().state.bag.at(-1).species, entry.id);
    assert.equal(restored.game.view().state.gear.stock[state.bait], 1);
    restored.run('reel', undefined, frozen.round.id, 'treasure-reel');
    assert.equal(restored.game.view().state.bag.length, 1);
    assert.equal(restored.game.view().state.book[entry.id].count, 1);
  }
});

test('new egret and firefly visits enter the journal but never enter the bag or fish total', () => {
  for (const entry of extraFinds.filter(s => s.visitor)) {
    const state = emptyFishing(); state.spot = entry.spot;
    const pool = fishingPool(state.spot, 'creature', 'plain');
    let before = 0; for (const p of pool) { if (p.entry.id === entry.id) break; before += p.chance; }
    const chance = pool.find(p => p.entry.id === entry.id).chance;
    let n = 0; const draws = [.52, (before + chance / 2) / .06, .5];
    const x = setup(state, 1000, () => draws[n++] ?? .5);
    // Creature pool proportions stay fixed as activity moves its category interval.
    const at = 1794916800000;
    const live = fishingShares(fishingTide(at).activity); draws[0] = live.empty + live.tiny + .03;
    const game = new Fishing({ getItem: k => x.data.get(k) ?? null, setItem: (k,v) => x.data.set(k,v) }, x.coins, () => draws[n++] ?? .5, () => at);
    game.execute({ action: 'cast', requestId: 'visit-cast' }); game.confirmSaved();
    const round = game.view().state.round;
    game.execute({ action: 'reel', roundId: round.id, requestId: 'visit-reel' }); game.confirmSaved();
    assert.equal(game.view().state.book[entry.id].count, 1);
    assert.equal(game.view().state.bag.length, 0);
    assert.equal(game.view().state.total, 0);
  }
});
