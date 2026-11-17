import { GAME_PROGRESS_KEY, parseGameProgress, type GameProgressState } from '../shared/game-progress.js';
import { species, type FishingState } from '../shared/fishing.js';
import type { Table } from '../shared/poker/engine.js';
import type { Titles } from './titles.js';
import { GameClock } from './game-clock.js';
interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void }
/** Lives in the serialized business queue, sharing the snapshot save/retry boundary. */
export class GameProgress {
  readonly clock: GameClock;
  private state: GameProgressState | null = null;
  error = '';
  constructor(private store: Store, private titles: Titles, clock = new GameClock()) {
    this.clock = clock;
    try { this.state = parseGameProgress(store.getItem(GAME_PROGRESS_KEY)); }
    catch { this.error = '游戏成就记录无法读取，已停止计时；原数据已保留。'; }
  }
  games() { return structuredClone(this.state?.games ?? {}); }
  settle() {
    const elapsed = this.clock.drain();
    if (!this.state) return;
    for (const [id, time] of Object.entries(elapsed)) {
      const game = id as keyof GameProgressState['games'];
      const total = this.state.games[game] ??= { active: 0, idle: 0 };
      total.active += time.active; total.idle += time.idle;
    }
    // Persist whole milliseconds; fractions are kept in memory until the next checkpoint.
    const saved = structuredClone(this.state);
    for (const time of Object.values(saved.games)) { time.active = Math.floor(time.active); time.idle = Math.floor(time.idle); }
    this.store.setItem(GAME_PROGRESS_KEY, JSON.stringify(saved));
    this.titles.record({ kind: 'game', facts: {
      gameActive: Object.values(saved.games).reduce((n, t) => n + t.active, 0),
      gameIdle: Object.values(saved.games).reduce((n, t) => n + t.idle, 0),
      pokerHands: saved.poker.hands, pokerWins: saved.poker.wins,
    } });
  }
  fishing(state: Pick<FishingState, 'total' | 'book'>) {
    this.titles.record({ kind: 'game', facts: { fishingCaught: state.total,
      fishingFound: species.filter(s => state.book[s.id]).length,
      fishingMythic: species.filter(s => s.rarity === 5 && state.book[s.id]).length } });
  }
  poker(table: Table) {
    if (!this.state || !table.done || !table.settlement || this.state.poker.lastHand === table.id) return;
    this.state.poker.lastHand = table.id;
    this.state.poker.hands++;
    if ((table.settlement.netGains?.[0] ?? table.settlement.gains[0] - table.seats[0].invested) > 0) this.state.poker.wins++;
    this.settle();
  }
}
