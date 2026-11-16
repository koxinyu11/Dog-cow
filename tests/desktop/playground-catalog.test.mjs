import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({ entryPoints: ['src/renderer/features/playground/catalog.ts'], bundle: true, write: false, platform: 'neutral', format: 'esm' });
const catalog = await import(`data:text/javascript,${encodeURIComponent(bundled.outputFiles[0].text)}`);
const game = (id, extra = {}) => ({ id, title: id, description: '', icon: '', category: '', load: async () => ({ default: () => null }), ...extra });
const memory = (initial = {}) => { const data = { ...initial }; return { data, getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = value; } }; };

test('lobby tier follows game count thresholds', () => {
  assert.deepEqual([0, 1, 3, 4, 11, 12, 40].map(catalog.lobbyTier), ['empty', 'feature', 'feature', 'standard', 'standard', 'large', 'large']);
});

test('sorting uses order, then newest, then title', () => {
  const list = [game('c'), game('b', { addedAt: '2026-10-01' }), game('a', { order: 2 }), game('z', { order: 1 }), game('d', { addedAt: '2026-11-01' })];
  assert.deepEqual(catalog.sortGames(list).map(g => g.id), ['z', 'a', 'd', 'b', 'c']);
});

test('new badge lasts 30 days and ignores invalid or future dates', () => {
  const now = Date.parse('2026-11-13');
  assert.equal(catalog.isNewGame(game('a', { addedAt: '2026-11-01' }), now), true);
  assert.equal(catalog.isNewGame(game('a', { addedAt: '2026-09-01' }), now), false);
  assert.equal(catalog.isNewGame(game('a', { addedAt: 'later' }), now), false);
  assert.equal(catalog.isNewGame(game('a', { addedAt: '2027-01-01' }), now), false);
});

test('filter matches title, description and tags within a category; groups keep order', () => {
  const list = [game('贪吃牛', { category: '休闲', tags: ['snake'] }), game('数独', { category: '益智', description: '数字推理' }), game('打地鼠', { category: '反应' })];
  assert.deepEqual(catalog.filterGames(list, 'SNAKE', null).map(g => g.id), ['贪吃牛']);
  assert.deepEqual(catalog.filterGames(list, '推理', '益智').map(g => g.id), ['数独']);
  assert.deepEqual(catalog.filterGames(list, '推理', '休闲'), []);
  assert.deepEqual(catalog.categoriesOf([...list, game('x')]), ['休闲', '益智', '反应']);
  assert.deepEqual(catalog.groupByCategory([...list, game('x')]).map(g => g.category), ['休闲', '益智', '反应', '其他']);
});

test('recent games degrade safely on bad storage and stay bounded', () => {
  const known = ['a', 'b', 'c', 'd'].map(id => game(id));
  assert.deepEqual(catalog.readRecent(undefined, known), []);
  assert.deepEqual(catalog.readRecent(memory({ [catalog.RECENT_KEY]: '{bad' }), known), []);
  assert.deepEqual(catalog.readRecent(memory({ [catalog.RECENT_KEY]: '{"a":1}' }), known), []);
  assert.deepEqual(catalog.readRecent(memory({ [catalog.RECENT_KEY]: '["gone","a",1,"a","b","c","d"]' }), known), ['a', 'b', 'c']);
  assert.deepEqual(catalog.readRecent({ getItem() { throw Error('denied'); }, setItem() {} }, known), []);
  const store = memory();
  let recent = [];
  for (const id of ['a', 'b', 'c', 'a', 'd']) recent = catalog.recordRecent(store, recent, id);
  assert.deepEqual(recent, ['d', 'a', 'c']);
  assert.deepEqual(JSON.parse(store.data[catalog.RECENT_KEY]), ['d', 'a', 'c']);
  assert.deepEqual(catalog.recordRecent({ getItem: () => null, setItem() { throw Error('quota'); } }, ['a'], 'b'), ['b', 'a']);
});
