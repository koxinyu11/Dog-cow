import test from 'node:test';
import assert from 'node:assert/strict';
import { GameClock } from '../../dist-electron/src/main/game-clock.js';
import { GameProgress } from '../../dist-electron/src/main/game-progress.js';
import { GAME_PROGRESS_KEY, parseGameProgress, validActivityReport } from '../../dist-electron/src/shared/game-progress.js';
import { Titles } from '../../dist-electron/src/main/titles.js';
import { TITLES_KEY, emptyTitles, parseTitles, TITLES, catalogProblems } from '../../dist-electron/src/shared/titles/index.js';
import { emptyFishing, species } from '../../dist-electron/src/shared/fishing.js';
const report = (extra = {}) => ({ gameId: 'desk-fishing', runId: 'one', activity: 'decision', paused: false, input: false, ...extra });
function clockFixture(policies) {
  let now = 0;
  const clock = new GameClock(() => now, policies);
  clock.environmentChanged({ foreground: true, interrupted: false });
  clock.update(report());
  const tick = (ms) => { let sum = { active: 0, idle: 0 }; while (ms > 0) { const step = Math.min(ms, 10_000); now += step; ms -= step; const time = clock.drain()['desk-fishing']; if (time) { sum.active += time.active; sum.idle += time.idle; } } return sum; };
  return { clock, tick, skip: ms => { now += ms; } };
}
test('five-minute idle limit is exact; mouse-free normal waiting counts and resets decision allowance', () => {
  const { clock, tick } = clockFixture();
  assert.equal(tick(310_000).active, 300_000);
  assert.equal(tick(10_000).active, 0);
  clock.update(report({ input: true }));
  assert.equal(tick(10_000).active, 10_000);
  clock.update(report({ activity: 'progressing' }));
  assert.equal(tick(600_000).active, 600_000);
  clock.update(report());
  assert.equal(tick(310_000).active, 300_000);
});
test('background ordinary games, manual pause, blocked loading, suspend and offline gaps do not count', () => {
  const { clock, tick, skip } = clockFixture();
  assert.equal(tick(1000).active, 1000);
  clock.environmentChanged({ foreground: false, interrupted: false });
  assert.deepEqual(tick(20_000), { active: 0, idle: 0 });
  clock.environmentChanged({ foreground: true, interrupted: false });
  clock.update(report({ paused: true }));
  assert.equal(tick(20_000).active, 0);
  clock.update(report({ activity: 'blocked' }));
  assert.equal(tick(20_000).active, 0);
  clock.update(report({ activity: 'progressing' }));
  clock.interrupt();
  skip(8 * 3600_000);
  assert.deepEqual(clock.drain(), {});
  clock.environmentChanged({ foreground: true, interrupted: false });
  assert.equal(tick(20_000).active, 0, 'resume alone must not restart a suspended session');
  clock.update(report({ activity: 'progressing' }));
  skip(3600_000);
  assert.deepEqual(clock.drain(), {}, 'stalled event loop never awards offline time');
});
test('future idle policy uses exclusive buckets; no idle when blocked or manually paused', () => {
  const { clock, tick } = clockFixture({ 'desk-fishing': { background: 'idle' } });
  clock.update(report({ activity: 'idle-running' }));
  assert.deepEqual(tick(360_000), { active: 300_000, idle: 60_000 });
  clock.environmentChanged({ foreground: false, interrupted: false });
  assert.deepEqual(tick(60_000), { active: 0, idle: 60_000 });
  clock.update(report({ activity: 'blocked' }));
  assert.deepEqual(tick(60_000), { active: 0, idle: 0 });
  clock.update(report({ activity: 'idle-running', paused: true }));
  assert.deepEqual(tick(60_000), { active: 0, idle: 0 });
});
test('switching games closes the previous accounting interval without overlapping time', () => {
  let now = 0;
  const clock = new GameClock(() => now);
  clock.environmentChanged({ foreground: true, interrupted: false });
  clock.update(report()); now += 1000;
  clock.update(report({ gameId: 'poker', runId: 'two' })); now += 2000;
  clock.stop(); now += 10_000;
  assert.deepEqual(clock.drain(), { 'desk-fishing': { active: 1000, idle: 0 }, poker: { active: 2000, idle: 0 } });
});
function progressFixture(values = new Map()) {
  const store = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const titles = new Titles(store, () => null); titles.load();
  let now = 0;
  const clock = new GameClock(() => now);
  const progress = new GameProgress(store, titles, clock);
  const ids = () => titles.view().items.map(t => t.id);
  return { values, store, titles, progress, clock, ids, tick: ms => { now += ms; progress.settle(); } };
}
test('no participation trophies; higher fish milestones backfill, persist and remain idempotent', () => {
  assert.deepEqual(catalogProblems(), []);
  const f = progressFixture();
  const fish = emptyFishing(); fish.total = 1; fish.book[species[0].id] = { count: 1, largest: 1 };
  f.progress.fishing(fish);
  assert.deepEqual(f.ids(), []);
  fish.total = 200;
  for (const s of species.slice(0, 50)) fish.book[s.id] = { count: 1, largest: 1 };
  f.progress.fishing(fish); f.progress.settle();
  const expected = f.ids();
  assert.ok(expected.includes('fishing-caught-50'));
  assert.ok(expected.includes('fishing-caught-200'));
  assert.ok(expected.includes('fishing-found-50'));
  f.progress.fishing(fish);
  assert.deepEqual(f.ids(), expected);
  assert.deepEqual(progressFixture(f.values).ids(), expected);
  assert.equal(TITLES.filter(t => ['game-time', 'fishing', 'poker'].includes(t.series)).length, 17);
});
test('poker settlement deduplicates after restart; tied hands do not count as net wins', () => {
  const f = progressFixture();
  const hand = n => ({ id: `hand-${n}`, done: true, settlement: { netGains: [n % 2 ? 10 : 0] } });
  for (let n = 1; n <= 50; n++) { f.progress.poker(hand(n)); f.progress.poker(hand(n)); }
  let saved = parseGameProgress(f.values.get(GAME_PROGRESS_KEY));
  assert.equal(saved.poker.hands, 50); assert.equal(saved.poker.wins, 25);
  assert.ok(f.ids().includes('poker-hands-50')); assert.ok(f.ids().includes('poker-wins-20'));
  const reopened = progressFixture(f.values);
  reopened.progress.poker(hand(50));
  saved = parseGameProgress(f.values.get(GAME_PROGRESS_KEY));
  assert.equal(saved.poker.hands, 50);
});
test('time survives restart and crosses 2h only with active time; retry cannot double drain', () => {
  const values = new Map([[GAME_PROGRESS_KEY, JSON.stringify({ version: 1, games: { 'desk-fishing': { active: 7_199_000, idle: 99_000_000 } }, poker: { hands: 0, wins: 0, lastHand: '' } })]]);
  const f = progressFixture(values);
  f.progress.settle(); assert.ok(!f.ids().includes('game-time-2'));
  f.clock.environmentChanged({ foreground: true, interrupted: false }); f.clock.update(report());
  f.tick(1000); f.progress.settle();
  assert.ok(f.ids().includes('game-time-2'));
  assert.equal(parseGameProgress(values.get(GAME_PROGRESS_KEY)).games['desk-fishing'].active, 7_200_000);
  assert.ok(progressFixture(values).ids().includes('game-time-2'));
});
test('damaged progress remains untouched and never replaces old bytes', () => {
  const raw = '{broken'; const f = progressFixture(new Map([[GAME_PROGRESS_KEY, raw]]));
  assert.match(f.progress.error, /原数据已保留/);
  f.tick(1000); assert.equal(f.values.get(GAME_PROGRESS_KEY), raw);
  assert.throws(() => parseGameProgress(JSON.stringify({ version: 1, games: { poker: { active: -1, idle: 0 } }, poker: { hands: 0, wins: 0, lastHand: '' } })));
  assert.equal(validActivityReport(report({ gameId: '__proto__' })), false);
  assert.equal(validActivityReport(report({ activity: 'made-up' })), false);
});
test('old rule version retains existing ownership and imports new ledgers on reparse', () => {
  const old = emptyTitles('2026-01-01'); old.rules = 1;
  old.unlocked = [{ id: 'done-1', at: Date.now() }];
  const next = parseTitles(JSON.stringify(old), '2026-11-17');
  assert.equal(next.unlocked[0].id, 'done-1');
});
test('real poker execution emits one settled hand; retry saves the same candidate once', async () => {
  const { Poker } = await import('../../dist-electron/src/main/poker.js');
  const { Coins } = await import('../../dist-electron/src/main/coins.js');
  const { COINS_KEY, emptyCoins } = await import('../../dist-electron/src/shared/coins.js');
  const f = progressFixture();
  f.store.setItem(COINS_KEY, JSON.stringify({ ...emptyCoins(), balance: 100 }));
  const coins = new Coins(f.store, () => ({})); coins.load();
  const poker = new Poker(f.store, coins, t => f.progress.poker(t));
  const request = (action, extra = {}) => ({ action, createdAt: Date.now(), requestId: crypto.randomUUID(), ...extra });
  const save = () => { coins.confirmSaved(); poker.confirmSaved(); };
  poker.execute(request('exchangeCoins', { amount: 10 })); save();
  poker.execute(request('join', { amount: 1000 })); save();
  let t = poker.view().table;
  let last;
  while (!t.done) {
    last = request(t.turn === 0 ? 'act' : 'bot', { tableId: t.id, revision: t.revision, move: 'fold' });
    poker.execute(last, { move: 'fold' });
    save(); t = poker.view().table;
  }
  poker.execute(last, { move: 'fold' });
  assert.equal(parseGameProgress(f.values.get(GAME_PROGRESS_KEY)).poker.hands, 1);
  assert.equal(parseGameProgress(f.values.get(GAME_PROGRESS_KEY)).poker.wins, (t.settlement.netGains[0] > 0 ? 1 : 0));
});
test('failed disk flush retains elapsed candidate; retry and reload never add it twice', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { Repository } = await import('../../dist-electron/src/main/repository.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dogcow-game-save-'));
  try {
    const repo = new Repository(dir); await repo.load();
    const titles = new Titles(repo.storage, () => null); titles.load();
    let now = 0; const clock = new GameClock(() => now);
    const progress = new GameProgress(repo.storage, titles, clock);
    progress.settle(); assert.equal(await repo.flush(), true);
    await fs.rename(repo.file, `${repo.file}.old`); await fs.mkdir(repo.file);
    clock.environmentChanged({ foreground: true, interrupted: false }); clock.update(report());
    now = 1000; progress.settle(); assert.equal(await repo.flush(), false);
    progress.settle(); assert.equal(parseGameProgress(repo.storage.getItem(GAME_PROGRESS_KEY)).games['desk-fishing'].active, 1000);
    await fs.rmdir(repo.file); assert.equal(await repo.flush(), true);
    const reopened = new Repository(dir); await reopened.load();
    assert.equal(parseGameProgress(reopened.storage.getItem(GAME_PROGRESS_KEY)).games['desk-fishing'].active, 1000);
    assert.ok(reopened.storage.getItem(TITLES_KEY));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
