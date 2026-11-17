import { GAME_IDLE_MS, GAME_POLICIES, type GameActivityReport, type GameId, type GameTime } from '../shared/game-progress.js';
interface Environment { foreground: boolean; interrupted: boolean }
/** Monotonic, exclusive accounting: one second can belong to only one game and one bucket. */
export class GameClock {
  private report?: GameActivityReport;
  private environment: Environment = { foreground: false, interrupted: false };
  private last: number;
  private inputAt: number;
  private pending: Partial<Record<GameId, GameTime>> = {};
  constructor(private now = () => performance.now(), private policies: Readonly<Record<string, { background: 'pause' | 'idle' }>> = GAME_POLICIES) {
    this.last = this.inputAt = now();
  }
  update(report: GameActivityReport) {
    this.advance();
    if (report.runId !== this.report?.runId || report.gameId !== this.report?.gameId || report.input
      || (this.report?.activity === 'progressing' && report.activity !== 'progressing')
      || (this.report?.activity === 'blocked' && report.activity !== 'blocked')) this.inputAt = this.last;
    this.report = { ...report };
  }
  environmentChanged(next: Environment) {
    this.advance();
    this.environment = next;
  }
  stop() { this.advance(); this.report = undefined; }
  interrupt() { this.advance(); this.report = undefined; this.environment.interrupted = true; }
  drain() { this.advance(); const result = this.pending; this.pending = {}; return result; }
  private advance() {
    const now = this.now();
    const from = this.last;
    this.last = now;
    // Missing heartbeats/event-loop stalls never turn into offline playtime.
    if (now <= from || now - from > 30_000) return;
    const r = this.report;
    if (!r || r.paused || r.activity === 'blocked' || this.environment.interrupted) return;
    const policy = this.policies[r.gameId];
    if (!policy) return;
    const duration = now - from;
    const foreground = this.environment.foreground;
    const active = !foreground ? 0 : r.activity === 'progressing' ? duration
      : Math.max(0, Math.min(now, this.inputAt + GAME_IDLE_MS) - from);
    const idle = policy.background === 'idle' && r.activity === 'idle-running' ? duration - active : 0;
    const time = this.pending[r.gameId] ??= { active: 0, idle: 0 };
    time.active += active;
    time.idle += idle;
  }
}
