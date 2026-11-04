import { HANGZHOU_PAYROLL_POLICY as POLICY } from '../data/payroll/hangzhou.js';

export const DEFAULT_PAYROLL_CONFIG = {
  city: 'hangzhou',
  taxMode: 'estimate',
  taxMonth: 11,
  additionalDeduction: 0,
  priorTaxableIncome: 0,
  priorTaxPaid: 0,
  socialBaseMode: 'salary',
  socialBase: 0,
  fundBaseMode: 'salary',
  fundBase: 0,
  items: {
    pension: { method: 'percent', rate: 8, amount: 0 },
    medical: { method: 'percent', rate: 2, amount: 0 },
    unemployment: { method: 'percent', rate: 0.5, amount: 0 },
    fund: { method: 'percent', rate: 12, amount: 0 },
  },
  extras: [],
};

const TAX_BRACKETS = [
  { maximum: 36000, rate: 0.03, deduction: 0 },
  { maximum: 144000, rate: 0.10, deduction: 2520 },
  { maximum: 300000, rate: 0.20, deduction: 16920 },
  { maximum: 420000, rate: 0.25, deduction: 31920 },
  { maximum: 660000, rate: 0.30, deduction: 52920 },
  { maximum: 960000, rate: 0.35, deduction: 85920 },
  { maximum: Infinity, rate: 0.45, deduction: 181920 },
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

export function validatePayrollConfig(raw) {
  if (!isRecord(raw)) {
    return { valid: false, config: null, errors: { general: '工资扣款设置格式不正确。' } };
  }

  const input = { ...DEFAULT_PAYROLL_CONFIG, ...raw };
  const errors = {};
  const config = {};
  const number = (value, key, label, maximum = Infinity) => {
    const parsed = parseNumber(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) {
      errors[key] = `${label}必须是${maximum === Infinity ? '有限的非负数' : `0 至 ${maximum} 之间的数值`}。`;
    }
    return parsed;
  };
  const choice = (key, allowed, label) => {
    if (!allowed.includes(input[key])) errors[key] = `请选择有效的${label}。`;
    config[key] = input[key];
  };

  choice('city', ['hangzhou'], '城市，目前仅支持杭州市区');
  choice('taxMode', ['estimate', 'cumulative'], '个税计算方式');
  config.taxMonth = parseNumber(input.taxMonth);
  if (!Number.isInteger(config.taxMonth) || config.taxMonth < 1 || config.taxMonth > 12) {
    errors.taxMonth = '计税月份必须为 1 至 12 月。';
  }
  for (const [key, label] of [
    ['additionalDeduction', '每月专项附加扣除'],
    ['priorTaxableIncome', '本年前期累计应纳税所得额'],
    ['priorTaxPaid', '本年前期累计已扣个税'],
    ['socialBase', '社保缴费基数'],
    ['fundBase', '公积金缴费基数'],
  ]) config[key] = number(input[key], key, label);
  choice('socialBaseMode', ['salary', 'custom'], '社保基数方式');
  choice('fundBaseMode', ['salary', 'custom'], '公积金基数方式');

  config.items = {};
  if (!isRecord(input.items)) errors.items = '个人险金扣款设置格式不正确。';
  for (const [id, policy] of Object.entries(POLICY.items)) {
    const source = isRecord(input.items?.[id]) ? input.items[id] : DEFAULT_PAYROLL_CONFIG.items[id];
    if (input.items && Object.hasOwn(input.items, id) && !isRecord(input.items[id])) {
      errors[`items.${id}.method`] = `${policy.name}设置格式不正确。`;
    }
    const item = { method: source.method };
    if (!['percent', 'fixed', 'none'].includes(item.method)) {
      errors[`items.${id}.method`] = `请选择${policy.name}的扣款方式。`;
    }
    item.rate = number(source.rate, `items.${id}.rate`, `${policy.name}比例`, 100);
    item.amount = number(source.amount, `items.${id}.amount`, `${policy.name}固定金额`);
    config.items[id] = item;
  }

  config.extras = [];
  const ids = new Set();
  if (!Array.isArray(input.extras)) errors.extras = '其他扣款必须为列表。';
  for (const [index, source] of (Array.isArray(input.extras) ? input.extras : []).entries()) {
    const prefix = `extras.${index}`;
    if (!isRecord(source)) {
      errors[prefix] = `第 ${index + 1} 项其他扣款格式不正确。`;
      continue;
    }
    const item = {
      id: typeof source.id === 'string' ? source.id.trim() : '',
      name: typeof source.name === 'string' ? source.name.trim() : '',
      method: source.method,
      rate: number(source.rate, `${prefix}.rate`, '其他扣款比例', 100),
      amount: number(source.amount, `${prefix}.amount`, '其他扣款固定金额'),
      taxDeductibleAmount: number(source.taxDeductibleAmount, `${prefix}.taxDeductibleAmount`, '其他扣款税前可扣金额'),
    };
    if (!item.id || ids.has(item.id)) errors[`${prefix}.id`] = '其他扣款编号不能为空或重复，请重新添加。';
    ids.add(item.id);
    if (!item.name) errors[`${prefix}.name`] = '请填写其他扣款名称。';
    if (!['percent', 'fixed'].includes(item.method)) errors[`${prefix}.method`] = '请选择其他扣款的计算方式。';
    if (item.method === 'fixed' && item.taxDeductibleAmount > item.amount) {
      errors[`${prefix}.taxDeductibleAmount`] = '税前可扣金额不能超过该项实际扣款。';
    }
    config.extras.push(item);
  }

  return Object.keys(errors).length > 0
    ? { valid: false, config: null, errors }
    : { valid: true, config, errors };
}

function finite(value) {
  if (!Number.isFinite(value)) throw new Error('数值过大，无法安全计算工资，请减小金额或扣款参数。');
  return value;
}

function money(value) {
  finite(value);
  // At this magnitude JavaScript cannot represent fractional yuan; avoid overflowing * 100.
  if (Math.abs(value) >= 1e21) return value;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(values) {
  return values.reduce((total, value) => finite(total + value), 0);
}

function cumulativeTax(taxableIncome) {
  const income = Math.max(0, finite(taxableIncome));
  const bracket = TAX_BRACKETS.find((item) => income <= item.maximum);
  return money(Math.max(0, finite(income * bracket.rate - bracket.deduction)));
}

function invalid(error) {
  return {
    valid: false, netSalary: null, grossSalary: null, tax: null,
    personalContributions: null, fundPersonal: null, otherDeductions: null,
    totalDeductions: null, items: [], warnings: [], assumption: '', error,
  };
}

export function calculatePayroll(settings, now = new Date()) {
  const salary = parseNumber(settings?.monthlySalary);
  if (!Number.isFinite(salary) || salary < 0) return invalid('请输入有效的非负月薪。');
  if (settings?.salaryMode !== 'net' && settings?.salaryMode !== 'gross') return invalid('请选择税前或税后月薪。');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return invalid('当前日期无效，无法计算工资。');
  if (settings.salaryMode === 'net') {
    return {
      valid: true, netSalary: money(salary), grossSalary: null, tax: 0,
      personalContributions: 0, fundPersonal: 0, otherDeductions: 0,
      totalDeductions: 0, taxDeductibleAmount: 0, taxableIncome: 0,
      items: [], warnings: [], assumption: '输入金额已是税后月薪，直接用于计费，不再扣除个税或险金。',
    };
  }

  const validation = validatePayrollConfig(settings.payroll ?? DEFAULT_PAYROLL_CONFIG);
  if (!validation.valid) return invalid(Object.values(validation.errors).join(' '));
  const config = validation.config;

  try {
    const grossSalary = money(salary);
    const warnings = [];
    const bases = {};
    for (const type of ['social', 'fund']) {
      const policy = POLICY[type];
      bases[type] = config[`${type}BaseMode`] === 'salary'
        ? Math.min(policy.maximumBase, Math.max(policy.minimumBase, grossSalary))
        : config[`${type}Base`];
      if (config[`${type}BaseMode`] === 'custom'
        && (bases[type] < policy.minimumBase || bases[type] > policy.maximumBase)) {
        warnings.push(`${type === 'social' ? '社保' : '公积金'}自定义基数超出本期政策范围：现金按输入扣款，税前可扣额另按政策上限限制，请核对工资条。`);
      }
    }

    const items = Object.entries(POLICY.items).map(([id, policy]) => {
      const item = config.items[id];
      const base = bases[policy.base];
      const amount = money(item.method === 'none' ? 0 : item.method === 'fixed'
        ? item.amount : finite(base * (item.rate / 100)));
      const legalBase = Math.min(base, POLICY[policy.base].maximumBase);
      const legalRate = item.method === 'percent' ? Math.min(item.rate, policy.rate) : policy.rate;
      const taxDeductibleAmount = money(Math.min(amount, finite(legalBase * (legalRate / 100))));
      if (amount > taxDeductibleAmount) {
        warnings.push(`${policy.name}实际扣款有 ¥${money(amount - taxDeductibleAmount).toFixed(2)} 超出本工具的税前扣除上限，超出部分仍计入应税收入。`);
      }
      if (id === 'fund' && item.method === 'percent'
        && (item.rate < POLICY.fund.minimumRate || item.rate > POLICY.fund.maximumRate)) {
        warnings.push('公积金自定义比例不在普通职工 5%–12% 的政策范围内，请按工资条核实；税前可扣比例最高按 12%。');
      }
      return {
        id, name: policy.name, method: item.method, amount, taxDeductibleAmount,
        base: item.method === 'none' ? null : base,
        rate: item.method === 'percent' ? item.rate : null,
      };
    });

    for (const item of config.extras) {
      const amount = money(item.method === 'fixed' ? item.amount : finite(grossSalary * (item.rate / 100)));
      const taxDeductibleAmount = money(item.taxDeductibleAmount);
      if (taxDeductibleAmount > amount) return invalid(`${item.name}的税前可扣金额不能超过实际扣款。`);
      items.push({
        ...item, amount, taxDeductibleAmount,
        base: item.method === 'percent' ? grossSalary : null,
        rate: item.method === 'percent' ? item.rate : null,
      });
    }

    const taxDeductibleAmount = money(sum(items.map((item) => item.taxDeductibleAmount)));
    const deductionBeforeTax = sum([taxDeductibleAmount, config.additionalDeduction]);
    const monthlyTaxableIncome = finite(finite(grossSalary - deductionBeforeTax) - 5000);
    let taxableIncome;
    let tax;
    let assumption;
    if (config.taxMode === 'estimate') {
      taxableIncome = Math.max(0, finite(monthlyTaxableIncome * config.taxMonth));
      const previousIncome = Math.max(0, finite(monthlyTaxableIncome * (config.taxMonth - 1)));
      tax = money(Math.max(0, finite(cumulativeTax(taxableIncome) - cumulativeTax(previousIncome))));
      assumption = `按本年 1–${config.taxMonth} 月工资、险金与专项附加扣除均相同估算，第 ${config.taxMonth} 月个税为当月与上月累计税额之差，并非全年平均月税。`;
    } else {
      taxableIncome = Math.max(0, finite(config.priorTaxableIncome + monthlyTaxableIncome));
      const taxBalance = finite(cumulativeTax(taxableIncome) - config.priorTaxPaid);
      tax = money(Math.max(0, taxBalance));
      if (taxBalance < 0) warnings.push('累计已扣个税高于本期累计应纳税额，本期个税按 0 计，不自动退税。');
      assumption = `第 ${config.taxMonth} 月按所填本年前期累计应纳税所得额与已扣税额计算；前期应纳税所得额已扣除前期基本减除费用、险金和其他合法扣除。`;
    }

    const personalContributions = money(sum(items.slice(0, 3).map((item) => item.amount)));
    const fundPersonal = items.find((item) => item.id === 'fund').amount;
    const otherDeductions = money(sum(items.slice(4).map((item) => item.amount)));
    const totalDeductions = money(sum([personalContributions, fundPersonal, otherDeductions, tax]));
    const netSalary = money(Math.max(0, finite(grossSalary - totalDeductions)));
    if (totalDeductions > grossSalary) warnings.push('扣款合计超过税前月薪，税后计费月薪按 0 计，请核对固定扣款和缴费基数。');
    if (config.socialBaseMode === 'salary' || config.fundBaseMode === 'salary') {
      warnings.push('部分缴费基数由本月工资在政策上下限内估算，实际通常按上年度平均工资或单位申报值；可切换为自定义基数。');
    }
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (now.getFullYear() !== POLICY.social.year || date < POLICY.fund.effectiveFrom || date > POLICY.fund.effectiveTo) {
      warnings.push('当前日期超出部分内置政策参数的适用期，请按最新政策或实际工资条调整基数和扣款。');
    }
    assumption += ' 每月基本减除费用 5000 元；不含奖金、补缴补差和年度汇算。结果用于时间收入折算，不按每日请假重新计算个税。';
    return {
      valid: true, grossSalary, netSalary, tax, personalContributions, fundPersonal,
      otherDeductions, totalDeductions, items, warnings, assumption,
      taxDeductibleAmount, taxableIncome, taxMonth: config.taxMonth,
    };
  } catch (error) {
    return invalid(error.message || '工资计算失败，请检查输入金额。');
  }
}
