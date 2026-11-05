import type { Attendance } from '../../contracts.js';
import type { Signal } from '../types.js';

/** Schedule facts for one date, provided by the income engine. */
export interface DayFacts {
  workday: boolean;
  fullDayLeave: boolean;
  startAt: number;
  endAt: number;
  flex: boolean;
}

const MINUTE = 60_000;
type Day = Attendance['days'][number];

/** Signals for every attendance day whose facts changed in this save. */
export function clockSignals(before: Attendance, after: Attendance, facts: (date: string) => DayFacts | null): Signal[] {
  const previous = new Map(before.days.map((day) => [day.date, JSON.stringify(day)]));
  return after.days.filter((day) => previous.get(day.date) !== JSON.stringify(day)).flatMap((day) => daySignals(day, facts(day.date)));
}

function daySignals(day: Day, facts: DayFacts | null): Signal[] {
  const out: Signal[] = [];
  const add = (signal: 'clockin' | 'ontime' | 'exact' | 'friday' | 'monday') => out.push({ kind: 'key', signal, key: day.date, date: day.date });
  const weekday = new Date(`${day.date}T12:00:00`).getDay();
  const scheduled = facts && facts.workday && !facts.fullDayLeave && Number.isFinite(facts.startAt) && Number.isFinite(facts.endAt);
  const fixed = scheduled && !facts.flex;
  if (day.clockIn) {
    add('clockin');
    if (scheduled && weekday === 1) add('monday');
    if (fixed && Math.floor(day.clockIn.at / MINUTE) === Math.floor(facts.startAt / MINUTE)) add('exact');
  }
  if (day.clockOut) {
    const late = day.clockOut.at - (facts?.endAt ?? NaN);
    if (fixed && late >= 0 && late <= 10 * MINUTE) add('ontime');
    if (scheduled && weekday === 5) add('friday');
  }
  return out;
}
