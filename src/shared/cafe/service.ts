import { SHIFTS, SHIFT_HOURS, cafeContent } from './content.js';
import { simulateWeek } from './simulation.js';
import type { CafeContent, CafeState, Segment, WeekPlan } from './types.js';

export type GuestOutcome = 'served' | 'queue' | 'stock' | 'seats';
/** Times are absolute simulated minutes. A visual never invents transactions or seat assignments. */
export interface GuestVisit {
  id: string;
  day: number;
  segment: Segment;
  drink: string;
  arrival: number;
  starts: number;
  ready: number;
  leaves: number;
  outcome: GuestOutcome;
  dineIn: boolean;
  seat: number | null;
  revenue: number;
  cost: number;
}
export interface ServiceRun {
  id: string;
  plan: WeekPlan;
  cursor: number;
}
export interface ServiceSlot {
  day: number;
  hour: number;
  closing: boolean;
}
export interface ServiceTimeline {
  id: string;
  guests: GuestVisit[];
  slots: ServiceSlot[];
  duration: number;
}
export function serviceSlots(plan: WeekPlan, week: number): ServiceSlot[] {
  const hours = SHIFTS.filter((shift) => plan.shifts[shift].open).flatMap((shift) => SHIFT_HOURS[shift]);
  if (!hours.length) return [];
  return Array.from({ length: 7 }, (_, day) => [
    ...hours.map((hour) => ({ day: (week - 1) * 7 + day, hour, closing: false })),
    { day: (week - 1) * 7 + day, hour: Math.max(...hours) + 1, closing: true },
  ]).flat();
}
export function serviceTime(timeline: ServiceTimeline, cursor: number) {
  const bounded = Math.max(0, Math.min(timeline.duration, cursor));
  const index = Math.min(timeline.slots.length - 1, Math.floor(bounded / 60));
  const slot = timeline.slots[index];
  const minute = bounded >= timeline.duration ? 60 : bounded % 60;
  return { ...slot, minute, absolute: slot.day * 1440 + slot.hour * 60 + minute };
}
/** Reconstruct from the immutable week-start state. No full trace is written into the save. */
export function serviceTimeline(
  state: CafeState,
  content: CafeContent = cafeContent,
): ServiceTimeline | undefined {
  if (!state.run) return;
  const guests: GuestVisit[] = [];
  simulateWeek(state, state.run.plan, content, (visit) => guests.push(visit));
  const slots = serviceSlots(state.run.plan, state.week);
  for (const guest of guests) {
    const close = slots.find((slot) => slot.day === guest.day && slot.closing)!;
    guest.leaves = Math.min(guest.leaves, close.day * 1440 + (close.hour + 1) * 60);
  }
  return { id: state.run.id, guests, slots, duration: slots.length * 60 };
}
export type GuestPhase = 'entering' | 'queueing' | 'brewing' | 'to-seat' | 'drinking' | 'leaving';
export function guestPhase(guest: GuestVisit, now: number): GuestPhase | null {
  if (now < guest.arrival - 3 || now >= guest.leaves) return null;
  if (now < guest.arrival) return 'entering';
  if (guest.outcome !== 'served') return now >= guest.leaves - 2 ? 'leaving' : 'queueing';
  if (now < guest.starts) return 'queueing';
  if (now < guest.ready) return 'brewing';
  if (!guest.dineIn || now >= guest.leaves - 3) return 'leaving';
  if (now < guest.ready + 3) return 'to-seat';
  return 'drinking';
}
export function serviceTotals(timeline: ServiceTimeline, now: number) {
  let served = 0,
    revenue = 0,
    lost = 0;
  for (const guest of timeline.guests) {
    if (guest.outcome === 'served' && guest.ready <= now) {
      served++;
      revenue += guest.revenue;
    } else if (guest.outcome !== 'served' && guest.leaves <= now) lost++;
  }
  return { served, revenue, lost };
}
