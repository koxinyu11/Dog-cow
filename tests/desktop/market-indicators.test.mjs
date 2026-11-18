import test from 'node:test';
import assert from 'node:assert/strict';
import { recordCandle, aggregateCandles, movingAverage, exponentialAverage, macd } from '../../dist-electron/src/shared/market/indicators.js';
import { createPlayableMarket } from '../../dist-electron/src/shared/market/playable.js';
import { stepMarket } from '../../dist-electron/src/shared/market/simulation.js';

test('OHLC bars retain actual opens/extremes/closes and sum executed volume across five minutes', () => {
  const bars = [];
  recordCandle(bars, 1, 10, 12, 3);
  recordCandle(bars, 2, 12, 9, 4);
  recordCandle(bars, 5, 9, 11, 2);
  assert.deepEqual(bars, [{ time: 0, open: 10, high: 12, low: 9, close: 11, volume: 9 }]);
  recordCandle(bars, 6, 11, 11, 0);
  assert.deepEqual(bars[1], { time: 5, open: 11, high: 11, low: 11, close: 11, volume: 0 });
});

test('history is bounded and aggregation preserves price extrema and total volume without mutating source', () => {
  const bars = [];
  for (let i = 0; i < 300; i++) recordCandle(bars, i * 5 + 1, 100 + i, 101 + i, i);
  assert.equal(bars.length, 289);
  const original = structuredClone(bars);
  const aggregated = aggregateCandles(bars, 15);
  assert.deepEqual(bars, original);
  assert.equal(aggregated.reduce((sum, b) => sum + b.volume, 0), bars.reduce((sum, b) => sum + b.volume, 0));
  assert.equal(aggregated[0].open, bars[0].open);
  assert.equal(aggregated.at(-1).close, bars.at(-1).close);
  assert.equal(Math.max(...aggregated.map(b => b.high)), Math.max(...bars.map(b => b.high)));
  assert.throws(() => aggregateCandles(bars, 7), /周期无效/);
});

test('SMA and EMA use correct warm-up and independent closed-form expectations', () => {
  assert.deepEqual(movingAverage([1,2,3,4,5], 3), [null,null,2,3,4]);
  assert.deepEqual(exponentialAverage([1,2,3,4,5], 3), [null,null,2,3,4]);
  assert.deepEqual(exponentialAverage([null,1,2,3,null,4,5,6], 3), [null,null,null,2,null,null,null,5]);
  assert.throws(() => movingAverage([1], 0), /周期无效/);
});

test('MACD linear ramp has DIF=7, DEA=7 and zero histogram after full SMA-seeded warm-up', () => {
  const { dif, dea, histogram } = macd(Array.from({ length: 60 }, (_, i) => i + 1));
  assert.ok(dif.slice(0, 25).every(v => v === null));
  assert.ok(dea.slice(0, 33).every(v => v === null));
  assert.ok(Math.abs(dif[25] - 7) < 1e-10);
  assert.ok(Math.abs(dea[33] - 7) < 1e-10);
  assert.ok(histogram.slice(33).every(v => Math.abs(v) < 1e-10));
  const flat = macd(Array(60).fill(100));
  assert.ok(flat.histogram.slice(33).every(v => v === 0));
  assert.ok(macd([1,2]).histogram.every(v => v === null));
});

test('real auction candles match executed trade totals and observed price extrema', () => {
  const market = createPlayableMarket(37);
  const ids = [0, 240], expected = ids.map(id => ({ open: market.securities[id].price, prices: [market.securities[id].price], volume: 0 }));
  for (let i = 0; i < 5; i++) {
    const trades = stepMarket(market);
    ids.forEach((id, index) => {
      expected[index].prices.push(market.securities[id].price);
      expected[index].volume += trades.filter(t => t.security === id).reduce((sum, t) => sum + t.quantity, 0);
    });
  }
  ids.forEach((id, index) => {
    const e = expected[index], bar = market.securities[id].candles[0];
    assert.equal(bar.open, e.open);
    assert.equal(bar.close, e.prices.at(-1));
    assert.equal(bar.high, Math.max(...e.prices));
    assert.equal(bar.low, Math.min(...e.prices));
    assert.equal(bar.volume, e.volume);
  });
});
