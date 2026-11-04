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
import { Check, Segmented, Switch } from '../../ui';

export function IncomeSettingsPanel({
  income,
  notify,
}: {
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
  return (
    <section onBlur={() => void auto.flush()}>
      <h3>工资与排班</h3>
      <div className="pay-mode">
        <Segmented<IncomeSettings['payBasis']>
          label="计薪方式"
          value={d.payBasis}
          options={[[ 'monthly', '包月上班' ], [ 'daily', '按天营业' ]]}
          onChange={(payBasis) => set('payBasis', payBasis)}
        />
        <p className="muted">{d.payBasis === 'daily'
          ? '按天计价，输入每天到手金额；不代表每天发工资。本月预计随排班天数变化。'
          : '固定月薪，按本月排班分配到每天；提前上班或晚下班都不会增加工资总额。'}</p>
        {d.payBasis === 'monthly' && <Switch
          label="算算到手"
          hint="开启后输入税前月薪，按现有杭州薪税配置估算到手金额；关闭时直接输入到手月薪。"
          checked={d.salaryMode === 'gross'}
          onChange={(on) => set('salaryMode', on ? 'gross' : 'net')}
        />}
      </div>
      <div className="fields">
        {d.payBasis === 'daily' ? <NumberField
          label="到手日薪（元）"
          error={auto.errors.dailySalary}
          value={d.dailySalary}
          onChange={(value) => set('dailySalary', value)}
        /> : <NumberField
          label={d.salaryMode === 'gross' ? '税前月薪（元）' : '到手月薪（元）'}
          error={auto.errors.monthlySalary}
          value={d.monthlySalary}
          onChange={(value) => set('monthlySalary', value)}
        />}
        <Field label="日历模式" error={auto.errors.calendarMode}>
          <FormSelect value={d.calendarMode} onChange={(nextValue) => set('calendarMode', nextValue)}>
            <option value="cn">国家调休＋每周排班</option>
            <option value="weekly">仅按每周排班</option>
          </FormSelect>
        </Field>
        <Field label="上班时间" error={auto.errors.startTime}>
          <TimePicker
            value={d.startTime}
            onChange={(nextValue) => set('startTime', nextValue)}
          />
        </Field>
        <Field label="下班时间" error={auto.errors.endTime}>
          <TimePicker value={d.endTime} onChange={(nextValue) => set('endTime', nextValue)} />
        </Field>
      </div>
      <fieldset>
        <legend>每周工作日</legend>
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <Check
            key={day}
            checked={d.workdays.includes(day)}
            onChange={(on) => set('workdays', on ? [...d.workdays, day] : d.workdays.filter((v) => v !== day))}
            label={['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day]}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend>标准午休</legend>
        <Switch
          checked={d.lunchCountsAsWork}
          onChange={(on) => set('lunchCountsAsWork', on)}
          label="午休计入标准工时和时间差"
          hint="打开后实际午休全部参与偷出金额；关闭时排除以下标准午休。"
        />
        {!d.lunchCountsAsWork && (
          <div className="fields">
            <Field label="标准午休开始" error={auto.errors.lunchStartTime}>
              <TimePicker
                value={d.lunchStartTime}
                onChange={(nextValue) => set('lunchStartTime', nextValue)}
              />
            </Field>
            <Field label="标准午休结束" error={auto.errors.lunchEndTime}>
              <TimePicker
                value={d.lunchEndTime}
                onChange={(nextValue) => set('lunchEndTime', nextValue)}
              />
            </Field>
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend>时间统计模式</legend>
        <Switch
          checked={d.stealMode}
          label="偷时间模式"
          onChange={(on) => auto.change({ ...d, stealMode: on, clockMode: on ? d.clockMode : false })}
        />
        <Switch
          checked={d.clockMode}
          disabled={!d.stealMode}
          label="上下班模式"
          hint={d.stealMode ? undefined : '需先打开偷时间模式'}
          onChange={(on) => set('clockMode', on)}
        />
        <p>每日应得工资固定；上下班模式中提前上班开始累计，点击下班补齐当日应得工资，差额计入下班早，收入不超过日薪。</p>
      </fieldset>
      {d.payBasis === 'monthly' && d.salaryMode === 'gross' && (
        <PayrollFields
          value={d.payroll}
          change={(value) => set('payroll', value)}
          income={income}
        />
      )}
      <ErrorList errors={auto.errors} />
      <p role="status">{auto.feedback}</p>
      {income.migrationNotice && <p className="notice">{income.migrationNotice}</p>}
      {income.calculationError && <p className="notice">{income.calculationError.message}</p>}
      <p>
        调休加载：{income.calendar.busy ? '检查中' : '已检查'}；
        {income.snapshot ? `本月工作日 ${income.snapshot.monthlyWorkdays} 天` : '计算待就绪'}
      </p>
      <button onClick={() => void command('refreshCalendar').then((r) => notify(r.message))}>
        刷新调休日历
      </button>
      <p className="muted">
        {Object.entries(income.calendar.results)
          .map(
            ([year, result]) =>
              `${year}：${result.status === 'ready' ? '可用' : '不可用'} / ${result.source || '无来源'}${result.refreshFailed ? '（联网刷新失败）' : ''}`,
          )
          .join('；')}
      </p>
      <p className="muted">
        有效输入自动保存，输入未完成时继续用上次有效设置。修改设置按当前口径重算整月。
      </p>
    </section>
  );
}
