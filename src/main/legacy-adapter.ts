import { loadHolidayYear } from '../../app/income/src/calendar.js';
import { createIncomeController } from '../../app/income/src/controller.js';
import type { IncomeState, Result } from '../shared/contracts.js';
export interface IncomeController {
  subscribe(listener: (state: Omit<IncomeState, 'now'> & { now: Date }) => void): () => void;
  getState(): unknown;
  updateSettings(raw: unknown): Result;
  saveLeave(raw: unknown, editingId: string | null): Result;
  removeLeave(id: unknown): Result;
  commitAttendance(raw: unknown): Result;
  refreshCalendar(force?: boolean): Promise<unknown>;
  tick(): void;
  destroy(): void;
}
// The old tested engine retains its JavaScript implementation during migration;
// an explicit boundary describes its existing runtime contract to the TS shell.
export const createController = createIncomeController as unknown as (options: {
  calendarLoader?: typeof loadHolidayYear;
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
}) => IncomeController;
