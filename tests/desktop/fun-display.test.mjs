import test from 'node:test';
import assert from 'node:assert/strict';
import { treatShelf, goalSpan, spanText, SHELF_MAX } from '../../dist-electron/src/shared/fun-display.js';
import { treatCount, goalMonths } from '../../dist-electron/src/shared/fun.js';

test('treat shelf keeps treatCount and derives progress to the next item', () => {
  const shelf = treatShelf(18, 333.5);
  assert.equal(shelf.count, treatCount(18, 333.5));
  assert.equal(shelf.whole, 18);
  assert.ok(Math.abs(shelf.fraction - 0.5277) < 0.001);
  assert.equal(shelf.remaining, 8.5);
  assert.equal(shelf.shown, SHELF_MAX);
  assert.equal(shelf.overflow, true);
});

test('treat shelf handles zero, exact multiples, negatives and missing data', () => {
  assert.deepEqual(treatShelf(18, 0), { count: 0, whole: 0, fraction: 0, remaining: 18, shown: 0, overflow: false });
  const exact = treatShelf(30, 90);
  assert.equal(exact.whole, 3); assert.equal(exact.fraction, 0); assert.equal(exact.remaining, 30);
  assert.equal(treatShelf(18, -5).remaining, 18);
  assert.equal(treatShelf(18, null), null);
  assert.equal(treatShelf(18, Number.NaN), null);
  assert.ok(treatShelf(0.03, 0.1).remaining >= 0.01);
});

test('goal span uses month cells up to 12 and year cells beyond, bounded', () => {
  const short = goalSpan(6000, 10000);
  assert.equal(short.months, goalMonths(6000, 10000));
  assert.deepEqual([short.unit, short.cells, short.filled], ['month', 12, 1]);
  assert.equal(spanText(short), '1 个月');
  const twelve = goalSpan(120000, 10000);
  assert.deepEqual([twelve.unit, spanText(twelve)], ['month', '12 个月']);
  const mid = goalSpan(150000, 10000);
  assert.deepEqual([mid.unit, mid.years, mid.rest, mid.cells, spanText(mid)], ['year', 1, 3, 2, '1 年 3 个月']);
  const even = goalSpan(240000, 10000);
  assert.equal(spanText(even), '2 年');
  const huge = goalSpan(100000000, 5000);
  assert.deepEqual([huge.cells, huge.filled, huge.overflow], [SHELF_MAX, SHELF_MAX, true]);
  assert.equal(goalSpan(6000, 0), null);
  assert.equal(goalSpan(6000, undefined), null);
});
