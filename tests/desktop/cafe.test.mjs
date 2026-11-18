import { Cafe } from '../../dist-electron/src/main/cafe.js';
import { CAFE_KEY } from '../../dist-electron/src/shared/cafe/content.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCafe, parseCafe, validatePlan } from '../../dist-electron/src/shared/cafe/state.js';
import { applyCafeAction, setupQuote } from '../../dist-electron/src/shared/cafe/commands.js';
import { cafeContent, defaultPlan, SHIFTS } from '../../dist-electron/src/shared/cafe/content.js';
import { simulateWeek } from '../../dist-electron/src/shared/cafe/simulation.js';
import { balanceDifference, profitOf } from '../../dist-electron/src/shared/cafe/finance.js';
import { weekBudget } from '../../dist-electron/src/shared/cafe/operations.js';
import { canMake, consume, expire } from '../../dist-electron/src/shared/cafe/inventory.js';
import { validateLegacy, collectLegacy, allowedKey } from '../../dist-electron/src/migration/transfer.js';
const setup = (location = 'campus') => ({ location, machine: 'starter', seats: 6, positioning: 'express' });
const opened = (location = 'campus', seed = 42) =>
  applyCafeAction(emptyCafe(seed), { action: 'setup', setup: setup(location) });
const roundtrip = (state) => assert.deepEqual(parseCafe(JSON.stringify(state)), state);
function fixture() {
  const values = new Map();
  const store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const service = new Cafe(store, 42);
  const request = (action, extra = {}, id = crypto.randomUUID()) => ({
    action,
    ...extra,
    requestId: id,
    revision: service.view().state.revision,
  });
  return { values, store, service, request };
}

test('setup occupies cash while capitalizing deposits, fitout, equipment and stock', () => {
  const s = opened();
  const quote = setupQuote(setup());
  assert.equal(s.finance.cash, s.finance.capital - quote.total);
  assert.equal(s.finance.retained, 0);
  assert.equal(s.finance.deposit, quote.deposit);
  assert.equal(balanceDifference(s), 0);
  roundtrip(s);
  assert.throws(() => applyCafeAction(s, { action: 'setup', setup: setup() }));
});
test('seeded weekly simulation is deterministic, immutable and financially balanced', () => {
  const initial = opened(),
    before = structuredClone(initial),
    plan = defaultPlan();
  const a = simulateWeek(initial, plan),
    b = simulateWeek(initial, plan);
  assert.deepEqual(a, b);
  assert.deepEqual(initial, before);
  const r = a.reports[0];
  assert.equal(r.profit, profitOf(r));
  assert.equal(a.finance.retained, r.profit);
  assert.equal(
    r.cashChange,
    r.revenue - r.purchases - r.wages - r.rent - r.utilities - r.marketing - r.interest,
  );
  assert.equal(balanceDifference(a), 0);
  assert.equal(a.week, 2);
  for (const h of r.hours) {
    assert.equal(h.demand, h.served + h.queueLost + h.stockLost + h.seatLost);
    assert.ok(h.machineUsed <= h.machineCapacity + 1e-9);
    assert.ok(h.laborUsed <= h.laborCapacity + 1e-9);
  }
  assert.equal(
    a.finance.inventory,
    a.inventory.reduce((n, b) => n + b.quantity * b.unitCost, 0),
  );
  roundtrip(a);
});
test('inventory uses oldest available lots, preserves in-transit goods and expires by receipt date', () => {
  const inventory = [
    { ingredient: 'milk', quantity: 2, unitCost: 200, arrivedDay: 0, quality: 1 },
    { ingredient: 'milk', quantity: 5, unitCost: 250, arrivedDay: 2, quality: 1 },
  ];
  assert.equal(canMake(inventory, { milk: 3 }, 0), false);
  assert.equal(consume(inventory, { milk: 3 }, 2), 650);
  assert.equal(inventory[0].quantity, 0);
  assert.equal(inventory[1].quantity, 4);
  assert.equal(expire(inventory, 6, cafeContent), 0);
  assert.equal(expire(inventory, 7, cafeContent), 1000);
  assert.throws(() => consume(inventory, { milk: 1 }, 7));
});
test('loans and principal repayment affect cash/debt, never operating profit', () => {
  const initial = opened();
  let s = applyCafeAction(initial, { action: 'loan', amount: 100000 });
  assert.equal(s.finance.cash - initial.finance.cash, 100000);
  assert.equal(s.finance.retained, 0);
  assert.equal(s.finance.debt, 100000);
  s = applyCafeAction(s, { action: 'repay', amount: 50000 });
  assert.equal(s.finance.debt, 50000);
  assert.equal(s.finance.retained, 0);
  roundtrip(s);
  assert.throws(() => applyCafeAction(s, { action: 'loan', amount: 3000000 }));
});
test('equipment upgrades retain independent acquisition value; repeated sales cannot mint cash', () => {
  let s = simulateWeek(opened(), defaultPlan());
  s = applyCafeAction(s, { action: 'machine', machine: 'commercial' });
  assert.equal(s.assets.find((a) => a.id === 'machine').bookValue, cafeContent.machines[1].price);
  const beforeSale = structuredClone(s);
  s = applyCafeAction(s, { action: 'sellMachine' });
  assert.equal(s.finance.cash - beforeSale.finance.cash, Math.round(cafeContent.machines[1].price * 0.6));
  assert.equal(s.machineOwned, false);
  assert.equal(balanceDifference(s), 0);
  roundtrip(s);
  assert.throws(() => applyCafeAction(s, { action: 'sellMachine' }));
  assert.throws(() => applyCafeAction(s, { action: 'week', plan: defaultPlan() }));
});
test('closed business retains reports and outstanding debt without allowing further spending', () => {
  let s = applyCafeAction(opened(), { action: 'loan', amount: 3000000 });
  s = simulateWeek(s, defaultPlan());
  s = applyCafeAction(s, { action: 'liquidate' });
  assert.equal(s.phase, 'closed');
  assert.equal(s.finance.inventory, 0);
  assert.equal(s.finance.equipment, 0);
  assert.equal(s.finance.deposit, 0);
  assert.equal(s.reports.length, 1);
  assert.equal(balanceDifference(s), 0);
  roundtrip(s);
  assert.throws(() => applyCafeAction(s, { action: 'loan', amount: 100000 }));
});
test('command boundary blocks duplicate, stale, unsafe and unsaved requests', () => {
  const f = fixture();
  const request = f.request('setup', { setup: setup() });
  f.service.execute(request);
  assert.equal(f.service.view().pending, true);
  const original = f.values.get(CAFE_KEY);
  assert.throws(() => f.service.execute(f.request('loan', { amount: 10000 })), /尚未保存/);
  assert.equal(f.values.get(CAFE_KEY), original);
  f.service.confirmSaved();
  f.service.execute(request);
  assert.equal(f.values.get(CAFE_KEY), original);
  const week = f.request('week', { plan: defaultPlan() });
  f.service.execute(week);
  f.service.confirmSaved();
  const saved = f.values.get(CAFE_KEY);
  f.service.execute(week);
  assert.equal(f.values.get(CAFE_KEY), saved);
  assert.throws(() => f.service.execute({ ...f.request('loan', { amount: 10000 }), revision: 0 }), /已更新/);
  assert.throws(() => f.service.execute(f.request('loan', { amount: -100 })), /无效/);
});
test('pending state survives service reconstruction and duplicate retry does not rerun a week', () => {
  const f = fixture();
  f.service.execute(f.request('setup', { setup: setup() }));
  f.service.confirmSaved();
  const request = f.request('week', { plan: defaultPlan() });
  f.service.execute(request);
  const reloaded = new Cafe(f.store, 9);
  reloaded.execute(request);
  assert.equal(reloaded.view().state.week, 2);
  assert.equal(reloaded.view().state.reports.length, 1);
});
test('invalid plans and impossible working hours cannot mutate the business', () => {
  const plan = defaultPlan();
  plan.shifts.evening.open = true;
  plan.shifts.evening.owner = true;
  assert.throws(() => validatePlan(plan), /最多/);
  const noStaff = defaultPlan();
  noStaff.shifts.morning.owner = false;
  noStaff.shifts.morning.staff.barista = 0;
  assert.throws(() => validatePlan(noStaff), /咖啡师/);
  const invalid = defaultPlan();
  invalid.prices.latte = NaN;
  assert.throws(() => validatePlan(invalid));
  const s = opened('office');
  const expensive = defaultPlan();
  for (const ingredient of cafeContent.ingredients) expensive.purchases[ingredient.id] = 100;
  assert.ok(weekBudget(s, expensive).total > s.finance.cash);
  assert.throws(() => applyCafeAction(s, { action: 'week', plan: expensive }), /现金不足/);
});
test('corrupt and future saves stay locked and original payload remains intact', () => {
  const f = fixture();
  for (const value of [
    'broken',
    JSON.stringify({ ...opened(), version: 2 }),
    JSON.stringify({ ...opened(), finance: {} }),
  ]) {
    f.values.set(CAFE_KEY, value);
    assert.throws(() => f.service.view(), /原始数据已保留/);
    assert.equal(f.values.get(CAFE_KEY), value);
  }
  const bad = opened();
  bad.finance.inventory++;
  assert.throws(() => parseCafe(JSON.stringify(bad)));
});
test('cafe key participates in repository transfer and restore validation', () => {
  assert.ok(allowedKey(CAFE_KEY));
  const values = new Map([[CAFE_KEY, JSON.stringify(opened())]]);
  const transfer = collectLegacy({
    getItem: (key) => values.get(key) ?? null,
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
  });
  assert.equal(transfer[CAFE_KEY], values.get(CAFE_KEY));
  assert.doesNotThrow(() => validateLegacy(transfer));
  assert.throws(() => validateLegacy({ ...transfer, [CAFE_KEY]: '{}' }));
});
test('content catalogs can add a drink without changes to simulation or accounting', () => {
  const content = structuredClone(cafeContent);
  content.drinks.push({ ...content.drinks[0], id: 'longBlack', name: '长黑', price: 1900 });
  const plan = defaultPlan(content);
  const s = simulateWeek(opened(), plan, content);
  assert.ok(Object.hasOwn(s.reports[0].sales, 'longBlack'));
  assert.equal(balanceDifference(s), 0);
  assert.equal(
    s.reports[0].served,
    Object.values(s.reports[0].sales).reduce((n, v) => n + v, 0),
  );
});

test('emergency restocking is paid once, arrives next day and stays within its reserve', () => {
  let s = opened();
  // Sell the initial stock at carrying cost, then compare the same seeded business with/without reserve.
  s.finance.cash += s.finance.inventory;
  s.finance.inventory = 0;
  s.inventory = [];
  const plan = defaultPlan();
  for (const id in plan.purchases) plan.purchases[id] = 0;
  const empty = simulateWeek(s, plan);
  plan.emergencyBudget = 100000;
  const stocked = simulateWeek(s, plan),
    r = stocked.reports[0];
  assert.equal(empty.reports[0].served, 0);
  assert.ok(r.served > 0);
  assert.ok(r.emergencyPurchases > 0 && r.emergencyPurchases <= plan.emergencyBudget);
  assert.equal(
    r.hours.filter((h) => h.day === 0).reduce((n, h) => n + h.served, 0),
    0,
  );
  assert.equal(r.purchases, r.emergencyPurchases);
  assert.equal(balanceDifference(stocked), 0);
  roundtrip(stocked);
});

test('higher price trades demand for margin; overpricing can produce an operating loss', () => {
  const s = opened('campus');
  const affordable = defaultPlan(),
    overpriced = defaultPlan();
  for (const id in affordable.prices) affordable.prices[id] = 1200;
  for (const id in overpriced.prices) overpriced.prices[id] = 6000;
  const a = simulateWeek(s, affordable).reports[0],
    b = simulateWeek(s, overpriced).reports[0];
  assert.ok(a.demand > b.demand);
  assert.ok(b.profit < 0);
});

test('staffing, seating and quality are consumed by operating rules, not cosmetic upgrades', () => {
  const s = opened('community'),
    lean = defaultPlan(),
    supported = defaultPlan();
  for (const id in lean.prices) lean.prices[id] = 1200;
  for (const id in supported.prices) supported.prices[id] = 1200;
  for (const shift of SHIFTS) {
    lean.shifts[shift].staff.server = 0;
    supported.shifts[shift].staff.server = 1;
  }
  const a = simulateWeek(s, lean).reports[0],
    b = simulateWeek(s, supported).reports[0];
  assert.ok(b.served >= a.served);
  assert.ok(b.wages > a.wages);
  const noSeats = structuredClone(s);
  noSeats.setup.seats = 0;
  const c = simulateWeek(noSeats, supported).reports[0];
  assert.ok(c.hours.some((h) => h.seatLost > 0));
  assert.ok(c.served < b.served);
});

test('real repository flush failure preserves the prior snapshot and retries the same candidate once', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { Repository } = await import('../../dist-electron/src/main/repository.js');
  const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-cafe-'));
  try {
    const repo = new Repository(directory);
    await repo.load();
    const service = new Cafe(repo.storage, 42);
    const make = (action, extra = {}) => ({
      action,
      ...extra,
      revision: service.view().state.revision,
      requestId: crypto.randomUUID(),
    });
    service.execute(make('setup', { setup: setup() }));
    assert.equal(await repo.flush(), true);
    service.confirmSaved();
    const file = repo.file,
      original = await readFile(file, 'utf8');
    const request = make('week', { plan: defaultPlan() });
    service.execute(request);
    Object.defineProperty(repo, 'file', {
      configurable: true,
      get: () => path.join(directory, 'unavailable', 'snapshot.json'),
    });
    assert.equal(await repo.flush(), false);
    assert.equal(service.view().pending, true);
    assert.equal(await readFile(file, 'utf8'), original);
    assert.throws(() => service.execute(make('loan', { amount: 10000 })), /尚未保存/);
    delete repo.file;
    assert.equal(await repo.flush(), true);
    service.confirmSaved();
    service.execute(request);
    const reloaded = new Repository(directory);
    await reloaded.load();
    const state = new Cafe(reloaded.storage, 999).view().state;
    assert.equal(state.week, 2);
    assert.equal(state.reports.length, 1);
    assert.equal(state.seed, 42);
    assert.equal(balanceDifference(state), 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
