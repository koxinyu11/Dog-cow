import type { Candle } from './model.js';

/** Five-minute bars record actual auction closes; zero-trade bars carry zero volume.
 * Ex-dividend gaps remain visible (unadjusted). Never backfill OHLC from closing-only history. */
export function recordCandle(bars: Candle[], minute: number, open: number, close: number, volume: number): Candle[] {
  const time = Math.floor((minute - 1) / 5) * 5;
  const last = bars.at(-1);
  if (last?.time === time) {
    last.high = Math.max(last.high, open, close);
    last.low = Math.min(last.low, open, close);
    last.close = close;
    last.volume += volume;
  } else {
    bars.push({ time, open, high: Math.max(open, close), low: Math.min(open, close), close, volume });
    if (bars.length > 289) bars.shift();
  }
  return bars;
}

export function aggregateCandles(bars: readonly Candle[], minutes: number): Candle[] {
  if (![5, 15, 30, 60].includes(minutes)) throw Error('K线周期无效。');
  const result: Candle[] = [];
  for (const bar of bars) {
    const time = Math.floor(bar.time / minutes) * minutes;
    const last = result.at(-1);
    if (last?.time === time) { last.high = Math.max(last.high, bar.high); last.low = Math.min(last.low, bar.low); last.close = bar.close; last.volume += bar.volume; }
    else result.push({ ...bar, time });
  }
  return result;
}

export function movingAverage(values: readonly number[], period: number): (number | null)[] {
  if (!Number.isSafeInteger(period) || period < 1) throw Error('均线周期无效。');
  let sum = 0;
  return values.map((value, i) => { sum += value; if (i >= period) sum -= values[i - period]; return i + 1 < period ? null : sum / period; });
}

/** SMA-seeded EMA; null warm-up propagates to dependent signals rather than drawing fake zeros. */
export function exponentialAverage(values: readonly (number | null)[], period: number): (number | null)[] {
  if (!Number.isSafeInteger(period) || period < 1) throw Error('EMA周期无效。');
  let sum = 0, samples = 0, previous: number | null = null;
  const alpha = 2 / (period + 1);
  return values.map(value => {
    if (value === null) { sum = 0; samples = 0; previous = null; return null; }
    if (previous === null) {
      sum += value; samples++;
      if (samples < period) return null;
      previous = sum / period;
    } else previous = value * alpha + previous * (1 - alpha);
    return previous;
  });
}

export function macd(values: readonly number[]) {
  const fast = exponentialAverage(values, 12), slow = exponentialAverage(values, 26);
  const dif = fast.map((value, i) => value === null || slow[i] === null ? null : value - slow[i]!);
  const dea = exponentialAverage(dif, 9);
  const histogram = dif.map((value, i) => value === null || dea[i] === null ? null : 2 * (value - dea[i]!));
  return { dif, dea, histogram };
}
