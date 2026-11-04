import { type Payroll, type Deduction, type IncomeState } from '../../../shared/contracts';
import { HANGZHOU_PAYROLL_POLICY } from '../../../../app/income/data/payroll/hangzhou.js';
import { record } from '../../../domain/tasks/model';
import { command } from '../../state';
import { Field } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { money } from '../../format';

function DeductionFields({
  label,
  value,
  onChange,
  allowNone=true,
}: {
  label: string;
  allowNone?: boolean;
  value: Deduction;
  onChange: (value: Deduction) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="fields">
        <Field label="扣款方式">
          <select
            value={value.method}
            onChange={(e) => onChange({ ...value, method: e.target.value })}
          >
            <option value="percent">按百分比</option>
            <option value="fixed">固定金额</option>
            {allowNone && <option value="none">不缴</option>}
          </select>
        </Field>
        {value.method === 'percent' && (
          <NumberField
            label="比例（%）"
            value={value.rate}
            onChange={(rate) => onChange({ ...value, rate })}
          />
        )}{' '}
        {value.method === 'fixed' && (
          <NumberField
            label="固定金额（元）"
            value={value.amount}
            onChange={(amount) => onChange({ ...value, amount })}
          />
        )}
      </div>
    </fieldset>
  );
}
export function PayrollFields({
  value,
  change,
  income,
}: {
  value: Payroll;
  change: (value: Payroll) => void;
  income: IncomeState;
}) {
  const set = (key: keyof Payroll, next: unknown) => change({ ...value, [key]: next });
  const result = income.payrollResult;
  return (
    <section className="settings-section">
      <h3>杭州个人薪税估算</h3>
      <p className="muted">个人扣款与单位成本分开。自定义现金扣款不代表全额免税。</p>
      <div className="fields">
        <Field label="地点">
          <select value={value.city} onChange={(e) => set('city', e.target.value)}>
            <option value="hangzhou">杭州（市区）</option>
          </select>
        </Field>
        <Field label="个税计算方式">
          <select value={value.taxMode} onChange={(e) => set('taxMode', e.target.value)}>
            <option value="estimate">同薪累计预扣估算</option>
            <option value="cumulative">输入前期累计</option>
          </select>
        </Field>
        <NumberField
          label="计税月份（1–12）"
          value={value.taxMonth}
          onChange={(next) => set('taxMonth', next)}
        />
        <button onClick={() => set('taxMonth', new Date(income.now).getMonth() + 1)}>
          使用当前月
        </button>
        <NumberField
          label="每月专项附加扣除"
          value={value.additionalDeduction}
          onChange={(next) => set('additionalDeduction', next)}
        />
        {value.taxMode === 'cumulative' && (
          <>
            <NumberField
              label="本年前期累计应纳税所得额"
              value={value.priorTaxableIncome}
              onChange={(next) => set('priorTaxableIncome', next)}
            />
            <NumberField
              label="本年前期累计已扣税"
              value={value.priorTaxPaid}
              onChange={(next) => set('priorTaxPaid', next)}
            />
          </>
        )}
        {(['social', 'fund'] as const).map((kind) => (
          <section key={kind}>
            <Field label={`${kind === 'social' ? '社保' : '公积金'}基数方式`}>
              <select
                value={value[`${kind}BaseMode`]}
                onChange={(e) => set(`${kind}BaseMode`, e.target.value)}
              >
                <option value="salary">按工资在政策范围内估算</option>
                <option value="custom">自定义基数</option>
              </select>
            </Field>
            {value[`${kind}BaseMode`] === 'custom' && (
              <NumberField
                label="自定义缴费基数"
                value={value[`${kind}Base`]}
                onChange={(next) => set(`${kind}Base`, next)}
              />
            )}
          </section>
        ))}
      </div>
      {Object.entries(value.items).map(([id, item]) => (
        <DeductionFields
          key={id}
          label={
            HANGZHOU_PAYROLL_POLICY.items[id as keyof typeof HANGZHOU_PAYROLL_POLICY.items]?.name ||
            id
          }
          value={item}
          onChange={(next) => set('items', { ...value.items, [id]: next })}
        />
      ))}
      <h4>其他自定义扣款</h4>
      {value.extras.map((item, index) => (
        <fieldset key={item.id}>
          <legend>第 {index + 1} 项</legend>
          <Field label="扣款名称">
            <input
              value={item.name}
              onChange={(e) =>
                set(
                  'extras',
                  value.extras.map((entry, i) =>
                    i === index ? { ...entry, name: e.target.value } : entry,
                  ),
                )
              }
            />
          </Field>
          <DeductionFields
            label="计算方式"
            allowNone={false}
            value={item}
            onChange={(next) =>
              set(
                'extras',
                value.extras.map((entry, i) => (i === index ? { ...entry, ...next } : entry)),
              )
            }
          />
          <NumberField
            label="其中合法税前可扣金额"
            value={item.taxDeductibleAmount}
            onChange={(next) =>
              set(
                'extras',
                value.extras.map((entry, i) =>
                  i === index ? { ...entry, taxDeductibleAmount: next } : entry,
                ),
              )
            }
          />
          <button
            onClick={() =>
              set(
                'extras',
                value.extras.filter((entry) => entry.id !== item.id),
              )
            }
          >
            删除扣项
          </button>
        </fieldset>
      ))}
      <button
        onClick={() =>
          set('extras', [
            ...value.extras,
            {
              id: crypto.randomUUID(),
              name: '其他扣款',
              method: 'fixed',
              amount: 0,
              rate: 0,
              taxDeductibleAmount: 0,
            },
          ])
        }
      >
        添加扣项
      </button>
      {result && (
        <section>
          <h4>估算结果</h4>
          <div className="fields">
            {[
              ['grossSalary', '税前月薪'],
              ['personalContributions', '个人社保'],
              ['fundPersonal', '个人公积金'],
              ['otherDeductions', '其他扣款'],
              ['tax', '本月个税'],
              ['netSalary', '税后月薪'],
            ].map(([key, label]) => (
              <p key={key}>
                {label}：¥{money(result[key])}
              </p>
            ))}
          </div>
          <p>{String(result.assumption || '')}</p>
          {Array.isArray(result.warnings) &&
            result.warnings.map((warning, i) => (
              <p className="notice" key={i}>
                {String(warning)}
              </p>
            ))}
          {Array.isArray(result.items) && (
            <details>
              <summary>扣款明细</summary>
              {result.items.map((item, i) => (
                <p key={i}>
                  {record(item)
                    ? `${String(item.name || '扣项')}：¥${money(item.amount)}，其中税前可扣 ¥${money(item.taxDeductibleAmount)}`
                    : '扣项明细不可用'}
                </p>
              ))}
            </details>
          )}
        </section>
      )}
      <details>
        <summary>政策快照与来源</summary>
        <p>
          核对日期：{HANGZHOU_PAYROLL_POLICY.checkedAt}；公积金适用期{' '}
          {HANGZHOU_PAYROLL_POLICY.fund.effectiveFrom} 至 {HANGZHOU_PAYROLL_POLICY.fund.effectiveTo}
        </p>
        {HANGZHOU_PAYROLL_POLICY.sources.map((source) => (
          <p key={source.url}>
            <button onClick={() => void command('openSource', { url: source.url })}>
              {source.title}
            </button>
          </p>
        ))}
      </details>
    </section>
  );
}
