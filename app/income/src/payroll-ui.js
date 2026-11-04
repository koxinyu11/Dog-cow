import { DEFAULT_PAYROLL_CONFIG } from './payroll.js';
import { HANGZHOU_PAYROLL_POLICY as POLICY } from '../data/payroll/hangzhou.js';

const FORMAT = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let nextExtra = 0;

export function mountPayrollEditor(container) {
  const document = container.ownerDocument;
  const fields = new Map();
  let extraRows = [];
  let lastRendered = '';
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const emitInput = () => container.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
  const field = (key, label, options = {}, registry = fields) => {
    const wrapper = node('div', undefined, 'field');
    const control = node(options.choices ? 'select' : 'input');
    control.id = `payroll-${key.replaceAll('.', '-')}`;
    const labelElement = node('label', label);
    labelElement.htmlFor = control.id;
    if (options.choices) {
      for (const [value, title] of options.choices) {
        const option = node('option', title);
        option.value = value;
        control.append(option);
      }
    } else {
      control.type = options.type ?? 'number';
      if (control.type === 'number') {
        control.min = '0';
        control.step = '0.01';
        control.inputMode = 'decimal';
        if (options.maximum !== undefined) control.max = String(options.maximum);
      }
    }
    const error = node('p', '', 'field-error');
    error.id = `${control.id}-error`;
    error.hidden = true;
    control.setAttribute('aria-describedby', error.id);
    wrapper.append(labelElement, control);
    if (options.help) {
      const help = node('p', options.help, 'help');
      help.id = `${control.id}-help`;
      wrapper.append(help);
      control.setAttribute('aria-describedby', `${help.id} ${error.id}`);
    }
    wrapper.append(error);
    const entry = { wrapper, control, error };
    registry.set(key, entry);
    return entry;
  };
  const addField = (parent, key, label, options) => {
    const entry = field(key, label, options);
    parent.append(entry.wrapper);
    return entry;
  };
  const section = (title) => {
    const fieldset = node('fieldset');
    fieldset.append(node('legend', title));
    const grid = node('div', undefined, 'fields');
    fieldset.append(grid);
    container.append(fieldset);
    return grid;
  };
  const methodChoices = [['percent', '按比例'], ['fixed', '固定金额'], ['none', '不缴纳']];
  const numberKeys = ['taxMonth', 'additionalDeduction', 'priorTaxableIncome', 'priorTaxPaid', 'socialBase', 'fundBase'];

  container.replaceChildren();
  container.append(node('h3', '税前工资与个人扣款'));
  container.append(node('p', '仅估算个人到手工资；工伤、生育等单位承担费用不从个人月薪扣除。修改后随工资设置一起保存。', 'help'));
  const overview = section('城市与个税');
  addField(overview, 'city', '工作地点', { choices: [['hangzhou', '杭州（市区）']] });
  addField(overview, 'taxMode', '个税计算方式', {
    choices: [['estimate', '同薪估算当月预扣税'], ['cumulative', '填写前期累计数据']],
  });
  const month = addField(overview, 'taxMonth', '计税月份', {
    choices: Array.from({ length: 12 }, (_, index) => [String(index + 1), `${index + 1} 月`]),
  });
  const currentMonth = node('button', '使用当前月', 'secondary');
  currentMonth.type = 'button';
  currentMonth.addEventListener('click', () => {
    month.control.value = String(new Date().getMonth() + 1);
    emitInput();
  });
  month.wrapper.append(currentMonth);
  addField(overview, 'additionalDeduction', '每月专项附加扣除（元）', {
    help: '填符合政策的子女教育、住房租金等专项附加扣除月合计；它是减税依据，不是工资现金扣款。',
  });
  const cumulativeFields = section('本年前期累计数据（不含本月）');
  addField(cumulativeFields, 'priorTaxableIncome', '前期累计应纳税所得额（元）', {
    help: '已经减去前期基本减除费用、个人险金等合法扣除后的累计金额，不是累计税前工资。',
  });
  addField(cumulativeFields, 'priorTaxPaid', '前期累计已扣个税（元）');

  const baseFields = section('缴费基数');
  for (const [type, name, range] of [
    ['social', '社保', '2026 年参考范围 5122–25611 元/月'],
    ['fund', '公积金', '2026-07 至 2027-06，杭州市区参考范围 2660–42151 元/月'],
  ]) {
    addField(baseFields, `${type}BaseMode`, `${name}基数方式`, {
      choices: [['salary', '用月薪估算并应用政策上下限'], ['custom', '填写实际缴费基数']], help: range,
    });
    addField(baseFields, `${type}Base`, `${name}实际缴费基数（元）`, {
      help: '通常取上年度平均工资或单位申报值。自定义超限时按输入扣现金，税前可扣额仍限制在政策范围内。',
    });
  }

  for (const [id, policy] of Object.entries(POLICY.items)) {
    const grid = section(`${policy.name} · 个人部分`);
    addField(grid, `items.${id}.method`, '扣款方式', { choices: methodChoices });
    addField(grid, `items.${id}.rate`, '个人比例（%）', { maximum: 100, help: `政策参考：${id === 'fund' ? '5%–12%' : `${policy.rate}%`}。自定义比例最高可填 100%，超出合法扣除范围的部分不免税。` });
    addField(grid, `items.${id}.amount`, '个人每月固定扣款（元）');
  }

  const extrasSection = node('fieldset');
  extrasSection.append(node('legend', '其他个人扣款'));
  extrasSection.append(node('p', '默认按税后扣款处理。仅在已核实工资条及合法扣除依据时填写“税前可扣金额”，不得超过该项实际扣款。比例按税前月薪计算。', 'help'));
  const extrasContainer = node('div');
  const addExtraButton = node('button', '添加其他扣款', 'secondary');
  addExtraButton.type = 'button';
  extrasSection.append(extrasContainer, addExtraButton);
  container.append(extrasSection);

  const syncVisibility = () => {
    cumulativeFields.parentElement.hidden = fields.get('taxMode').control.value !== 'cumulative';
    for (const type of ['social', 'fund']) {
      fields.get(`${type}Base`).wrapper.hidden = fields.get(`${type}BaseMode`).control.value !== 'custom';
    }
    for (const id of Object.keys(POLICY.items)) {
      const method = fields.get(`items.${id}.method`).control.value;
      fields.get(`items.${id}.rate`).wrapper.hidden = method !== 'percent';
      fields.get(`items.${id}.amount`).wrapper.hidden = method !== 'fixed';
    }
    for (const row of extraRows) {
      row.controls.get('rate').wrapper.hidden = row.controls.get('method').control.value !== 'percent';
      row.controls.get('amount').wrapper.hidden = row.controls.get('method').control.value !== 'fixed';
    }
  };

  const addExtra = (item) => {
    const element = node('fieldset');
    const legend = node('legend', '附加扣款');
    const controls = new Map();
    const grid = node('div', undefined, 'fields');
    const id = item.id;
    element.append(legend, grid);
    for (const [key, label, options] of [
      ['name', '扣款名称', { type: 'text' }],
      ['method', '计算方式', { choices: methodChoices.slice(0, 2) }],
      ['rate', '占税前月薪比例（%）', { maximum: 100 }],
      ['amount', '每月扣款（元）', {}],
      ['taxDeductibleAmount', '其中税前可扣金额（元）', {}],
    ]) {
      const entry = field(`extra-${id}-${key}`, label, options, new Map());
      controls.set(key, entry);
      entry.control.value = String(item[key]);
      grid.append(entry.wrapper);
    }
    const remove = node('button', '删除此扣款', 'secondary');
    remove.type = 'button';
    element.append(remove);
    const row = { id, element, controls };
    remove.addEventListener('click', () => {
      extraRows = extraRows.filter((entry) => entry !== row);
      element.remove();
      addExtraButton.focus();
      emitInput();
    });
    extraRows.push(row);
    extrasContainer.append(element);
  };
  addExtraButton.addEventListener('click', () => {
    const id = `deduction-${Date.now()}-${++nextExtra}`;
    addExtra({ id, name: '其他扣款', method: 'fixed', rate: 0, amount: 0, taxDeductibleAmount: 0 });
    syncVisibility();
    extraRows.at(-1).controls.get('name').control.focus();
    emitInput();
  });
  container.addEventListener('change', syncVisibility);

  const errorSummary = node('p', '', 'field-error');
  errorSummary.hidden = true;
  errorSummary.setAttribute('role', 'alert');
  const resultContainer = node('section');
  resultContainer.className = 'payroll-result';
  container.append(errorSummary, resultContainer);
  const policyDetails = node('details');
  policyDetails.append(node('summary', `政策口径与来源（核验于 ${POLICY.checkedAt}）`));
  policyDetails.append(node('p', '社保与公积金个人扣款使用独立基数。自定义固定金额或比例只改变实际扣款；超政策比例、基数部分不会全部视为免税。桐庐、淳安、建德公积金下限为 2430 元，可用自定义基数填写。', 'help'));
  policyDetails.append(node('p', '职工大病保险个人 48 元/年从医保个人账户扣缴；长护险个人 45 元/年可从医保个人账户扣缴。本工具不再把这两项重复计入每月现金扣款。若工资条确有额外现金扣费，可添加其他扣款。', 'help'));
  const sources = node('ul');
  for (const source of POLICY.sources) {
    const li = node('li');
    const link = node('a', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    li.append(link);
    sources.append(li);
  }
  policyDetails.append(sources);
  container.append(policyDetails);

  const fill = (config) => {
    const value = config ?? DEFAULT_PAYROLL_CONFIG;
    for (const key of ['city', 'taxMode', 'socialBaseMode', 'fundBaseMode', ...numberKeys]) {
      fields.get(key).control.value = String(value[key] ?? DEFAULT_PAYROLL_CONFIG[key]);
    }
    for (const id of Object.keys(POLICY.items)) {
      for (const key of ['method', 'rate', 'amount']) {
        fields.get(`items.${id}.${key}`).control.value = String(value.items?.[id]?.[key] ?? DEFAULT_PAYROLL_CONFIG.items[id][key]);
      }
    }
    extraRows = [];
    extrasContainer.replaceChildren();
    for (const item of value.extras ?? []) addExtra(item);
    syncVisibility();
  };
  fill(DEFAULT_PAYROLL_CONFIG);

  return {
    read() {
      const config = { items: {}, extras: [] };
      for (const key of ['city', 'taxMode', 'socialBaseMode', 'fundBaseMode', ...numberKeys]) config[key] = fields.get(key).control.value;
      for (const id of Object.keys(POLICY.items)) {
        config.items[id] = Object.fromEntries(['method', 'rate', 'amount'].map((key) => [key, fields.get(`items.${id}.${key}`).control.value]));
      }
      config.extras = extraRows.map((row) => ({
        id: row.id,
        ...Object.fromEntries([...row.controls].map(([key, entry]) => [key, entry.control.value])),
      }));
      return config;
    },
    fill,
    render(result) {
      const serialized = JSON.stringify(result);
      if (serialized === lastRendered) return;
      lastRendered = serialized;
      resultContainer.replaceChildren(node('h3', '税后月薪明细'));
      if (!result?.valid) {
        resultContainer.append(node('p', result?.error || '填写有效工资后显示估算。', 'field-error'));
        return;
      }
      const rows = result.grossSalary === null
        ? [['税后计费月薪', result.netSalary]]
        : [
          ['税前月薪', result.grossSalary],
          ...result.items.map((item) => [`${item.name}（税前可扣 ¥${FORMAT.format(item.taxDeductibleAmount)}）`, item.amount]),
          ['当月预扣个税', result.tax],
          ['现金扣款合计', result.totalDeductions],
          ['税后计费月薪', result.netSalary],
        ];
      const table = node('table');
      table.className = 'payroll-breakdown';
      const body = node('tbody');
      for (const [label, value] of rows) {
        const row = node('tr');
        const heading = node('th', label);
        heading.scope = 'row';
        row.append(heading, node('td', `¥${FORMAT.format(value)}`));
        body.append(row);
      }
      table.append(body);
      resultContainer.append(table, node('p', result.assumption, 'help'));
      if (result.warnings.length > 0) {
        const list = node('ul', undefined, 'help');
        for (const warning of result.warnings) list.append(node('li', warning));
        resultContainer.append(list);
      }
    },
    showErrors(errors = {}) {
      const entries = new Map(fields);
      extraRows.forEach((row, index) => {
        for (const [key, entry] of row.controls) entries.set(`extras.${index}.${key}`, entry);
      });
      for (const [key, entry] of entries) {
        const message = errors[key] || '';
        entry.control.setAttribute('aria-invalid', message ? 'true' : 'false');
        entry.error.textContent = message;
        entry.error.hidden = !message;
      }
      errorSummary.textContent = Object.values(errors).join(' ');
      errorSummary.hidden = !errorSummary.textContent;
    },
  };
}
