import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TITLES, catalogProblems, applySignals, changeTitles, emptyTitles, parseTitles, titlesView, viewOf, met,
  taskSignals, clockSignals, funSignals, openSignals, stealSignals, owedSignals, TITLES_KEY,
} from '../../dist-electron/src/shared/titles/index.js';
import { Titles } from '../../dist-electron/src/main/titles.js';
import { localDate } from '../../dist-electron/src/domain/tasks/model.js';
import { defaultFun, updateFun } from '../../dist-electron/src/shared/fun.js';
import { validateLegacy } from '../../src/migration/transfer.js';

const T = 1_800_000_000_000;
const key = (signal, k, date = '2026-11-05') => ({ kind: 'key', signal, key: k, date });
const ledger = (id, k, value, date = k) => ({ kind: 'ledger', ledger: id, key: k, value, date });
const ids = (state) => state.unlocked.map((u) => u.id);
const run = (signals, state = emptyTitles('2026-01-01')) => applySignals(state, signals, T);

test('catalog has no structural problems', () => {
  assert.deepEqual(catalogProblems(), []);
});

// Every custom condition must have a case here; adding a custom title without one fails this test.
const CUSTOM_CASES = {
  'h-nail': [
    [['01', '02', '03', '04'].map((d) => ledger('lunch', `2026-02-${d}`, '饺子')), false],
    [['01', '02', '03', '04', '05'].map((d) => ledger('lunch', `2026-02-${d}`, '饺子')), true],
  ],
  'h-mixer': [
    [['a', 'b', 'c', 'd'].map((m, i) => ledger('mood', `2026-02-0${i + 1}`, m)), false],
    [['a', 'b', 'c', 'd', 'e'].map((m, i) => ledger('mood', `2026-02-0${i + 1}`, m)), true],
    [['a', 'b', 'c', 'd'].map((m, i) => ledger('mood', `2026-02-0${i + 1}`, m)).concat(ledger('mood', '2026-02-20', 'e')), false],
  ],
  'h-pi': [
    [[ledger('steal', '2026-02-01', 31_399)], false],
    [[ledger('steal', '2026-02-01', 31_000), ledger('steal', '2026-02-02', 450)], true],
    [[ledger('steal', '2026-02-01', 31_500)], false],
  ],
};
test('every custom condition has cases, and the cases hold', () => {
  const custom = TITLES.filter((t) => 'custom' in t.when).map((t) => t.id).sort();
  assert.deepEqual(Object.keys(CUSTOM_CASES).sort(), custom);
  for (const [id, cases] of Object.entries(CUSTOM_CASES))
    for (const [signals, expected] of cases) assert.equal(ids(run(signals).state).includes(id), expected, id);
});

test('ladders unlock at each threshold, once, and keep counting past the top', () => {
  const days = (n) => Array.from({ length: n }, (_, i) => key('clockin', `d${i}`));
  assert.deepEqual(ids(run(days(4)).state), ['clockin-1']);
  assert.deepEqual(ids(run(days(5)).state), ['clockin-1', 'clockin-5']);
  const top = run(days(25)).state;
  assert.deepEqual(ids(top).filter((id) => id.startsWith('clockin')), ['clockin-1', 'clockin-5', 'clockin-20']);
  assert.equal(viewOf(top).count('clockin'), 25);
  assert.deepEqual(run([key('clockin', 'd0')], top).unlocked, []);
});

test('duplicate signals and facts before enabledAt are ignored', () => {
  const first = run([key('done', 'task-a')]).state;
  const again = applySignals(first, [key('done', 'task-a')], T + 1);
  assert.equal(again.changed, false);
  const late = applySignals(emptyTitles('2026-11-05'), [key('mood', '2026-11-04', '2026-11-04')], T);
  assert.equal(late.changed, false);
});

test('sum and any ledgers: steal overwrites today and never double counts', () => {
  let state = run(stealSignals('2026-02-01', 0.5)).state;
  state = applySignals(state, stealSignals('2026-02-01', 1.2), T).state;
  assert.equal(viewOf(state).ledger('steal')['2026-02-01'], 120);
  assert.ok(ids(state).includes('steal-1'));
  state = applySignals(state, stealSignals('2026-02-02', 20), T).state;
  assert.ok(ids(state).includes('h-coffee'));
  assert.equal(met({ sum: 'steal', atLeast: 2120 }, viewOf(state)), true);
  assert.deepEqual(stealSignals('2026-02-01', NaN), []);
});

test('meta title sees unlocks made in the same pass', () => {
  const signals = Array.from({ length: 20 }, (_, i) => key('clockin', `c${i}`))
    .concat(Array.from({ length: 10 }, (_, i) => key('done', `t${i}`)), Array.from({ length: 7 }, (_, i) => key('mood', `m${i}`)),
      Array.from({ length: 7 }, (_, i) => key('open', `o${i}`)), [key('lunch', 'l')]);
  // 3 + 2 + 2 + 2 + 1 = 10 regular titles, then the collector itself.
  assert.ok(ids(run(signals).state).includes('h-collector'));
});

test('task collector: redone and long-delayed completions', () => {
  const state = run([key('done', 'a')]).state;
  const view = viewOf(state);
  assert.deepEqual(taskSignals({ id: 'a', date: '2026-11-05' }, '2026-11-05', view).map((s) => s.signal), ['done', 'redone']);
  assert.deepEqual(taskSignals({ id: 'b', date: '2026-10-29' }, '2026-11-05', view).map((s) => s.signal), ['done', 'done-late']);
  assert.deepEqual(taskSignals({ id: 'c', date: '2026-10-30' }, '2026-11-05', view).map((s) => s.signal), ['done']);
});

test('clock collector judges on-time, exact, friday and monday from day facts', () => {
  const at = (date, time) => new Date(`${date}T${time}`).getTime();
  const fact = (date) => ({ workday: true, fullDayLeave: false, startAt: at(date, '09:00:00'), endAt: at(date, '18:00:00'), flex: false });
  const day = (date, inT, outT) => ({ date, clockIn: { at: at(date, inT) }, clockOut: outT ? { at: at(date, outT) } : null, breaks: [] });
  const before = { days: [] };
  const friday = '2026-11-06';
  const sig = (days, facts = fact) => clockSignals(before, { days }, facts).map((s) => s.signal).sort();
  assert.deepEqual(sig([day(friday, '09:00:40', '18:09:00')]), ['clockin', 'exact', 'friday', 'ontime']);
  assert.deepEqual(sig([day(friday, '09:01:00', '18:11:00')]), ['clockin', 'friday']);
  assert.deepEqual(sig([day('2026-11-09', '09:05:00', null)]), ['clockin', 'monday']);
  assert.deepEqual(sig([day(friday, '09:00:00', '18:00:00')], () => null), ['clockin']);
  assert.deepEqual(sig([day(friday, '09:00:00', '18:00:00')], (d) => ({ ...fact(d), flex: true })), ['clockin', 'friday']);
  const unchanged = { days: [day(friday, '09:00:00', null)] };
  assert.deepEqual(clockSignals(unchanged, unchanged, fact), []);
});

test('fun collector: mood, lunch and hopes', () => {
  const now = new Date('2026-11-05T12:00:00');
  const mood = updateFun(defaultFun(), { action: 'mood', value: 1 }, now);
  assert.deepEqual(funSignals('mood', mood, '2026-11-05').map((s) => s.kind), ['key', 'ledger']);
  const lunch = updateFun(defaultFun(), { action: 'lunch', value: '饺子' }, now);
  assert.equal(funSignals('lunch', lunch, '2026-11-05')[1].value, '饺子');
  const hopes = { ...defaultFun(), hopes: [{ id: 'a', name: 'x', date: '2026-12-01' }, { id: 'b', name: 'y', date: '2026-11-01' }] };
  assert.equal(funSignals('hope', hopes, '2026-11-05')[0].value, 1);
  assert.deepEqual(funSignals('meals', hopes, '2026-11-05'), []);
});

test('open collector: once per day, rest days and comebacks', () => {
  const state = run([key('open', '2026-10-01', '2026-10-01')]).state;
  assert.deepEqual(openSignals('2026-10-01', false, viewOf(state)), []);
  assert.deepEqual(openSignals('2026-10-15', true, viewOf(state)).map((s) => s.signal), ['open', 'open-rest', 'comeback']);
  assert.deepEqual(openSignals('2026-10-14', null, viewOf(state)).map((s) => s.signal), ['open']);
});

test('auto-wear picks the rarest new title until the user chooses', () => {
  let state = run([key('open', 'a')]).state;
  assert.equal(state.worn, 'open-1');
  state = applySignals(state, Array.from({ length: 7 }, (_, i) => key('open', `o${i}`)), T).state;
  assert.equal(state.worn, 'open-7');
  state = changeTitles(state, { action: 'wear', id: 'open-1' });
  state = applySignals(state, Array.from({ length: 30 }, (_, i) => key('open', `p${i}`)), T).state;
  assert.equal(state.worn, 'open-1');
  assert.throws(() => changeTitles(state, { action: 'wear', id: 'steal-20000' }));
  state = changeTitles(state, { action: 'seen', ids: ['open-30'] });
  assert.ok(!state.unseen.includes('open-30') && state.pendingToast.includes('open-30'));
});

test('renderer view contains unlocked titles only', () => {
  const state = run([key('done', 'a'), ...Array.from({ length: 5 }, (_, i) => ledger('lunch', `2026-02-0${i + 1}`, '牛肉面拉面套餐'))]).state;
  const view = titlesView(state);
  assert.deepEqual(view.items.map((c) => c.id).sort(), ['done-1', 'h-nail']);
  assert.equal(view.items.find((c) => c.id === 'h-nail').name, '牛肉面拉面套钉子户');
  assert.ok(!JSON.stringify(view).includes('需求粉碎机'));
});

test('storage: round trip, broken structure, unknown and unsupported unlocks', () => {
  const state = run([key('done', 'a')]).state;
  assert.deepEqual(parseTitles(JSON.stringify(state), '2026-11-05'), state);
  assert.throws(() => parseTitles('{"version":2}', '2026-11-05'));
  const forged = { ...state, unlocked: [...state.unlocked, { id: 'done-50', at: T }, { id: 'nope', at: T }], worn: 'done-50', unseen: ['done-50'] };
  const parsed = parseTitles(JSON.stringify(forged), '2026-11-05');
  assert.deepEqual(ids(parsed), ['done-1']);
  assert.equal(parsed.worn, '');
  assert.equal(parseTitles(null, '2026-11-05').enabledAt, '2026-11-05');
});

test('main integration writes through the shared store and survives write failures', () => {
  const values = new Map();
  const store = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const titles = new Titles(store, () => ({ workday: true, fullDayLeave: false, startAt: 0, endAt: 0, flex: false }));
  titles.load();
  assert.deepEqual(titles.record({ kind: 'task-done', task: { id: 'x', date: localDate() } }), ['done-1']);
  assert.ok(values.has(TITLES_KEY));
  titles.record({ kind: 'steal', amount: 0.3 });
  assert.equal(JSON.parse(values.get(TITLES_KEY)).ledgers.steal, undefined);
  titles.settle();
  assert.ok(JSON.parse(values.get(TITLES_KEY)).ledgers.steal);
  const broken = new Titles({ getItem: () => null, setItem: () => { throw Error('read-only'); } }, () => null);
  broken.load();
  assert.doesNotThrow(() => broken.record({ kind: 'open' }));
  const locked = new Titles({ getItem: () => '{bad', setItem() {} }, () => null);
  locked.load();
  assert.ok(locked.view().error);
  assert.deepEqual(locked.record({ kind: 'open' }), []);
});

test('backup accepts title data and rejects a broken structure', () => {
  const base = { 'work-todolist-generic-v1': null, 'dogcow.home.v1': null, ...Object.fromEntries([1, 2, 3, 4].map((v) => [`niuma-calculator.settings.v${v}`, null])) };
  assert.doesNotThrow(() => validateLegacy({ ...base, [TITLES_KEY]: JSON.stringify(emptyTitles('2026-11-05')) }));
  assert.throws(() => validateLegacy({ ...base, [TITLES_KEY]: '{"version":1}' }), /职称/);
});

test('boss-owes series unlocks silently: no toast, no unseen, no auto-wear', () => {
  const before = run([ledger('steal', '2026-11-04', 100)]).state;
  assert.equal(before.worn, 'steal-1');
  const { state, unlocked } = applySignals(before, owedSignals({ '2026-11-04': 60, '2026-11-05': 50 }), T);
  assert.deepEqual(unlocked, ['owed-1', 'owed-100']);
  assert.equal(state.ledgers.owed['2026-11-05'], 5000);
  assert.deepEqual(state.pendingToast, before.pendingToast);
  assert.deepEqual(state.unseen, before.unseen);
  assert.equal(state.worn, 'steal-1');
  assert.ok(titlesView(state).items.some((item) => item.id === 'owed-100' && item.series === 'owed'));
  assert.deepEqual(owedSignals({ '2026-11-05': -1, '2026-11-06': Number.NaN }), []);
});
