import { DEFAULT_SETTINGS, validateSettings } from '../../../../app/income/src/calculator.js';
import { type IncomeState, type IncomeSettings } from '../../../shared/contracts';
import { useAutoDraft } from '../../hooks/useAutoDraft';
import { command } from '../../state';
import { Field } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { ErrorList } from '../../components/ErrorList';
import { PayrollFields } from './PayrollFields';

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
      <div className="fields">
        <Field label="月薪口径">
          <select value={d.salaryMode} onChange={(e) => set('salaryMode', e.target.value)}>
            <option value="net">税后月薪，直接计价</option>
            <option value="gross">税前月薪，杭州到手估算</option>
          </select>
        </Field>
        <NumberField
          label="月薪（元）"
          value={d.monthlySalary}
          onChange={(value) => set('monthlySalary', value)}
        />
        <Field label="日历模式">
          <select value={d.calendarMode} onChange={(e) => set('calendarMode', e.target.value)}>
            <option value="cn">国家调休＋每周排班</option>
            <option value="weekly">仅按每周排班</option>
          </select>
        </Field>
        <Field label="上班时间">
          <input
            type="time"
            value={d.startTime}
            onChange={(e) => set('startTime', e.target.value)}
          />
        </Field>
        <Field label="下班时间">
          <input type="time" value={d.endTime} onChange={(e) => set('endTime', e.target.value)} />
        </Field>
      </div>
      <fieldset>
        <legend>每周工作日</legend>
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <label className="check-field" key={day}>
            <input
              type="checkbox"
              checked={d.workdays.includes(day)}
              onChange={(e) =>
                set(
                  'workdays',
                  e.target.checked ? [...d.workdays, day] : d.workdays.filter((v) => v !== day),
                )
              }
            />
            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day]}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>标准午休</legend>
        <label className="check-field">
          <input
            type="checkbox"
            checked={d.lunchCountsAsWork}
            onChange={(e) => set('lunchCountsAsWork', e.target.checked)}
          />
          午休计入标准工时和时间差
        </label>
        <p className="muted">勾选后实际午休全部参与偷出金额；不勾选时排除以下标准午休。</p>
        {!d.lunchCountsAsWork && (
          <div className="fields">
            <Field label="标准午休开始">
              <input
                type="time"
                value={d.lunchStartTime}
                onChange={(e) => set('lunchStartTime', e.target.value)}
              />
            </Field>
            <Field label="标准午休结束">
              <input
                type="time"
                value={d.lunchEndTime}
                onChange={(e) => set('lunchEndTime', e.target.value)}
              />
            </Field>
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend>时间统计模式</legend>
        <label className="check-field">
          <input
            type="checkbox"
            checked={d.stealMode}
            onChange={(e) =>
              auto.change({
                ...d,
                stealMode: e.target.checked,
                clockMode: e.target.checked ? d.clockMode : false,
              })
            }
          />
          偷时间模式
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            disabled={!d.stealMode}
            checked={d.clockMode}
            onChange={(e) => set('clockMode', e.target.checked)}
          />
          上下班模式
        </label>
        <p>工资按标准排班自动累计；打开上下班模式后拆分上班晚、午休和下班早。</p>
      </fieldset>
      {d.salaryMode === 'gross' && (
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
