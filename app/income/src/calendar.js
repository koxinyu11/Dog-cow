import holiday2026 from '../data/holidays/2026.json' with { type: 'json' };

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SNAPSHOTS = {
  2026: {
    data: holiday2026,
    updatedAt: Date.parse('2025-11-04T09:33:09Z'),
  },
};

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function isValidYear(year) {
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!isValidYear(year)) return false;
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validateHolidayData(raw, expectedYear) {
  if (!isValidYear(expectedYear) || !raw || raw.year !== expectedYear) {
    return { valid: false, reason: '节假日数据年份无效或不匹配。' };
  }
  if (!Array.isArray(raw.papers) || raw.papers.length === 0
      || !Array.from(raw.papers).every((paper) => typeof paper === 'string' && /^https?:\/\//.test(paper))) {
    return { valid: false, reason: '节假日安排尚未发布，或缺少来源文件。' };
  }
  if (!Array.isArray(raw.days) || raw.days.length === 0) {
    return { valid: false, reason: '节假日安排尚未发布，或日期数据为空。' };
  }

  const dates = new Map();
  for (const day of raw.days) {
    if (!day || !isValidDateKey(day.date) || typeof day.isOffDay !== 'boolean'
        || typeof day.name !== 'string' || day.name.trim() === '') {
      return { valid: false, reason: '节假日日期、名称或休息标记无效。' };
    }
    const previous = dates.get(day.date);
    if (previous && (previous.isOffDay !== day.isOffDay || previous.name !== day.name)) {
      return { valid: false, reason: '同一天存在互相冲突的节假日安排。' };
    }
    dates.set(day.date, { date: day.date, name: day.name, isOffDay: day.isOffDay });
  }

  return {
    valid: true,
    data: { year: raw.year, papers: [...raw.papers], days: [...dates.values()] },
  };
}

export function createCalendarContext(validDatasetsArray) {
  const readyYears = new Set();
  const overrides = {};
  for (const data of validDatasetsArray) {
    const checked = validateHolidayData(data, data?.year);
    if (!checked.valid) continue;
    readyYears.add(checked.data.year);
    for (const day of checked.data.days) {
      overrides[day.date] = { isOffDay: day.isOffDay, name: day.name };
    }
  }
  return { readyYears: [...readyYears].sort((a, b) => a - b), overrides };
}

export function getDayInfo(date, settings, context) {
  if (settings.calendarMode === 'cn') {
    if (!context?.readyYears?.includes(date.getFullYear())) {
      const error = new Error(`${date.getFullYear()} 年节假日与调休数据不可用，请重试或切换为每周排班模式。`);
      error.code = 'calendar-unavailable';
      throw error;
    }
    const override = context.overrides?.[dateKey(date)];
    if (override) {
      return {
        isWorkday: !override.isOffDay,
        kind: override.isOffDay ? 'holiday' : 'makeup',
        name: override.name,
      };
    }
  }
  const isWorkday = settings.workdays.includes(date.getDay());
  return { isWorkday, kind: isWorkday ? 'workday' : 'weekend', name: '' };
}

export function getMonthPlan(settings, year, monthIndex0, context) {
  if (!isValidYear(year) || !Number.isInteger(monthIndex0) || monthIndex0 < 0 || monthIndex0 > 11) {
    throw new RangeError('请选择有效的年份和月份。');
  }
  const days = [];
  const monthLength = new Date(year, monthIndex0 + 1, 0, 12).getDate();
  for (let day = 1; day <= monthLength; day += 1) {
    const date = new Date(year, monthIndex0, day, 12);
    days.push({ date: dateKey(date), ...getDayInfo(date, settings, context) });
  }
  return { year, month: monthIndex0 + 1, workdayCount: days.filter((day) => day.isWorkday).length, days };
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readCache(storage, year) {
  try {
    const saved = JSON.parse(storage?.getItem(`niuma-calculator.holidays.v1.${year}`) ?? 'null');
    if (!saved || saved.version !== CACHE_VERSION || saved.year !== year
        || !Number.isFinite(saved.checkedAt) || saved.checkedAt < 0) return null;
    if (saved.data === null) return { ...saved, updatedAt: null };
    const checked = validateHolidayData(saved.data, year);
    if (!checked.valid || !Number.isFinite(saved.updatedAt) || saved.updatedAt < 0) return null;
    return { ...saved, data: checked.data };
  } catch {
    return null;
  }
}

function writeCache(storage, year, record) {
  try {
    storage?.setItem(`niuma-calculator.holidays.v1.${year}`, JSON.stringify({ version: CACHE_VERSION, year, ...record }));
  } catch {
    // Calendar data remains usable when browser storage is denied or full.
  }
}

async function fetchYear(url, year, fetchImpl, timeoutMs) {
  if (typeof fetchImpl !== 'function') return null;
  const controller = new AbortController();
  let timeout;
  try {
    const request = (async () => {
      const response = await fetchImpl(url, { signal: controller.signal, cache: 'no-cache' });
      if (!response?.ok) return null;
      const checked = validateHolidayData(await response.json(), year);
      return checked.valid ? checked.data : null;
    })();
    const timedOut = new Promise((resolve) => {
      timeout = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, timeoutMs);
    });
    return await Promise.race([request, timedOut]);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadHolidayYear(year, {
  fetchImpl = globalThis.fetch,
  storage,
  now = Date.now(),
  force = false,
  timeoutMs = 4000,
} = {}) {
  if (!isValidYear(year)) return { status: 'unavailable', updatedAt: null, refreshFailed: true };
  const target = resolveStorage(storage);
  const cached = readCache(target, year);
  const fresh = cached && now >= cached.checkedAt && now - cached.checkedAt < CACHE_TTL_MS;
  if (!force && fresh) {
    return cached.data
      ? { status: 'ready', data: cached.data, source: 'cache', updatedAt: cached.updatedAt, refreshFailed: Boolean(cached.refreshFailed) }
      : { status: 'unavailable', updatedAt: null, refreshFailed: true };
  }

  const endpoints = [
    `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
    `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
  ];
  for (const url of endpoints) {
    const data = await fetchYear(url, year, fetchImpl, timeoutMs);
    if (data) {
      writeCache(target, year, { checkedAt: now, updatedAt: now, data, refreshFailed: false });
      return { status: 'ready', data, source: 'network', updatedAt: now, refreshFailed: false };
    }
  }

  if (cached?.data) {
    writeCache(target, year, { checkedAt: now, updatedAt: cached.updatedAt, data: cached.data, refreshFailed: true });
    return { status: 'ready', data: cached.data, source: 'cache', updatedAt: cached.updatedAt, refreshFailed: true };
  }

  const snapshot = SNAPSHOTS[year];
  if (snapshot) {
    const checked = validateHolidayData(snapshot.data, year);
    if (checked.valid) {
      const data = checked.data;
      writeCache(target, year, { checkedAt: now, updatedAt: snapshot.updatedAt, data, refreshFailed: true });
      return { status: 'ready', data, source: 'snapshot', updatedAt: snapshot.updatedAt, refreshFailed: true };
    }
  }

  writeCache(target, year, { checkedAt: now, updatedAt: null, data: null, refreshFailed: true });
  return { status: 'unavailable', updatedAt: null, refreshFailed: true };
}
