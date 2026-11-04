import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttendance } from '../../app/income/src/attendance.js';
import { validateSettings } from '../../app/income/src/calculator.js';
import { loadSettings, saveSettings, SETTINGS_KEY, PREVIOUS_SETTINGS_KEY, V2_SETTINGS_KEY, LEGACY_SETTINGS_KEY } from '../../app/income/src/storage.js';

const previousSettings = {
  monthlySalary: 8800, startTime: '09:00', endTime: '17:00',
  workdays: [1, 2, 3, 4, 5], calendarMode: 'cn',
};
const v3Settings = { ...previousSettings, lunchCountsAsWork: true, lunchStartTime: '12:00', lunchEndTime: '13:00' };
const settings = validateSettings(v3Settings).settings;
const leaves = [
  { id: 'leave-1', date: '2026-11-04', fullDay: false, startTime: '10:00', endTime: '12:00', paid: false },
  { id: 'leave-2', date: '2026-11-05', fullDay: true, startTime: '', endTime: '', paid: true },
];
const time = (hour, minute = 0, day = 4) => new Date(2026, 10, day, hour, minute).getTime();
const fact = (at) => ({ at, recordedAt: at, updatedAt: at, source: 'recorded' });
const attendance = {
  trackingFrom: '2026-11-04',
  days: [{
    date: '2026-11-04', clockIn: fact(time(9)), clockOut: fact(time(18)),
    breaks: [{ id: 'rest-1', start: fact(time(12)), end: fact(time(13)) }],
  }],
  modeDays: [{ date: '2026-11-04', stealMode: true, clockMode: true }],
};
const oldAttendance = {
  trackingFrom: '2026-11-04', days: [{ date: '2026-11-04', events: [
    { type: 'start', at: time(9) }, { type: 'pause', at: time(12) },
    { type: 'resume', at: time(13) }, { type: 'finish', at: time(18) },
  ] }],
};
const legacy = { ...previousSettings, monthlyWorkdays: 22 };
delete legacy.calendarMode;
const migrationTime = new Date(2026, 10, 4, 0, 5);

function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}

test('版本 4 单快照保存工资、请假、上下班事实和逐日模式', () => {
  const storage = memoryStorage();
  assert.equal(SETTINGS_KEY, 'niuma-calculator.settings.v4');
  assert.equal(PREVIOUS_SETTINGS_KEY, 'niuma-calculator.settings.v3');
  assert.equal(V2_SETTINGS_KEY, 'niuma-calculator.settings.v2');
  assert.equal(LEGACY_SETTINGS_KEY, 'niuma-calculator.settings.v1');
  assert.deepEqual(loadSettings(storage), { status: 'empty' });
  assert.deepEqual(saveSettings(settings, leaves, attendance, storage), { ok: true });
  assert.deepEqual(JSON.parse(storage.getItem(SETTINGS_KEY)), { version: 4, settings, leaves, attendance });
  assert.deepEqual(loadSettings(storage), { status: 'loaded', settings, leaves, attendance });
});

test('缺省设置被规范化，空请假和空事实记录合法', () => {
  const storage = memoryStorage();
  const emptyAttendance = createAttendance(migrationTime);
  assert.deepEqual(saveSettings(previousSettings, [], emptyAttendance, storage), { ok: true });
  assert.deepEqual(loadSettings(storage), { status: 'loaded', settings, leaves: [], attendance: emptyAttendance });
});

test('v3 事件迁移保留每个实际时间，补模式默认且三个旧版备份原样保留', () => {
  const storage = memoryStorage();
  const previous = JSON.stringify({ version: 3, settings: v3Settings, leaves, attendance: oldAttendance });
  const v2 = JSON.stringify({ version: 2, settings: previousSettings, leaves });
  const v1 = JSON.stringify({ version: 1, settings: legacy });
  storage.setItem(PREVIOUS_SETTINGS_KEY, previous);
  storage.setItem(V2_SETTINGS_KEY, v2);
  storage.setItem(LEGACY_SETTINGS_KEY, v1);

  const migrated = loadSettings(storage, migrationTime);
  assert.equal(migrated.status, 'migration');
  assert.deepEqual(migrated.settings, settings);
  assert.equal(migrated.settings.stealMode, false);
  assert.equal(migrated.settings.clockMode, false);
  assert.equal(migrated.settings.salaryMode, 'net');
  assert.deepEqual(migrated.leaves, leaves);
  const day = migrated.attendance.days[0];
  assert.deepEqual(day.clockIn, fact(time(9)));
  assert.deepEqual(day.breaks[0].start, fact(time(12)));
  assert.deepEqual(day.breaks[0].end, fact(time(13)));
  assert.deepEqual(day.clockOut, fact(time(18)));
  assert.deepEqual(migrated.attendance.modeDays, []);
  assert.equal(storage.getItem(SETTINGS_KEY), null);
  assert.deepEqual(saveSettings(migrated.settings, migrated.leaves, migrated.attendance, storage), { ok: true });
  assert.equal(storage.getItem(PREVIOUS_SETTINGS_KEY), previous);
  assert.equal(storage.getItem(V2_SETTINGS_KEY), v2);
  assert.equal(storage.getItem(LEGACY_SETTINGS_KEY), v1);
});

test('v2 迁移保留请假并按本地今日创建新的事实起算日期', () => {
  const storage = memoryStorage();
  const original = JSON.stringify({ version: 2, settings: previousSettings, leaves });
  storage.setItem(V2_SETTINGS_KEY, original);
  const migrated = loadSettings(storage, migrationTime);
  assert.deepEqual(migrated, {
    status: 'migration', settings, leaves,
    attendance: { trackingFrom: '2026-11-04', days: [], modeDays: [] },
  });
  assert.equal(storage.getItem(SETTINGS_KEY), null);
  assert.deepEqual(saveSettings(migrated.settings, migrated.leaves, migrated.attendance, storage), { ok: true });
  assert.equal(storage.getItem(V2_SETTINGS_KEY), original);
});

test('仅 v1 时迁移工资和排班并保留原始备份', () => {
  const storage = memoryStorage();
  const original = JSON.stringify({ version: 1, settings: legacy });
  storage.setItem(LEGACY_SETTINGS_KEY, original);
  const migrated = loadSettings(storage, migrationTime);
  assert.deepEqual(migrated, {
    status: 'migration', settings, leaves: [],
    attendance: { trackingFrom: '2026-11-04', days: [], modeDays: [] },
  });
  assert.deepEqual(saveSettings(migrated.settings, migrated.leaves, migrated.attendance, storage), { ok: true });
  assert.equal(storage.getItem(LEGACY_SETTINGS_KEY), original);
});

test('v4 有效快照优先于旧版备份', () => {
  const storage = memoryStorage();
  storage.setItem(PREVIOUS_SETTINGS_KEY, JSON.stringify({ version: 3, settings: { ...v3Settings, monthlySalary: 1234 }, leaves: [], attendance: oldAttendance }));
  assert.deepEqual(saveSettings(settings, leaves, attendance, storage), { ok: true });
  assert.deepEqual(loadSettings(storage), { status: 'loaded', settings, leaves, attendance });
});

test('v1 溢出或无效折算天数不能迁移，原数据不变', () => {
  const storage = memoryStorage();
  for (const invalid of [
    { ...legacy, monthlyWorkdays: '1e-320' },
    { ...legacy, monthlySalary: Number.MAX_VALUE, monthlyWorkdays: 0.01 },
    { ...legacy, monthlyWorkdays: 0 }, { ...legacy, monthlyWorkdays: '' },
    { ...legacy, monthlyWorkdays: 'Infinity' }, { ...legacy, monthlyWorkdays: true },
  ]) {
    const original = JSON.stringify({ version: 1, settings: invalid });
    storage.setItem(LEGACY_SETTINGS_KEY, original);
    assert.deepEqual(loadSettings(storage, migrationTime), { status: 'invalid' });
    assert.equal(storage.getItem(LEGACY_SETTINGS_KEY), original);
    assert.equal(storage.getItem(SETTINGS_KEY), null);
  }
});

test('v1 损坏、错误版本和无效排班不能迁移', () => {
  const storage = memoryStorage();
  for (const serialized of [
    '{', 'null', JSON.stringify({ version: 2, settings: legacy }),
    JSON.stringify({ version: 1, settings: { ...legacy, endTime: '08:00' } }),
    JSON.stringify({ version: 1, settings: { ...legacy, workdays: [] } }),
  ]) {
    storage.setItem(LEGACY_SETTINGS_KEY, serialized);
    assert.deepEqual(loadSettings(storage, migrationTime), { status: 'invalid' });
  }
});

test('v2 损坏时不降级到 v1，也不丢弃非法请假', () => {
  const storage = memoryStorage();
  storage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify({ version: 1, settings: legacy }));
  for (const serialized of [
    '{', 'null', JSON.stringify({ version: 2, settings: previousSettings }),
    JSON.stringify({ version: 2, settings: previousSettings, leaves: [leaves[0], leaves[0]] }),
  ]) {
    storage.setItem(V2_SETTINGS_KEY, serialized);
    assert.deepEqual(loadSettings(storage, migrationTime), { status: 'invalid' });
    assert.equal(storage.getItem(V2_SETTINGS_KEY), serialized);
  }
});

test('v3 缺失或错误事件链不静默降级到 v2', () => {
  const storage = memoryStorage();
  storage.setItem(V2_SETTINGS_KEY, JSON.stringify({ version: 2, settings: previousSettings, leaves }));
  for (const invalidAttendance of [
    undefined, null, {},
    { trackingFrom: '2026-11-04', days: [{ date: '2026-11-04', events: [{ type: 'pause', at: time(12) }] }] },
  ]) {
    const original = JSON.stringify({ version: 3, settings: v3Settings, leaves, attendance: invalidAttendance });
    storage.setItem(PREVIOUS_SETTINGS_KEY, original);
    assert.deepEqual(loadSettings(storage, migrationTime), { status: 'invalid' });
    assert.equal(storage.getItem(PREVIOUS_SETTINGS_KEY), original);
  }
});

test('v4 坏数据、缺字段或缺 modeDays 时不回退旧版', () => {
  const storage = memoryStorage();
  storage.setItem(PREVIOUS_SETTINGS_KEY, JSON.stringify({ version: 3, settings: v3Settings, leaves, attendance: oldAttendance }));
  for (const serialized of [
    '{', 'null', JSON.stringify({ version: 9, settings, leaves, attendance }),
    JSON.stringify({ version: 4, settings: { ...settings, monthlySalary: -1 }, leaves, attendance }),
    JSON.stringify({ version: 4, settings, leaves }),
    JSON.stringify({ version: 4, settings, attendance }),
    JSON.stringify({ version: 4, settings, leaves, attendance: { trackingFrom: attendance.trackingFrom, days: attendance.days } }),
  ]) {
    storage.setItem(SETTINGS_KEY, serialized);
    assert.deepEqual(loadSettings(storage), { status: 'invalid' });
    assert.equal(storage.getItem(SETTINGS_KEY), serialized);
  }
});

test('v4 无效、重复或重叠请假不能部分恢复', () => {
  const storage = memoryStorage();
  for (const invalidLeaves of [
    null, {}, [{ ...leaves[0], date: '2026-02-30' }],
    [leaves[0], { ...leaves[1], id: leaves[0].id }],
    [leaves[0], { ...leaves[0], id: 'overlap', startTime: '11:00', endTime: '13:00' }],
  ]) {
    const serialized = JSON.stringify({ version: 4, settings, leaves: invalidLeaves, attendance });
    storage.setItem(SETTINGS_KEY, serialized);
    assert.deepEqual(loadSettings(storage), { status: 'invalid' });
    assert.equal(storage.getItem(SETTINGS_KEY), serialized);
  }
});

test('v4 无效实际事实和模式组合不能载入', () => {
  const storage = memoryStorage();
  for (const invalidAttendance of [
    null, {}, { ...attendance, trackingFrom: '2026-02-30' },
    { ...attendance, days: [{ ...attendance.days[0], clockIn: null }] },
    { ...attendance, modeDays: [{ date: '2026-11-04', stealMode: false, clockMode: true }] },
  ]) {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 4, settings, leaves, attendance: invalidAttendance }));
    assert.deepEqual(loadSettings(storage), { status: 'invalid' });
  }
});

test('拒写失败保留完整工资、请假、模式和原始事实', () => {
  const storage = memoryStorage();
  assert.deepEqual(saveSettings(settings, leaves, attendance, storage), { ok: true });
  const previous = storage.getItem(SETTINGS_KEY);
  storage.setItem = () => { throw new Error('quota exceeded'); };
  const next = { ...settings, monthlySalary: 17600 };
  const nextLeaves = [{ ...leaves[0], paid: true }];
  const nextAttendance = structuredClone(attendance);
  nextAttendance.modeDays[0].clockMode = false;
  assert.deepEqual(saveSettings(next, nextLeaves, nextAttendance, storage), { ok: false, reason: 'unavailable' });
  assert.equal(storage.getItem(SETTINGS_KEY), previous);
  assert.equal(next.monthlySalary, 17600);
  assert.equal(nextLeaves[0].paid, true);
  assert.equal(nextAttendance.modeDays[0].clockMode, false);
  assert.deepEqual(loadSettings(storage), { status: 'loaded', settings, leaves, attendance });
});

test('缺失或非法记录在写入前拒绝，不覆盖有效快照', () => {
  const storage = memoryStorage();
  assert.deepEqual(saveSettings(settings, leaves, attendance, storage), { ok: true });
  const previous = storage.getItem(SETTINGS_KEY);
  for (const [nextSettings, nextLeaves, nextAttendance] of [
    [{ ...settings, monthlySalary: -1 }, [], attendance],
    [settings, [leaves[0], leaves[0]], attendance],
    [settings, leaves, undefined], [settings, undefined, attendance],
    [settings, leaves, { trackingFrom: 'bad', days: [], modeDays: [] }],
  ]) {
    assert.deepEqual(saveSettings(nextSettings, nextLeaves, nextAttendance, storage), { ok: false, reason: 'invalid' });
    assert.equal(storage.getItem(SETTINGS_KEY), previous);
  }
});

test('存储读取被拒绝时返回明确降级状态', () => {
  const storage = { getItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadSettings(storage), { status: 'unavailable' });
});

test('localStorage getter 被拒绝时读取与保存均降级', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    assert.deepEqual(loadSettings(), { status: 'unavailable' });
    assert.deepEqual(saveSettings(settings, [], attendance), { ok: false, reason: 'unavailable' });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});


test('daily and monthly inputs and monthly tax preference survive saving and switching modes', () => {
  const storage = memoryStorage();
  const config = validateSettings({ ...settings, payBasis: 'daily', dailySalary: 200, salaryMode: 'gross' }).settings;
  assert.equal(saveSettings(config, leaves, attendance, storage).ok, true);
  const daily = loadSettings(storage);
  assert.equal(daily.status, 'loaded');
  assert.equal(daily.settings.payBasis, 'daily');
  assert.equal(daily.settings.dailySalary, 200);
  assert.equal(daily.settings.monthlySalary, settings.monthlySalary);
  assert.equal(daily.settings.salaryMode, 'gross');
  assert.equal(saveSettings({ ...daily.settings, payBasis: 'monthly' }, leaves, attendance, storage).ok, true);
  const monthly = loadSettings(storage);
  assert.equal(monthly.settings.dailySalary, 200);
  assert.equal(monthly.settings.payBasis, 'monthly');
  assert.equal(monthly.settings.salaryMode, 'gross');
});
