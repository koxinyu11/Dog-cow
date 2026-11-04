import { type Task } from '../../../shared/contracts';
import { weekDates, matchesDate } from '../../../domain/tasks/model';
import { dateLabel } from '../../format';

export function WeeklySummary({ tasks, selected }: { tasks: Task[]; selected: string }) {
  const dates = weekDates(selected);
  const items = tasks.filter((task) => dates.some((date) => matchesDate(task, date)));
  const labels = new Map<string, number>();
  items.forEach((task) =>
    task.tags.forEach((tag) => labels.set(tag.label, (labels.get(tag.label) || 0) + 1)),
  );
  return (
    <>
      <h2>本周概览</h2>
      <p>
        {dateLabel(dates[0])} – {dateLabel(dates[6])}
      </p>
      <p>
        {items.length} 项任务 · 平均进展{' '}
        {items.length
          ? Math.round(items.reduce((sum, t) => sum + t.progress, 0) / items.length)
          : 0}
        %
      </p>
      <p>
        完成 {items.filter((t) => t.done).length} · 待办 {items.filter((t) => !t.done).length}
      </p>
      {[...labels]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, count]) => (
          <p key={label}>
            {label} · {count} 项
          </p>
        ))}
    </>
  );
}
