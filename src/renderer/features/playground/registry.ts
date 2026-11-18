import type { ComponentType } from 'react';
import type { GameActivity } from '../../../shared/game-progress';
import type { GameDiagnostics } from './game-diagnostics';
import { CafeScene } from './games/cafe/Scene';
import { MarketCover } from './games/market/Cover';
import { DeskFishingCover } from './covers/DeskFishingCover';
/** Games receive lifecycle state, not the main app's business bridge. */
export interface GameProps { paused: boolean; diagnostics: GameDiagnostics; onActivity?(activity: GameActivity): void }
/** Cover tint; maps to theme tokens so both light and dark themes stay legible. */
export type GameAccent = 'brand' | 'accent' | 'sky' | 'gold' | 'danger' | 'grass';
export interface LocalGame {
  /** Stable local identifier; changing a title must not change this ID. */
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Optional small illustrated cover; the emoji icon is shown when absent. Keep it a lightweight SVG component. */
  cover?: ComponentType;
  persistent?: boolean;
  /** Prefer a shared short label such as 益智 / 反应 / 休闲 so filters stay small. */
  category: string;
  accent?: GameAccent;
  /** Typical round length in minutes. */
  minutes?: number;
  controls?: 'keyboard' | 'mouse';
  /** ISO date (YYYY-MM-DD); shows a "新" badge for 30 days. */
  addedAt?: string;
  /** Lower comes first; unset games follow, newest first. */
  order?: number;
  /** Extra search keywords. */
  tags?: readonly string[];
  load(): Promise<{ default: ComponentType<GameProps> }>;
}
/** Explicit, offline catalog. Add a game directory and one lazy import here. */
export const games: readonly LocalGame[] = [{
  id: 'stock-market', title: '狗牛市', description: '240 家公司与 18 只 ETF，用狗牛币读财报、看行情、做交易。', icon: '↗', cover: MarketCover, category: '经营', accent: 'grass', minutes: 5, controls: 'mouse', addedAt: '2026-11-18', persistent: true, order: 0, tags: ['股票', 'ETF', '狗牛币', '量化', '投资'], load: () => import('./games/market'),
}, {
  id: 'cafe', title: '狗牛咖啡馆', description: '从街角选址开始，经营你的第一家咖啡馆。', icon: '☕', cover: CafeScene, category: '经营', accent: 'gold', minutes: 5, controls: 'mouse', addedAt: '2026-11-17', persistent: true, tags: ['咖啡', '经营', 'BizCafe', '模拟'], load: () => import('./games/cafe'),
}, {
  id: 'poker', title: '工位德州', description: '筹码落桌，藏好你的底牌。', icon: '♠', category: '棋牌', accent: 'gold', minutes: 5, controls: 'mouse', addedAt: '2026-11-16', persistent: true, tags: ['德州', '扑克', '狗牛币'], load: () => import('./games/poker'),
}, {
  id: 'desk-fishing', title: '工位钓鱼', description: '抛一竿，等一点水下的动静。收集小鱼，逛逛河边杂货铺。',
  icon: '🎣', cover: DeskFishingCover, category: '休闲', accent: 'grass', minutes: 1, controls: 'mouse', addedAt: '2026-11-14',
  tags: ['钓鱼', '养老', '收集', '图鉴'], load: () => import('./games/desk-fishing'),
}];
