import { parentPort } from 'node:worker_threads';
import { legal, pot, rank, score, suit, type Table, type Card, type Action } from '../../shared/poker/engine.js';
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const profiles = [
  { aggression: .1, looseness: 0, bluff: .07, error: .04 },
  { aggression: -.04, looseness: -.08, bluff: .025, error: .025 },
  { aggression: .22, looseness: .09, bluff: .16, error: .06 },
  { aggression: -.1, looseness: .17, bluff: .02, error: .075 },
  { aggression: .12, looseness: .02, bluff: .11, error: .035 },
];
/** Approximate starting-hand strength, not a promise of showdown equity. */
export function startingStrength(hand: Card[]): number {
  const [a, b] = hand.map(rank).sort((x, y) => y - x);
  if (a === b) return .48 + (a - 2) * .04;
  return clamp(.12 + (a - 2) * .025 + (b - 2) * .019 + (suit(hand[0]) === suit(hand[1]) ? .08 : 0) + (a - b === 1 ? .06 : a - b === 2 ? .025 : 0), .1, .9);
}
function texture(cards: Card[]) {
  if (cards.length < 3) return { wet: 0, draw: false };
  const counts = [0, 1, 2, 3].map(s => cards.filter(c => suit(c) === s).length);
  const ranks = new Set(cards.map(rank)); if (ranks.has(14)) ranks.add(1);
  const run = Math.max(...Array.from({ length: 10 }, (_, i) => Array.from({ length: 5 }, (_, j) => i + j + 1).filter(r => ranks.has(r)).length));
  return { wet: clamp((Math.max(...counts) >= 3 ? .5 : .1) + (run >= 3 ? .4 : 0), 0, 1), draw: counts.some(n => n === 4) || run === 4 };
}
/** Weight a candidate by public actions, using only board cards available at that action. */
export function rangeWeight(t: Table, seat: number, hand: Card[]): number {
  const style = profiles[seat];
  const actions = (t.actions ?? []).filter(a => a.seat === seat && a.action !== 'fold');
  let weight = 1;
  for (const action of actions) {
    const board = t.board.slice(0, [0, 3, 4, 5][action.street]);
    const strength = board.length ? Math.floor(score([...hand, ...board]) / 15 ** 5) : startingStrength(hand);
    const pressure = action.paid / Math.max(10, action.potBefore);
    if (action.street === 0) {
      const cutoff = (action.action === 'raise' ? .57 : .34) - style.looseness;
      if (action.action === 'raise' || action.action === 'call') weight *= clamp(.15 + (strength - cutoff + .35) * 1.6, .08, 1);
    } else if (action.action === 'raise') {
      const made = strength >= 2 ? .95 : strength === 1 ? .5 : .08;
      const draw = action.street < 3 && texture([...hand, ...board]).draw;
      weight *= clamp(made + (draw ? .3 : 0) + style.bluff - Math.min(.12, pressure * .035), .035, 1);
    } else if (action.action === 'call') {
      weight *= strength >= 1 || (action.street < 3 && texture([...hand, ...board]).draw) ? .9 : .25 + style.looseness;
    }
  }
  return clamp(weight, .02, 1);
}
export function estimateEquity(t: Table, random = Math.random): number {
  const me = t.seats[t.turn], known = [...me.hand, ...t.board];
  const available = Array.from({ length: 52 }, (_, c) => c).filter(c => !known.includes(c));
  const opponents = t.seats.map((s, i) => ({ s, i })).filter(x => x.i !== t.turn && !x.s.folded);
  let equity = 0;
  const samples = t.street === 0 ? 320 : 440;
  for (let sample = 0; sample < samples; sample++) {
    const pool = [...available];
    const draw = () => pool.splice(Math.floor(random() * pool.length), 1)[0];
    const hands = opponents.map(({ i }) => {
      // Bounded importance resampling over a small set of proposals, no unbounded rejection loop.
      const candidates = Array.from({ length: 6 }, () => {
        const a = Math.floor(random() * pool.length);
        let b = Math.floor(random() * (pool.length - 1)); if (b >= a) b++;
        const hand = [pool[a], pool[b]];
        return { hand, weight: rangeWeight(t, i, hand) };
      });
      let ticket = random() * candidates.reduce((sum, c) => sum + c.weight, 0);
      const chosen = candidates.find(c => (ticket -= c.weight) <= 0) ?? candidates.at(-1)!;
      for (const card of chosen.hand) pool.splice(pool.indexOf(card), 1);
      return chosen.hand;
    });
    const board = [...t.board]; while (board.length < 5) board.push(draw());
    const mine = score([...me.hand, ...board]);
    const others = hands.map(hand => score([...hand, ...board]));
    if (others.every(s => s <= mine)) equity += 1 / (1 + others.filter(s => s === mine).length);
  }
  return equity / samples;
}
export function bluffOpportunity(t: Table, perceived: number): boolean {
  const draw = t.street > 0 && t.street < 3 && texture([...t.seats[t.turn].hand, ...t.board]).draw;
  return draw || (texture(t.board).wet <= .2 && t.street > 0 && perceived > .06) || (t.street === 0 && startingStrength(t.seats[t.turn].hand) > .4);
}
export function decide(t: Table, random = Math.random): { move: Action; total?: number } {
  const me = t.seats[t.turn], l = legal(t), style = profiles[t.turn];
  const opponents = t.seats.map((s, i) => ({ s, i })).filter(x => x.i !== t.turn && !x.s.folded);
  const equity = estimateEquity(t, random);
  const clockwise = Array.from({ length: 5 }, (_, n) => (t.dealer + 1 + n) % 5).filter(i => !t.seats[i].folded);
  const position = clockwise.indexOf(t.turn) / Math.max(1, clockwise.length - 1);
  const activeRaises = (t.actions ?? []).filter(a => a.street === t.street && a.action === 'raise');
  const mood = clamp(t.temperament?.[t.turn] ?? 0, -.04, .04);
  const perceived = clamp(equity + (random() - .5) * style.error * 2 + mood, 0, 1);
  const odds = l.call / Math.max(1, pot(t) + l.call);
  const wet = texture(t.board).wet;
  const foldRate = opponents.reduce((sum, { i }) => {
    const read = t.reads?.[i];
    return sum + (read && read.decisions >= 8 ? clamp(read.folds / read.decisions, .1, .7) : .3);
  }, 0) / Math.max(1, opponents.length);
  const pressure = activeRaises.length;
  const bluffChance = style.bluff * (opponents.length === 1 ? 1 : .3) * (foldRate + .4) * (position > .5 ? 1.2 : .7) / (1 + pressure);
  const bluff = random() < bluffChance && bluffOpportunity(t, perceived);
  const valueRaise = perceived > (opponents.length > 2 ? .73 : .62) - style.aggression * .12;
  const callMargin = pressure * .012 + (l.call / Math.max(1, me.chips)) * .035 - style.looseness * .15;
  if (l.raise && (valueRaise || bluff)) {
    const fractions = bluff ? [0.5, .75, 1] : wet > .5 ? [.65, .85, 1] : [.33, .5, .75];
    const fraction = fractions[Math.floor(random() * fractions.length)];
    const effective = Math.min(me.chips, Math.max(...opponents.map(x => x.s.chips + Math.max(0, x.s.bet - me.bet)), 0));
    const target = Math.max(l.min, t.current + Math.round(Math.max(10, pot(t) * fraction) / 5) * 5);
    const capped = Math.min(l.max, Math.max(l.min, me.bet + effective), target);
    return { move: 'raise', total: capped };
  }
  if (!l.call) return { move: 'check' };
  // A certain win is never folded; uncertain low-equity hands can still be misread by personality.
  if (equity >= .995 || perceived >= odds + callMargin) return { move: 'call' };
  return { move: 'fold' };
}
parentPort?.on('message', (table: Table) => {
  try { parentPort!.postMessage({ decision: decide(table) }); }
  catch { parentPort!.postMessage({ error: '电脑暂时无法决策，请重试。' }); }
});
