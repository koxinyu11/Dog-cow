import { TimePicker } from '../../components/TimePicker';
import { FormSelect } from '../../components/FormSelect';
import { DatePicker } from '../../components/DatePicker';
import { type Fields, type Tag, type Task } from '../../../shared/contracts';
import { localDate } from '../../../domain/tasks/model';
import { dateLabel } from '../../format';
import { AutoText } from '../../components/AutoText';
import { ArrowRightToLine, CalendarClock, Clock, Trash2, X } from 'lucide-react';
import { Button, Check, IconButton } from '../../ui';
import { CowProgress } from './CowProgress';

export function TaskCard({
  task,
  library,
  celebrating,
  act,
  patch,
}: {
  task: Task;
  library: Array<{ label: string; color: string }>;
  celebrating: boolean;
  act: (action: string, id: string, extra?: Fields) => Promise<void>;
  patch: (id: string, patch: Fields) => Promise<void>;
}) {
  const updateTag = (id: string, change: Partial<Tag>) =>
    patch(task.id, {
      tags: task.tags.map((tag) => (tag.id === id ? { ...tag, ...change } : tag)),
    });
  const due = task.dueDate
    ? task.done
      ? '已完成'
      : task.dueDate < localDate()
        ? '已逾期'
        : task.dueDate === localDate()
          ? '今天截止'
          : `截止 ${dateLabel(task.dueDate)}`
    : '';
  return (
    <article className={`task-card ${task.done ? 'done' : ''}`} data-task-id={task.id}>
      <div className="row task-head">
        <Check
          round
          checked={task.done}
          label={<span className="sr-only">{task.done ? `取消完成 ${task.title}` : `完成 ${task.title}`}</span>}
          onChange={() => void act('toggle', task.id)}
        />
        <AutoText
          value={task.title}
          label="任务标题"
          onCommit={(value) => patch(task.id, { title: value.trim() || '未命名任务' })}
        />
        <FormSelect
          aria-label="优先级"
          className={`priority-select p-${task.priority}`}
          value={task.priority}
          onChange={(nextValue) => void patch(task.id, { priority: nextValue })}
        >
          {['高', '中', '低'].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </FormSelect>
      </div>
      <AutoText
        value={task.note}
        label="任务备注"
        area
        onCommit={(value) => patch(task.id, { note: value })}
      />
      <div className="row task-tags">
        {task.tags.map((tag) => (
          <span className="tag-pill" key={tag.id}>
            <AutoText
              value={tag.label}
              label="标签文字"
              onCommit={(value) => updateTag(tag.id, { label: value.trim() || '标签' })}
            />
            <input
              type="color"
              aria-label="标签颜色"
              value={tag.color}
              onChange={(e) => void updateTag(tag.id, { color: e.target.value })}
            />
            <button
              className="tag-remove"
              aria-label="删除标签"
              onClick={() =>
                void patch(task.id, {
                  tags: task.tags.filter((t) => t.id !== tag.id),
                })
              }
            >
              ×
            </button>
          </span>
        ))}
        <FormSelect
          className="tag-reuse"
          aria-label="复用或新增标签"
          value=""
          onChange={(nextValue) => {
            const selected = nextValue;
            if (!selected) return;
            const reusable = library.find((tag) => tag.label === selected);
            if (
              reusable &&
              task.tags.some(
                (tag) =>
                  tag.label.toLocaleLowerCase('zh-CN') === selected.toLocaleLowerCase('zh-CN'),
              )
            )
              return;
            void patch(task.id, {
              tags: [
                ...task.tags,
                {
                  id: crypto.randomUUID(),
                  label: reusable?.label || '新标签',
                  color: reusable?.color || '#8b5cf6',
                },
              ],
            });
          }}
        >
          <option value="">添加标签</option>
          <option value="__new__">新标签</option>
          {library.map((tag) => (
            <option key={tag.label}>{tag.label}</option>
          ))}
        </FormSelect>
      </div>
      <div className="row task-meta">
        {task.hasTime ? (
          <>
            <TimePicker
              aria-label="任务开始时间"

              value={task.startTime}
              onChange={(nextValue) => void patch(task.id, { startTime: nextValue })}
            />
            <span>至</span>
            <TimePicker
              aria-label="任务结束时间"

              value={task.endTime}
              onChange={(nextValue) => void patch(task.id, { endTime: nextValue })}
            />
            <IconButton
              size="sm"
              variant="ghost"
              label="移除时间"
              onClick={() =>
                void patch(task.id, {
                  hasTime: false,
                  startTime: '',
                  endTime: '',
                })
              }
            >
              <X size={13} />
            </IconButton>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={<Clock size={13} />}
            onClick={() =>
              void patch(task.id, {
                hasTime: true,
                startTime: '09:00',
                endTime: '10:00',
              })
            }
          >
            添加时间
          </Button>
        )}
        {task.dueDate ? (
          <>
            <DatePicker clearable
              aria-label="截止日期"
              value={task.dueDate}
              onChange={(nextValue) => void patch(task.id, { dueDate: nextValue })}
            />
            <span className={`due-chip ${due === '已逾期' ? 'is-late' : due === '今天截止' ? 'is-today' : ''}`}>{due}</span>
            <IconButton size="sm" variant="ghost" label="移除截止日" onClick={() => void patch(task.id, { dueDate: '' })}><X size={13} /></IconButton>
          </>
        ) : (
          <Button size="sm" variant="ghost" icon={<CalendarClock size={13} />} onClick={() => void patch(task.id, { dueDate: task.date })}>设置截止日</Button>
        )}
      </div>
      <CowProgress task={task} act={act} celebrating={celebrating} />
      <div className="task-actions">
        {!task.done && (
          <Button size="sm" variant="soft" icon={<ArrowRightToLine size={13} />} onClick={() => void act('move', task.id)}>
            同步到下一日
          </Button>
        )}
        <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => void act('delete', task.id)}>
          删除
        </Button>
      </div>
    </article>
  );
}
