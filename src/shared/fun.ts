import { moodData, moodStreak, validMoodData, MOOD_REWARDS, type MoodOption } from './mood.js';
import { addDays, localDate, record, validDate } from '../domain/tasks/model.js';
import type { Fields } from './contracts.js';

export interface FunState {
  mood: { date: string; value: number } | null;
  moods?: MoodOption[];
  moodHistory?: Record<string,string>;
  wallpapers?: string[];
  meals: string[];
  noRepeat: boolean;
  lunch: { week: string; used: string[]; date: string; chosen: string };
  hopes: { id: string; name: string; date: string }[];
  pinned: string;
  rewarded: string[];
  products: { name: string; price: number }[];
  product: number;
}
export const defaultFun = (): FunState => ({
  mood: null, meals: ['牛肉面', '盖浇饭', '饺子', '麻辣烫', '轻食'], noRepeat: true,
  lunch: { week: '', used: [], date: '', chosen: '' }, hopes: [], pinned: '', rewarded: [],
  products: [{ name: '奶茶', price: 18 }, { name: '火锅', price: 120 }], product: 0,
});
export const weekKey = (date: string) => addDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
export const weekendDays = (date: string) => {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || day === 6 ? 0 : 6 - day;
};
export const daysUntil = (today: string, target: string) => Math.round((Date.UTC(...parts(target)) - Date.UTC(...parts(today))) / 86400000);
function parts(date: string): [number, number, number] { const [y, m, d] = date.split('-').map(Number); return [y, m - 1, d]; }
const text = (v: unknown, max = 60): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const strings = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => text(x, 100)) && new Set(v).size === v.length;
export function validFun(v: unknown): v is FunState {
  if (!record(v) || !validMoodData(v)) return false;
  return (v.mood === null || (record(v.mood) && validDate(v.mood.date) && Number.isInteger(v.mood.value) && Number(v.mood.value) >= 0 && Number(v.mood.value) < 3))
    && strings(v.meals, 50) && typeof v.noRepeat === 'boolean'
    && record(v.lunch) && (v.lunch.week === '' || validDate(v.lunch.week)) && strings(v.lunch.used, 50)
    && (v.lunch.date === '' || validDate(v.lunch.date)) && typeof v.lunch.chosen === 'string' && v.lunch.chosen.length <= 100
    && Array.isArray(v.hopes) && v.hopes.length <= 30 && v.hopes.every(h => record(h) && text(h.id, 100) && text(h.name) && validDate(h.date))
    && new Set(v.hopes.map(h => h.id)).size === v.hopes.length && typeof v.pinned === 'string' && (v.pinned === '' || v.hopes.some(h => h.id === v.pinned))
    && strings(v.rewarded, 100000) && Array.isArray(v.products) && v.products.length <= 30
    && v.products.every(p => record(p) && text(p.name) && typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0 && p.price <= 100000000)
    && Number.isInteger(v.product) && Number(v.product) >= 0 && (v.products.length === 0 ? v.product === 0 : Number(v.product) < v.products.length);
}
export function lunchOptions(fun: FunState, date: string) {
  const used = fun.lunch.week === weekKey(date) ? fun.lunch.used : [];
  return fun.meals.filter(meal => !fun.noRepeat || !used.includes(meal));
}

/** Common single-serving estimate used by the linked lunch/calorie cards. */
export function estimateMealCalories(meal: string) {
  const rules: Array<[RegExp, number]> = [
    [/火锅|麻辣烫|冒菜/, 900],
    [/炸鸡|炸串|油炸|薯条/, 850],
    [/汉堡|披萨/, 800],
    [/烧烤|烤肉/, 750],
    [/盖浇饭|炒饭|煲仔饭|黄焖鸡|咖喱饭/, 700],
    [/牛肉面|拉面|拌面|炒面|米线|螺蛳粉/, 620],
    [/饺子|馄饨|包子/, 550],
    [/奶茶|甜品|蛋糕/, 500],
    [/三明治|面包|饭团/, 450],
    [/粥|汤/, 320],
    [/轻食|沙拉|蔬菜/, 350],
  ];
  return rules.find(([pattern]) => pattern.test(meal))?.[1] ?? 600;
}
export function updateFun(previous: FunState, p: Fields, now: Date): FunState {
  const next = structuredClone(previous);
  const today = localDate(now);
  switch (p.action) {
    case 'mood': {
      const data = moodData(next);
      const id = typeof p.id === 'string' ? p.id : `mood-${p.value}`;
      if (!data.moods.some(m => m.id === id && !m.archived)) throw Error('请选择一个可用的精神状态。');
      data.moodHistory = { ...data.moodHistory, [today]: id };
      const streak = moodStreak(data,today);
      data.wallpapers = [...new Set([...data.wallpapers, ...MOOD_REWARDS.filter(r => streak.days >= r.days).map(r => r.id)])];
      Object.assign(next,data);
      next.mood = /^mood-[012]$/.test(id) ? { date: today, value: Number(id.slice(-1)) } : null;
      break;
    }
    case 'save-mood': {
      const data = moodData(next);
      const id = String(p.id || '');
      const old = data.moods.find(m => m.id === id);
      const option = { id, name: String(p.name || '').trim(), emoji: String(p.emoji || ''), color: String(p.color || ''), archived: old?.archived ?? false };
      if (old) data.moods = data.moods.map(m => m.id === id ? option : m);
      else { if (data.moods.filter(m => !m.archived).length >= 20) throw Error('最多保留 20 个可选状态，请先归档一些。'); data.moods = [...data.moods,option]; }
      Object.assign(next,data); break;
    }
    case 'archive-mood': {
      const data = moodData(next);
      if (!data.moods.some(m => m.id === p.id)) throw Error('状态不存在。');
      const target = data.moods.find(m=>m.id===p.id)!;
      if (target.archived && data.moods.filter(m=>!m.archived).length>=20) throw Error('最多保留 20 个可选状态。');
      data.moods = data.moods.map(m => m.id === p.id ? { ...m, archived: !m.archived } : m);
      Object.assign(next,data); break;
    }
    case 'meals':
      if (typeof p.value !== 'string' || p.value.length > 5050 || typeof p.noRepeat !== 'boolean') throw Error('午餐清单无效。');
      next.meals = [...new Set(p.value.split('\n').map(x => x.trim()).filter(Boolean))]; next.noRepeat = p.noRepeat; break;
    case 'lunch':
      if (typeof p.value !== 'string' || !lunchOptions(next, today).includes(p.value)) throw Error('这道菜已选过或不在清单里，请重新抽。');
      next.lunch = { week: weekKey(today), date: today, chosen: p.value, used: [...new Set([...(next.lunch.week === weekKey(today) ? next.lunch.used : []), p.value])] }; break;
    case 'reset-lunch': next.lunch = { week: weekKey(today), used: [], date: '', chosen: '' }; break;
    case 'hope': next.hopes.push({ id: String(p.id), name: String(p.name || '').trim(), date: String(p.date) }); if (!next.pinned) next.pinned = String(p.id); break;
    case 'pin': next.pinned = String(p.id); break;
    case 'remove-hope': next.hopes = next.hopes.filter(h => h.id !== p.id); if (next.pinned === p.id) next.pinned = next.hopes[0]?.id || ''; break;
    case 'products':
      if (!Array.isArray(p.value)) throw Error('商品清单无效。');
      next.products = p.value as FunState['products']; next.product = 0; break;
    case 'product': next.product = Number(p.value); break;
    default: throw Error('趣味卡片操作无效。');
  }
  if (!validFun(next)) throw Error('请检查填写内容、数量和价格。');
  return next;
}
export function rewardTask(fun: FunState, taskId: string) {
  if (fun.rewarded.includes(taskId)) return fun;
  const next = { ...fun, rewarded: [...fun.rewarded, taskId] };
  if (!validFun(next)) throw Error('牧场记录已满，任务奖励未保存。');
  return next;
}
