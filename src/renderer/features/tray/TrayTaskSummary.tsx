import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ListChecks, Check } from 'lucide-react';
import type { TraySummary } from '../../../shared/tray-summary';
export function TrayTaskSummary({ tasks }: { tasks: TraySummary['tasks'] }) {
  const previous = useRef(tasks.done);
  const [reaction, setReaction] = useState(0);
  useEffect(() => { if (tasks.done > previous.current) setReaction(value => value + 1); previous.current = tasks.done; }, [tasks.done]);
  return <section className="tray-task-summary" aria-label="今日任务">
    <div className="tray-section-heading"><span><ListChecks size={13} />今日任务</span><strong key={reaction} className={reaction ? 'tray-task-reaction' : ''}>
      {tasks.unavailable ? '暂不可用' : tasks.total ? `${tasks.done}/${tasks.total} · ${tasks.percent}%` : '今日无任务'}
    </strong></div>
    {!tasks.unavailable && tasks.total > 0 && <>
      <div className={`tray-task-progress${tasks.percent === 100 ? ' is-complete' : ''}`} role="progressbar" aria-label="今日任务完成度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={tasks.percent} style={{ '--task-progress': `${tasks.percent}%` } as CSSProperties}><i /></div>
      {tasks.next ? <div className="tray-next-task"><span>下一项</span><strong title={tasks.next.title}>{tasks.next.title}</strong><time>{tasks.next.time}</time></div>
        : <div className="tray-task-complete"><Check size={12} />今日任务全部完成</div>}
    </>}
  </section>;
}
