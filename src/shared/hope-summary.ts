import { hopeDate, type Hope, type HolidayStart } from './fun.js';
export function sortedHopes(hopes: Hope[], today: string, holidays: HolidayStart[]) {
  const rank = (at: ReturnType<typeof hopeDate>) => !at ? 1e6 : at.days < 0 ? 2e6 - at.days : at.days;
  return hopes.map(hope => ({ hope, at: hopeDate(hope, today, holidays) })).sort((a, b) => rank(a.at) - rank(b.at));
}
