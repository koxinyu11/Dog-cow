import { TimePicker } from '../../components/TimePicker';
import { FormSelect } from '../../components/FormSelect';
import { DatePicker } from '../../components/DatePicker';
import { useEffect, useState } from 'react';
import { type IncomeState } from '../../../shared/contracts';
import { clockCommandError } from '../../../shared/clock-command';
import { localDate } from '../../../domain/tasks/model';
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
}: {
  draft: { action: string; date?: string; token: string; at: number };
  income: IncomeState;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [date, setDate] = useState(draft.date || localDate(new Date(draft.at)));
  const original = income.attendance.days.find((day) => day.date === date);
  const [method, setMethod] = useState(
    draft.action === 'edit' || (draft.action === 'start' ? original?.clockIn : original?.clockOut)
      ? 'backfill'
      : 'recorded',
  );
  const [start, setStart] = useState(time(original?.clockIn?.at));
  const [end, setEnd] = useState(time(original?.clockOut?.at));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStart(time(original?.clockIn?.at));
    setEnd(time(original?.clockOut?.at));
  }, [date]);
  const captured = time(draft.at);
  const startValue = method === 'recorded' && draft.action === 'start' ? captured : start;
  const endValue = method === 'recorded' && draft.action === 'finish' ? captured : end;
  return (
    <Modal
      open
      title={
        draft.action === 'start'
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
          if (validation) {
            setError(validation);
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
              },
              'income',
            );
            const anchor = document.querySelector('.clock-main');
            if (result.applied) {
              notify(result.message);
              onClose();
              fx(draft.action === 'start' ? 'clock-in' : draft.action === 'finish' ? 'clock-out' : 'save', anchor);
            } else {
              setError(result.message);
              fx('error', form);
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>是不是忘记点了？确认后才保存，取消不产生打卡。</p>
        <div className="fields">
          <Field label="打卡日期">
            <DatePicker
              min={income.attendance.trackingFrom}
              max={localDate(new Date(income.now))}
              disabled={method === 'recorded' || draft.action !== 'edit' || !!draft.date}
              value={date}
              onChange={(nextValue) => setDate(nextValue)}
            />
          </Field>
          <Field label="打卡方式">
            <FormSelect value={method} onChange={(nextValue) => setMethod(nextValue)}>
              <option disabled={draft.action === 'edit'} value="recorded">
                现在打卡
              </option>
              <option value="backfill">忘记点击，补实际时间</option>
            </FormSelect>
          </Field>
          <Field label="实际上班时间">
            <TimePicker
              seconds
              value={startValue}
              disabled={method === 'recorded' && (draft.action === 'start' || !!original?.clockIn)}
              onChange={(nextValue) => setStart(nextValue)}
            />
          </Field>
          {(draft.action !== 'start' || original?.clockOut) && (
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
        <p className="muted">
          现在打卡使用打开弹窗时的{' '}
          {new Date(draft.at).toLocaleTimeString('zh-CN', { hour12: false })}
          。下班前必须有实际上班时间。
        </p>
        <p className="error" role="alert">
          {error}
        </p>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" type="submit" disabled={busy} icon={draft.action === 'start' ? <LogIn size={15} /> : draft.action === 'finish' ? <LogOut size={15} /> : <Save size={15} />}>
            确认并保存
          </Button>
        </div>
      </form>
    </Modal>
  );
}
