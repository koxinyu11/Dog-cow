import type { Signal, TitleView } from '../types.js';

const DAY = 86_400_000;
const gapDays = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / DAY);

/** The app became visible today. `restDay` is null when the schedule is unknown. */
export function openSignals(today: string, restDay: boolean | null, view: TitleView): Signal[] {
  if (view.has('open', today)) return [];
  const out: Signal[] = [{ kind: 'key', signal: 'open', key: today, date: today }];
  if (restDay) out.push({ kind: 'key', signal: 'open-rest', key: today, date: today });
  const last = view.keys('open').reduce((latest, day) => (day > latest ? day : latest), '');
  if (last && gapDays(last, today) >= 14) out.push({ kind: 'key', signal: 'comeback', key: today, date: today });
  return out;
}
