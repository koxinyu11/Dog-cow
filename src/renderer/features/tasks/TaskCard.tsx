import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { type Fields, type Tag, type Task } from '../../../shared/contracts';
import { localDate } from '../../../domain/tasks/model';
import { dateLabel } from '../../format';
import { AutoText } from '../../components/AutoText';

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
  const [progress, setProgress] = useState(task.progress);
  const current = useRef(task.progress);
  const saving = useRef(false);
  useEffect(() => {
    if (!saving.current) {
      setProgress(task.progress);
      current.current = task.progress;
    }
  }, [task.progress]);
  const commitProgress = async () => {
    if (current.current === task.progress || saving.current) return;
    saving.current = true;
    try {
      await act('progress', task.id, { progress: current.current });
    } finally {
      saving.current = false;
    }
  };
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
      <div className="row">
        <button
          aria-label={task.done ? `取消完成 ${task.title}` : `完成 ${task.title}`}
          onClick={() => void act('toggle', task.id)}
        >
          {task.done ? '✓ 已完成' : '○ 完成'}
        </button>
        <AutoText
          value={task.title}
          label="任务标题"
          onCommit={(value) => patch(task.id, { title: value.trim() || '未命名任务' })}
        />
        <select
          aria-label="优先级"
          value={task.priority}
          onChange={(e) => void patch(task.id, { priority: e.target.value })}
        >
          {['高', '中', '低'].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <AutoText
        value={task.note}
        label="任务备注"
        area
        onCommit={(value) => patch(task.id, { note: value })}
      />
      <div className="row">
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
        <select
          aria-label="复用或新增标签"
          value=""
          onChange={(e) => {
            const selected = e.target.value;
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
        </select>
      </div>
      <div className="row">
        {task.hasTime ? (
          <>
            <input
              aria-label="任务开始时间"
              type="time"
              value={task.startTime}
              onChange={(e) => void patch(task.id, { startTime: e.target.value })}
            />
            <span>至</span>
            <input
              aria-label="任务结束时间"
              type="time"
              value={task.endTime}
              onChange={(e) => void patch(task.id, { endTime: e.target.value })}
            />
            <button
              onClick={() =>
                void patch(task.id, {
                  hasTime: false,
                  startTime: '',
                  endTime: '',
                })
              }
            >
              移除时间
            </button>
          </>
        ) : (
          <button
            onClick={() =>
              void patch(task.id, {
                hasTime: true,
                startTime: '09:00',
                endTime: '10:00',
              })
            }
          >
            添加时间
          </button>
        )}
        {task.dueDate ? (
          <>
            <input
              type="date"
              aria-label="截止日期"
              value={task.dueDate}
              onChange={(e) => void patch(task.id, { dueDate: e.target.value })}
            />
            <span>{due}</span>
            <button onClick={() => void patch(task.id, { dueDate: '' })}>移除截止日</button>
          </>
        ) : (
          <button onClick={() => void patch(task.id, { dueDate: task.date })}>设置截止日</button>
        )}
      </div>
      <div
        className={`task-progress ${task.done ? 'complete' : ''} ${celebrating ? 'celebrating' : ''}`}
      >
        <span>当前进展</span>
        <div className="cow-progress" style={{ '--progress': `${progress}%` } as CSSProperties}>
          <div className="grass-track" />
          <span className="cow-runner" aria-hidden="true">
            🐄
          </span>
          <input
            aria-label={`任务进展 ${task.title}`}
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => {
              setProgress(Number(e.target.value));
              current.current = Number(e.target.value);
            }}
            onPointerUp={() => void commitProgress()}
            onKeyUp={() => void commitProgress()}
            onBlur={() => void commitProgress()}
          />
        </div>
        <output>
          {task.done ? (
            <span className="completion-feedback">
              <b>吃完啦</b>
              <i>✨</i>
            </span>
          ) : (
            `${progress}% 🌿`
          )}
        </output>
      </div>
      <div className="actions">
        {!task.done && <button onClick={() => void act('move', task.id)}>同步到下一日</button>}
        <button onClick={() => void act('delete', task.id)}>删除</button>
      </div>
    </article>
  );
}
