import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PAYROLL_CONFIG, calculatePayroll, validatePayrollConfig } from '../../app/income/src/payroll.js';
import { PAYROLL_POLICIES, switchPayrollCity, resetPayrollCity, defaultPayrollItems } from '../../app/income/data/payroll/cities.js';
const now = new Date(2026, 10, 4, 12);
const config = (city) => ({ ...structuredClone(DEFAULT_PAYROLL_CONFIG), city, items: defaultPayrollItems(city) });
const calculate = (payroll, date = now, monthlySalary = 20000) => calculatePayroll({ monthlySalary, salaryMode: 'gross', payroll }, date);

test('eight city entries are distinct; unsupported cities do not normalize as Hangzhou', () => {
  assert.equal(Object.keys(PAYROLL_POLICIES).length, 8);
  for (const city of Object.keys(PAYROLL_POLICIES)) assert.equal(PAYROLL_POLICIES[city].city, city);
  assert.equal(validatePayrollConfig({ ...config('hangzhou'), city: 'unknown' }).valid, false);
});

test('Shanghai fund uses its own 7% ceiling and policy-specific base', () => {
  const raw = config('shanghai');
  const result = calculate(raw, now, 50000);
  assert.equal(result.valid, true);
  assert.equal(result.fundPersonal, 2641.17);
  assert.equal(result.items[0].base, 37731);
  raw.items.fund.rate = 12;
  const custom = calculate(raw, now, 50000);
  assert.equal(custom.items[3].taxDeductibleAmount, 2641.17);
  assert.ok(custom.warnings.some((v) => v.includes('5%–7%')));
});

test('fixed medical surcharge counts once, and is excluded from automatic tax deduction', () => {
  for (const [city, fee] of [['beijing', 3], ['nanjing', 10]]) {
    const raw = config(city);
    const result = calculate(raw);
    assert.equal(result.valid, true);
    assert.equal(result.items[1].amount, 400 + fee);
    assert.equal(result.items[1].taxDeductibleAmount, 400);
    raw.items.medical = { method: 'fixed', rate: 2, amount: 401, taxDeductibleAmount: 400 };
    assert.equal(calculate(raw).items[1].amount, 401);
  }
});

test('partial cities use editable general percentage presets without borrowing Hangzhou bounds', () => {
  for (const city of ['guangzhou', 'shenzhen', 'chengdu', 'wuhan']) {
    const raw = config(city);
    const normalized = validatePayrollConfig(raw);
    assert.equal(normalized.valid, true, city);
    const result = calculate(normalized.config);
    assert.equal(result.valid, true, city);
    assert.ok(result.items.some((item) => item.estimateMode === 'general'));
    assert.ok(result.warnings.some((warning) => warning.includes('通用估算')));
  }
  const raw = config('chengdu');
  assert.deepEqual(Object.values(raw.items).map((item) => item.rate), [8, 2, 0.5, 5]);
  const low = calculate(raw, now, 1000);
  assert.equal(low.items[0].base, 1000);
  assert.equal(low.personalContributions, 105);
  assert.equal(low.fundPersonal, 50);
});

test('general percentages accept custom rates, shared bases and per-item bases', () => {
  const raw = config('chengdu');
  raw.socialBaseMode = 'custom'; raw.socialBase = 8000;
  raw.items.medical.rate = 3;
  raw.items.pension.baseMode = 'custom'; raw.items.pension.base = 10000;
  raw.items.fund.rate = 12;
  const result = calculate(validatePayrollConfig(raw).config);
  assert.equal(result.valid, true);
  assert.equal(result.items[0].base, 10000);
  assert.equal(result.items[0].amount, 800);
  assert.equal(result.items[1].base, 8000);
  assert.equal(result.items[1].amount, 240);
  assert.equal(result.fundPersonal, 2400);
  assert.equal(result.items[3].taxDeductibleAmount, 2400);
});

test('known local bounds remain in use when only the local rate is unavailable', () => {
  const result = calculate(config('wuhan'), now, 1000);
  const item = result.items.find((entry) => entry.id === 'unemployment');
  assert.equal(result.valid, true);
  assert.equal(item.estimateMode, 'general');
  assert.equal(item.base, 4552);
  assert.equal(item.rate, 0.5);
  assert.equal(item.amount, 22.76);
});

test('manual fixed contributions survive entering a partial city and retain tax deduction input', () => {
  const raw = config('hangzhou');
  raw.items.medical = { method: 'fixed', rate: 2, amount: 123, taxDeductibleAmount: 100 };
  const next = switchPayrollCity(raw, 'chengdu');
  const result = calculate(next);
  assert.equal(result.valid, true);
  assert.equal(result.items[1].amount, 123);
  assert.equal(result.items[1].taxDeductibleAmount, 100);
  assert.equal(next.items.fund.rate, 5);
});

test('Shenzhen uses separate pension and medical bounds for the same low salary', () => {
  const raw = config('shenzhen');
  raw.items.unemployment = { method: 'none', amount: 0, rate: 0 };
  raw.items.fund = { method: 'none', amount: 0, rate: 0 };
  const result = calculate(raw, now, 3000);
  assert.equal(result.valid, true);
  assert.equal(result.items[0].base, 5521);
  assert.equal(result.items[1].base, 6727);
});

test('city switch updates automatic rates, retains manual inputs, and reset is explicit', () => {
  const raw = config('hangzhou');
  raw.socialBaseMode = 'custom'; raw.socialBase = 12000;
  raw.items.medical = { method: 'fixed', rate: 2, amount: 123, taxDeductibleAmount: 100 };
  raw.items.pension.baseMode = 'custom'; raw.items.pension.base = 8000;
  const next = switchPayrollCity(raw, 'shanghai');
  assert.equal(next.items.fund.rate, 7);
  assert.deepEqual(next.items.medical, raw.items.medical);
  assert.deepEqual(next.items.pension, raw.items.pension);
  assert.equal(next.socialBase, 12000);
  const restored = resetPayrollCity(next);
  assert.equal(restored.socialBaseMode, 'salary');
  assert.equal(restored.items.medical.method, 'percent');
  assert.equal(restored.items.fund.rate, 7);
  assert.equal(raw.city, 'hangzhou');
});

test('per-item base override survives validation and affects only that contribution', () => {
  const raw = config('hangzhou');
  raw.items.medical.baseMode = 'custom'; raw.items.medical.base = 9000;
  const normalized = validatePayrollConfig(raw);
  assert.equal(normalized.valid, true);
  const result = calculate(normalized.config);
  assert.equal(result.items[0].base, 20000);
  assert.equal(result.items[1].base, 9000);
});

test('expired policies block automatic calculation, but allow explicit manual payroll amounts', () => {
  for (const city of ['hangzhou', 'beijing', 'shanghai', 'nanjing']) {
    const raw = config(city);
    assert.equal(calculate(raw, new Date(2028, 0, 1)).valid, false);
    for (const item of Object.values(raw.items)) Object.assign(item, { method: 'fixed', amount: 100, taxDeductibleAmount: 90 });
    const result = calculate(raw, new Date(2028, 0, 1));
    assert.equal(result.valid, true);
    assert.equal(result.taxDeductibleAmount, 360);
  }
});
