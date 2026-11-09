import {
  TITLES_KEY, correctDeparture, applySignals, catalogProblems, changeTitles, clockSignals, funSignals, openSignals, owedSignals, parseTitles, stealSignals,
  taskSignals, titlesView, viewOf, type DayFacts, type Signal, type TitleId, type TitlesAction, type TitlesState, type TitlesView,
} from '../shared/titles/index.js';
import type { Attendance, Task } from '../shared/contracts.js';
import type { FunState } from '../shared/fun.js';
import { localDate } from '../domain/tasks/model.js';

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Facts from one business command that may produce title signals. */
export type TitleEvent =
  | { kind: 'task-done'; task: Pick<Task, 'id' | 'date'> }
  | { kind: 'clock'; before: Attendance; after: Attendance }
  | { kind: 'fun'; action: unknown; after: FunState }
  | { kind: 'open' }
  | { kind: 'steal'; amount: unknown }
  | { kind: 'owed'; days: Record<string, number>; month?: string };

const STEAL_STEP = 100; // cents; smaller changes wait for the next forced write
const MONEY_LEDGERS = ['steal', 'owed'] as const;

/**
 * The single integration point between business commands and the title engine.
 * Callers only describe what happened; no title, threshold or rule lives here.
 */
export class Titles {
  private state: TitlesState | null = null;
  private error = '';
  /** `${ledger}:${day}` → last written cents for the high-frequency money ledgers. */
  private persisted = new Map<string, number>();

  constructor(private readonly store: Store, private readonly dayFacts: (date: string) => DayFacts | null) {}

  load(today = localDate()) {
    this.error = '';
    this.persisted.clear();
    const problems = catalogProblems();
    if (problems.length) console.error('[titles:catalog]', problems.join('; '));
    try {
      const raw = this.store.getItem(TITLES_KEY);
      this.state = parseTitles(raw, today);
      this.remember();
    } catch {
      this.state = null;
      this.error = '职称数据读取失败，已暂停记录；原数据未被覆盖。';
    }
  }

  view(): TitlesView {
    return titlesView(this.state, this.error);
  }

  /**
   * Records an event inside the current command, before the shared flush, so the
   * business change and the title change are saved together. Returns new unlock ids.
   * `force` writes small steal changes too (offwork, day change, quit).
   */
  record(event: TitleEvent, force = false): TitleId[] {
    if (!this.state) return [];
    const today = localDate();
    if (event.kind === 'steal' && !force && typeof event.amount === 'number' && this.state.ledgers.steal?.[today] === Math.round(event.amount * 100)) return [];
    const signals = this.signals(event, today);
    if (!signals.length) return [];
    const result = applySignals(this.state, signals, Date.now());
    if (!result.changed) return [];
    this.state = result.state;
    const money = event.kind === 'steal' || event.kind === 'owed';
    if (!money || force || result.unlocked.length || this.moneyMoved()) this.write();
    return result.unlocked;
  }

  /** A correction changes eligibility, never ownership or the user's worn title. */
  undoDeparture(date: string) {
    if (!this.state) return;
    this.state = correctDeparture(this.state, date, Date.now());
    this.write();
  }

  /** Flushes any in-memory steal amount not yet written (quit, day change). */
  settle() {
    if (this.state && this.moneyEntries().some(([key, v]) => this.persisted.get(key) !== v)) this.write();
  }

  /** Read-only money ledgers for the coin wallet; `null` while titles are locked. */
  moneyLedgers(): Pick<TitlesState['ledgers'], 'steal' | 'owed'> | null {
    return this.state ? { steal: this.state.ledgers.steal, owed: this.state.ledgers.owed } : null;
  }

  change(input: TitlesAction) {
    if (!this.state) throw Error(this.error || '职称数据不可用。');
    this.state = changeTitles(this.state, input);
    this.store.setItem(TITLES_KEY, JSON.stringify(this.state));
  }

  private signals(event: TitleEvent, today: string): Signal[] {
    const view = viewOf(this.state!);
    switch (event.kind) {
      case 'task-done': return taskSignals(event.task, today, view);
      case 'clock': return clockSignals(event.before, event.after, this.dayFacts);
      case 'fun': return funSignals(event.action, event.after, today);
      case 'open': { const facts = this.dayFacts(today); return openSignals(today, facts ? !facts.workday : null, view); }
      case 'steal': return stealSignals(today, event.amount);
      case 'owed': return owedSignals(event.days, event.month, view.ledger('owed'));
    }
  }

  private moneyEntries(): [string, number][] {
    return MONEY_LEDGERS.flatMap((ledger) => Object.entries(this.state!.ledgers[ledger] ?? {})
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .map(([day, value]) => [`${ledger}:${day}`, value] as [string, number]));
  }

  private moneyMoved() {
    return this.moneyEntries().some(([key, value]) => Math.abs(value - (this.persisted.get(key) ?? 0)) >= STEAL_STEP);
  }

  private remember() {
    for (const [key, value] of this.moneyEntries()) this.persisted.set(key, value);
  }

  /** Title storage failure never blocks the business command that triggered it. */
  private write() {
    try {
      this.store.setItem(TITLES_KEY, JSON.stringify(this.state));
      this.remember();
    } catch (error) {
      console.error('[titles:write]', error instanceof Error ? error.name : 'unknown');
    }
  }
}
