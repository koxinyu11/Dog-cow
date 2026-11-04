import { addDays, record, validDate } from '../domain/tasks/model.js';

export interface MoodOption { id: string; name: string; emoji: string; color: string; archived: boolean }
export interface MoodData { moods: MoodOption[]; moodHistory: Record<string, string>; wallpapers: string[] }
export const MOOD_COLORS = ['#d97758', '#629c71', '#687ed0', '#b77bb2', '#c49b45', '#429caa'] as const;
export const MOOD_EMOJIS = ['🐮', '🐂', '🥩', '😴', '🫠', '✨', '🌧️', '🔥', '🌱', '😎', '🥹', '☁️'] as const;
export const MOOD_REWARDS = [
  { id: 'cloud-rest', days: 3, name: '云端摸鱼', emoji: '☁️' },
  { id: 'deep-rest', days: 7, name: '深海放空', emoji: '🪼' },
  { id: 'galaxy-off', days: 14, name: '银河下班', emoji: '🌌' },
] as const;
export const defaultMoods = (): MoodOption[] => [
  { id: 'mood-0', name: '牛劲十足', emoji: '🐮', color: '#629c71', archived: false },
  { id: 'mood-1', name: '勉强营业', emoji: '🐂', color: '#c49b45', archived: false },
  { id: 'mood-2', name: '已成牛肉干', emoji: '🥩', color: '#d97758', archived: false },
];
type LegacyMood = { mood: { date: string; value: number } | null; moods?: MoodOption[]; moodHistory?: Record<string,string>; wallpapers?: string[] };
/** Older saves contain one dated selection only. Never invent earlier records. */
export function moodData(fun: LegacyMood): MoodData {
  return {
    moods: fun.moods ?? defaultMoods(),
    moodHistory: fun.moodHistory ?? (fun.mood ? { [fun.mood.date]: `mood-${fun.mood.value}` } : {}),
    wallpapers: fun.wallpapers ?? [],
  };
}
export function validMoodData(v: Record<string, unknown>) {
  if (v.moods === undefined && v.moodHistory === undefined && v.wallpapers === undefined) return true;
  if (!Array.isArray(v.moods) || v.moods.length > 100 || !v.moods.every(m => record(m) && typeof m.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(m.id)
    && typeof m.name === 'string' && m.name.trim().length > 0 && m.name.length <= 12
    && typeof m.emoji === 'string' && (MOOD_EMOJIS as readonly string[]).includes(m.emoji)
    && typeof m.color === 'string' && /^#[0-9a-f]{6}$/i.test(m.color) && typeof m.archived === 'boolean')) return false;
  const ids = new Set(v.moods.map(m => m.id));
  return ids.size === v.moods.length && record(v.moodHistory)
    && Object.entries(v.moodHistory).every(([date,id]) => validDate(date) && typeof id === 'string' && ids.has(id))
    && Array.isArray(v.wallpapers) && new Set(v.wallpapers).size === v.wallpapers.length
    && v.wallpapers.every(id => MOOD_REWARDS.some(r => r.id === id));
}
export function moodStreak(data: MoodData, today: string) {
  const selectedToday = !!data.moodHistory[today];
  let date = selectedToday ? today : addDays(today,-1);
  const id = data.moodHistory[date];
  let days = 0;
  while (id && data.moodHistory[date] === id) { days++; date = addDays(date,-1); }
  return { id, days, selectedToday };
}
export function moodMessage(name: string, days: number) {
  return days > 0 ? `${name}第 ${days} 天，续航依然是个谜。` : '今天的状态，由你定义。';
}
