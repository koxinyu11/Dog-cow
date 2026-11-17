import test from 'node:test';
import assert from 'node:assert/strict';
import { fishingTide, fishingDay, fishingShares, fishingRarityBoost } from '../../dist-electron/src/shared/fishing-tide.js';
import { emptyFishing, fishingCategories, fishingPool, rollRound, parseFishing, FISHING_KEY } from '../../dist-electron/src/shared/fishing.js';
import { Fishing } from '../../dist-electron/src/main/fishing.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { emptyCoins, COINS_KEY } from '../../dist-electron/src/shared/coins.js';
const at = (day, hour = 0, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test('daily deterministic windows change across days and hours, with a ten-minute plateau in every hour', () => {
  const days = [17, 18, 19].map(day => fishingDay(at(day)));
  assert.deepEqual(fishingDay(at(17, 22)), days[0]);
  for (const windows of days) {
    assert.equal(windows.length, 24);
    assert.ok(new Set(windows.map(w => new Date(w.start).getMinutes())).size > 10);
    for (const [i, window] of windows.entries()) {
      assert.equal(new Date(window.start).getHours(), i);
      assert.ok(new Date(window.start).getMinutes() >= 10 && new Date(window.start).getMinutes() <= 40);
      assert.equal(window.end - window.start, 600000);
      for (const time of [window.start, window.start + 300000, window.end - 1]) {
        const tide = fishingTide(time);
        close(tide.activity, 1); assert.equal(tide.phase, 'peak');
        assert.deepEqual(tide, fishingTide(time));
      }
    }
  }
  assert.notDeepEqual(days[0].map(w => new Date(w.start).getMinutes()), days[1].map(w => new Date(w.start).getMinutes()));
  assert.notEqual(fishingTide(at(17, 9)).activity, fishingTide(at(18, 9)).activity);
  assert.notEqual(fishingTide(at(17, 9)).activity, fishingTide(at(17, 13)).activity);
});

test('activity stays smooth through rising/falling edges, every hour and midnight', () => {
  for (let day = 17; day <= 19; day++) for (const window of fishingDay(at(day))) {
    for (const edge of [window.start - 300000, window.start, window.end, window.end + 300000, new Date(window.start).setMinutes(0, 0, 0)]) {
      assert.ok(Math.abs(fishingTide(edge - 1).activity - fishingTide(edge + 1).activity) < .00001);
    }
    assert.equal(fishingTide(window.start - 1).phase, 'rising');
    assert.equal(fishingTide(window.end).phase, 'falling');
  }
  for (let time = at(17); time <= at(20); time += 30000) {
    const tide = fishingTide(time);
    assert.ok(tide.activity >= 0 && tide.activity <= 1);
    assert.ok(tide.nextStart > time);
  }
  assert.equal(fishingTide(at(17, 23, 59)).nextStart, fishingDay(at(18))[0].start);
  assert.throws(() => fishingTide(NaN), /时间/);
});

test('probability endpoints and every interpolated bait/spot pool conserve mass and absolute mythic chances', () => {
  assert.deepEqual(fishingShares(0), { empty: .3, tiny: .2, fish: .4, creature: .06, junk: .03, treasure: .01 });
  const peak = fishingShares(1);
  for (const [id, chance] of Object.entries({ empty: .1, tiny: .05, fish: .75, creature: .06, junk: .02, treasure: .02 })) close(peak[id], chance);
  assert.deepEqual([0, 1, 2, 3, 4].map(r => fishingRarityBoost(r, 1)), [1, 1.2, 3, 4, 6]);
  for (const activity of [0, .1, .35, .7, 1]) for (const bait of ['plain', 'worm', 'scout', 'magnet']) for (const spot of ['pond', 'river']) {
    const shares = fishingShares(activity), categories = fishingCategories(bait, activity);
    close(shares.empty + shares.tiny + categories.reduce((n, c) => n + c.share, 0), 1);
    for (const category of categories) {
      const pool = fishingPool(spot, category.id, bait, {}, activity);
      close(pool.reduce((n, s) => n + s.chance, 0), category.share);
      assert.ok(pool.every(s => s.chance > 0 && Number.isFinite(s.chance)));
      for (const entry of pool.filter(s => s.entry.rarity === 5)) close(entry.chance, .0001 * (1 + 9 * activity));
    }
    close(categories.find(c => c.id === 'treasure').share, shares.treasure + (bait === 'magnet' ? .008 : 0));
    close(categories.find(c => c.id === 'junk').share, shares.junk - (bait === 'magnet' ? .008 : 0));
  }
});

test('rare fish are boosted independently of bait; common creatures retain their distribution', () => {
  const ratio = (activity, id) => {
    const pool = fishingPool('pond', 'fish', 'plain', {}, activity);
    return pool.find(s => s.entry.id === id).chance / pool.find(s => s.entry.id === 'crucian').chance;
  };
  for (const [id, boost] of [['perch', 1.2], ['koi', 3], ['moon', 4], ['opal', 6]]) close(ratio(1, id) / ratio(0, id), boost);
  assert.deepEqual(fishingPool('pond', 'creature', 'plain', {}, 0), fishingPool('pond', 'creature', 'plain', {}, 1));
});

test('a cast freezes authoritative time/activity, hides its result and survives save retry, next-day reload and duplicate requests', () => {
  let clock = fishingDay(at(17))[13].start + 1000, draws = 0;
  const castAt = clock;
  const state = emptyFishing(); state.equipped = 'collector'; state.rods.collector = 1;
  const values = new Map([[FISHING_KEY, JSON.stringify(state)], [COINS_KEY, JSON.stringify(emptyCoins())]]);
  const store = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const coins = new Coins(store, () => ({})); coins.load();
  const numbers = [.9, 0, .5, .999, .5, .5];
  const game = new Fishing(store, coins, () => numbers[draws++] ?? .5, () => clock);
  game.execute({ action: 'cast', requestId: 'once', at: at(19) }); // Renderer time is ignored.
  const savedRound = parseFishing(values.get(FISHING_KEY)).round;
  assert.deepEqual(savedRound.tide, { version: 2, at: castAt, activity: 1 });
  assert.equal(savedRound.result.species, 'star-koi');
  assert.equal(game.view().state.round, null); assert.equal(game.view().pending, true);
  clock = at(18, 1);
  assert.throws(() => game.execute({ action: 'cast', requestId: 'other' }), /尚未保存/);
  game.confirmSaved();
  game.execute({ action: 'cast', requestId: 'once' });
  assert.deepEqual(parseFishing(values.get(FISHING_KEY)).round, savedRound);
  const visible = game.view().state.round;
  assert.equal(visible.result, undefined); assert.deepEqual(visible.tide, savedRound.tide);
  const reload = new Fishing(store, coins, () => { throw Error('must not reroll'); }, () => clock);
  assert.deepEqual(reload.view().state.round, visible);
  reload.execute({ action: 'reel', roundId: visible.id, requestId: 'reel-once' });
  assert.equal(reload.view().state.bag.length, 0);
  reload.confirmSaved();
  reload.execute({ action: 'reel', roundId: visible.id, requestId: 'reel-once' });
  assert.equal(reload.view().state.bag.length, 1); assert.equal(reload.view().state.last.species, 'star-koi');
  assert.equal(draws, 6);
});

test('legacy unrevealed rounds are preserved; malformed new metadata locks rather than overwrites a save', () => {
  const legacy = emptyFishing(); legacy.round = rollRound(legacy, 'old', () => .4);
  assert.equal(legacy.round.tide, undefined);
  assert.deepEqual(parseFishing(JSON.stringify(legacy)), legacy);
  for (const tide of [{ version: 1, at: at(17), activity: .5 }, { version: 2, at: -1, activity: .5 },
    { version: 2, at: at(17), activity: 1.01 }, { version: 2, at: at(17), activity: '1' }]) {
    assert.throws(() => parseFishing(JSON.stringify({ ...legacy, round: { ...legacy.round, tide } })), /鱼竿记录/);
  }
});
