import { useEffect, useState } from 'react';
import { type Fields, type Result } from '../../../shared/contracts';
import { weekDates } from '../../../domain/tasks/model';
import { dateLabel } from '../../format';
import { Modal, Field } from '../../components/Modal';
import { CalendarRange, Plus } from 'lucide-react';
import { Button, Switch } from '../../ui';

export function NewTask({
  open,
  date,
  onClose,
  run,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  run: (payload: Fields) => Promise<Result>;
}) {
  const [draft, set] = useState({
    title: '',
    note: '',
    date,
    priority: '中',
    category: '工作',
    hasTime: false,
    startTime: '09:00',
    endTime: '10:00',
    dueDate: '',
    calendarMark: false,
    markerColor: '#8b5cf6',
  });
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (open) {
      set({
        title: '',
        note: '',
        date,
        priority: '中',
        category: '工作',
        hasTime: false,
        startTime: '09:00',
        endTime: '10:00',
        dueDate: '',
        calendarMark: false,
        markerColor: '#8b5cf6',
      });
      setMessage('');
    }
  }, [open]);
  const change = (key: string, value: unknown) => set((d) => ({ ...d, [key]: value }));
  return (
    <Modal open={open} title="新增任务" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await run({ action: 'create', task: draft });
          setMessage(result.message);
          if (result.applied) onClose();
        }}
      >
        <Field label="任务标题">
          <input required value={draft.title} onChange={(e) => change('title', e.target.value)} />
        </Field>
        <div className="fields">
          <Field label="安排日期">
            <select value={draft.date} onChange={(e) => change('date', e.target.value)}>
              {weekDates(date).map((d) => (
                <option key={d} value={d}>
                  {dateLabel(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="优先级">
            <select value={draft.priority} onChange={(e) => change('priority', e.target.value)}>
              {['高', '中', '低'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="标签">
            <input value={draft.category} onChange={(e) => change('category', e.target.value)} />
          </Field>
          <Field label="截止日期（可选）">
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => change('dueDate', e.target.value)}
            />
          </Field>
        </div>
        <Field label="备注">
          <textarea value={draft.note} onChange={(e) => change('note', e.target.value)} />
        </Field>
        <Switch checked={draft.hasTime} label="设置时段" onChange={(on) => change('hasTime', on)} />
        {draft.hasTime && (
          <div className="fields">
            <Field label="开始">
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) => change('startTime', e.target.value)}
              />
            </Field>
            <Field label="结束">
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) => change('endTime', e.target.value)}
              />
            </Field>
          </div>
        )}
        <Switch checked={draft.calendarMark} label="月历特别事件色标" onChange={(on) => change('calendarMark', on)} />
        {draft.calendarMark && (
          <input
            aria-label="月历色标"
            type="color"
            value={draft.markerColor}
            onChange={(e) => change('markerColor', e.target.value)}
          />
        )}
        <p role="status">{message}</p>
        <div className="dialog-actions"><Button variant="primary" type="submit" icon={<Plus size={15} />}>创建任务</Button></div>
      </form>
    </Modal>
  );
}
export function WeeklyDialog({
  open,
  date,
  onClose,
  run,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  run: (payload: Fields) => Promise<Result>;
}) {
  const [titles, setTitles] = useState('');
  const [weekends, setWeekends] = useState(false);
  const [startTime, setStart] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [tag, setTag] = useState('工作');
  const [priority, setPriority] = useState('中');
  const [message, setMessage] = useState('');
  return (
    <Modal open={open} title="一次性生成本周任务" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await run({
            action: 'weekly',
            titles: titles
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean),
            week: weekDates(date)[0],
            weekends,
            startTime,
            duration: Number(duration),
            tag,
            priority,
          });
          setMessage(result.message);
          if (result.applied) {
            setTitles('');
            onClose();
          }
        }}
      >
        <Field label="每行一项，最多 50 项">
          <textarea required value={titles} onChange={(e) => setTitles(e.target.value)} />
        </Field>
        <Switch checked={weekends} label="安排至整周" hint="关闭时仅周一到周五" onChange={setWeekends} />
        <div className="fields">
          <Field label="开始时间">
            <input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="时长">
            <select value={duration} onChange={(e) => setDuration(e.target.value)}>
              {[30, 60, 90, 120].map((v) => (
                <option key={v} value={v}>
                  {v} 分钟
                </option>
              ))}
            </select>
          </Field>
          <Field label="标签">
            <input value={tag} onChange={(e) => setTag(e.target.value)} />
          </Field>
          <Field label="优先级">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {['高', '中', '低'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        <p>轮转分配到该周，下一轮开始时间增加“时长 + 30 分钟”。</p>
        <p role="status">{message}</p>
        <div className="dialog-actions"><Button variant="primary" type="submit" icon={<CalendarRange size={15} />}>生成任务</Button></div>
      </form>
    </Modal>
  );
}
