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
  lunch: {
    week: string;
    used: string[];
    date: string;
    chosen: string;
    /** Number of common single-person servings. Missing in older saves means one serving. */
    servings?: number;
    /** User-adjusted total kcal. Missing means use the automatic estimate. */
    calories?: number;
  };
  hopes: Hope[];
  pinned: string;
  /** Built-in hopes were offered once; removing them later must not bring them back. */
  hopesSeeded?: boolean;
  rewarded: string[];
  products: Product[];
  product: number;
}
/** Treats are counted against today's pay; goals against months of this month's expected take-home. Missing type means treat. */
export type ProductType = 'treat' | 'goal';
export interface Product { name: string; price: number; unit?: string; emoji?: string; type?: ProductType }
export const PRODUCT_PRESETS: Required<Product>[] = [
  { name: '奶茶', unit: '杯', price: 18, emoji: '🧋', type: 'treat' },
  { name: '咖啡', unit: '杯', price: 30, emoji: '☕', type: 'treat' },
  { name: '电影票', unit: '张', price: 50, emoji: '🎬', type: 'treat' },
  { name: '火锅', unit: '顿', price: 120, emoji: '🍲', type: 'treat' },
  { name: '手机', unit: '部', price: 6000, emoji: '📱', type: 'goal' },
  { name: '旅行', unit: '次', price: 10000, emoji: '✈️', type: 'goal' },
  { name: '车子', unit: '辆', price: 200000, emoji: '🚗', type: 'goal' },
  { name: '房子首付', unit: '笔', price: 1000000, emoji: '🏠', type: 'goal' },
];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Servings of a treat today, floored to two decimals so the card never overclaims. */
export const treatCount = (price: number, earnedToday: unknown) =>
  finite(earnedToday) && price > 0 ? Math.floor(Math.max(0, earnedToday) / price * 100) / 100 : null;
/** Whole months needed if every yuan of this month's expected take-home were kept; null when it cannot be estimated. */
export const goalMonths = (price: number, monthIncome: unknown) =>
  finite(monthIncome) && monthIncome > 0 && price > 0 ? Math.ceil(price / monthIncome) : null;
/** week/month/year repeat from `date`; holiday/spring follow the official holiday data. */
export type HopeRepeat = 'week' | 'month' | 'year' | 'holiday' | 'spring';
export interface Hope { id: string; name: string; date: string; repeat?: HopeRepeat; emoji?: string }
export interface HolidayStart { name: string; date: string }
export const HOPE_REPEATS: HopeRepeat[] = ['week', 'month', 'year', 'holiday', 'spring'];

/** Shown on first run and re-addable from the manager. Ids are stable so they are never duplicated. */
export const HOPE_PRESETS: Omit<Hope, 'date'>[] = [
  { id: 'preset-friday', name: '周五', emoji: '🍻', repeat: 'week' },
  { id: 'preset-holiday', name: '法定假期', emoji: '🏖️', repeat: 'holiday' },
  { id: 'preset-spring', name: '过年', emoji: '🧧', repeat: 'spring' },
];
/** One-tap starting points for hopes whose date only the user knows. */
export const HOPE_TEMPLATES: Omit<Hope, 'id' | 'date'>[] = [
  { name: '发薪日', emoji: '💰', repeat: 'month' },
  { name: '年终奖', emoji: '🎁' },
];
export const presetDate = (id: string, today: string) => id === 'preset-friday' ? addDays(today, (5 - new Date(`${today}T12:00:00`).getDay() + 7) % 7) : today;
export function seedHopes(fun: FunState, today: string): FunState {
  if (fun.hopesSeeded || fun.hopes.length) return fun;
  const hopes = HOPE_PRESETS.map(h => ({ ...h, date: presetDate(h.id, today) }));
  return { ...fun, hopes, pinned: hopes[0].id, hopesSeeded: true };
}

/** First off-day of each consecutive official holiday block, from the stored yearly holiday files. */
export function holidayStarts(raws: string[]): HolidayStart[] {
  const days: { date: string; name: string }[] = [];
  for (const raw of raws) {
    try {
      const value = JSON.parse(raw) as { data?: { days?: unknown } };
      const list = Array.isArray(value?.data?.days) ? value.data.days : [];
      for (const d of list) if (record(d) && d.isOffDay === true && validDate(d.date) && typeof d.name === 'string') days.push({ date: d.date as string, name: d.name });
    } catch { /* a broken year only hides that year's holidays */ }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days.filter((d, i) => i === 0 || days[i - 1].name !== d.name || addDays(days[i - 1].date, 1) !== d.date);
}

const ymd = (y: number, m: number, d: number) => {
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};
/** Next date a hope happens on or after `today`. Null means holiday data has no upcoming entry yet. */
export function hopeDate(hope: Hope, today: string, holidays: HolidayStart[]): { date: string; days: number; label?: string } | null {
  const at = (date: string, label?: string) => ({ date, days: daysUntil(today, date), label });
  const [ty, tm] = parts(today);
  const [, am, ad] = parts(hope.date);
  switch (hope.repeat) {
    case 'week': return at(addDays(today, ((new Date(`${hope.date}T12:00:00`).getDay() - new Date(`${today}T12:00:00`).getDay()) + 7) % 7));
    case 'month': { const here = ymd(ty, tm, ad); return at(here >= today ? here : ymd(ty, tm + 1, ad)); }
    case 'year': { const here = ymd(ty, am, ad); return at(here >= today ? here : ymd(ty + 1, am, ad)); }
    case 'holiday': { const next = holidays.find(h => h.date >= today); return next ? at(next.date, next.name) : null; }
    case 'spring': { const next = holidays.find(h => h.date >= today && h.name === '春节'); return next ? at(next.date) : null; }
    default: return at(hope.date);
  }
}

export const defaultFun = (): FunState => ({
  mood: null, meals: ['牛肉面', '盖浇饭', '饺子', '麻辣烫', '轻食'], noRepeat: true,
  lunch: { week: '', used: [], date: '', chosen: '' }, hopes: [], pinned: '', rewarded: [],
  products: [PRODUCT_PRESETS[0], PRODUCT_PRESETS[3], PRODUCT_PRESETS[6]].map(p => ({ ...p })), product: 0,
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
    && (v.lunch.servings === undefined || (typeof v.lunch.servings === 'number' && Number.isFinite(v.lunch.servings) && v.lunch.servings >= 0.1 && v.lunch.servings <= 20))
    && (v.lunch.calories === undefined || (typeof v.lunch.calories === 'number' && Number.isInteger(v.lunch.calories) && v.lunch.calories >= 0 && v.lunch.calories <= 10000))
    && Array.isArray(v.hopes) && v.hopes.length <= 30 && v.hopes.every(h => record(h) && text(h.id, 100) && text(h.name) && validDate(h.date)
      && (h.repeat === undefined || HOPE_REPEATS.includes(h.repeat as HopeRepeat)) && (h.emoji === undefined || text(h.emoji, 16)))
    && (v.hopesSeeded === undefined || typeof v.hopesSeeded === 'boolean')
    && new Set(v.hopes.map(h => h.id)).size === v.hopes.length && typeof v.pinned === 'string' && (v.pinned === '' || v.hopes.some(h => h.id === v.pinned))
    && strings(v.rewarded, 100000) && Array.isArray(v.products) && v.products.length <= 30
    && v.products.every(p => record(p) && text(p.name) && typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0 && p.price <= 100000000
      && (p.unit === undefined || text(p.unit, 8)) && (p.emoji === undefined || text(p.emoji, 16)) && (p.type === undefined || p.type === 'treat' || p.type === 'goal'))
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
      next.lunch = { week: weekKey(today), date: today, chosen: p.value, servings: 1, used: [...new Set([...(next.lunch.week === weekKey(today) ? next.lunch.used : []), p.value])] }; break;
    case 'custom-lunch': {
      const chosen = String(p.value || '').trim();
      const servings = Number(p.servings);
      if (!text(chosen, 100) || !Number.isFinite(servings) || servings < 0.1 || servings > 20) throw Error('请填写吃了什么和有效份量。');
      next.lunch = {
        week: weekKey(today),
        date: today,
        chosen,
        servings,
        used: [...new Set([...(next.lunch.week === weekKey(today) ? next.lunch.used : []), chosen])],
      };
      break;
    }
    case 'lunch-details': {
      if (next.lunch.date !== today || !next.lunch.chosen) throw Error('请先记录今天吃了什么。');
      const servings = Number(p.servings);
      if (!Number.isFinite(servings) || servings < 0.1 || servings > 20) throw Error('份量应在 0.1 到 20 份之间。');
      next.lunch = { ...next.lunch, servings };
      if (p.calories === null) delete next.lunch.calories;
      else {
        const calories = Number(p.calories);
        if (!Number.isInteger(calories) || calories < 0 || calories > 10000) throw Error('热量应为 0 到 10000 的整数。');
        next.lunch.calories = calories;
      }
      break;
    }
    case 'reset-lunch': next.lunch = { week: weekKey(today), used: [], date: '', chosen: '' }; break;
    case 'hope': {
      const hope: Hope = { id: String(p.id), name: String(p.name || '').trim(), date: String(p.date) };
      if (p.repeat) hope.repeat = p.repeat as HopeRepeat;
      if (p.emoji) hope.emoji = String(p.emoji);
      next.hopes.push(hope); if (!next.pinned) next.pinned = hope.id; break;
    }
    case 'pin': next.pinned = String(p.id); break;
    case 'remove-hope': next.hopes = next.hopes.filter(h => h.id !== p.id); if (next.pinned === p.id) next.pinned = next.hopes[0]?.id || ''; break;
    case 'products':
      if (!Array.isArray(p.value)) throw Error('商品清单无效。');
      next.products = p.value as FunState['products'];
      next.product = Number.isInteger(p.selected) ? Number(p.selected) : Math.max(0, next.products.findIndex(item => item.name === previous.products[previous.product]?.name));
      break;
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
