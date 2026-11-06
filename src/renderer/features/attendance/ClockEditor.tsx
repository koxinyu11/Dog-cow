import { buildFlexDay } from '../../../../app/income/src/flex.js';
import { TimePicker } from '../../components/TimePicker';
import { FormSelect } from '../../components/FormSelect';
import { DatePicker } from '../../components/DatePicker';
import { useEffect, useState } from 'react';
import { type IncomeState } from '../../../shared/contracts';
import { shouldCelebrateOffwork } from '../../../shared/offwork';
import { clockCommandError } from '../../../shared/clock-command';
import { localDate, matchesDate } from '../../../domain/tasks/model';
import { time } from '../../format';
import { command } from '../../state';
import { Modal, Field } from '../../components/Modal';
import { fx } from '../../motion/fx';
import { LogIn, LogOut, Save } from 'lucide-react';
import { Button } from '../../ui';

export function ClockEditor({
  draft,
  income,
  onClose,
  notify,
  onFinished,
}: {
  draft: { action: string; date?: string; token: string; at: number };
  income: IncomeState;
  onClose: () => void;
  notify: (message: string) => void;
  onFinished: (income: IncomeState, date: string, completedTasks: number) => void;
}) {
  const isStart = ['start','flex-start'].includes(draft.action);
  const isEdit = ['edit', 'edit-breaks'].includes(draft.action);
  const breaksOnly = draft.action === 'edit-breaks';
  const isFlex = draft.action==='flex-start';
  const [date, setDate] = useState(draft.date || localDate(new Date(draft.at)));
  const original = income.attendance.days.find((day) => day.date === date);
  const [method, setMethod] = useState(
    isEdit || (isStart ? original?.clockIn : original?.clockOut)
      ? 'backfill'
      : 'recorded',
  );
  const [start, setStart] = useState(time(original?.clockIn?.at));
  const [end, setEnd] = useState(time(original?.clockOut?.at));
  const [breaks, setBreaks] = useState(() => (original?.breaks ?? []).map((item) => ({ id: item.id, startTime: time(item.start.at), endTime: time(item.end?.at) })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBreaks((original?.breaks ?? []).map((item) => ({ id: item.id, startTime: time(item.start.at), endTime: time(item.end?.at) })));
    setError('');
    setStart(time(original?.clockIn?.at));
    setEnd(time(original?.clockOut?.at));
  }, [date]);
  const captured = time(draft.at);
  const startValue = method === 'recorded' && isStart ? captured : start;
  const endValue = method === 'recorded' && draft.action === 'finish' ? captured : end;
  const preview = isFlex && income.settings ? buildFlexDay(income.settings,date,new Date(`${date}T${startValue}`).getTime()) : null;
  const flex = preview?.flex ?? original?.flex;
  return (
    <Modal
      open
      title={
        isFlex ? '弹性打卡' : draft.action === 'start'
          ? '上班打卡'
          : draft.action === 'finish'
            ? '下班打卡'
            : '补录或修改实际时间'
      }
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const validation = clockCommandError(
            { action: draft.action, method, startTime: startValue, endTime: endValue },
            income.settings,
          );
          if (validation || (isFlex && !preview?.flex)) {
            setError(validation || preview?.message || '请输入有效的实际上班时间。');
            fx('error', form);
            return;
          }
          setBusy(true);
          try {
            const result = await command(
              'clock',
              {
                token: draft.token,
                date,
                method,
                startTime: startValue,
                endTime: endValue,
                ...(isEdit ? { breaks } : {}),
              },
              'income',
            );
            const anchor = document.querySelector('.clock-main');
            if (result.applied && result.persisted) {
              notify(result.message);
              onClose();
              if (shouldCelebrateOffwork(draft.action, method, date, income, result)) {
                const completedTasks = result.snapshot!.tasks.tasks.filter((task) => task.done && matchesDate(task, date)).length;
                onFinished(result.snapshot!.income, date, completedTasks);
              } else fx(isStart ? 'clock-in' : 'save', anchor);
            } else {
              setError(result.message);
              fx('error', form);
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        {flex && <div className="clock-flex-preview"><span>{flex.mode==='shift'?'晚到晚走':'只免迟到'}</span><strong>{time(isFlex ? new Date(`${date}T${startValue}`).getTime() : original?.clockIn?.at)} → {time(flex.endAt)}</strong><small>实际到岗 → 当天下班</small></div>}
        {preview && !preview.flex && <p className="error" role="alert">{preview.message}</p>}
        <div className="fields">
          <Field label="打卡日期">
            <DatePicker
              min={income.attendance.trackingFrom}
              max={localDate(new Date(income.now))}
              disabled={method === 'recorded' || !isEdit || !!draft.date}
              value={date}
              onChange={(nextValue) => setDate(nextValue)}
            />
          </Field>
          {!isEdit && <Field label="打卡方式">
            <FormSelect value={method} onChange={(nextValue) => setMethod(nextValue)}>
              <option disabled={isEdit} value="recorded">
                现在打卡
              </option>
              <option value="backfill">忘记点击，补实际时间</option>
            </FormSelect>
          </Field>}
          {!breaksOnly && <Field label="实际上班时间">
            <TimePicker
              seconds
              value={startValue}
              disabled={method === 'recorded' && (isStart || !!original?.clockIn)}
              onChange={(nextValue) => setStart(nextValue)}
            />
          </Field>}
          {(!breaksOnly && (!isStart || original?.clockOut)) && (
            <Field label="实际下班时间">
              <TimePicker
                seconds
                value={endValue}
                disabled={method === 'recorded'}
                onChange={(nextValue) => setEnd(nextValue)}
              />
            </Field>
          )}
        </div>
        {isEdit && <fieldset disabled={busy}>
          <legend>午休</legend>
          {breaks.map((item, index) => <div key={item.id} className="fields">
            <Field label={`午休 ${index + 1} 开始`}><TimePicker seconds value={item.startTime} onChange={(value) => setBreaks(breaks.map((row) => row.id === item.id ? { ...row, startTime: value } : row))} /></Field>
            <Field label={`午休 ${index + 1} 结束`}><TimePicker seconds value={item.endTime} onChange={(value) => setBreaks(breaks.map((row) => row.id === item.id ? { ...row, endTime: value } : row))} />{!item.endTime && original?.breaks.some((row) => row.id === item.id && !row.end) && <small>进行中，可补结束时间</small>}</Field>
            <Button variant="ghost" onClick={() => setBreaks(breaks.filter((row) => row.id !== item.id))}>删除此段</Button>
          </div>)}
          <Button variant="ghost" onClick={() => setBreaks([...breaks, { id: crypto.randomUUID(), startTime: '', endTime: '' }])}>添加午休</Button>
        </fieldset>}
        {!isEdit && <p className="muted">
          现在打卡使用打开弹窗时的{' '}
          {new Date(draft.at).toLocaleTimeString('zh-CN', { hour12: false })}
          。下班前必须有实际上班时间。
        </p>}
        <p className="error" role="alert">
          {error}
        </p>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          {income.toilet?.pendingSave && <Button disabled={busy} onClick={() => void command('retrySave').then(result => { if (!result.persisted) setError(result.message); else onClose(); })}>重试保存</Button>}
          <Button variant="primary" type="submit" disabled={busy || income.toilet?.pendingSave} icon={isStart ? <LogIn size={15} /> : draft.action === 'finish' ? <LogOut size={15} /> : <Save size={15} />}>
            确认并保存
          </Button>
        </div>
      </form>
    </Modal>
  );
}
