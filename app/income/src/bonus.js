import { calculatePayroll, cumulativeTax } from './payroll.js';

// Bonus settings are calculator preferences, never part of time-based earnings.
export const DEFAULT_BONUS_CONFIG = {
  enabled: false,
  amountMode: '1',
  baseSalary: '',
  customAmount: '',
  taxMode: 'separate',
  taxYear: 2026,
  annualMode: 'estimate',
  annualIncome: '',
  annualDeductions: '',
};
const BONUS_BRACKETS = [
  [3000, 0.03, 0], [12000, 0.10, 210], [25000, 0.20, 1410],
  [35000, 0.25, 2660], [55000, 0.30, 4410], [80000, 0.35, 7360], [Infinity, 0.45, 15160],
];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value) => typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
function money(value) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) throw Error('金额超出可计算范围，请减小金额。');
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateBonusConfig(raw = DEFAULT_BONUS_CONFIG) {
  if (!record(raw)) return { valid: false, config: null, errors: { general: '年终奖设置格式不正确。' } };
  const input = { ...DEFAULT_BONUS_CONFIG, ...raw };
  const config = { enabled: input.enabled };
  const errors = {};
  if (typeof input.enabled !== 'boolean') errors.enabled = '请选择是否开启年终奖。';
  for (const [key, choices] of [
    ['amountMode', ['1', '2', '3', '4', 'custom']],
    ['taxMode', ['separate', 'combined']], ['annualMode', ['estimate', 'custom']],
  ]) {
    config[key] = input[key];
    if (!choices.includes(input[key])) errors[key] = '请选择有效的年终奖选项。';
  }
  for (const key of ['baseSalary', 'customAmount', 'annualIncome', 'annualDeductions']) {
    config[key] = input[key] === '' ? '' : number(input[key]);
    if (config[key] !== '' && (!Number.isFinite(config[key]) || config[key] < 0 || config[key] > Number.MAX_SAFE_INTEGER / 100)) {
      errors[key] = '请输入有效的非负金额。';
    }
  }
  config.taxYear = number(input.taxYear);
  if (!Number.isInteger(config.taxYear) || config.taxYear < 2019 || config.taxYear > 9999) errors.taxYear = '请输入有效的计税年份（2019–9999）。';
  return { valid: !Object.keys(errors).length, config: Object.keys(errors).length ? null : config, errors };
}

export function calculateBonus(settings, now = new Date()) {
  const checked = validateBonusConfig(settings?.bonus);
  if (!checked.valid) return { valid: false, error: Object.values(checked.errors).join(' ') };
  const config = checked.config;
  if (!config.enabled) return { valid: true, enabled: false };
  try {
    const monthlyGross = settings.payBasis === 'monthly' && settings.salaryMode === 'gross';
    const baseSalary = config.baseSalary === '' && monthlyGross ? number(settings.monthlySalary) : number(config.baseSalary);
    const rawBonus = config.amountMode === 'custom' ? number(config.customAmount) : baseSalary * Number(config.amountMode);
    if (!Number.isFinite(rawBonus) || rawBonus < 0) return { valid: false, error: config.amountMode === 'custom' ? '请填写税前年终奖金额。' : '请填写税前月薪基数。' };
    const bonus = money(rawBonus);
    let tax;
    let annualIncome = null;
    let annualDeductions = null;
    let annualTaxWithout = null;
    let annualTaxWith = null;
    if (config.taxMode === 'separate') {
      if (config.taxYear > 2027) return { valid: false, error: '该年份的年终奖单独计税政策尚未确认，请选择综合计税。' };
      const [, rate, deduction] = BONUS_BRACKETS.find(([maximum]) => bonus / 12 <= maximum);
      tax = money(Math.max(0, bonus * rate - deduction));
    } else {
      if (config.annualMode === 'estimate') {
        if (!monthlyGross) return { valid: false, error: '请填写全年税前收入与扣除额。' };
        const payroll = calculatePayroll(settings, now);
        if (!payroll.valid) return { valid: false, error: '工资扣款尚未就绪，请填写全年收入与扣除额，或补全工资设置。' };
        annualIncome = money(number(settings.monthlySalary) * 12);
        annualDeductions = money((payroll.taxDeductibleAmount + number(settings.payroll.additionalDeduction)) * 12);
      } else {
        annualIncome = number(config.annualIncome);
        annualDeductions = number(config.annualDeductions);
        if (!Number.isFinite(annualIncome) || !Number.isFinite(annualDeductions)) return { valid: false, error: '请填写全年税前收入与扣除额（不含基本减除费用）。' };
      }
      // Preserve unused annual deductions: do not clamp the base until after adding bonus.
      const taxableBefore = money(annualIncome - 60000 - annualDeductions);
      annualTaxWithout = cumulativeTax(taxableBefore);
      annualTaxWith = cumulativeTax(money(taxableBefore + bonus));
      tax = money(Math.max(0, annualTaxWith - annualTaxWithout));
    }
    return { valid: true, enabled: true, bonus, tax, netBonus: money(bonus - tax),
      taxMode: config.taxMode, annualIncome, annualDeductions, annualTaxWithout, annualTaxWith };
  } catch (error) {
    return { valid: false, error: error.message || '年终奖计算失败，请检查金额。' };
  }
}
