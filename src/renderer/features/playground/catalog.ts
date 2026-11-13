import type { LocalGame } from './registry';
/** Pure lobby rules: layout tier, ordering, filtering and recent-play persistence. */
export type LobbyTier = 'empty' | 'feature' | 'standard' | 'large';
export const FEATURE_MAX = 3;
export const LARGE_MIN = 12;
export const RECENT_LIMIT = 3;
export const NEW_DAYS = 30;
export const RECENT_KEY = 'dogcow.playground.recent';
export function lobbyTier(count: number): LobbyTier {
  if (count <= 0) return 'empty';
  if (count <= FEATURE_MAX) return 'feature';
  return count >= LARGE_MIN ? 'large' : 'standard';
}
/** Explicit order first, then newest, then title. */
export function sortGames(games: readonly LocalGame[]): LocalGame[] {
  return [...games].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
    || (b.addedAt ?? '').localeCompare(a.addedAt ?? '')
    || a.title.localeCompare(b.title, 'zh-CN'));
}
export function isNewGame(game: LocalGame, now = Date.now()): boolean {
  if (!game.addedAt) return false;
  const added = Date.parse(game.addedAt);
  return Number.isFinite(added) && added <= now && now - added < NEW_DAYS * 86_400_000;
}
export function categoriesOf(games: readonly LocalGame[]): string[] {
  return [...new Set(games.map(game => game.category).filter(Boolean))];
}
export function filterGames(games: readonly LocalGame[], query: string, category: string | null): LocalGame[] {
  const text = query.trim().toLocaleLowerCase();
  return games.filter(game => (!category || game.category === category)
    && (!text || [game.title, game.description, game.category, ...(game.tags ?? [])].some(value => value.toLocaleLowerCase().includes(text))));
}
export function groupByCategory(games: readonly LocalGame[]): { category: string; games: LocalGame[] }[] {
  const groups = new Map<string, LocalGame[]>();
  for (const game of games) { const key = game.category || '其他'; groups.set(key, [...(groups.get(key) ?? []), game]); }
  return [...groups].map(([category, list]) => ({ category, games: list }));
}
type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;
/** Unreadable or malformed storage degrades to "no recent games". */
export function readRecent(storage: KeyValue | undefined, known: readonly LocalGame[]): string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    const ids = new Set(known.map(game => game.id));
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && ids.has(id)))].slice(0, RECENT_LIMIT);
  } catch { return []; }
}
/** Returns the next list even when persisting fails, so the session still reflects the play. */
export function recordRecent(storage: KeyValue | undefined, current: readonly string[], id: string): string[] {
  const next = [id, ...current.filter(value => value !== id)].slice(0, RECENT_LIMIT);
  try { storage?.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota or disabled storage */ }
  return next;
}
