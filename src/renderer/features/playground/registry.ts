import type { ComponentType } from 'react';
import type { GameDiagnostics } from './game-diagnostics';
/** Games receive lifecycle state, not the main app's business bridge. */
export interface GameProps { paused: boolean; diagnostics: GameDiagnostics }
export interface LocalGame {
  /** Stable local identifier; changing a title must not change this ID. */
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  load(): Promise<{ default: ComponentType<GameProps> }>;
}
/** Explicit, offline catalog. Add a game directory and one lazy import here. */
export const games: readonly LocalGame[] = [];
