/** Local daily fish activity. No random draws or saved rerollable schedule. */
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
export interface FishingTideStamp { version: 2; at: number; activity: number }
export interface FishFrenzy { start: number; end: number }
export interface FishingTide extends FishingTideStamp, FishFrenzy {
  phase: 'calm' | 'rising' | 'peak' | 'falling';
  nextStart: number;
}
function hourAt(at: number) {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) throw Error('鱼情时间无效。');
  date.setMinutes(0, 0, 0);
  return date.getTime();
}
function hash(at: number, channel: string) {
  const date = new Date(at);
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}/${date.getHours()}/${channel}`;
  let value = 2166136261;
  for (const char of key) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
function frenzy(hour: number): FishFrenzy {
  const start = hour + (10 + hash(hour, 'frenzy-v2') % 31) * MINUTE;
  return { start, end: start + 10 * MINUTE };
}
function background(hour: number) { return hash(hour, 'activity-v2') / 0xffffffff * .45; }
/** Smooth daily background plus one 10-minute maximum plateau per local hour. */
export function fishingTide(at: number): FishingTide {
  const hour = hourAt(at);
  const { start, end } = frenzy(hour);
  const base = background(hour) + (background(hour + HOUR) - background(hour)) * smooth((at - hour) / HOUR);
  const phase = at < start - 5 * MINUTE || at >= end + 5 * MINUTE ? 'calm'
    : at < start ? 'rising' : at < end ? 'peak' : 'falling';
  const wave = at < start ? smooth((at - start + 5 * MINUTE) / (5 * MINUTE)) : 1 - smooth((at - end) / (5 * MINUTE));
  return { version: 2, at, activity: base + (1 - base) * wave, phase, start, end,
    nextStart: at < start ? start : frenzy(hour + HOUR).start };
}
/** Walk actual hours so local DST days can contain 23 or 25 windows. */
export function fishingDay(at: number): FishFrenzy[] {
  const date = new Date(at); date.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setDate(end.getDate() + 1);
  const windows: FishFrenzy[] = [];
  for (let hour = date.getTime(); hour < end.getTime(); hour += HOUR) windows.push(frenzy(hour));
  return windows;
}
/** Activity endpoints are shared by probability pools and their on-demand preview. */
export const fishingShares = (activity = 0) => ({
  empty: .3 - .2 * activity, tiny: .2 - .15 * activity,
  fish: .4 + .35 * activity, creature: .06,
  junk: .03 - .01 * activity, treasure: .01 + .01 * activity,
});
export const fishingRarityBoost = (rarity: number, activity: number) => 1 + (([1, 1.2, 3, 4, 6][rarity] ?? 1) - 1) * activity;
