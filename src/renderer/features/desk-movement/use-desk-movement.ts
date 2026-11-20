// Single renderer-side source for desk-movement data. The board card and the dialog both read it here;
// every write that returns fresh data goes through updateDeskMovement so both stay in step.
import { useEffect, useSyncExternalStore } from 'react';
import type { DeskMovementData } from '../../../shared/desk-movement';
import { command } from '../../state';

export interface DeskMovementState { data?: DeskMovementData; error: string; loading: boolean }

const READ_ERROR = '活动数据暂不可读。';
let state: DeskMovementState = { error: '', loading: false };
let pending: Promise<DeskMovementData | undefined> | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<DeskMovementState>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Reads from the main process; concurrent calls share one request. */
export function loadDeskMovement(): Promise<DeskMovementData | undefined> {
  if (pending) return pending;
  emit({ loading: true, error: '' });
  pending = command('deskMovement', { action: 'read' }).then(result => {
    if (result.deskMovement) { emit({ data: result.deskMovement, loading: false }); return result.deskMovement; }
    emit({ error: result.message || READ_ERROR, loading: false });
    return undefined;
  }, () => { emit({ error: READ_ERROR, loading: false }); return undefined; })
    .finally(() => { pending = null; });
  return pending;
}

export const updateDeskMovement = (data: DeskMovementData) => emit({ data, error: '' });

/** Subscribes to the shared state and loads it once if nothing has been read yet. */
export function useDeskMovement(): DeskMovementState {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!state.data && !pending) void loadDeskMovement();
  }, []);
  return current;
}
