import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, validateSettings, calculateSnapshot } from '../../app/income/src/calculator.js';
import { DEFAULT_BONUS_CONFIG, calculateBonus, validateBonusConfig } from '../../app/income/src/bonus.js';
import { calculatePayroll } from '../../app/income/src/payroll.js';
import { loadSettings, saveSettings } from '../../app/income/src/storage.js';
import { createAttendance } from '../../app/income/src/attendance.js';
const now = new Date(2026, 10, 4, 12);
const settings = (bonus = {}, changes = {}) => ({ ...structuredClone(DEFAULT_SETTINGS), monthlySalary: 20000,
  salaryMode: 'gross', calendarMode: 'weekly', ...changes,
  bonus: { ...DEFAULT_BONUS_CONFIG, enabled: true, ...bonus },
});

test('bonus is opt-in and old settings normalize to disabled without changing income', () => {
  const raw = settings(); delete raw.bonus;
  const normalized = validateSettings(raw);
  assert.equal(normalized.valid, true);
  assert.equal(normalized.settings.bonus.enabled, false);
  assert.deepEqual(calculateBonus(raw, now), { valid: true, enabled: false });
});

test('preset multiples use gross salary; custom amount and explicit base are independent', () => {
  for (const amountMode of ['1', '2', '3', '4']) {
    const result = calculateBonus(settings({ amountMode }), now);
    assert.equal(result.valid, true);
    assert.equal(result.bonus, Number(amountMode) * 20000);
  }
  assert.equal(calculateBonus(settings({ amountMode: 'custom', customAmount: 12345 }), now).bonus, 12345);
  assert.equal(calculateBonus(settings({ amountMode: '2', baseSalary: 10000 }), now).bonus, 20000);
  assert.equal(calculateBonus(settings({ customAmount: 0, amountMode: 'custom' }), now).netBonus, 0);
});

test('net and daily settings never infer gross salary for bonus multiples', () => {
  for (const changes of [{ salaryMode: 'net' }, { payBasis: 'daily', dailySalary: 500 }]) {
    assert.equal(calculateBonus(settings({}, changes), now).valid, false);
    assert.equal(calculateBonus(settings({ baseSalary: 10000 }, changes), now).bonus, 10000);
  }
});

test('separate bonus tax uses monthly brackets but taxes the entire bonus once', () => {
  for (const [bonus, tax] of [[36000, 1080], [36000.01, 3390], [144000, 14190], [144000.01, 27390], [960000, 328640], [960000.01, 416840]]) {
    const result = calculateBonus(settings({ amountMode: 'custom', customAmount: bonus }), now);
    assert.equal(result.valid, true);
    assert.equal(result.tax, tax);
  }
});

test('separate tax policy expiry does not silently use the old concession', () => {
  const raw = settings({ taxYear: 2028 });
  assert.equal(calculateBonus(raw, now).valid, false);
  raw.bonus = { ...raw.bonus, taxMode: 'combined', annualMode: 'custom', annualIncome: 240000, annualDeductions: 0 };
  assert.equal(calculateBonus(raw, now).valid, true);
});

test('combined tax returns annual incremental tax, preserving unused annual deduction', () => {
  const raw = settings({ amountMode: 'custom', customAmount: 30000, taxMode: 'combined', annualMode: 'custom', annualIncome: 30000, annualDeductions: 0 });
  const exempt = calculateBonus(raw, now);
  assert.equal(exempt.tax, 0);
  assert.equal(exempt.netBonus, 30000);
  raw.bonus.customAmount = 40000;
  assert.equal(calculateBonus(raw, now).tax, 300);
  raw.bonus.annualIncome = 160000;
  raw.bonus.annualDeductions = 10000;
  raw.bonus.customAmount = 30000;
  const result = calculateBonus(raw, now);
  assert.equal(result.annualTaxWithout, 6480);
  assert.equal(result.annualTaxWith, 9480);
  assert.equal(result.tax, 3000);
  assert.equal(result.netBonus, 27000);
});

test('annual estimate uses tax-deductible contributions, not monthly withholding or all cash deductions', () => {
  const raw = settings({ taxMode: 'combined' });
  raw.payroll.extras = [{ id: 'food', name: '餐费', method: 'fixed', amount: 1000, rate: 0, taxDeductibleAmount: 0 }];
  const result = calculateBonus(raw, now);
  assert.equal(result.valid, true);
  assert.equal(result.annualIncome, 240000);
  assert.equal(result.annualDeductions, 54000);
  const manual = settings({ taxMode: 'combined', annualMode: 'custom', annualIncome: 240000, annualDeductions: 54000 });
  assert.equal(result.tax, calculateBonus(manual, now).tax);
});

test('missing, invalid and overflowing inputs return errors without corrupting base payroll', () => {
  for (const value of [-1, Infinity, NaN, 'invalid', Number.MAX_VALUE]) {
    assert.equal(calculateBonus(settings({ amountMode: 'custom', customAmount: value }), now).valid, false);
  }
  assert.equal(validateBonusConfig(null).valid, false);
  assert.equal(validateBonusConfig({ enabled: 'yes' }).valid, false);
  assert.equal(calculateBonus(settings({ amountMode: 'custom', customAmount: '' }), now).valid, false);
  assert.equal(calculateBonus(settings({ baseSalary: Number.MAX_SAFE_INTEGER / 101, amountMode: '4' }), now).valid, false);
  assert.equal(calculateBonus(settings({ taxMode: 'combined', annualMode: 'custom' }), now).valid, false);
  assert.equal(calculateBonus(settings({ taxMode: 'combined' }, { salaryMode: 'net' }), now).valid, false);
});

test('bonus preferences persist in the existing version 4 snapshot', () => {
  const raw = settings({ amountMode: '3', taxMode: 'combined', annualMode: 'custom', annualIncome: '240000', annualDeductions: '54000' });
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(saveSettings(raw, [], createAttendance(now), storage).ok, true);
  const restored = loadSettings(storage, now);
  assert.equal(restored.status, 'loaded');
  assert.equal(restored.settings.bonus.amountMode, '3');
  assert.equal(restored.settings.bonus.annualIncome, 240000);
  assert.equal(calculateBonus(restored.settings, now).tax, calculateBonus(raw, now).tax);
});

test('bonus never changes income snapshot or payroll totals in monthly gross, net and daily modes', () => {
  for (const changes of [{}, { salaryMode: 'net' }, { payBasis: 'daily', dailySalary: 500 }]) {
    const without = settings({ enabled: false }, changes);
    const withBonus = settings({ amountMode: 'custom', customAmount: 1000000 }, changes);
    assert.deepEqual(calculateSnapshot(withBonus, now), calculateSnapshot(without, now));
    assert.deepEqual(calculatePayroll(withBonus, now), calculatePayroll(without, now));
  }
});
