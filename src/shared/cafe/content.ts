import type { CafeContent, Shift, WeekPlan } from './types.js';
/** Extend these catalogs to add content. Mechanics consume capabilities, never display names. */
export const cafeContent: CafeContent = {
  revision: 1,
  ingredients: [
    { id: 'beans', name: '咖啡豆', unit: '份', pack: 100, price: 18000, shelfDays: 28, freshnessDays: 10 },
    { id: 'milk', name: '鲜牛奶', unit: '份', pack: 50, price: 11000, shelfDays: 5, freshnessDays: null },
    { id: 'oat', name: '燕麦奶', unit: '份', pack: 50, price: 17000, shelfDays: 7, freshnessDays: null },
    {
      id: 'cups',
      name: '杯与杯盖',
      unit: '套',
      pack: 100,
      price: 6000,
      shelfDays: null,
      freshnessDays: null,
    },
  ],
  drinks: [
    {
      id: 'americano',
      name: '美式',
      short: '美',
      recipe: { beans: 1, cups: 1 },
      price: 1800,
      minutes: 1.5,
      affinity: { office: 1.3, student: 1.1, neighbor: 0.8 },
    },
    {
      id: 'latte',
      name: '拿铁',
      short: '拿',
      recipe: { beans: 1, milk: 1, cups: 1 },
      price: 2500,
      minutes: 2.3,
      affinity: { office: 1, student: 1.2, neighbor: 1.4 },
    },
    {
      id: 'oatLatte',
      name: '燕麦拿铁',
      short: '燕',
      recipe: { beans: 1, oat: 1, cups: 1 },
      price: 2900,
      minutes: 2.5,
      affinity: { office: 0.7, student: 0.5, neighbor: 0.9 },
    },
  ],
  locations: [
    {
      id: 'office',
      name: '梧桐路转角',
      district: '写字楼街区',
      description: '早高峰的第一杯咖啡',
      area: 35,
      maxSeats: 8,
      rent: 840000,
      depositMonths: 2,
      fitout: 1800000,
      footfall: { morning: 300, afternoon: 200, evening: 85 },
      weekend: 0.24,
      segments: { office: 0.8, student: 0.05, neighbor: 0.15 },
      competition: 0.8,
      color: '#a8734e',
    },
    {
      id: 'campus',
      name: '银杏里 07 号',
      district: '大学南门',
      description: '把课间留给一杯拿铁',
      area: 40,
      maxSeats: 12,
      rent: 480000,
      depositMonths: 2,
      fitout: 1400000,
      footfall: { morning: 160, afternoon: 230, evening: 210 },
      weekend: 0.88,
      segments: { office: 0.1, student: 0.8, neighbor: 0.1 },
      competition: 0.9,
      color: '#78865e',
    },
    {
      id: 'community',
      name: '橘子巷小铺',
      district: '社区商业街',
      description: '和邻居慢慢熟悉起来',
      area: 55,
      maxSeats: 18,
      rent: 560000,
      depositMonths: 2,
      fitout: 2000000,
      footfall: { morning: 130, afternoon: 175, evening: 120 },
      weekend: 1.3,
      segments: { office: 0.2, student: 0.1, neighbor: 0.7 },
      competition: 0.95,
      color: '#be8863',
    },
  ],
  machines: [
    { id: 'starter', name: '单头咖啡机', price: 1600000, cupsPerHour: 24, lifeWeeks: 156 },
    { id: 'commercial', name: '双头商用机', price: 3400000, cupsPerHour: 48, lifeWeeks: 208 },
  ],
  roles: [
    { id: 'barista', name: '咖啡师', wage: 2400, brewPerHour: 25, servicePerHour: 10 },
    { id: 'server', name: '兼职店员', wage: 1800, brewPerHour: 0, servicePerHour: 40 },
  ],
};
export const SHIFTS: readonly Shift[] = ['morning', 'afternoon', 'evening'];
export const SHIFT_HOURS: Record<Shift, number[]> = {
  morning: [7, 8, 9, 10],
  afternoon: [11, 12, 13, 14],
  evening: [15, 16, 17, 18],
};
export const SHIFT_NAMES: Record<Shift, string> = {
  morning: '早班 07–11',
  afternoon: '午班 11–15',
  evening: '晚班 15–19',
};
export const STARTING_CAPITAL = 10000000;
export const LOAN_LIMIT = 3000000;
export const CAMPAIGN_WEEKS = 8;
export const CAFE_KEY = 'dogcow.cafe.v1';
export function defaultPlan(content = cafeContent): WeekPlan {
  return {
    prices: Object.fromEntries(content.drinks.map((d) => [d.id, d.price])),
    purchases: Object.fromEntries(
      content.ingredients.map((i) => [i.id, i.id === 'beans' || i.id === 'cups' ? 8 : 5]),
    ),
    quality: 'house',
    marketing: 15000,
    emergencyBudget: 0,
    wagePremium: 0,
    shifts: Object.fromEntries(
      SHIFTS.map((id) => [
        id,
        {
          open: id !== 'evening',
          owner: id !== 'evening',
          staff: Object.fromEntries(content.roles.map((r) => [r.id, r.id === 'server' ? 1 : 0])),
        },
      ]),
    ) as WeekPlan['shifts'],
  };
}
export function item<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((value) => value.id === id);
  if (!found) throw Error('内容不存在，请更新游戏后重试。');
  return found;
}
