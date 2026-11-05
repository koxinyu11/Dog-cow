import { useEffect, useRef, useState } from 'react';
import type { Fields, Result, Snapshot } from '../../../shared/contracts';
import { localDate } from '../../../domain/tasks/model';
import { command, registerFlush } from '../../state';
import { HopeManager } from './HopesCard';
/** Opens the existing editor from a native entry without depending on a board card. */
export function HopeManagerLauncher({ state, notify }: { state: Snapshot; notify(message: string): void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const pending = useRef<Promise<Result | null> | null>(null);
  useEffect(() => window.dogcow.openHopes(() => setOpen(true)), []);
  useEffect(() => registerFlush(async () => !pending.current || !!await pending.current), []);
  const run = (payload: Fields) => {
    if (lock.current) return Promise.resolve(null);
    lock.current = true; setBusy(true);
    const job = command('fun', payload, 'home').then(result => {
      if (!result.applied || !result.persisted) { notify(result.message || '盼头未保存，请重试。'); return null; }
      return result;
    }).catch(() => { notify('盼头未保存，请重试。'); return null; }).finally(() => { lock.current = false; setBusy(false); });
    pending.current = job;
    return job;
  };
  return open ? <HopeManager ctx={{ state, today: localDate(new Date(state.income.now)) }} busy={busy} run={run} onClose={() => setOpen(false)} /> : null;
}
