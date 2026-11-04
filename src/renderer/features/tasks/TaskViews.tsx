// Task list layouts per board size. 大 keeps the full TaskCard editor; these four are lighter views.
import type { CSSProperties, ReactNode } from 'react';
import type { Fields, Task } from '../../../shared/contracts';
import { addDays, matchesDate, weekDates } from '../../../domain/tasks/model';
import { dateLabel, weekNames } from '../../format';
import { ArrowLeft, ArrowRight, ArrowRightToLine, CalendarRange, Clock, Plus, Sprout, Trash2 } from 'lucide-react';
import { Button, Check, Chip, Emoji, IconButton } from '../../ui';
import { CowProgress } from './CowProgress';

export interface TaskViewProps {
  tasks: Task[];
  selected: string;
  today: string;
  select: (date: string) => void;
  celebrating: string;
  locked: boolean;
  details: ReactNode;
  act: (action: string, id: string, extra?: Fields, anchor?: Element | null) => Promise<void>;
  openNew: () => void;
  openWeekly: () => void;
}

const order = ['高', '中', '低'];
export const tone = (p: string) => (p === '高' ? 'high' : p === '低' ? 'low' : 'mid');
const node = (id: string) => document.querySelector(`[data-task-id="${CSS.escape(id)}"]`);
const dayOf = (date: string) => weekNames[new Date(`${date}T12:00:00`).getDay()];
const forDay = (tasks: Task[], date: string) =>
  tasks
    .filter((t) => matchesDate(t, date))
    .map((task, index) => ({ task, index }))
    .sort((a, b) => order.indexOf(a.task.priority) - order.indexOf(b.task.priority) || a.index - b.index)
    .map((x) => x.task);

function Toggle({ task, act }: { task: Task; act: TaskViewProps['act'] }) {
  return (
    <Check
      round
      checked={task.done}
      label={<span className="sr-only">{task.done ? `取消完成 ${task.title}` : `完成 ${task.title}`}</span>}
      onChange={() => void act('toggle', task.id, {}, node(task.id))}
    />
  );
}

function Empty({ openNew, locked }: { openNew: () => void; locked: boolean }) {
  return (
    <div className="m-empty">
      <Sprout size={28} strokeWidth={1.8} className="m-empty-icon" />
      <p>这一天的草地空空的</p>
      <Button size="sm" icon={<Plus size={14} />} disabled={locked} onClick={openNew}>
        种一项
      </Button>
    </div>
  );
}

/* 小：今天还剩几项 + 下一项 */
export function TasksSmall({ tasks, selected, act, openNew, details, locked }: TaskViewProps) {
  const list = forDay(tasks, selected);
  const open = list.filter((t) => !t.done);
  const pct = list.length ? Math.round(((list.length - open.length) / list.length) * 100) : 100;
  const next = open[0];
  return (
    <div className="tv-small">
      <IconButton className="tv-small-add" size="sm" variant="ghost" label="新增任务" disabled={locked} onClick={openNew}>
        <Plus size={15} />
      </IconButton>
      <div className="tv-small-count">
        <b>{open.length}</b>
        <span>项待办</span>
        <Emoji motion="idle-chew">{open.length ? '🐄' : '🐮'}</Emoji>
      </div>
      {next ? (
        <div className="tv-small-next" data-task-id={next.id}>
          <Toggle task={next} act={act} />
          <span title={next.title}>{next.title}</span>
        </div>
      ) : (
        <p className="m-label">{list.length ? '今天的草吃完啦' : '今天还没有任务'}</p>
      )}
      <div className="tv-small-foot">
        <span className="cow-line" style={{ '--progress': `${pct}%` } as CSSProperties} role="img" aria-label={`今天完成 ${pct}%`}>
          <span />
        </span>
        <small>{pct}%</small>
        {details}
      </div>
    </div>
  );
}

/* 中：今天的清单 */
export function TasksMedium({ tasks, selected, today, select, act, celebrating, openNew, details, locked }: TaskViewProps) {
  const list = forDay(tasks, selected);
  return (
    <div className="tv-medium">
      <div className="tv-bar">
        <IconButton size="sm" variant="ghost" label="前一天" onClick={() => select(addDays(selected, -1))}>
          <ArrowLeft size={14} />
        </IconButton>
        <button className="tv-date" onClick={() => select(today)} title="回到今天">
          {dateLabel(selected)}
        </button>
        <IconButton size="sm" variant="ghost" label="后一天" onClick={() => select(addDays(selected, 1))}>
          <ArrowRight size={14} />
        </IconButton>
        <IconButton size="sm" variant="primary" label="新增任务" disabled={locked} onClick={openNew}>
          <Plus size={14} />
        </IconButton>
        {details}
      </div>
      <div className="tv-scroll">
        {!list.length ? (
          <Empty openNew={openNew} locked={locked} />
        ) : (
          list.map((task) => (
            <div key={task.id} className={`tv-row ${task.done ? 'is-done' : ''}`} data-task-id={task.id}>
              <Toggle task={task} act={act} />
              <div className="tv-row-main">
                <div className="tv-row-title">
                  <span>{task.title}</span>
                  <i className={`tv-dot tone-${tone(task.priority)}`} title={`${task.priority}优先`} />
                </div>
                <CowProgress variant="slim" task={task} act={act} celebrating={celebrating === task.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* 长：左边选日期，右边横向小卡 */
export function TasksWide({ tasks, selected, today, select, act, celebrating, openNew, openWeekly, details, locked }: TaskViewProps) {
  const list = forDay(tasks, selected);
  return (
    <div className="tv-wide">
      <div className="tv-wide-side">
        <div className="tv-days">
          {weekDates(selected).map((date) => {
            const left = tasks.filter((t) => matchesDate(t, date) && !t.done).length;
            return (
              <button key={date} aria-pressed={date === selected} className={date === today ? 'is-today' : ''} onClick={() => select(date)} title={dateLabel(date)}>
                <b>{dayOf(date).slice(1)}</b>
                <small>{left || '✓'}</small>
              </button>
            );
          })}
        </div>
        <div className="tv-wide-actions">
          <Button size="sm" variant="primary" icon={<Plus size={14} />} disabled={locked} onClick={openNew}>
            新增
          </Button>
          <Button size="sm" variant="ghost" icon={<CalendarRange size={14} />} disabled={locked} onClick={openWeekly}>
            每周任务
          </Button>
          {details}
        </div>
      </div>
      <div className="tv-lane">
        {!list.length ? (
          <Empty openNew={openNew} locked={locked} />
        ) : (
          list.map((task) => (
            <article key={task.id} className={`tv-card ${task.done ? 'is-done' : ''}`} data-task-id={task.id}>
              <div className="tv-card-head">
                <Toggle task={task} act={act} />
                <b>{task.title}</b>
              </div>
              <div className="tv-card-meta">
                <Chip tone={tone(task.priority)}>{task.priority}</Chip>
                {task.hasTime && (
                  <Chip>
                    <Clock size={11} /> {task.startTime}
                  </Chip>
                )}
                {task.tags.slice(0, 2).map((tag) => (
                  <Chip key={tag.id} color={tag.color}>
                    {tag.label}
                  </Chip>
                ))}
              </div>
              <CowProgress variant="slim" task={task} act={act} celebrating={celebrating === task.id} />
            </article>
          ))
        )}
      </div>
    </div>
  );
}

/* 竖：一天的时间线 */
export function TasksTall({ tasks, selected, today, select, act, celebrating, openNew, details, locked }: TaskViewProps) {
  const list = forDay(tasks, selected).sort((a, b) =>
    a.hasTime === b.hasTime ? (a.hasTime ? a.startTime.localeCompare(b.startTime) : 0) : a.hasTime ? -1 : 1,
  );
  return (
    <div className="tv-tall">
      <div className="tv-bar">
        <div className="tv-dots">
          {weekDates(selected).map((date) => {
            const day = tasks.filter((t) => matchesDate(t, date));
            const state = !day.length ? 'empty' : day.every((t) => t.done) ? 'done' : 'open';
            return (
              <button key={date} aria-pressed={date === selected} className={`is-${state} ${date === today ? 'is-today' : ''}`} onClick={() => select(date)} title={dateLabel(date)}>
                <small>{dayOf(date).slice(1)}</small>
                <i />
              </button>
            );
          })}
        </div>
        <IconButton size="sm" variant="primary" label="新增任务" disabled={locked} onClick={openNew}>
          <Plus size={14} />
        </IconButton>
      </div>
      <div className="tv-detail-row">{details}</div>
      <div className="tv-scroll tv-timeline">
        {!list.length ? (
          <Empty openNew={openNew} locked={locked} />
        ) : (
          list.map((task) => (
            <div key={task.id} className={`tv-step ${task.done ? 'is-done' : ''}`} data-task-id={task.id}>
              <span className="tv-time">{task.hasTime ? task.startTime : '全天'}</span>
              <div className="tv-step-body">
                <div className="tv-row-title">
                  <Toggle task={task} act={act} />
                  <span>{task.title}</span>
                  <i className={`tv-dot tone-${tone(task.priority)}`} title={`${task.priority}优先`} />
                  {task.dueDate && !task.done && task.dueDate <= today && <Chip tone="high">{task.dueDate < today ? '逾期' : '今天截止'}</Chip>}
                </div>
                <CowProgress variant="slim" task={task} act={act} celebrating={celebrating === task.id} />
                <div className="tv-step-actions">
                  {!task.done && (
                    <IconButton size="sm" variant="ghost" label="顺延到下一天" onClick={() => void act('move', task.id)}>
                      <ArrowRightToLine size={13} />
                    </IconButton>
                  )}
                  <IconButton size="sm" variant="danger" label="删除任务" onClick={() => void act('delete', task.id)}>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
