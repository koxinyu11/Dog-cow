import { Gift } from 'lucide-react';
import { DEFAULT_BONUS_CONFIG, calculateBonus } from '../../../../app/income/src/bonus.js';
import type { BonusConfig, IncomeSettings } from '../../../shared/contracts';
import { Field } from '../../components/Modal';
import { FormSelect } from '../../components/FormSelect';
import { NumberField } from '../../components/NumberField';
import { Rolling, Segmented, Switch } from '../../ui';
import { money } from '../../format';

export function BonusFields({ settings, now, change }: {
  settings: IncomeSettings; now: number; change: (bonus: BonusConfig) => void;
}) {
  const value = settings.bonus || DEFAULT_BONUS_CONFIG;
  const set = (key: keyof BonusConfig, next: unknown) => change({ ...value, [key]: next });
  const monthlyGross = settings.payBasis === 'monthly' && settings.salaryMode === 'gross';
  const result = calculateBonus(settings, new Date(now));
  return <section className="setting-group bonus-settings">
    <Switch label={<><Gift size={16} /> 年终奖</>} checked={value.enabled} onChange={(enabled) => change({ ...value, enabled,
      annualMode: !monthlyGross && value.annualMode === 'estimate' ? 'custom' : value.annualMode })} />
    {value.enabled && <div className="bonus-content">
      <Segmented<string> label="年终奖金额" value={value.amountMode} onChange={(mode) => set('amountMode', mode)}
        options={[[ '1', '×1' ], [ '2', '×2' ], [ '3', '×3' ], [ '4', '×4' ], [ 'custom', '自定义' ]]} />
      <div className="bonus-amount-field">
        {value.amountMode === 'custom' ? <NumberField label="税前年终奖（元）" value={value.customAmount} onChange={(v) => set('customAmount', v)} />
          : <Field label="税前月薪基数（元）">
            <input type="number" step="any" inputMode="decimal" min="0" value={value.baseSalary}
              placeholder={monthlyGross ? String(settings.monthlySalary || '填写基数') : '填写基数'}
              onChange={(e) => set('baseSalary', e.target.value)} />
          </Field>}
      </div>
      <Segmented<string> label="年终奖计税方式" value={value.taxMode} onChange={(mode) => set('taxMode', mode)}
        options={[[ 'separate', '单独计税' ], [ 'combined', '综合计税' ]]} />
      <div className="bonus-tax-inputs">
        <NumberField label="计税年份" value={value.taxYear} onChange={(v) => set('taxYear', v)} />
        {value.taxMode === 'combined' && <>
          <Field label="全年收入与扣除"><FormSelect value={value.annualMode} onChange={(mode) => set('annualMode', mode)}>
            <option value="estimate" disabled={!monthlyGross}>按当前工资 ×12 估算</option><option value="custom">自定义全年金额</option>
          </FormSelect></Field>
          {value.annualMode === 'custom' && <>
            <NumberField label="全年税前收入（不含本次奖金，元）" value={value.annualIncome} onChange={(v) => set('annualIncome', v)} />
            <NumberField label="全年税前扣除（不含基本减除，元）" value={value.annualDeductions} onChange={(v) => set('annualDeductions', v)} />
          </>}
        </>}
      </div>
      <div className={`payroll-preview bonus-preview ${result.valid ? '' : 'is-pending'}`} aria-live="polite">
        <span>年终奖到手</span>
        <strong>{result.valid && 'netBonus' in result ? <Rolling text={`¥${money(result.netBonus)}`} /> : '待补全'}</strong>
        {result.valid && 'bonus' in result ? <dl>
          <div><dt>税前奖金</dt><dd><Rolling text={`¥${money(result.bonus)}`} /></dd></div>
          <div><dt>{value.taxMode === 'combined' ? '奖金增量税额' : '奖金个税'}</dt><dd><Rolling text={`¥${money(result.tax)}`} /></dd></div>
        </dl> : <p className="field-error" role="alert">{'error' in result ? String(result.error) : ''}</p>}
      </div>
      <details className="settings-help bonus-help"><summary>计算明细</summary>
        <p>此处仅算税，不计入每日或月收入。按符合条件的居民个人全年一次性奖金估算；单独计税每年限用一次。</p>
        {value.amountMode !== 'custom' && monthlyGross && value.baseSalary === '' && <p>奖金基数跟随税前月薪。</p>}
        {value.taxMode === 'combined' && <p>基本减除费用 ¥60,000 单独计算；全年扣除额填写社保、公积金、专项附加扣除等合法税前扣除。</p>}
        {result.valid && 'annualIncome' in result && result.annualIncome !== null && <>
          <p>{value.annualMode === 'estimate' ? '同薪全年估算' : '自定义全年'} · 收入 ¥{money(result.annualIncome)} · 扣除 ¥{money(result.annualDeductions)}</p>
          <p>不含奖金全年税额 ¥{money(result.annualTaxWithout)} · 含奖金全年税额 ¥{money(result.annualTaxWith)}</p>
        </>}
      </details>
    </div>}
  </section>;
}
