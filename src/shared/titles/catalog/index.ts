import { isLedger, isSignal } from '../signals.js';
import type { Rarity, SeriesDef, TitleDef, Tier } from '../types.js';
import { appUsage } from './app.js';
import { clock } from './clock.js';
import { fun } from './fun.js';
import { meta } from './meta.js';
import { money } from './money.js';
import { work } from './work.js';

/** Bump when any threshold or condition changes. Unlocked titles are never revoked. */
export const RULES_VERSION = 1;
/** Ids removed from the catalog. Never reuse them. */
export const RETIRED_IDS: readonly string[] = [];

// Shelf order in the warehouse follows this list.
const parts = [work, clock, fun, appUsage, money, meta];
export const SERIES: readonly SeriesDef[] = parts.flatMap((part) => part.series);
export const TITLES: readonly TitleDef[] = parts.flatMap((part) => part.titles);
export const titleById = new Map(TITLES.map((title) => [title.id, title]));
export const seriesById = new Map(SERIES.map((series) => [series.id, series]));

export const rarityOf = (tier: Tier): Rarity =>
  tier === 'hidden' ? 'secret' : tier === 1 ? 'intern' : tier === 2 ? 'regular' : tier === 3 ? 'special' : 'plate';
const RANK: Record<Rarity, number> = { intern: 1, regular: 2, special: 3, secret: 4, plate: 5 };
export const rarityRank = (tier: Tier) => RANK[rarityOf(tier)];

/** Structural problems in the catalog; empty when valid. Checked by tests and at startup. */
export function catalogProblems(titles: readonly TitleDef[] = TITLES, series: readonly SeriesDef[] = SERIES): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const seriesIds = new Set(series.map((item) => item.id));
  for (const title of titles) {
    if (ids.has(title.id)) problems.push(`重复 ID：${title.id}`);
    if (RETIRED_IDS.includes(title.id)) problems.push(`复用了已下线 ID：${title.id}`);
    ids.add(title.id);
    if (!seriesIds.has(title.series)) problems.push(`未知系列：${title.id} → ${title.series}`);
    if (!title.name || title.name.length > 10) problems.push(`称号名长度需为 1–10：${title.id}`);
    if (!title.copy || title.copy.length > 60 || !title.rule) problems.push(`缺少文案或规则：${title.id}`);
    const when = title.when;
    if ('count' in when && !isSignal(when.count)) problems.push(`未注册信号：${title.id} → ${when.count}`);
    if ('sum' in when && !isLedger(when.sum)) problems.push(`未注册台账：${title.id} → ${when.sum}`);
    if ('any' in when && !isLedger(when.any)) problems.push(`未注册台账：${title.id} → ${when.any}`);
  }
  for (const item of series) if (!item.icon || !/^#[0-9a-f]{6}$/i.test(item.color)) problems.push(`系列缺少图标或颜色：${item.id}`);
  return problems;
}
