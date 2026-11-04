import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PAYROLL_CONFIG, validatePayrollConfig, calculatePayroll } from '../../app/income/src/payroll.js';

const now = new Date(2026, 10, 4, 12);
function config(overrides = {}) {
  return { ...structuredClone(DEFAULT_PAYROLL_CONFIG), ...overrides };
}
function calculate(monthlySalary = 20000, overrides = {}) {
  return calculatePayroll({ monthlySalary, salaryMode: 'gross', payroll: config(overrides) }, now);
}
function exemptConfig(overrides = {}) {
  const result = config(overrides);
  for (const item of Object.values(result.items)) item.method = 'none';
  return result;
}

test('payroll defaults are JSON serializable and normalize numeric form values', () => {
  const raw = JSON.parse(JSON.stringify(DEFAULT_PAYROLL_CONFIG));
  raw.taxMonth = '11';
  raw.items.pension.rate = '8';
  const result = validatePayrollConfig(raw);
  assert.equal(result.valid, true);
  assert.deepEqual(result.config, DEFAULT_PAYROLL_CONFIG);
});

test('validates finite nonnegative money, percentage range, month and city', () => {
  for (const value of [-1, Infinity, NaN, '']) {
    assert.equal(validatePayrollConfig(config({ socialBase: value })).valid, false);
  }
  for (const value of [-1, 100.01, Infinity]) {
    const raw = config();
    raw.items.fund.rate = value;
    assert.equal(validatePayrollConfig(raw).valid, false);
  }
  for (const taxMonth of [0, 13, 1.5]) assert.equal(validatePayrollConfig(config({ taxMonth })).valid, false);
  assert.equal(validatePayrollConfig(config({ city: 'unsupported' })).valid, false);
  assert.equal(validatePayrollConfig(null).valid, false);
});

test('January and November estimate the current month cumulative withholding, not annual average', () => {
  const january = calculate(20000, { taxMonth: 1 });
  const november = calculate();
  assert.equal(january.valid, true);
  assert.equal(january.personalContributions, 2100);
  assert.equal(january.fundPersonal, 2400);
  assert.equal(january.tax, 315);
  assert.equal(january.netSalary, 15185);
  assert.equal(november.tax, 1050);
  assert.equal(november.netSalary, 14450);
});

test('monthly salary bases apply the verified lower and upper limits', () => {
  const low = calculate(1000);
  assert.equal(low.items.find((item) => item.id === 'pension').base, 5122);
  assert.equal(low.items.find((item) => item.id === 'fund').base, 2660);
  assert.equal(low.personalContributions, 537.81);
  assert.equal(low.fundPersonal, 319.2);
  assert.equal(low.netSalary, 142.99);
  const high = calculate(50000);
  assert.equal(high.items.find((item) => item.id === 'pension').base, 25611);
  assert.equal(high.items.find((item) => item.id === 'fund').base, 42151);
  assert.equal(high.items.find((item) => item.id === 'unemployment').amount, 128.06);
  assert.equal(high.fundPersonal, 5058.12);
});

test('fixed, percentage and exempt methods are mutually exclusive', () => {
  const raw = config();
  raw.items.pension = { method: 'fixed', rate: 100, amount: 123 };
  raw.items.medical = { method: 'none', rate: 100, amount: 999 };
  raw.items.unemployment = { method: 'percent', rate: 0.5, amount: 999 };
  const result = calculatePayroll({ monthlySalary: 20000, salaryMode: 'gross', payroll: raw }, now);
  assert.equal(result.items[0].amount, 123);
  assert.equal(result.items[1].amount, 0);
  assert.equal(result.items[2].amount, 100);
  assert.equal(result.personalContributions, 223);
});

test('excess actual bases and rates do not all become tax deductible', () => {
  const raw = config({ socialBaseMode: 'custom', socialBase: 30000, fundBaseMode: 'custom', fundBase: 50000, taxMonth: 1 });
  raw.items.pension.rate = 1;
  raw.items.medical.rate = 10;
  raw.items.fund.rate = 20;
  const result = calculatePayroll({ monthlySalary: 50000, salaryMode: 'gross', payroll: raw }, now);
  assert.equal(result.valid, true);
  assert.equal(result.items[0].amount, 300);
  assert.equal(result.items[0].taxDeductibleAmount, 256.11);
  assert.equal(result.items[1].amount, 3000);
  assert.equal(result.items[1].taxDeductibleAmount, 512.22);
  assert.equal(result.fundPersonal, 10000);
  assert.equal(result.items[3].taxDeductibleAmount, 5058.12);
  assert.ok(result.warnings.some((warning) => warning.includes('超出')));
});

test('fixed personal contributions have a separate legal tax deduction ceiling', () => {
  const raw = exemptConfig({ taxMonth: 1 });
  raw.items.pension = { method: 'fixed', amount: 3000, rate: 8 };
  const result = calculatePayroll({ monthlySalary: 20000, salaryMode: 'gross', payroll: raw }, now);
  assert.equal(result.items[0].amount, 3000);
  assert.equal(result.items[0].taxDeductibleAmount, 1600);
  assert.equal(result.tax, 402);
});

test('extras default to post-tax deduction and percent uses gross salary', () => {
  const raw = exemptConfig({ taxMonth: 1, extras: [
    { id: 'food', name: '餐费', method: 'fixed', amount: 200, rate: 0, taxDeductibleAmount: 0 },
    { id: 'other', name: '其他', method: 'percent', amount: 999, rate: 1, taxDeductibleAmount: 0 },
  ] });
  const result = calculatePayroll({ monthlySalary: 10000, salaryMode: 'gross', payroll: raw }, now);
  assert.equal(result.otherDeductions, 300);
  assert.equal(result.taxDeductibleAmount, 0);
  assert.equal(result.tax, 150);
  assert.equal(result.netSalary, 9550);
});

test('only explicitly entered lawful extra deduction reduces taxable income', () => {
  const raw = exemptConfig({ taxMonth: 1, extras: [
    { id: 'deduction', name: '已核实扣除', method: 'fixed', amount: 200, rate: 0, taxDeductibleAmount: 100 },
  ] });
  const result = calculatePayroll({ monthlySalary: 10000, salaryMode: 'gross', payroll: raw }, now);
  assert.equal(result.taxDeductibleAmount, 100);
  assert.equal(result.tax, 147);
  assert.equal(result.netSalary, 9653);
  raw.extras[0].taxDeductibleAmount = 201;
  assert.equal(validatePayrollConfig(raw).valid, false);
});

test('percentage extra deduction cannot claim more tax-free money than actual deduction', () => {
  const result = calculate(1000, { extras: [
    { id: 'invalid', name: '其他', method: 'percent', rate: 1, amount: 0, taxDeductibleAmount: 11 },
  ] });
  assert.equal(result.valid, false);
  assert.match(result.error, /不能超过/);
});

test('cumulative mode uses prior taxable income and prior tax paid', () => {
  const result = calculate(20000, { taxMode: 'cumulative', priorTaxableIncome: 100000, priorTaxPaid: 5000 });
  assert.equal(result.valid, true);
  assert.equal(result.taxableIncome, 110500);
  assert.equal(result.tax, 3530);
  assert.equal(result.netSalary, 11970);
});

test('cumulative overpayment does not create an automatic refund', () => {
  const result = calculate(20000, { taxMode: 'cumulative', priorTaxableIncome: 100000, priorTaxPaid: 10000 });
  assert.equal(result.tax, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('不自动退税')));
});

test('additional deductions reduce tax but are not a cash salary deduction', () => {
  const result = calculate(20000, { taxMonth: 1, additionalDeduction: 1000 });
  assert.equal(result.tax, 285);
  assert.equal(result.totalDeductions, 4785);
  assert.equal(result.netSalary, 15215);
});

test('tax brackets are continuous around the first annual threshold', () => {
  for (const [salary, expectedTax] of [[7999, 89.97], [8000, 90], [8001, 90.87]]) {
    const result = calculatePayroll({ monthlySalary: salary, salaryMode: 'gross', payroll: exemptConfig({ taxMonth: 12 }) }, now);
    assert.equal(result.tax, expectedTax);
  }
});

test('net salary mode never subtracts personal costs or tax again', () => {
  const result = calculatePayroll({ monthlySalary: 10000, salaryMode: 'net', payroll: config({ priorTaxPaid: 9999 }) }, now);
  assert.equal(result.valid, true);
  assert.equal(result.netSalary, 10000);
  assert.equal(result.grossSalary, null);
  assert.equal(result.totalDeductions, 0);
  assert.deepEqual(result.items, []);
});

test('zero salary stays finite and excessive deductions clamp net salary to zero', () => {
  const zero = calculate(0);
  assert.equal(zero.valid, true);
  assert.equal(zero.netSalary, 0);
  assert.equal(zero.tax, 0);
  assert.ok(zero.warnings.some((warning) => warning.includes('超过税前月薪')));
  const result = calculate(100, { extras: [
    { id: 'large', name: '大额扣款', method: 'fixed', amount: 200, rate: 0, taxDeductibleAmount: 0 },
  ] });
  assert.equal(result.valid, true);
  assert.equal(result.netSalary, 0);
});

test('nonfinite salary and overflowing intermediate sums are rejected in Chinese', () => {
  for (const salary of [Infinity, NaN, -1]) assert.equal(calculate(salary).valid, false);
  const overflow = calculate(Number.MAX_VALUE);
  assert.equal(overflow.valid, false);
  assert.match(overflow.error, /数值过大/);
  const extras = [1, 2].map((id) => ({ id: String(id), name: '巨大扣款', method: 'fixed', amount: Number.MAX_VALUE, rate: 0, taxDeductibleAmount: 0 }));
  assert.equal(calculate(10000, { extras }).valid, false);
});

test('policy dates outside verified applicability are identified', () => {
  const result = calculatePayroll({ monthlySalary: 10000, salaryMode: 'gross', payroll: config() }, new Date(2028, 0, 1));
  assert.equal(result.valid, false);
  assert.match(result.error, /适用期/);
});
