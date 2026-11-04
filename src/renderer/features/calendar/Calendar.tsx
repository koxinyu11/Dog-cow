import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { type Task } from '../../../shared/contracts';
import { addDays, localDate, matchesDate } from '../../../domain/tasks/model';

export function Calendar({
  title,
  tasks,
  selected,
  select,
}: {
  title: ReactNode;
  tasks: Task[];
  selected: string;
  select: (date: string) => void;
}) {
  const [month, setMonth] = useState(selected.slice(0, 7));
  useEffect(() => setMonth(selected.slice(0, 7)), [selected.slice(0, 7)]);
  const first = new Date(`${month}-01T12:00:00`);
  const start = addDays(localDate(first), -(first.getDay() + 6) % 7);
  const move = (delta: number) => {
    const d = new Date(first);
    d.setMonth(d.getMonth() + delta);
    setMonth(localDate(d).slice(0, 7));
  };
  return (
    <>
      <div className="toolbar">
        <button onClick={() => move(-1)} aria-label="上个月">
          ‹
        </button>
        <h2>{title}<br />
          {first.getFullYear()}年 {first.getMonth() + 1}月
        </h2>
        <button onClick={() => move(1)} aria-label="下个月">
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
          <b key={day}>{day}</b>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const date = addDays(start, i);
          const dayTasks = tasks.filter((task) => matchesDate(task, date));
          const marks = [
            ...new Set(
              dayTasks.filter((task) => task.calendarMark).map((task) => task.markerColor),
            ),
          ].slice(0, 3);
          const due = dayTasks.filter((task) => task.dueDate === date);
          return (
            <button
              key={date}
              className={`${date === selected ? 'selected ' : ''}${date === localDate() ? 'today ' : ''}${date.slice(0, 7) !== month ? 'outside' : ''}`}
              title={[
                ...dayTasks.filter((t) => t.calendarMark).map((t) => t.title),
                ...due.map((t) => `截止：${t.title}`),
              ].join('；')}
              onClick={() => select(date)}
            >
              {Number(date.slice(-2))}
              <small>
                {dayTasks.length ? `${dayTasks.length}项` : ''}
                {due.length ? ' · 截止' : ''}
              </small>
              {marks.map((color) => (
                <span key={color} style={{ color }}>
                  ●
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </>
  );
}
