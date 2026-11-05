import type { Result, ToiletRecord } from './contracts.js';

/** Local days use calendar boundaries, including daylight-saving transitions. */
export function toiletRecordOnDate(record: ToiletRecord, date: string, now: number): boolean {
  const start = new Date(`${date}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return false;
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  const endAt = record.endAt ?? now;
  // Zero-duration and unresolved records remain discoverable on their start day.
  return record.startAt < next.getTime() && (endAt > start.getTime()
    || (endAt === record.startAt && record.startAt >= start.getTime()));
}

/** Historical corrections, cancellation and failed writes must not celebrate. */
export function shouldCelebrateToilet(result: Result, recordId: string): boolean {
  if (!result.applied || !result.persisted) return false;
  const record = result.snapshot?.income.toilet?.records.find(item => item.id === recordId);
  if (record?.status !== 'completed' || record.endReason !== 'manual') return false;
  const details = result.snapshot?.income.snapshot?.toiletDetails;
  return Array.isArray(details) && details.some(item => item.id === recordId && item.addedSeconds > 0);
}
