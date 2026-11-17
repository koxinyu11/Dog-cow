import type { Action, PlayerRead, Table } from './engine.js';

export interface Observation { hits: number; opportunities: number }
export interface OpponentModel {
  vpip: Observation;
  preflopRaise: Observation;
  aggression: Observation;
  foldToBet: Observation[];
  weakRiverShowdown: Observation;
}
const empty = (): Observation => ({ hits: 0, opportunities: 0 });
export const emptyOpponentModel = (): OpponentModel => ({
  vpip: empty(), preflopRaise: empty(), aggression: empty(),
  foldToBet: Array.from({ length: 4 }, empty), weakRiverShowdown: empty(),
});
/** Recent evidence gradually replaces a prior; one showdown never becomes certainty. */
export const observedRate = (stat: Observation | undefined, prior: number) =>
  stat ? (stat.hits + prior * 10) / (stat.opportunities + 10) : prior;
function observe(stat: Observation, hit: boolean) {
  stat.hits = stat.hits * .98 + Number(hit);
  stat.opportunities = stat.opportunities * .98 + 1;
}
function readFor(t: Table, seat: number): PlayerRead {
  t.reads ??= t.seats.map(() => ({ decisions: 0, raises: 0, calls: 0, folds: 0 }));
  return t.reads[seat];
}
/** Called before appending the current action. Only publicly observable choices are inputs. */
export function observeAction(t: Table, action: Action, toCall: number) {
  const read = readFor(t, t.turn);
  read.decisions++;
  if (action === 'raise') read.raises++;
  if (action === 'call') read.calls++;
  if (action === 'fold') read.folds++;
  const model = read.model ??= emptyOpponentModel();
  observe(model.aggression, action === 'raise');
  if (toCall > 0) observe(model.foldToBet[t.street], action === 'fold');
  if (t.street !== 0) return;
  const earlier = (t.actions ?? []).filter(a => a.seat === t.turn && a.street === 0);
  const voluntary = action === 'raise' || (action === 'call' && toCall > 0);
  if (!earlier.length) {
    observe(model.vpip, voluntary);
    observe(model.preflopRaise, action === 'raise');
  } else {
    // Upgrade the same hand's observation, never count a second hand after a re-raise.
    if (voluntary && !earlier.some(a => a.action === 'call' || a.action === 'raise') && model.vpip.opportunities > 0)
      model.vpip.hits = Math.min(model.vpip.opportunities, model.vpip.hits + 1);
    if (action === 'raise' && !earlier.some(a => a.action === 'raise') && model.preflopRaise.opportunities > 0)
      model.preflopRaise.hits = Math.min(model.preflopRaise.opportunities, model.preflopRaise.hits + 1);
  }
}
/** The dealer calls this only for hands that the existing UI actually reveals. */
export function observeRiverShowdown(t: Table, seat: number, weak: boolean) {
  if (!t.actions?.some(a => a.seat === seat && a.street === 3 && a.action === 'raise')) return;
  const read = readFor(t, seat);
  const model = read.model ??= emptyOpponentModel();
  observe(model.weakRiverShowdown, weak);
}
