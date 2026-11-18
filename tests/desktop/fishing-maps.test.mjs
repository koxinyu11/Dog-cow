import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFishing, parseFishing, fishingPool, fishingCategories, rollRound, fishingView, species, FISHING_KEY } from '../../dist-electron/src/shared/fishing.js';
import { fishingMaps, defaultLocation } from '../../dist-electron/src/shared/fishing-maps.js';
import { Fishing } from '../../dist-electron/src/main/fishing.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { COINS_KEY, emptyCoins } from '../../dist-electron/src/shared/coins.js';

test('all 12 location/layer combinations keep normalized pools with fixed encounters and distinct fish distributions', () => {
  for (const spot of ['lotus', 'bridge']) {
    const signatures = new Set();
    for (const zone of fishingMaps[spot].zones) for (const layer of ['shallow', 'bottom']) {
      const location = { zone: zone.id, layer };
      for (const activity of [0, 1]) for (const bait of ['plain', 'worm', 'scout', 'magnet']) {
        for (const { id, share } of fishingCategories(bait, activity)) {
          const pool = fishingPool(spot, id, bait, {}, activity, location);
          assert.ok(pool.length);
          assert.ok(Math.abs(pool.reduce((n, p) => n + p.chance, 0) - share) < 1e-10);
          for (const p of pool) {
            assert.ok(p.chance > 0);
            if (p.entry.castChance) assert.equal(p.chance, p.entry.castChance * (1 + 9 * activity));
          }
        }
      }
      signatures.add(JSON.stringify(fishingPool(spot, 'fish', 'plain', {}, 0, location).map(p => p.chance)));
    }
    assert.equal(signatures.size, 6);
    const expectedWeight = layer => fishingPool(spot, 'fish', 'plain', {}, 0, { zone: fishingMaps[spot].zones[0].id, layer }).reduce((n, p) => n + p.chance * p.entry.max, 0);
    assert.ok(expectedWeight('bottom') > expectedWeight('shallow'));
  }
});

test('legacy maps retain exact rolls and saves; new maps validate and default locations', () => {
  for (const spot of ['pond', 'river']) {
    const state = emptyFishing(); state.spot = spot;
    assert.deepEqual(parseFishing(JSON.stringify(state)), state);
    assert.equal(rollRound(state, 'legacy', () => .5).location, undefined);
    assert.deepEqual(fishingPool(spot, 'fish', 'plain'), fishingPool(spot, 'fish', 'plain', {}, 0));
  }
  for (const spot of ['lotus', 'bridge']) {
    const state = emptyFishing(); state.spot = spot;
    const parsed = parseFishing(JSON.stringify(state));
    assert.deepEqual(parsed.location, defaultLocation(spot));
    parsed.location.zone = 'invalid';
    assert.throws(() => parseFishing(JSON.stringify(parsed)), /落点/);
  }
});

test('unlock gates, invalid choices, frozen rounds, reload and save retry preserve a single result', () => {
  const state = emptyFishing();
  const data = new Map([[FISHING_KEY, JSON.stringify(state)], [COINS_KEY, JSON.stringify({ ...emptyCoins(), balance: 1000 })]]);
  const store = { getItem: key => data.get(key) ?? null, setItem: (key, raw) => data.set(key, raw) };
  const coins = new Coins(store, () => ({})); coins.load();
  const fishing = new Fishing(store, coins, () => .5, () => 1794916800000);
  let serial = 0;
  const run = (action, id, roundId, requestId = `maps-${++serial}`) => fishing.execute({ action, id, roundId, requestId });
  const saved = () => { fishing.confirmSaved(); coins.confirmSaved(); };
  assert.throws(() => run('spot', 'lotus'), /10/);
  assert.throws(() => run('spot', 'bridge'), /20/);
  assert.throws(() => run('zone', 'leaves'), /不支持/);
  for (const entry of species.filter(s => s.category === 'fish').slice(0, 20)) state.book[entry.id] = { count: 1, largest: .1 };
  data.set(FISHING_KEY, JSON.stringify(state));
  for (const spot of ['lotus', 'bridge']) {
    run('spot', spot); saved();
    assert.throws(() => run('zone', 'invalid'), /不存在/);
    assert.throws(() => run('layer', 'invalid'), /不存在/);
    run('zone', fishingMaps[spot].zones[2].id); saved(); run('layer', 'bottom'); saved();
    run('cast'); saved();
    const frozen = parseFishing(data.get(FISHING_KEY));
    assert.deepEqual(frozen.round.location, frozen.location);
    assert.equal(fishingView(frozen, 0).state.round.result, undefined);
    assert.throws(() => run('zone', fishingMaps[spot].zones[0].id), /收回/);
    assert.throws(() => run('layer', 'shallow'), /收回/);
    assert.throws(() => run('spot', 'pond'), /收回/);
    assert.deepEqual(parseFishing(JSON.stringify(frozen)).round, frozen.round);
    run('reel', undefined, frozen.round.id, `reel-${spot}`);
    assert.ok(fishing.view().pending);
    assert.deepEqual(fishing.view().state.round, fishingView(frozen, 0).state.round);
    saved();
    const after = data.get(FISHING_KEY);
    run('reel', undefined, frozen.round.id, `reel-${spot}`);
    assert.equal(data.get(FISHING_KEY), after);
    assert.deepEqual(fishing.view().state.last, frozen.round.result);
  }
  run('spot', 'pond'); saved(); assert.equal(fishing.view().state.location, undefined);
});
