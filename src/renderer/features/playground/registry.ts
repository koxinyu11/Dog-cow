import type { ComponentType } from 'react';
import type { GameDiagnostics } from './game-diagnostics';
/** Games receive lifecycle state, not the main app's business bridge. */
export interface GameProps { paused: boolean; diagnostics: GameDiagnostics }
/** Cover tint; maps to theme tokens so both light and dark themes stay legible. */
export type GameAccent = 'brand' | 'accent' | 'sky' | 'gold' | 'danger' | 'grass';
export interface LocalGame {
  /** Stable local identifier; changing a title must not change this ID. */
  id: string;
  title: string;
  description: string;
  icon: string;
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
export const games: readonly LocalGame[] = [];
