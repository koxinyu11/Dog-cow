/** The host owns accounting. Games only describe their current lifecycle. */
export const GAME_PROGRESS_KEY = 'dogcow.games.v1';
export const GAME_IDLE_MS = 5 * 60_000;
export const GAME_POLICIES = {
  'desk-fishing': { background: 'pause' },
  poker: { background: 'pause' },
  cafe: { background: 'pause' },
  'stock-market': { background: 'idle' },
} as const;
export type GameId = keyof typeof GAME_POLICIES;
export type GameActivity = 'blocked' | 'decision' | 'progressing' | 'idle-running';
export interface GameActivityReport {
  gameId: GameId;
  runId: string;
  activity: GameActivity;
  paused: boolean;
  input: boolean;
}
export interface GameTime { active: number; idle: number }
export interface GameProgressState {
  version: 1;
  games: Partial<Record<GameId, GameTime>>;
  poker: { hands: number; wins: number; lastHand: string };
}
export interface GameProgressReply {
  games: Partial<Record<GameId, GameTime>>;
  notices: import('./titles/types.js').TitleCard[];
  error?: string;
  errorCode?: string;
  correlationId?: string;
}
export const isGameId = (id: unknown): id is GameId => typeof id === 'string' && Object.hasOwn(GAME_POLICIES, id);
export function validActivityReport(value: unknown): value is GameActivityReport {
  if (!value || typeof value !== 'object') return false;
  const v = value as GameActivityReport;
  return isGameId(v.gameId) && typeof v.runId === 'string' && v.runId.length > 0 && v.runId.length <= 100
    && ['blocked', 'decision', 'progressing', 'idle-running'].includes(v.activity)
    && typeof v.paused === 'boolean' && typeof v.input === 'boolean';
}
export const emptyGameProgress = (): GameProgressState => ({ version: 1, games: {}, poker: { hands: 0, wins: 0, lastHand: '' } });
export function parseGameProgress(raw: string | null): GameProgressState {
  if (raw === null) return emptyGameProgress();
  const value = JSON.parse(raw) as GameProgressState;
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  if (!value || value.version !== 1 || !value.games || typeof value.games !== 'object' || Array.isArray(value.games)
    || !value.poker || !count(value.poker.hands) || !count(value.poker.wins) || value.poker.wins > value.poker.hands
    || typeof value.poker.lastHand !== 'string' || value.poker.lastHand.length > 100) throw Error('游戏成就记录格式无效。');
  const clean = emptyGameProgress();
  clean.poker = { ...value.poker };
  for (const [id, time] of Object.entries(value.games)) {
    if (!time || !count(time.active) || !count(time.idle)) throw Error('游戏时长记录格式无效。');
    if (isGameId(id)) clean.games[id] = { active: time.active, idle: time.idle };
  }
  return clean;
}
