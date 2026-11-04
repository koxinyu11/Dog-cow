import { CalendarDays, Clock3, Coffee, Timer, Wallet } from 'lucide-react';
import { TimePicker } from '../../components/TimePicker';
import { FormSelect } from '../../components/FormSelect';
import { DEFAULT_SETTINGS, validateSettings } from '../../../../app/income/src/calculator.js';
import { type IncomeState, type IncomeSettings } from '../../../shared/contracts';
import { useAutoDraft } from '../../hooks/useAutoDraft';
import { command } from '../../state';
import { Field } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { ErrorList } from '../../components/ErrorList';
import { PayrollFields } from './PayrollFields';
import { BonusFields } from './BonusFields';
import { Button, Segmented, Switch } from '../../ui';

export function IncomeSettingsPanel({ income, notify }: {
  income: IncomeState;
  notify: (message: string) => void;
}) {
  const auto = useAutoDraft<IncomeSettings>(
    income.settings || (structuredClone(DEFAULT_SETTINGS) as IncomeSettings),
    (draft) => command('settings', { settings: draft }, 'income'),
    (draft) => validateSettings(draft).errors as Record<string, string>,
  );
  const d = auto.draft;
  const set = (key: keyof IncomeSettings, value: unknown) => auto.change({ ...d, [key]: value });
  const estimating = d.payBasis === 'monthly' && d.salaryMode === 'gross';
  return (
    <section className={`income-settings ${estimating ? 'has-payroll' : ''}`} onBlur={() => void auto.flush()}>
      <div className="income-settings-main">
        <section className="setting-group">
          <h3><Wallet size={16} /> 工资</h3>
          <Segmented<IncomeSettings['payBasis']> label="计薪方式" value={d.payBasis}
            options={[[ 'monthly', '包月上班' ], [ 'daily', '按天营业' ]]}
            onChange={(payBasis) => set('payBasis', payBasis)} />
          <div className="salary-setting">
            <NumberField label={d.payBasis === 'daily' ? '到手日薪（元）' : estimating ? '税前月薪（元）' : '到手月薪（元）'}
              error={d.payBasis === 'daily' ? auto.errors.dailySalary : auto.errors.monthlySalary}
              value={d.payBasis === 'daily' ? d.dailySalary : d.monthlySalary}
              onChange={(value) => set(d.payBasis === 'daily' ? 'dailySalary' : 'monthlySalary', value)} />
            {d.payBasis === 'monthly' && <Switch label="算算到手" checked={estimating}
              onChange={(on) => set('salaryMode', on ? 'gross' : 'net')} />}
          </div>
        </section>
        <BonusFields settings={d} now={income.now} change={(bonus) => set('bonus', bonus)} />
        <section className="setting-group">
          <h3><CalendarDays size={16} /> 排班</h3>
          <Field label="日历" error={auto.errors.calendarMode}>
            <FormSelect value={d.calendarMode} onChange={(value) => set('calendarMode', value)}>
              <option value="cn">国家调休＋每周排班</option><option value="weekly">每周排班</option>
            </FormSelect>
          </Field>
          <div className="weekday-setting" role="group" aria-label="每周工作日">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => <button type="button" key={day}
              aria-label={['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day]}
              aria-pressed={d.workdays.includes(day)}
              onClick={() => set('workdays', d.workdays.includes(day) ? d.workdays.filter((v) => v !== day) : [...d.workdays, day])}>
              <span>周</span>{['日', '一', '二', '三', '四', '五', '六'][day]}
            </button>)}
          </div>
          <div className="settings-pair">
            <Field label="上班" error={auto.errors.startTime}><TimePicker value={d.startTime} onChange={(v) => set('startTime', v)} /></Field>
            <Field label="下班" error={auto.errors.endTime}><TimePicker value={d.endTime} onChange={(v) => set('endTime', v)} /></Field>
          </div>
          <div className="calendar-setting-status">
            <span>{income.calendar.busy ? '调休同步中…' : income.snapshot ? `本月 ${income.snapshot.monthlyWorkdays} 个工作日` : '日历待就绪'}</span>
            <Button size="sm" variant="ghost" disabled={income.calendar.busy}
              onClick={() => void command('refreshCalendar').then((r) => notify(r.message))}>刷新调休</Button>
          </div>
        </section>
        <section className="setting-group">
          <h3><Coffee size={16} /> 午休</h3>
          <Switch checked={d.lunchCountsAsWork} onChange={(on) => set('lunchCountsAsWork', on)} label="午休计入工时" />
          {!d.lunchCountsAsWork && <div className="settings-pair">
            <Field label="午休开始" error={auto.errors.lunchStartTime}><TimePicker value={d.lunchStartTime} onChange={(v) => set('lunchStartTime', v)} /></Field>
            <Field label="午休结束" error={auto.errors.lunchEndTime}><TimePicker value={d.lunchEndTime} onChange={(v) => set('lunchEndTime', v)} /></Field>
          </div>}
        </section>
        <section className="setting-group">
          <h3><Timer size={16} /> 时间记录</h3>
          <Switch checked={d.stealMode} label="偷时间" onChange={(on) => auto.change({ ...d, stealMode: on, clockMode: on ? d.clockMode : false })} />
          <Switch checked={d.clockMode} disabled={!d.stealMode} label="上下班打卡"
            hint={!d.stealMode ? '先开启偷时间' : undefined} onChange={(on) => set('clockMode', on)} />
        </section>
        <details className="settings-help">
          <summary><Clock3 size={14} /> 计薪规则与日历状态</summary>
          <p>{d.payBasis === 'daily' ? '日薪乘以排班天数计算本月预计收入。' : '月薪固定，按排班分配到每天。提前上班不增加日薪；点击下班补齐当天应得收入，差额计入下班早。'}</p>
          <p>有效输入自动保存，修改后按当前口径重算整月；输入未完成时保留上次有效设置。</p>
          {Object.entries(income.calendar.results).map(([year, result]) => <p key={year}>
            {year} · {result.status === 'ready' ? '可用' : '不可用'} · {String(result.source || '无来源')}{result.refreshFailed ? ' · 刷新失败' : ''}
          </p>)}
        </details>
      </div>
      {estimating && <PayrollFields value={d.payroll} change={(value) => set('payroll', value)} settings={d} now={income.now} />}
      <div className="income-settings-feedback">
        <ErrorList errors={auto.errors} />
        <span role="status">{auto.feedback}</span>
        {income.migrationNotice && <p className="notice">{income.migrationNotice}</p>}
        {income.calculationError && <p className="notice">{income.calculationError.message}</p>}
      </div>
    </section>
  );
}
