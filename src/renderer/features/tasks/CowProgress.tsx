import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Fields, Task } from '../../../shared/contracts';

/**
 * Draggable "cow eats the grass" progress. The value follows the pointer immediately and is
 * saved once, on release / key up / blur. Used by every task layout so behaviour stays identical.
 */
export function CowProgress({
  task,
  act,
  celebrating,
  variant = 'full',
}: {
  task: Task;
  act: (action: string, id: string, extra?: Fields) => Promise<void>;
  celebrating: boolean;
  /** full: label + track + output · slim: thin track + percent */
  variant?: 'full' | 'slim';
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
  const commit = async () => {
    if (current.current === task.progress || saving.current) return;
    saving.current = true;
    try {
      await act('progress', task.id, { progress: current.current });
    } finally {
      saving.current = false;
    }
  };
  return (
    <div className={`task-progress v-${variant} ${task.done ? 'complete' : ''} ${celebrating ? 'celebrating' : ''}`}>
      {variant === 'full' && <span>当前进展</span>}
      <div className="cow-progress" style={{ '--progress': `${progress}%` } as CSSProperties}>
        <div className="grass-track" />
        <span className="cow-runner" aria-hidden="true">
          {task.done ? '🐮' : '🐄'}
        </span>
        <input
          aria-label={`任务进展 ${task.title}`}
          type="range"
          min="0"
          max="100"
          step="5"
          value={progress}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            setProgress(Number(e.target.value));
            current.current = Number(e.target.value);
          }}
          onPointerUp={() => void commit()}
          onKeyUp={() => void commit()}
          onBlur={() => void commit()}
        />
      </div>
      <output>
        {task.done ? (
          <span className="completion-feedback">
            <b>吃完啦</b>
            <i>✨</i>
          </span>
        ) : variant === 'full' ? (
          `${progress}% 🌿`
        ) : (
          `${progress}%`
        )}
      </output>
    </div>
  );
}
