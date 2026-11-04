import { TimePicker } from '../../components/TimePicker';
import { FormSelect } from '../../components/FormSelect';
import { DatePicker } from '../../components/DatePicker';
import { useState } from 'react';
import { type IncomeState, type Fact, type Leave } from '../../../shared/contracts';
import { validateLeaveRecord as legacyValidateLeaveRecord } from '../../../../app/income/src/leave.js';
import { localDate } from '../../../domain/tasks/model';
import { time } from '../../format';
import { command } from '../../state';
import { Field } from '../../components/Modal';
import { ErrorList } from '../../components/ErrorList';
import { Switch } from '../../ui';
import { ClockButtons } from '../attendance/ClockButtons';
import { useAutoDraft } from '../../hooks/useAutoDraft';

const validateLeaveRecord = legacyValidateLeaveRecord as unknown as (
  raw: Leave,
  existing: Leave[],
  editingId?: string | null,
) => { valid: boolean; errors: Record<string, string> };
export function RecordsPanel({
  income,
  open,
  notify,
}: {
  income: IncomeState;
  open: (action: string, date?: string) => void;
  notify: (message: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [seed, setSeed] = useState<Leave>({
    id: crypto.randomUUID(),
    date: localDate(),
    fullDay: true,
    startTime: '',
    endTime: '',
    paid: true,
  });
  const auto = useAutoDraft<Leave>(
    seed,
    (draft) => command('leave', { leave: draft, editingId: editing }, 'income'),
    (draft) => validateLeaveRecord(draft, income.leaves, editing).errors as Record<string, string>,
    editing !== null,
    seed.id,
  );
  const d = auto.draft;
  const set = (key: keyof Leave, value: unknown) => auto.change({ ...d, [key]: value });
  const source = (fact: Fact | null) =>
    fact
      ? `${time(fact.at)}（${fact.source === 'backfill' ? '补录' : '实记'}，首次操作 ${new Date(fact.recordedAt).toLocaleString('zh-CN', { hour12: false })}）`
      : '未登记';
  return (
    <section>
      <h3>打卡和补录</h3>
      <ClockButtons income={income} open={open} notify={notify} />
      <details>
        <summary>已登记的实际时间</summary>
        {[...income.attendance.days].reverse().map((day) => (
          <p key={day.date}>
            {day.date} · 上班 {source(day.clockIn)} · 下班 {source(day.clockOut)} · 午休{' '}
            {day.breaks.length} 段{' '}
            {day.flex && <span> · {day.flex.mode==='shift'?'晚到晚走':'只免迟到'} · 当天下班 {time(day.flex.endAt)} </span>}
            {income.settings?.stealMode && income.settings.clockMode && (
              <button onClick={() => open('edit', day.date)}>补录 / 修改</button>
            )}
          </p>
        ))}
      </details>
      <h3>请假记录</h3>
      <p>新增记录点击添加；已有记录编辑自动保存，“结束编辑”不撤销已保存内容。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (editing) {
            await auto.flush();
            return;
          }
          const checked = validateLeaveRecord(d, income.leaves);
          if (!checked.valid) {
            notify(Object.values(checked.errors).join(' '));
            return;
          }
          const result = await command('leave', { leave: d }, 'income');
          notify(result.message);
          if (result.applied) setSeed({ ...d, id: crypto.randomUUID() });
        }}
      >
        <fieldset disabled={!income.settings}>
          <div className="fields">
            <Field label="请假日期" error={auto.errors.date}>
              <DatePicker  value={d.date} onChange={(nextValue) => set('date', nextValue)} />
            </Field>
            <Field label="是否扣薪">
              <FormSelect
                value={String(d.paid)}
                onChange={(nextValue) => set('paid', nextValue === 'true')}
              >
                <option value="true">带薪请假，不扣钱</option>
                <option value="false">无薪请假，按时长扣钱</option>
              </FormSelect>
            </Field>
            <Field label="开始时间" error={auto.errors.startTime}>
              <TimePicker
                disabled={d.fullDay}
                value={d.startTime || '09:00'}
                onChange={(nextValue) => set('startTime', nextValue)}
              />
            </Field>
            <Field label="结束时间" error={auto.errors.endTime}>
              <TimePicker
                disabled={d.fullDay}
                value={d.endTime || '18:00'}
                onChange={(nextValue) => set('endTime', nextValue)}
              />
            </Field>
          </div>
          <Switch
            checked={d.fullDay}


            label="整天请假"
            onChange={(on) =>
              auto.change({
                ...d,
                fullDay: on,
                startTime: on ? '' : d.startTime || '09:00',
                endTime: on ? '' : d.endTime || '18:00',
              })
            }
          />
          <ErrorList errors={auto.errors} />
          <p role="status">{editing ? auto.feedback : ''}</p>
          <button type="submit">{editing ? '保存修改' : '添加请假'}</button>
          {editing && (
            <button
              type="button"
              onClick={async () => {
                await auto.flush();
                setEditing(null);
                setSeed({
                  id: crypto.randomUUID(),
                  date: localDate(),
                  fullDay: true,
                  startTime: '',
                  endTime: '',
                  paid: true,
                });
              }}
            >
              结束编辑
            </button>
          )}
        </fieldset>
      </form>
      <ul>
        {income.leaves.map((leave) => (
          <li key={leave.id}>
            {leave.date} · {leave.fullDay ? '整天' : `${leave.startTime}–${leave.endTime}`} ·{' '}
            {leave.paid ? '带薪' : '无薪'}{' '}
            <button
              onClick={async () => {
                await auto.flush();
                setEditing(leave.id);
                setSeed(leave);
              }}
            >
              修改
            </button>
            <button
              onClick={() =>
                void command('removeLeave', { id: leave.id }, 'income').then((r) => {
                  notify(r.message);
                  if (r.applied && editing === leave.id) setEditing(null);
                })
              }
            >
              删除
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
