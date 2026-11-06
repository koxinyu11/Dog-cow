import { MOOD_REWARDS } from './mood.js';
import type { FunState } from './fun.js';
import { moodData } from './mood.js';

/** Hidden wallpapers earned by a title. Mood rewards stay in mood.ts because their unlock is stored in fun.wallpapers. */
export const TITLE_WALLPAPERS = [
  { id: 'money-rain', title: 'steal-5000', name: '带薪下钱雨', emoji: '💰' },
  { id: 'milk-tea', title: 'h-coffee', name: '奶茶自由', emoji: '🧋' },
  { id: 'pi-vault', title: 'h-pi', name: '无理小金库', emoji: '🥧' },
  { id: 'run-offwork', title: 'offwork-5', name: '到点跑路', emoji: '🏃' },
  { id: 'friday-resident', title: 'friday-12', name: '周五永居', emoji: '🍻' },
  { id: 'monday-immune', title: 'h-monday', name: '周一免疫', emoji: '😷' },
  { id: 'ticket-shredder', title: 'done-50', name: '需求粉碎机', emoji: '🗂️' },
  { id: 'overtime-hunter', title: 'owed-10000', name: '资本家克星', emoji: '🪧' },
  { id: 'forever-shareholder', title: 'open-365', name: '终身股东', emoji: '📈' },
] as const;

/** Wallpapers bought with 狗牛币. Shown locked with a price; the main process charges this price, never one from the renderer. */
export const COIN_WALLPAPERS = [
  { id: 'mint-factory', name: '摸鱼印钞厂', emoji: '🏭', price: 500 },
  { id: 'boss-iou', name: '老板欠条墙', emoji: '🧾', price: 1000 },
] as const;
export const coinItem = (id: string) => `wallpaper:${id}`;
export const coinWallpaper = (id: string) => COIN_WALLPAPERS.find(w => w.id === id);

export const HIDDEN_WALLPAPERS: readonly string[] = [...MOOD_REWARDS.map(r => r.id), ...TITLE_WALLPAPERS.map(w => w.id)];

/** Single unlock rule for the picker and the main-process guard. Unknown ids are ordinary presets. */
export function isWallpaperUnlocked(id: string, fun: FunState | undefined, titleIds: readonly string[], owned: readonly string[] = []) {
  if (coinWallpaper(id)) return owned.includes(coinItem(id));
  if (MOOD_REWARDS.some(r => r.id === id)) return !!fun && moodData(fun).wallpapers.includes(id);
  const reward = TITLE_WALLPAPERS.find(w => w.id === id);
  return reward ? titleIds.includes(reward.title) : true;
}

/** Wallpapers newly opened by these title ids, for the unlock toast. */
export const wallpapersForTitles = (titleIds: readonly string[]) => TITLE_WALLPAPERS.filter(w => titleIds.includes(w.title));
