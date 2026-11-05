import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUND_PRESETS, MODULE_IDS, defaultBoard, layoutScore, pack, smartArrange, validBoard } from '../../dist-electron/src/shared/board.js';
import { copyDefaults } from '../../dist-electron/src/domain/tasks/model.js';

const keys = Object.keys(copyDefaults);
const overlaps = (placed) =>
  placed.some((a, i) => placed.slice(i + 1).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));

test('board without columns or colors (older saves) stays valid', () => {
  assert.equal(validBoard(defaultBoard(), keys), true);
});

test('board accepts 3 or 4 columns and #rrggbb module colours only', () => {
  const ok = { ...defaultBoard(), columns: 3, colors: { income: '#2f3a34', clock: '#FFF4D6' } };
  assert.equal(validBoard(ok, keys), true);
  for (const columns of [2, 5, '3', null]) assert.equal(validBoard({ ...defaultBoard(), columns }, keys), false);
  assert.equal(validBoard({ ...defaultBoard(), colors: { income: 'red' } }, keys), false);
  assert.equal(validBoard({ ...defaultBoard(), colors: { nope: '#ffffff' } }, keys), false);
  assert.equal(validBoard({ ...defaultBoard(), colors: [] }, keys), false);
});

test('a row holds three medium cards and the default board has no gaps', () => {
  const three = pack([{ id: 'income', size: 'm' }, { id: 'work-time', size: 'm' }, { id: 'clock', size: 'm' }]);
  assert.deepEqual(three.map((p) => [p.x, p.y]), [[0, 0], [4, 0], [8, 0]]);
  assert.equal(layoutScore(defaultBoard().items, 12).holes, 0);
});

test('smart arrange randomly fills the grid, keeps modules and changes the layout', () => {
  for (const columns of [12, 6]) {
    for (const ids of [MODULE_IDS.slice(0, 4), [...MODULE_IDS], ['tasks', 'calendar', 'stolen', 'income']]) {
      const items = ids.map((id) => ({ id, size: 'm' }));
      const seen = new Set();
      for (let run = 0; run < 6; run++) {
        const { items: result, holes } = smartArrange(items, columns);
        assert.deepEqual([...result.map((i) => i.id)].sort(), [...ids].sort());
        assert.equal(overlaps(pack(result, columns)), false);
        assert.equal(holes, 0, `${columns} cols, ${ids.length} modules`);
        assert.notDeepEqual(result, items);
        seen.add(JSON.stringify(result));
      }
      assert.ok(seen.size > 1, 'different results across clicks');
    }
  }
});

test('legacy columns field is still readable', () => {
  assert.equal(validBoard({ ...defaultBoard(), columns: 3 }, keys), true);
});

test('every background theme key is valid, unknown keys are rejected', () => {
  for (const value of Object.keys(BACKGROUND_PRESETS)) assert.equal(validBoard({ ...defaultBoard(), background: { kind: 'preset', value } }, keys), true, value);
  for (const value of ['classic', 'meadow', 'sunset', 'night', 'candy', 'ocean', 'paper']) assert.ok(Object.hasOwn(BACKGROUND_PRESETS, value), `kept legacy key ${value}`);
  assert.equal(validBoard({ ...defaultBoard(), background: { kind: 'preset', value: 'mars' } }, keys), false);
});


test('default home keeps original nine cards and new fun cards stay optional', () => {
  const board = defaultBoard();
  assert.deepEqual([...board.items.map((item) => item.id)].sort(), MODULE_IDS.filter(id => !['paid-toilet','mood','receipt','lunch','calories','hopes','pasture','converter'].includes(id)).sort());
  for (const columns of [12, 6]) {
    assert.equal(overlaps(pack(board.items, columns)), false);
  }
  const customized = { ...board, items: board.items.filter((item) => item.id !== 'calendar') };
  assert.equal(validBoard(customized, keys), true);
  assert.equal(customized.items.some((item) => item.id === 'calendar'), false);
  assert.equal(defaultBoard().items.length, 9);
});
