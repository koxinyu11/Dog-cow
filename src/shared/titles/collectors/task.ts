import { addDays } from '../../../domain/tasks/model.js';
import type { Task } from '../../contracts.js';
import type { Signal, TitleView } from '../types.js';

/** A task just moved from not-done to done. */
export function taskSignals(task: Pick<Task, 'id' | 'date'>, today: string, view: TitleView): Signal[] {
  const key = (signal: 'done' | 'redone' | 'done-late'): Signal => ({ kind: 'key', signal, key: task.id, date: today });
  const signals = [key('done')];
  if (view.has('done', task.id)) signals.push(key('redone'));
  if (addDays(task.date, 7) <= today) signals.push(key('done-late'));
  return signals;
}
