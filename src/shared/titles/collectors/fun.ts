import type { FunState } from '../../fun.js';
import type { Signal } from '../types.js';

/** Signals for a successful fun-card command. `after` is the saved state. */
export function funSignals(action: unknown, after: FunState, today: string): Signal[] {
  const date = today;
  switch (action) {
    case 'mood': {
      const mood = after.moodHistory?.[today];
      return mood ? [{ kind: 'key', signal: 'mood', key: today, date }, { kind: 'ledger', ledger: 'mood', key: today, value: mood, date }] : [];
    }
    case 'lunch':
    case 'custom-lunch':
      return after.lunch.date === today && after.lunch.chosen
        ? [{ kind: 'key', signal: 'lunch', key: today, date }, { kind: 'ledger', ledger: 'lunch', key: today, value: after.lunch.chosen, date }]
        : [];
    case 'hope':
    case 'remove-hope':
      return [{ kind: 'ledger', ledger: 'hopes', key: today, value: after.hopes.filter((hope) => hope.date >= today).length, date }];
    default:
      return [];
  }
}
