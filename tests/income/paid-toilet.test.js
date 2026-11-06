import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSnapshot, validateSettings } from '../../app/income/src/calculator.js';
import { createAttendance, applyAttendanceAction, setAttendanceTimes } from '../../app/income/src/attendance.js';
import { createIncomeController } from '../../app/income/src/controller.js';
import { TOILET_KEY, validateToilet, loadToilet, changeToilet, endToilet, reviewToilet } from '../../app/income/src/paid-toilet.js';
const at = (h, m = 0, ms = 0) => new Date(2026, 10, 4, h, m, 0, ms);
const settings = overrides => validateSettings({ monthlySalary: 8400, startTime: '09:00', endTime: '17:00', workdays: [1, 2, 3, 4, 5], calendarMode: 'weekly', stealMode: true, clockMode: false, ...overrides }).settings;
const record = (id, start = at(10), end = at(10, 8)) => ({ id, startAt: +start, endAt: +end, status: 'completed' });
const empty = () => ({ version: 1, records: [] });
const calculate = (records = [], overrides = {}, attendance = createAttendance(at(9)), leaves = [], now = at(16)) => calculateSnapshot(settings(overrides), now, undefined, leaves, attendance, records);

test('eight minutes add only stolen time, preserving salary and actual work', () => {
  const before = calculate(); const after = calculate([record('a')]);
  assert.equal(after.toiletStolenSeconds, 480);
  assert.equal(after.stolenSeconds - before.stolenSeconds, 480);
  for (const key of ['earnedToday', 'earnedMonth', 'elapsedSeconds', 'actualBreakSeconds', 'earlyAmount', 'lateAmount']) assert.equal(after[key], before[key], key);
  assert.ok(Math.abs(after.toiletStolenAmount - 480 * after.perSecond) < 1e-10);
});
test('overlap is attributed once and milliseconds are rounded after combination', () => {
  const result = calculate([record('a'), record('b', at(10, 4), at(10, 12))]);
  assert.equal(result.toiletStolenSeconds, 720);
  assert.deepEqual(result.toiletDetails.map(item => item.addedSeconds), [480, 240]);
  const fragments = calculate([record('a', at(10, 0), at(10, 0, 700)), record('b', at(10, 1), at(10, 1, 700))]);
  assert.equal(fragments.toiletStolenSeconds, 1);
});
test('paid and unpaid leave, scheduled lunch and outside schedule are excluded', () => {
  const leaves = [{ id: 'leave', date: '2026-11-04', fullDay: false, startTime: '10:02', endTime: '10:06', paid: true }];
  assert.equal(calculate([record('a')], {}, undefined, leaves).toiletStolenSeconds, 240);
  assert.equal(calculate([record('a')], {}, undefined, [{ ...leaves[0], paid: false }]).toiletStolenSeconds, 240);
  assert.equal(calculate([record('a', at(12), at(13))], { lunchCountsAsWork: false, lunchStartTime: '12:00', lunchEndTime: '13:00' }).toiletStolenSeconds, 0);
  assert.equal(calculate([record('a', at(8), at(9))]).toiletStolenSeconds, 0);
});
test('clock facts bound activities and early-departure settlement stays unchanged', () => {
  const initial = createAttendance(at(9));
  const change = setAttendanceTimes(initial, { date: '2026-11-04', startAt: +at(10), endAt: +at(15), source: 'backfill' }, at(16));
  assert.equal(change.ok, true);
  const before = calculate([], { clockMode: true }, change.attendance);
  const after = calculate([record('a', at(9), at(11)), record('b', at(14), at(16))], { clockMode: true }, change.attendance);
  assert.equal(after.toiletStolenSeconds, 7200);
  assert.equal(after.earlySeconds, before.earlySeconds);
  assert.equal(after.lateSeconds, before.lateSeconds);
  assert.equal(after.stolenSeconds - before.stolenSeconds, 7200);
  assert.equal(calculate([record('a')], { clockMode: true }).toiletStolenSeconds, 0);
});
test('manual lunch remains a separate category and cannot be counted twice', () => {
  let attendance = createAttendance(at(9));
  attendance = applyAttendanceAction(attendance, 'pause', at(10)).attendance;
  attendance = applyAttendanceAction(attendance, 'resume', at(10, 8)).attendance;
  const result = calculate([record('a')], {}, attendance);
  assert.equal(result.toiletStolenSeconds, 0);
  assert.equal(result.lunchStolenSeconds, 480);
});
test('interrupted records never enter totals; running records are live estimates', () => {
  const item = { ...record('a'), endAt: null, status: 'running' };
  assert.equal(calculate([item], {}, undefined, [], at(10, 4)).toiletStolenSeconds, 240);
  assert.equal(calculate(reviewToilet({ version: 1, records: [item] }, 'sleep').data.records).toiletStolenSeconds, 0);
});
test('start, finish, cancel, review and editing enforce identity and time bounds', () => {
  const start = changeToilet(empty(), { action: 'start' }, +at(10), '', () => 'a');
  assert.equal(start.ok, true);
  assert.equal(changeToilet(start.data, { action: 'start' }, +at(10), '', () => 'b').ok, false);
  assert.equal(changeToilet(start.data, { action: 'end', recordId: 'missing' }, +at(11), '', () => '').errorCode, 'TOILET_CONFLICT');
  const end = changeToilet(start.data, { action: 'end', recordId: 'a' }, +at(10, 8), '', () => '');
  assert.equal(end.data.records[0].endAt, +at(10, 8));
  assert.equal(changeToilet(end.data, { action: 'end', recordId: 'a' }, +at(11), '', () => '').ok, false);
  assert.equal(changeToilet(end.data, { action: 'editEnd', recordId: 'a', endAt: +at(18) }, +at(11), '', () => '').errorCode, 'TOILET_TIME_INVALID');
  const reviewed = reviewToilet(start.data, 'sleep').data;
  const resolved = changeToilet(reviewed, { action: 'review', recordId: 'a', endAt: +at(10, 8) }, +at(11), '', () => '');
  assert.equal(resolved.data.records[0].status, 'completed');
  assert.equal(changeToilet(start.data, { action: 'cancel', recordId: 'a' }, +at(11), '', () => '').data.records.length, 0);
});
test('load preserves corrupt raw values and converts every unfinished record to review', () => {
  const raw = '{broken'; let writes = 0;
  const bad = loadToilet({ getItem: () => raw, setItem: () => writes++ });
  assert.ok(bad.error); assert.equal(writes, 0);
  assert.throws(() => validateToilet({ version: 1, records: [record('a'), record('a')] }));
  assert.throws(() => validateToilet({ version: 1, records: [{ ...record('a'), endAt: -1 }] }));
  const data = { version: 1, records: [{ ...record('a'), endAt: null, status: 'running' }] };
  assert.equal(loadToilet({ getItem: () => JSON.stringify(data) }).data.records[0].status, 'needs-review');
});
test('backfilled departure before activity start cannot create a negative interval', () => {
  const data = { version: 1, records: [{ ...record('a'), endAt: null, status: 'running' }] };
  const ended = endToilet(data, +at(9), 'offwork');
  assert.equal(ended.records[0].status, 'needs-review');
  assert.equal(ended.records[0].endAt, null);
});
test('controller publishes combined lunch and activity facts only after both are staged', () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  let now = at(10); const controller = createIncomeController({ storage, now: () => now, setIntervalImpl: () => 0, clearIntervalImpl: () => {} });
  controller.updateSettings(settings());
  const running = { version: 1, records: [{ ...record('a'), endAt: null, status: 'running' }] };
  controller.commitToilet(running);
  const observations = [];
  const off = controller.subscribe(state => observations.push({ state, disk: JSON.parse(storage.getItem(TOILET_KEY)) }));
  observations.length = 0;
  now = at(10, 8);
  const paused = applyAttendanceAction(controller.getState().attendance, 'pause', now);
  controller.commitAttendance(paused.attendance, endToilet(running, +now, 'lunch'));
  assert.equal(observations.length, 1);
  assert.equal(observations[0].state.toilet.records[0].endAt, +now);
  assert.equal(observations[0].disk.records[0].endAt, +now);
  assert.equal(observations[0].state.snapshot.toiletStolenSeconds, 480);
  off(); controller.destroy();
});
test('cross-month records contribute only the effective slice to each month', () => {
  const item = record('a', new Date(2026, 9, 30, 16, 55), new Date(2026, 10, 2, 9, 5));
  const oct = calculateSnapshot(settings(), new Date(2026, 9, 31, 23), undefined, [], createAttendance(at(9)), [item]);
  const nov = calculateSnapshot(settings(), new Date(2026, 10, 2, 10), undefined, [], createAttendance(at(9)), [item]);
  assert.equal(oct.toiletMonthAmount / oct.perSecond, 300);
  assert.equal(nov.toiletStolenSeconds, 300);
});

test('three activity kinds run independently, with at most one unfinished record per kind', () => {
  let data = empty();
  for (const kind of ['toilet', 'smoking', 'coffee']) {
    const result = changeToilet(data, { action: 'start', kind }, +at(10), '', () => kind);
    assert.equal(result.ok, true);
    data = result.data;
    assert.equal(changeToilet(data, { action: 'start', kind }, +at(10, 1), '', () => `${kind}-duplicate`).errorCode, 'TOILET_CONFLICT');
  }
  assert.equal(data.records.length, 3);
  assert.equal(changeToilet(data, { action: 'start', kind: 'unknown' }, +at(10), '', () => '').errorCode, 'TOILET_KIND_INVALID');
  data = changeToilet(data, { action: 'end', recordId: 'coffee' }, +at(10, 5), '', () => '').data;
  assert.equal(data.records.find(item => item.id === 'coffee').status, 'completed');
  assert.equal(data.records.filter(item => item.status === 'running').length, 2);
  const reviewed = reviewToilet(data, 'sleep').data;
  assert.equal(reviewed.records.filter(item => item.status === 'needs-review').length, 2);
  assert.equal(changeToilet(reviewed, { action: 'start', kind: 'smoking' }, +at(11), '', () => '').errorCode, 'TOILET_REVIEW_REQUIRED');
  assert.equal(changeToilet(reviewed, { action: 'start', kind: 'coffee' }, +at(11), '', () => 'coffee-next').ok, true);
});

test('category values stay independent while combined income counts overlapping time once', () => {
  const records = [
    { ...record('toilet', at(10), at(10, 10)), kind: 'toilet' },
    { ...record('smoke', at(10, 7), at(10, 12)), kind: 'smoking' },
    { ...record('coffee', at(11), at(11, 6)), kind: 'coffee' },
  ];
  const result = calculate(records);
  assert.equal(result.activitySummaries.toilet.seconds, 600);
  assert.equal(result.activitySummaries.smoking.seconds, 300);
  assert.equal(result.activitySummaries.coffee.seconds, 360);
  assert.equal(result.toiletStolenSeconds, 1080);
  assert.equal(result.toiletStolenAmount, result.perSecond * 1080);
  assert.equal(result.activitySummaries.smoking.amount, result.perSecond * 300);
  assert.equal(result.toiletDetails.find(item => item.id === 'smoke').addedSeconds, 120);
  assert.equal(result.toiletDetails.find(item => item.id === 'smoke').effectiveAmount, result.perSecond * 300);
  const withoutToilet = calculate(records.slice(1));
  assert.equal(withoutToilet.activitySummaries.smoking.seconds, 300);
  assert.equal(withoutToilet.toiletStolenSeconds, 660);
  // Corrected historical records of the same kind may overlap too.
  const sameKind = calculate([{ ...records[0], kind: 'coffee' }, { ...records[1], kind: 'coffee' }]);
  assert.equal(sameKind.activitySummaries.coffee.seconds, 720);
});

test('all categories obey work boundaries and batch-ending preserves independent records', () => {
  const records = ['toilet', 'smoking', 'coffee'].map(kind => ({ ...record(kind, at(8), at(10)), kind }));
  const result = calculate(records);
  for (const kind of ['toilet', 'smoking', 'coffee']) assert.equal(result.activitySummaries[kind].seconds, 3600);
  assert.equal(result.toiletStolenSeconds, 3600);
  const running = { version: 2, records: records.map(item => ({ ...item, startAt: +at(10), endAt: null, status: 'running' })) };
  const ended = endToilet(running, +at(10, 8), 'lunch');
  assert.equal(ended.records.filter(item => item.status === 'completed' && item.endReason === 'lunch').length, 3);
  const restored = loadToilet({ getItem: () => JSON.stringify(running) });
  assert.equal(restored.data.records.filter(item => item.status === 'needs-review').length, 3);
  assert.equal(calculate(restored.data.records).toiletStolenSeconds, 0);
});

test('v1 migration preserves exact original bytes, record identity and valuation across saves', () => {
  const legacy = JSON.stringify({ version: 1, records: [record('legacy')] }, null, 2);
  const map = new Map([[TOILET_KEY, legacy]]);
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const restored = loadToilet(storage);
  assert.equal(restored.changed, true);
  assert.equal(restored.data.version, 3);
  assert.equal(restored.data.records[0].kind, 'toilet');
  assert.equal(restored.data.legacyBackup, legacy);
  assert.equal(storage.getItem(TOILET_KEY), legacy); // Reading alone never writes.
  const before = calculate(JSON.parse(legacy).records);
  assert.equal(calculate(restored.data.records).toiletStolenAmount, before.toiletStolenAmount);
  const controller = createIncomeController({ storage, now: () => at(16), setIntervalImpl: () => 0, clearIntervalImpl: () => {} });
  controller.updateSettings(settings());
  const started = changeToilet(controller.getState().toilet, { action: 'start', kind: 'coffee' }, +at(15), '', () => 'new-coffee');
  assert.equal(controller.commitToilet(started.data).persisted, true);
  const disk = JSON.parse(storage.getItem(TOILET_KEY));
  assert.equal(disk.version, 3);
  assert.equal(disk.legacyBackup, legacy);
  assert.equal(disk.records.length, 2);
  controller.destroy();
});

test('failed migration writes preserve old storage and can be retried without losing backup', () => {
  const legacy = JSON.stringify({ version: 1, records: [record('legacy')] });
  const map = new Map([[TOILET_KEY, legacy]]);
  let failWrites = true;
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => {
    if (key === TOILET_KEY && failWrites) throw Error('disk full');
    map.set(key, value);
  } };
  const controller = createIncomeController({ storage, now: () => at(16), setIntervalImpl: () => 0, clearIntervalImpl: () => {} });
  assert.equal(storage.getItem(TOILET_KEY), legacy);
  assert.equal(controller.updateSettings(settings()).persisted, false);
  assert.equal(controller.getState().toilet.legacyBackup, legacy);
  failWrites = false;
  assert.equal(controller.retrySave().persisted, true);
  assert.equal(JSON.parse(storage.getItem(TOILET_KEY)).legacyBackup, legacy);
  controller.destroy();
});

test('custom configuration validates names and icons before starting', () => {
  assert.equal(changeToilet(empty(), { action: 'start', kind: 'custom' }, +at(10), '', () => 'custom').errorCode, 'TOILET_CUSTOM_REQUIRED');
  for (const name of ['', '   ', '一二三四五六七八九十一二三', '刷\n手机']) {
    assert.equal(changeToilet(empty(), { action: 'configureCustom', name, icon: 'phone' }, +at(10), '', () => '').errorCode, 'TOILET_CUSTOM_INVALID');
  }
  assert.equal(changeToilet(empty(), { action: 'configureCustom', name: '刷手机', icon: 'not-an-icon' }, +at(10), '', () => '').errorCode, 'TOILET_CUSTOM_INVALID');
  const configured = changeToilet(empty(), { action: 'configureCustom', name: '  刷手机  ', icon: 'phone' }, +at(10), '先设置薪资', () => '');
  assert.equal(configured.ok, true); // Configuration is independent of salary readiness.
  assert.deepEqual(configured.data.customActivity, { name: '刷手机', icon: 'phone' });
  assert.equal(changeToilet(configured.data, { action: 'start', kind: 'custom' }, +at(10), '午休中', () => 'a').errorCode, 'TOILET_NOT_AVAILABLE');
  assert.equal(changeToilet(empty(), { action: 'configureCustom', name: '✨'.repeat(12), icon: 'sparkles' }, +at(10), '', () => '').ok, true);
});

test('renaming custom activity preserves running, completed and restored record snapshots', () => {
  let data = changeToilet(empty(), { action: 'configureCustom', name: '刷手机', icon: 'phone' }, +at(10), '', () => '').data;
  data = changeToilet(data, { action: 'start', kind: 'custom' }, +at(10), '', () => 'first').data;
  data = changeToilet(data, { action: 'configureCustom', name: '散步', icon: 'walk' }, +at(10, 1), '', () => '').data;
  assert.deepEqual(data.records[0].customActivity, { name: '刷手机', icon: 'phone' });
  assert.equal(changeToilet(data, { action: 'start', kind: 'custom' }, +at(10, 1), '', () => 'duplicate').errorCode, 'TOILET_CONFLICT');
  data = changeToilet(data, { action: 'end', recordId: 'first' }, +at(10, 5), '', () => '').data;
  data = changeToilet(data, { action: 'start', kind: 'custom' }, +at(10, 6), '', () => 'second').data;
  assert.deepEqual(data.records.map(item => item.customActivity.name), ['刷手机', '散步']);
  const restored = loadToilet({ getItem: () => JSON.stringify(data) });
  assert.equal(restored.data.customActivity.name, '散步');
  assert.equal(restored.data.records[0].customActivity.icon, 'phone');
  assert.equal(restored.data.records[1].status, 'needs-review');
  assert.equal(restored.data.records[1].customActivity.icon, 'walk');
});

test('four simultaneous activities share the original pricing and combined union', () => {
  let data = changeToilet(empty(), { action: 'configureCustom', name: '发呆', icon: 'sparkles' }, +at(10), '', () => '').data;
  for (const kind of ['toilet', 'smoking', 'coffee', 'custom']) {
    data = changeToilet(data, { action: 'start', kind }, +at(10), '', () => kind).data;
  }
  const running = calculate(data.records, {}, undefined, [], at(10, 8));
  for (const kind of ['toilet', 'smoking', 'coffee', 'custom']) assert.equal(running.activitySummaries[kind].seconds, 480);
  assert.equal(running.toiletStolenSeconds, 480);
  assert.ok(Math.abs(running.toiletStolenAmount - 480 * running.perSecond) < 1e-10);
  assert.equal(calculate(reviewToilet(data, 'sleep').data.records).toiletStolenSeconds, 0);
  assert.equal(endToilet(data, +at(10, 8), 'offwork').records.filter(item => item.status === 'completed').length, 4);
});

test('v2 upgrades preserve original bytes and the v1 backup through subsequent configuration saves', () => {
  const previous = { version: 2, legacyBackup: 'original v1 bytes', records: [{ ...record('coffee'), kind: 'coffee' }] };
  const raw = JSON.stringify(previous, null, 2);
  const map = new Map([[TOILET_KEY, raw]]);
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const controller = createIncomeController({ storage, now: () => at(16), setIntervalImpl: () => 0, clearIntervalImpl: () => {} });
  const upgraded = JSON.parse(storage.getItem(TOILET_KEY));
  assert.equal(upgraded.version, 3);
  assert.equal(upgraded.migrationBackup, raw);
  assert.equal(upgraded.legacyBackup, previous.legacyBackup);
  assert.deepEqual(upgraded.records, previous.records);
  const configured = changeToilet(controller.getState().toilet, { action: 'configureCustom', name: '阅读', icon: 'book' }, +at(16), '', () => '');
  assert.equal(controller.commitToilet(configured.data).persisted, true);
  assert.equal(controller.getState().settings, null);
  const restored = loadToilet(storage);
  assert.equal(restored.data.customActivity.name, '阅读');
  assert.equal(restored.data.migrationBackup, raw);
  assert.equal(restored.changed, false);
  controller.updateSettings(settings());
  assert.equal(JSON.parse(storage.getItem(TOILET_KEY)).customActivity.name, '阅读');
  assert.equal(JSON.parse(storage.getItem(TOILET_KEY)).migrationBackup, raw);
  controller.destroy();
});

test('corrupt custom facts never overwrite original storage', () => {
  const custom = { ...record('custom'), kind: 'custom' };
  for (const value of [null, { version: 3, records: [custom] }, { version: 3, customActivity: { name: '手机', icon: 'invalid' }, records: [] },
    { version: 2, records: [{ ...custom, customActivity: { name: '手机', icon: 'phone' } }] }]) {
    const raw = JSON.stringify(value); let writes = 0;
    const restored = loadToilet({ getItem: () => raw, setItem: () => writes++ });
    assert.ok(restored.error);
    assert.equal(writes, 0);
  }
});

test('icon catalog preserves existing IDs and accepts every icon with its corresponding emoji', async () => {
  const { ACTIVITY_ICONS, ACTIVITY_ICON_IDS } = await import('../../app/income/src/activity-icons.js');
  assert.equal(ACTIVITY_ICON_IDS.length, 16);
  for (const id of ['phone', 'book', 'game', 'walk', 'sparkles']) assert.ok(ACTIVITY_ICON_IDS.includes(id));
  assert.equal(ACTIVITY_ICONS.meal.emoji, '🍚');
  assert.equal(ACTIVITY_ICONS.fish.emoji, '🐟');
  for (const icon of ACTIVITY_ICON_IDS) {
    assert.match(ACTIVITY_ICONS[icon].emoji, /\p{Extended_Pictographic}/u);
    assert.ok(ACTIVITY_ICONS[icon].label);
    const configured = changeToilet(empty(), { action: 'configureCustom', name: '带薪吃饭', icon }, +at(10), '', () => '');
    assert.equal(configured.ok, true);
    const started = changeToilet(configured.data, { action: 'start', kind: 'custom' }, +at(10), '', () => icon);
    assert.equal(started.data.records[0].customActivity.icon, icon);
    assert.equal(started.data.records[0].customActivity.name, '带薪吃饭');
  }
});

test('icon search supports Chinese activities, emoji and English without changing the catalog', async () => {
  const { searchActivityIcons, ACTIVITY_ICON_IDS } = await import('../../app/income/src/activity-icons.js');
  assert.deepEqual(searchActivityIcons('吃饭'), ['meal']);
  assert.deepEqual(searchActivityIcons('摸鱼'), ['fish']);
  assert.deepEqual(searchActivityIcons('🐟'), ['fish']);
  assert.deepEqual(searchActivityIcons('  PHONE '), ['phone']);
  assert.deepEqual(searchActivityIcons('午餐 饭'), ['meal']);
  assert.deepEqual(searchActivityIcons('没有这种图标'), []);
  assert.deepEqual(searchActivityIcons('   '), ACTIVITY_ICON_IDS);
});
