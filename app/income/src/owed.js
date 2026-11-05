// "老板欠我钱": overtime value derived from attendance facts plus manually logged message handling.
// Attendance-based seconds come from calculator.js; this module owns rates and messages.
// Rank titles live in the shared titles catalog (series "owed"), fed by the per-day amounts below.
export const OWED_KEY = 'dogcow.owed.v1';
export const DEFAULT_OVERTIME_CONFIG = Object.freeze({ enabled: false, workdayRate: 1.5, restRate: 2, holidayRate: 3, minMinutes: 5 });
const RATE_FIELDS = ['workdayRate', 'restRate', 'holidayRate'];
const MAX_MESSAGES = 2000;
const MAX_NOTE = 40;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const toNumber = (value) => typeof value === 'number' ? value
  : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  const pad = (n) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` === value;
}
function dateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Missing fields take defaults so older saved settings stay valid. */
export function validateOvertimeConfig(raw) {
  const input = record(raw) ? raw : {};
  const pick = (field) => Object.hasOwn(input, field) ? input[field] : DEFAULT_OVERTIME_CONFIG[field];
  const errors = {};
  const enabled = pick('enabled');
  if (typeof enabled !== 'boolean') errors.enabled = '请选择是否计算加班费。';
  const rates = {};
  for (const field of RATE_FIELDS) {
    const value = toNumber(pick(field));
    if (!Number.isFinite(value) || value < 1 || value > 10) errors[field] = '加班倍率需在 1 到 10 之间。';
    rates[field] = value;
  }
  const minMinutes = toNumber(pick('minMinutes'));
  if (!Number.isInteger(minMinutes) || minMinutes < 0 || minMinutes > 120) errors.minMinutes = '起算时长需为 0 到 120 的整数分钟。';
  if (Object.keys(errors).length) return { valid: false, config: null, errors };
  return { valid: true, config: { enabled, ...rates, minMinutes }, errors };
}

/**
 * @typedef {{ id: string, date: string, minutes: number, note: string, createdAt: number, updatedAt: number }} OwedEntry
 * `unlocked` is a legacy field from an unreleased build; kept so old local data still parses.
 * @typedef {{ version: 1, messages: OwedEntry[], unlocked: unknown[] }} OwedData
 * @returns {OwedData}
 */
export function emptyOwed() {
  return { version: 1, messages: [], unlocked: [] };
}

function validMessage(item) {
  return record(item) && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 64
    && validDate(item.date) && Number.isInteger(item.minutes) && item.minutes >= 1 && item.minutes <= 720
    && typeof item.note === 'string' && item.note.length <= MAX_NOTE
    && Number.isFinite(item.createdAt) && Number.isFinite(item.updatedAt);
}

/** Throws on invalid data so callers keep the original bytes instead of overwriting them. */
export function parseOwed(raw) {
  if (raw === null || raw === undefined) return emptyOwed();
  const data = JSON.parse(raw);
  const ids = new Set();
  if (!record(data) || data.version !== 1 || !Array.isArray(data.messages) || !Array.isArray(data.unlocked)
    || data.messages.length > MAX_MESSAGES
    || !data.messages.every((item) => validMessage(item) && !ids.has(item.id) && ids.add(item.id))
    || !data.unlocked.every(record)) {
    throw new Error('欠款记录格式无效。');
  }
  return structuredClone(data);
}

function messageFields(p, now) {
  const errors = {};
  const minutes = toNumber(p.minutes);
  const note = typeof p.note === 'string' ? p.note.trim() : '';
  if (!validDate(p.date)) errors.date = '请选择有效日期。';
  else if (p.date > dateKey(new Date(now))) errors.date = '不能记录未来的消息。';
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) errors.minutes = '时长需为 1 到 720 的整数分钟。';
  if (note.length > MAX_NOTE) errors.note = `备注最多 ${MAX_NOTE} 字。`;
  return { errors, fields: { date: p.date, minutes, note } };
}

/** Pure change: returns { data } or { errors, message } without touching the input. */
export function changeOwed(data, p, now, randomId) {
  const next = structuredClone(data);
  const action = p?.action;
  if (action === 'add' || action === 'edit') {
    const { errors, fields } = messageFields(p, now);
    if (Object.keys(errors).length) return { errors, message: Object.values(errors).join(' ') };
    if (action === 'add') {
      if (next.messages.length >= MAX_MESSAGES) return { errors: {}, message: '消息记录已达上限，请先删除旧记录。' };
      next.messages.push({ id: randomId(), ...fields, createdAt: now, updatedAt: now });
    } else {
      const item = next.messages.find((entry) => entry.id === p.id);
      if (!item) return { errors: {}, message: '这条记录已不存在。' };
      Object.assign(item, fields, { updatedAt: now });
    }
    return { data: next };
  }
  if (action === 'remove') {
    if (!next.messages.some((entry) => entry.id === p.id)) return { errors: {}, message: '这条记录已不存在。' };
    next.messages = next.messages.filter((entry) => entry.id !== p.id);
    return { data: next };
  }
  return { errors: {}, message: '欠款操作无效。' };
}

const rateFor = (config, kind) => kind === 'holiday' ? config.holidayRate
  : kind === 'weekend' ? config.restRate : config.workdayRate;

/**
 * Monthly view. `owedDays` comes from the calculator snapshot:
 * [{ date, kind, earlySeconds, lateSeconds, restSeconds }].
 */
export function owedSummary({ settings, snapshot, data, now }) {
  const config = validateOvertimeConfig(settings?.overtime).config ?? { ...DEFAULT_OVERTIME_CONFIG };
  const perSecond = Number(snapshot?.perSecond);
  const ready = Boolean(settings && snapshot && Number.isFinite(perSecond));
  const todayKey = dateKey(new Date(now));
  const month = todayKey.slice(0, 7);
  const threshold = config.minMinutes * 60;
  const kinds = new Map((snapshot?.owedDays ?? []).map((day) => [day.date, day.kind]));
  const parts = { early: 0, late: 0, rest: 0, message: 0 };
  const seconds = { early: 0, late: 0, rest: 0, message: 0 };
  /** @type {Record<string, number>} */
  const days = {};
  const add = (part, date, secs, rate) => {
    if (!(secs > 0)) return;
    const amount = ready ? secs * perSecond * rate : 0;
    seconds[part] += secs;
    parts[part] += amount;
    days[date] = (days[date] ?? 0) + amount;
  };
  for (const day of snapshot?.owedDays ?? []) {
    const rate = rateFor(config, day.kind);
    for (const [part, secs] of [['early', day.earlySeconds], ['late', day.lateSeconds], ['rest', day.restSeconds]]) {
      if (secs >= threshold) add(part, day.date, secs, rate);
    }
  }
  const messages = (data?.messages ?? [])
    .filter((item) => item.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .map((item) => {
      const rate = rateFor(config, kinds.get(item.date) ?? 'workday');
      add('message', item.date, item.minutes * 60, rate);
      return { ...item, amount: ready ? item.minutes * 60 * perSecond * rate : 0 };
    });
  const total = parts.early + parts.late + parts.rest + parts.message;
  return { ready, enabled: config.enabled, month, today: days[todayKey] ?? 0, total, parts, seconds, messages, days };
}

