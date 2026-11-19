import { deskMoves, deskRegions, maxMovementSeconds, type DeskMove, type DeskRegion } from './desk-movement-catalog.js';
export * from './desk-movement-catalog.js';

export const seatedQuick: readonly DeskMove[] = ['march', 'chest'];
export const walkingBreak: readonly DeskMove[] = ['walk'];

export interface DeskPlan {
  moves: DeskMove[];
  seatedOnly: boolean;
  excluded: DeskRegion[];
  days: number[];
  time: string;
  reminder: boolean;
}
export interface DeskSegment { move: DeskMove; milliseconds: number }
export interface DeskRecord { id: string; date: string; seconds: number; segments?: DeskSegment[]; kcal?: number }
export const validMovementWeight = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 500;
export function movementKcal(segments: readonly DeskSegment[], weightKg: number): number {
  return segments.reduce((total, item) => total +
    (deskMoves[item.move].met.value - 1) * weightKg * item.milliseconds / 3_600_000, 0);
}
export function validDeskSegments(value: unknown): value is DeskSegment[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((item: DeskSegment) => {
    if (!item || typeof item.move !== 'string' || !Object.hasOwn(deskMoves, item.move) ||
      !Number.isInteger(item.milliseconds) || item.milliseconds <= 0 || item.milliseconds > deskMoves[item.move].seconds * 1000) return false;
    return true;
  });
}
export function validDeskRecord(value: unknown): value is DeskRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as DeskRecord;
  return typeof r.id === 'string' && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    Number.isInteger(r.seconds) && r.seconds >= 0 &&
    (r.segments === undefined ? r.seconds > 0 && r.seconds <= maxMovementSeconds && r.kcal === undefined :
      validDeskSegments(r.segments) && r.seconds === Math.floor(r.segments.reduce((total, item) => total + item.milliseconds, 0) / 1000) &&
      (r.kcal === undefined || (Number.isFinite(r.kcal) && r.kcal >= 0)));
}
export interface DeskMovementData { plan: DeskPlan; records: DeskRecord[]; due: boolean; weightKg?: number }

export const defaultDeskPlan: DeskPlan = {
  moves: [...seatedQuick], seatedOnly: true, excluded: [], days: [1, 2, 3, 4, 5], time: '15:00', reminder: false,
};
export function eligibleDeskMove(move: DeskMove, plan: Pick<DeskPlan, 'seatedOnly' | 'excluded'>): boolean {
  return (!plan.seatedOnly || deskMoves[move].seated) && !plan.excluded.some(region => deskMoves[move].regions.includes(region));
}
export function validDeskPlan(value: unknown): value is DeskPlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as DeskPlan;
  return typeof p.seatedOnly === 'boolean' && typeof p.reminder === 'boolean' &&
    typeof p.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.time) &&
    Array.isArray(p.days) && p.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
    (!p.reminder || p.days.length > 0) &&
    Array.isArray(p.excluded) && p.excluded.every(region => deskRegions.includes(region)) &&
    Array.isArray(p.moves) && p.moves.length > 0 && new Set(p.moves).size === p.moves.length &&
    p.moves.every(move => Object.hasOwn(deskMoves, move) && eligibleDeskMove(move, p));
}
export function localMovementDate(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(value => String(value).padStart(2, '0')).join('-');
}

type Segment = { moves: readonly DeskMove[]; index: number };
export type DeskSession = Segment & (
  | { phase: 'ready' | 'paused'; remaining: number }
  | { phase: 'running'; deadline: number }
  | { phase: 'finished' }
);

export function prepareDeskSession(moves: readonly DeskMove[], index = 0): DeskSession {
  const move = moves[index];
  if (!move) return { moves, index, phase: 'finished' };
  return { moves, index, phase: 'ready', remaining: deskMoves[move].seconds * 1000 };
}

export function resumeDeskSession(session: DeskSession, now: number): DeskSession {
  if (session.phase !== 'ready' && session.phase !== 'paused') return session;
  return { moves: session.moves, index: session.index, phase: 'running', deadline: now + session.remaining };
}

export function pauseDeskSession(session: DeskSession, now: number): DeskSession {
  if (session.phase !== 'running') return session;
  const remaining = session.deadline - now;
  if (remaining <= 0) return prepareDeskSession(session.moves, session.index + 1);
  return { moves: session.moves, index: session.index, phase: 'paused', remaining };
}

export function activeMovementMs(session: DeskSession, now: number): number {
  const move = session.moves[session.index];
  if (!move || session.phase === 'finished') return 0;
  const total = deskMoves[move].seconds * 1000;
  const remaining = session.phase === 'running' ? session.deadline - now : session.remaining;
  return Math.round(Math.max(0, Math.min(total, total - remaining)));
}
