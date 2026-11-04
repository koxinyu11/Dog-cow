import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateHolidayData, createCalendarContext, getDayInfo, getMonthPlan, loadHolidayYear,
} from '../../app/income/src/calendar.js';

const raw2026 = JSON.parse(await readFile(new URL('../../app/income/data/holidays/2026.json', import.meta.url), 'utf8'));
const settings = { calendarMode: 'cn', workdays: [1, 2, 3, 4, 5] };
const context = createCalendarContext([raw2026]);
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-04T04:00:00Z');
const response = (data) => ({ ok: true, json: async () => structuredClone(data) });

function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}

test('actual 2026 snapshot has a source and valid holiday/makeup dates', () => {
  const result = validateHolidayData(raw2026, 2026);
  assert.equal(result.valid, true);
  assert.equal(result.data.days.filter((day) => day.isOffDay).length, 33);
  assert.equal(result.data.days.filter((day) => !day.isOffDay).length, 6);
});

for (const [month, expected] of [[2, 16], [5, 19], [10, 18], [11, 21]]) {
  test(`2026-${String(month).padStart(2, '0')} has ${expected} working days including adjustments`, () => {
    const plan = getMonthPlan(settings, 2026, month - 1, context);
    assert.equal(plan.workdayCount, expected);
    assert.equal(plan.year, 2026);
    assert.equal(plan.month, month);
    assert.equal(plan.days.length, new Date(2026, month, 0).getDate());
  });
}

test('national holiday and Saturday makeup workday override weekly settings', () => {
  assert.deepEqual(getDayInfo(new Date(2026, 1, 28, 12), settings, context), {
    isWorkday: true, kind: 'makeup', name: '春节',
  });
  assert.deepEqual(getDayInfo(new Date(2026, 9, 1, 12), settings, context), {
    isWorkday: false, kind: 'holiday', name: '国庆节',
  });
  const custom = { ...settings, workdays: [4] };
  assert.equal(getDayInfo(new Date(2026, 0, 1, 12), custom, context).isWorkday, false);
  assert.equal(getDayInfo(new Date(2026, 1, 28, 12), custom, context).isWorkday, true);
});

test('weekly mode ignores national adjustments and accepts a custom week without calendar data', () => {
  const weekly = { calendarMode: 'weekly', workdays: [0] };
  assert.deepEqual(getDayInfo(new Date(2026, 10, 1, 12), weekly), {
    isWorkday: true, kind: 'workday', name: '',
  });
  assert.equal(getDayInfo(new Date(2026, 1, 28, 12), weekly, context).isWorkday, false);
  assert.equal(getMonthPlan(weekly, 2026, 10).workdayCount, 5);
});

test('cn mode reports a missing year instead of assuming normal weekdays', () => {
  assert.throws(() => getDayInfo(new Date(2027, 0, 1, 12), settings, context), {
    code: 'calendar-unavailable',
  });
});

test('rejects unpublished, malformed and conflicting year data', () => {
  for (const raw of [
    { year: 2027, papers: [], days: [] },
    { ...raw2026, year: '2026' },
    { ...raw2026, papers: [] },
    { ...raw2026, days: [] },
    { ...raw2026, days: [{ date: '2026-02-30', name: '无效日期', isOffDay: true }] },
    { ...raw2026, days: [{ date: '2026-01-01', name: '元旦', isOffDay: 'true' }] },
    { ...raw2026, days: [
      { date: '2026-01-01', name: '元旦', isOffDay: true },
      { date: '2026-01-01', name: '元旦', isOffDay: false },
    ] },
  ]) {
    const expectedYear = raw.year === 2027 ? 2027 : 2026;
    const result = validateHolidayData(raw, expectedYear);
    assert.equal(result.valid, false);
    assert.ok(result.reason);
  }
});

test('later adjacent-year data can override a December date', () => {
  const first = {
    year: 2026, papers: ['https://example.com/test-2026'],
    days: [{ date: '2026-12-31', name: '测试原安排', isOffDay: false }],
  };
  const next = {
    year: 2027, papers: ['https://example.com/test-2027'],
    days: [
      { date: '2026-12-31', name: '测试次年通知', isOffDay: true },
      { date: '2027-01-01', name: '测试次年通知', isOffDay: true },
    ],
  };
  const combined = createCalendarContext([first, next]);
  assert.deepEqual(combined.readyYears, [2026, 2027]);
  assert.deepEqual(getDayInfo(new Date(2026, 11, 31, 12), settings, combined), {
    isWorkday: false, kind: 'holiday', name: '测试次年通知',
  });
});

test('valid data is fetched, cached for 24 hours, then refreshed', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(raw2026); };
  const first = await loadHolidayYear(2026, { fetchImpl, storage, now: NOW });
  assert.equal(first.source, 'network');
  assert.equal(first.updatedAt, NOW);
  const fresh = await loadHolidayYear(2026, { fetchImpl, storage, now: NOW + DAY_MS - 1 });
  assert.equal(fresh.source, 'cache');
  assert.equal(calls, 1);
  const refreshed = await loadHolidayYear(2026, { fetchImpl, storage, now: NOW + DAY_MS });
  assert.equal(refreshed.source, 'network');
  assert.equal(refreshed.updatedAt, NOW + DAY_MS);
  assert.equal(calls, 2);
  await loadHolidayYear(2026, { fetchImpl, storage, now: NOW + DAY_MS + 1, force: true });
  assert.equal(calls, 3);
});

test('jsDelivr is attempted if the raw endpoint fails', async () => {
  const requested = [];
  const result = await loadHolidayYear(2026, {
    storage: memoryStorage(), now: NOW,
    fetchImpl: async (url) => {
      requested.push(url);
      if (url.startsWith('https://raw.')) throw new Error('unreachable');
      return response(raw2026);
    },
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'network');
  assert.equal(requested.length, 2);
  assert.match(requested[1], /^https:\/\/cdn\.jsdelivr\.net\//);
});

test('expired valid cache survives remote refresh failures', async () => {
  const storage = memoryStorage();
  await loadHolidayYear(2026, { storage, now: NOW, fetchImpl: async () => response(raw2026) });
  let calls = 0;
  const result = await loadHolidayYear(2026, {
    storage, now: NOW + DAY_MS,
    fetchImpl: async () => { calls += 1; throw new Error('offline'); },
  });
  assert.equal(result.source, 'cache');
  assert.equal(result.refreshFailed, true);
  assert.equal(result.updatedAt, NOW);
  assert.equal(calls, 2);
});

test('2026 bundled memory snapshot remains available when both remote endpoints fail', async () => {
  const storage = memoryStorage();
  const requested = [];
  const result = await loadHolidayYear(2026, {
    storage, now: NOW,
    fetchImpl: async (url) => {
      requested.push(url);
      throw new Error('remote network unavailable');
    },
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'snapshot');
  assert.equal(result.refreshFailed, true);
  assert.ok(Number.isFinite(result.updatedAt));
  assert.deepEqual(result.data, validateHolidayData(raw2026, 2026).data);
  assert.equal(requested.length, 2);
  assert.equal(requested.every((url) => url.startsWith('https://')), true);
  const cached = await loadHolidayYear(2026, {
    storage, now: NOW + 1,
    fetchImpl: async () => { throw new Error('fresh snapshot cache must not fetch'); },
  });
  assert.equal(cached.source, 'cache');
  assert.deepEqual(cached.data, result.data);
});

test('without fetch capability the bundled 2026 snapshot is validated and cached offline', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const storage = memoryStorage();
  try {
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: undefined });
    const result = await loadHolidayYear(2026, { storage, now: NOW });
    assert.equal(result.status, 'ready');
    assert.equal(result.source, 'snapshot');
    assert.equal(result.refreshFailed, true);
    assert.deepEqual(result.data, validateHolidayData(raw2026, 2026).data);
    assert.equal((await loadHolidayYear(2026, { storage, now: NOW + 1 })).source, 'cache');
    assert.equal((await loadHolidayYear(2027, { storage, now: NOW })).status, 'unavailable');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'fetch', descriptor);
    else delete globalThis.fetch;
  }
});

test('empty 2027 data stays unavailable and caches the unsuccessful check for a day', async () => {
  const storage = memoryStorage();
  const requested = [];
  const fetchImpl = async (url) => { requested.push(url); return response({ year: 2027, papers: [], days: [] }); };
  const first = await loadHolidayYear(2027, { storage, fetchImpl, now: NOW });
  assert.equal(first.status, 'unavailable');
  assert.equal(first.updatedAt, null);
  assert.equal(requested.length, 2);
  assert.equal(requested.some((url) => url.includes('/data/holidays/')), false);
  await loadHolidayYear(2027, { storage, fetchImpl, now: NOW + 1 });
  assert.equal(requested.length, 2);
  await loadHolidayYear(2027, { storage, fetchImpl, now: NOW + 2, force: true });
  assert.equal(requested.length, 4);
});

test('without remote data, valid cache or a bundled year the result is explicitly unavailable', async () => {
  const result = await loadHolidayYear(2027, {
    storage: memoryStorage(), now: NOW,
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.deepEqual(result, { status: 'unavailable', updatedAt: null, refreshFailed: true });
});

test('storage methods or the localStorage getter being denied do not block network data', async () => {
  const denied = {
    getItem() { throw new Error('read denied'); },
    setItem() { throw new Error('write denied'); },
  };
  const options = { now: NOW, fetchImpl: async () => response(raw2026) };
  assert.equal((await loadHolidayYear(2026, { ...options, storage: denied })).source, 'network');

  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, get() { throw new Error('getter denied'); },
    });
    assert.equal((await loadHolidayYear(2026, options)).source, 'network');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('each stalled remote endpoint times out before the memory snapshot is used', async () => {
  let calls = 0;
  const result = await loadHolidayYear(2026, {
    storage: memoryStorage(), now: NOW, timeoutMs: 5,
    fetchImpl: async () => { calls += 1; return new Promise(() => {}); },
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'snapshot');
  assert.equal(calls, 2);
});
