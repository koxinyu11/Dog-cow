import { useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { FormSelect } from '../../components/FormSelect';
import { type Payroll, type Deduction, type IncomeSettings } from '../../../shared/contracts';
import { PAYROLL_POLICIES, getPayrollPolicy, payrollItemPolicy, automaticPayrollAvailable, switchPayrollCity, resetPayrollCity } from '../../../../app/income/data/payroll/cities.js';
import { calculatePayroll } from '../../../../app/income/src/payroll.js';
import { Field } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { Button, Rolling } from '../../ui';
import { money } from '../../format';

function DeductionFields({ city, id, value, date, onChange }: {
  city: string; id: string; value: Deduction; date: string; onChange: (value: Deduction) => void;
}) {
  const rule = payrollItemPolicy(city, id)!;
  const available = automaticPayrollAvailable(city, id, date);
  return <section className="payroll-deduction">
    <div className="setting-subheading"><h4>{rule.name}</h4><span className={`policy-badge ${available ? '' : 'needs-input'}`}>{available ? `${rule.minimumBase}–${rule.maximumBase} 元` : '通用估算'}</span></div>
    <div className="settings-pair">
      <Field label="扣款方式"><FormSelect value={value.method} onChange={(method) => onChange({ ...value, method })}>
        <option value="percent">按比例</option>
        <option value="fixed">工资条金额</option><option value="none">不缴</option>
      </FormSelect></Field>
      {value.method === 'percent' && <NumberField label="个人比例（%）" value={value.rate} onChange={(rate) => onChange({ ...value, rate })} />}
      {value.method === 'fixed' && <NumberField label="每月扣款（元）" value={value.amount} onChange={(amount) => onChange({ ...value, amount })} />}
    </div>
    {value.method === 'percent' && <>
      <Field label="此项缴费基数"><FormSelect value={value.baseMode || 'inherit'} onChange={(baseMode) => onChange({ ...value, baseMode, base: value.base ?? 0 })}>
        <option value="inherit">跟随{rule.base === 'fund' ? '公积金' : '社保'}设置</option><option value="salary">按工资估算</option><option value="custom">自定义基数</option>
      </FormSelect></Field>
      {value.baseMode === 'custom' && <NumberField label="缴费基数（元）" value={value.base ?? 0} onChange={(base) => onChange({ ...value, base })} />}
      {!!rule.fixedFee && <small className="muted">另含每月附加扣款 ¥{rule.fixedFee}；未自动计入税前扣除</small>}
    </>}
    {value.method === 'fixed' && <NumberField label={available ? "税前可扣（空白按政策）" : "合法税前可扣（元）"} value={value.taxDeductibleAmount ?? ''}
      onChange={(taxDeductibleAmount) => {
        const next = { ...value };
        if (taxDeductibleAmount === '') delete next.taxDeductibleAmount;
        else next.taxDeductibleAmount = taxDeductibleAmount;
        onChange(next);
      }} />}
  </section>;
}

export function PayrollFields({ value, change, settings, now }: {
  value: Payroll; change: (value: Payroll) => void; settings: IncomeSettings; now: number;
}) {
  const [cityFeedback, setCityFeedback] = useState('');
  const set = (key: keyof Payroll, next: unknown) => change({ ...value, [key]: next });
  const policy = getPayrollPolicy(value.city)!;
  const current = new Date(now);
  const date = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
  // Preview the draft itself: an invalid city draft must never display the previous saved result.
  const result = calculatePayroll({ ...settings, payroll: value }, current);
  const partial = Object.keys(policy.items).some((id) => !automaticPayrollAvailable(value.city, id, date));
  return <aside className="payroll-pane" aria-label="到手估算">
    <div className="setting-subheading"><h3><Calculator size={16} /> 到手估算</h3>{partial && <span className="policy-badge needs-input">含通用估算</span>}</div>
    <Field label="缴纳城市"><FormSelect value={value.city} onChange={(city) => {
      change(switchPayrollCity(value, city));
      setCityFeedback('已切换城市，手填项已保留，请核对。');
    }}>{Object.values(PAYROLL_POLICIES).map((entry) => <option value={entry.city} key={entry.city}>{entry.cityName}</option>)}</FormSelect></Field>
    {cityFeedback && <p className="field-hint" role="status">{cityFeedback}</p>}
    <div className={`payroll-preview ${result.valid ? '' : 'is-pending'}`} aria-live="polite">
      <span>预计每月到手</span><strong>{result.valid ? <Rolling text={`¥${money(result.netSalary)}`} /> : '待补全'}</strong>
      {result.valid ? <dl>{[
        ['个人社保', result.personalContributions], ['公积金', result.fundPersonal], ['个税', result.tax], ['其他扣款', result.otherDeductions],
      ].map(([label, amount]) => <div key={String(label)}><dt>{label}</dt><dd><Rolling text={`¥${money(amount)}`} /></dd></div>)}</dl>
        : <p className="field-error" role="alert">{'error' in result ? String(result.error) : ''}</p>}
    </div>
    <div className="settings-pair">
      <Field label="计税月份"><FormSelect value={String(value.taxMonth)} onChange={(taxMonth) => set('taxMonth', taxMonth)}>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1} 月</option>)}
      </FormSelect></Field>
      <NumberField label="专项附加扣除（元）" value={value.additionalDeduction} onChange={(next) => set('additionalDeduction', next)} />
    </div>
    <details className="payroll-options" key={value.city} open={partial || undefined}><summary>社保与公积金</summary>
      <div className="settings-pair payroll-base-settings">{(['social', 'fund'] as const).map((kind) => <section key={kind}>
        <Field label={`${kind === 'social' ? '社保' : '公积金'}基数`}><FormSelect value={value[`${kind}BaseMode`]} onChange={(mode) => set(`${kind}BaseMode`, mode)}>
          <option value="salary">按工资估算</option><option value="custom">自定义</option>
        </FormSelect></Field>
        {value[`${kind}BaseMode`] === 'custom' && <NumberField label="缴费基数（元）" value={value[`${kind}Base`]} onChange={(next) => set(`${kind}Base`, next)} />}
      </section>)}</div>
      {Object.keys(policy.items).map((id) => <DeductionFields key={id} city={value.city} id={id} date={date} value={value.items[id]}
        onChange={(next) => set('items', { ...value.items, [id]: next })} />)}
      <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={() => { change(resetPayrollCity(value)); setCityFeedback('已恢复默认比例与基数。'); }}>恢复城市默认值</Button>
    </details>
    <details className="payroll-options"><summary>累计个税与其他扣款</summary>
      <Field label="个税方式"><FormSelect value={value.taxMode} onChange={(next) => set('taxMode', next)}>
        <option value="estimate">同薪累计估算</option><option value="cumulative">填写前期累计</option>
      </FormSelect></Field>
      {value.taxMode === 'cumulative' && <>
        <NumberField label="前期累计应纳税所得额（元）" value={value.priorTaxableIncome} onChange={(v) => set('priorTaxableIncome', v)} />
        <NumberField label="前期累计已扣税（元）" value={value.priorTaxPaid} onChange={(v) => set('priorTaxPaid', v)} />
      </>}
      {value.extras.map((item, index) => <section className="payroll-deduction" key={item.id}>
        <Field label="扣款名称"><input value={item.name} onChange={(e) => set('extras', value.extras.map((v, i) => i === index ? { ...v, name: e.target.value } : v))} /></Field>
        <div className="settings-pair">
          <Field label="方式"><FormSelect value={item.method} onChange={(method) => set('extras', value.extras.map((v, i) => i === index ? { ...v, method } : v))}>
            <option value="fixed">固定金额</option><option value="percent">占税前工资比例</option>
          </FormSelect></Field>
          <NumberField label={item.method === 'fixed' ? '每月扣款（元）' : '比例（%）'} value={item.method === 'fixed' ? item.amount : item.rate}
            onChange={(v) => set('extras', value.extras.map((entry, i) => i === index ? { ...entry, [item.method === 'fixed' ? 'amount' : 'rate']: v } : entry))} />
        </div>
        <NumberField label="其中合法税前可扣（元）" value={item.taxDeductibleAmount} onChange={(v) => set('extras', value.extras.map((entry, i) => i === index ? { ...entry, taxDeductibleAmount: v } : entry))} />
        <Button variant="ghost" size="sm" onClick={() => set('extras', value.extras.filter((v) => v.id !== item.id))}>删除扣项</Button>
      </section>)}
      <Button size="sm" onClick={() => set('extras', [...value.extras, { id: crypto.randomUUID(), name: '其他扣款', method: 'fixed', amount: 0, rate: 0, taxDeductibleAmount: 0 }])}>添加扣项</Button>
    </details>
    <details className="payroll-options"><summary>计算明细</summary>
      {result.valid && <>
        {result.items.map((item) => <p key={item.id}>{item.name} · ¥{money(item.amount)}<br /><small className="muted">税前可扣 ¥{money(item.taxDeductibleAmount)}</small></p>)}
        <p>{result.assumption}</p>
        {result.warnings.map((warning, i) => <p className="notice" key={i}>{warning}</p>)}
      </>}

    </details>
  </aside>;
}
