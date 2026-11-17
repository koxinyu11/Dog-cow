import { parentPort } from 'node:worker_threads';
import { legal, pot, rank, score, suit, type Table, type Card, type Action } from '../../shared/poker/engine.js';
import { observedRate } from '../../shared/poker/observations.js';
import { analyzeHand, boardTexture, type HandFeatures } from './hand-analysis.js';
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const profiles = [
  { aggression: 0, looseness: 0, bluff: .07 }, // neutral prior for the human, never a fixed human personality
  { aggression: -.04, looseness: -.06, bluff: .025 },
  { aggression: .20, looseness: .08, bluff: .14 },
  { aggression: -.10, looseness: .14, bluff: .02 },
  { aggression: .10, looseness: .02, bluff: .10 },
];
export function startingStrength(hand: Card[]): number {
  const [a, b] = hand.map(rank).sort((x, y) => y - x);
  if (a === b) return .48 + (a - 2) * .04;
  return clamp(.12 + (a - 2) * .025 + (b - 2) * .019 + (suit(hand[0]) === suit(hand[1]) ? .08 : 0)
    + (a - b === 1 ? .06 : a - b === 2 ? .025 : 0), .1, .9);
}
export function opponentRead(t: Table, seat: number) {
  const style = profiles[seat], m = t.reads?.[seat]?.model;
  return {
    vpip: observedRate(m?.vpip, .30 + style.looseness),
    pfr: observedRate(m?.preflopRaise, .16 + style.aggression * .2),
    aggression: observedRate(m?.aggression, .27 + style.aggression * .3),
    fold: observedRate(m?.foldToBet[t.street], .48 - style.looseness * .6),
    weakRiver: observedRate(m?.weakRiverShowdown, .18 + style.bluff * .5),
  };
}
type FeatureCache = Map<string, HandFeatures>;
function features(hand: Card[], board: Card[], cache: FeatureCache) {
  const key = `${board.join(',')}:${[...hand].sort((a, b) => a - b).join(',')}`;
  let result = cache.get(key);
  if (!result) { result = analyzeHand(hand, board); cache.set(key, result); }
  return result;
}
function weightedRange(t: Table, seat: number, hand: Card[], cache: FeatureCache): number {
  const read = opponentRead(t, seat), style = profiles[seat];
  const actions = (t.actions ?? []).filter(a => a.seat === seat && a.action !== 'fold');
  const loose = clamp(style.looseness + (read.vpip - (.30 + style.looseness)) * .7, -.18, .25);
  const bluffMix = clamp(style.bluff + (read.aggression - .27) * .65 + (read.weakRiver - .22) * .8, .015, .40);
  let weight = 1;
  for (const action of actions) {
    const board = t.board.slice(0, [0, 3, 4, 5][action.street]);
    const pressure = (action.raiseSize ?? action.paid) / Math.max(10, action.potBefore + (action.toCall ?? 0));
    if (action.street === 0) {
      if (action.action === 'check') continue;
      const strength = startingStrength(hand);
      const cutoff = (action.action === 'raise' ? .57 - (read.pfr - .16) * .5 : .42) - loose;
      const likelihood = clamp(.5 + (strength - cutoff) * 2.7, .015, 1);
      weight *= action.action === 'raise' ? likelihood ** (1 + Math.min(2, pressure * .3)) : likelihood;
    } else {
      const f = features(hand, board, cache);
      if (action.action === 'raise') {
        const made = f.kind === 'monster' ? .98 : f.kind === 'strong' ? .86 : f.kind === 'medium' ? .25 : .015;
        const draw = action.street < 3 ? Math.min(.32, f.outs * .025) : 0;
        const air = bluffMix * (f.blocker ? 1.25 : .65);
        weight *= clamp((made + draw) / (1 + (f.kind === 'medium' ? pressure : 0)) + air, .01, 1);
      } else if (action.action === 'call') {
        const price = action.paid / Math.max(1, action.potBefore + action.paid);
        const made = f.kind === 'monster' ? .95 : f.kind === 'strong' ? .9 : f.kind === 'medium' ? .65 : .09;
        weight *= clamp(made + Math.min(.4, f.outs * .035) + loose - price * .5, .02, 1);
      } else {
        // Checks retain slow plays; they are weak evidence, never proof of a weak hand.
        weight *= f.kind === 'monster' ? .65 : f.kind === 'strong' ? .8 : 1;
      }
    }
  }
  return clamp(weight, .0005, 1);
}
export function rangeWeight(t: Table, seat: number, hand: Card[]) {
  return weightedRange(t, seat, hand, new Map());
}
interface Opponent { i: number; result: number; hand: HandFeatures; starting: number }
interface Deal { mine: number; opponents: Opponent[] }
/** Only our cards and the public board exclude cards from simulation. Hidden deck/hands are ignored. */
function simulate(t: Table, random: () => number, samples: number): Deal[] {
  const me = t.seats[t.turn], known = [...me.hand, ...t.board];
  if (me.hand.length !== 2 || new Set(known).size !== known.length) throw Error('机器人可见牌局无效。');
  const available = Array.from({ length: 52 }, (_, c) => c).filter(c => !known.includes(c));
  const opponents = t.seats.map((s, i) => ({ s, i })).filter(x => x.i !== t.turn && !x.s.folded);
  const cache: FeatureCache = new Map();
  const weights = new Map<string, number>();
  const deals: Deal[] = [];
  for (let sample = 0; sample < samples; sample++) {
    const pool = [...available];
    const hands = opponents.map(({ i }) => {
      const candidates = Array.from({ length: 6 }, () => {
        const a = Math.floor(random() * pool.length);
        let b = Math.floor(random() * (pool.length - 1)); if (b >= a) b++;
        const hand = [pool[a], pool[b]];
        const key = `${i}:${Math.min(...hand)},${Math.max(...hand)}`;
        let weight = weights.get(key);
        if (weight === undefined) { weight = weightedRange(t, i, hand, cache); weights.set(key, weight); }
        return { hand, weight };
      });
      let ticket = random() * candidates.reduce((sum, c) => sum + c.weight, 0);
      const chosen = candidates.find(c => (ticket -= c.weight) <= 0) ?? candidates.at(-1)!;
      for (const c of chosen.hand) pool.splice(pool.indexOf(c), 1);
      return { i, hand: chosen.hand };
    });
    const board = [...t.board];
    while (board.length < 5) board.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    deals.push({ mine: score([...me.hand, ...board]), opponents: hands.map(({ i, hand }) => ({
      i, result: score([...hand, ...board]), hand: features(hand, t.board, cache), starting: startingStrength(hand),
    })) });
  }
  return deals;
}
function share(deal: Deal, opponents = deal.opponents): number {
  if (opponents.some(o => o.result > deal.mine)) return 0;
  return 1 / (1 + opponents.filter(o => o.result === deal.mine).length);
}
export function estimateEquity(t: Table, random = Math.random, samples = t.street === 0 ? 180 : 260) {
  const deals = simulate(t, random, samples);
  return deals.reduce((n, d) => n + share(d), 0) / deals.length;
}
function positionOf(t: Table) {
  // Preflop begins after the big blind; postflop begins after the dealer.
  const live = Array.from({ length: 5 }, (_, n) => (t.dealer + (t.street === 0 ? 3 : 1) + n) % 5)
    .filter(i => !t.seats[i].folded && t.seats[i].chips > 0);
  return live.indexOf(t.turn) / Math.max(1, live.length - 1);
}
export function bluffOpportunity(t: Table, equity: number): boolean {
  const mine = analyzeHand(t.seats[t.turn].hand, t.board);
  const opponents = t.seats.filter((s, i) => i !== t.turn && !s.folded);
  if (!opponents.some(s => s.chips > 0)) return false;
  if (!t.street) return positionOf(t) >= .5 && startingStrength(t.seats[t.turn].hand) >= .42;
  if (mine.outs >= 4 && opponents.length <= 2) return true;
  if (opponents.length !== 1 || equity < .06 || mine.kind !== 'air') return false;
  const earlier = t.actions ?? [];
  const calledBefore = earlier.some(a => a.seat === t.turn && a.action === 'raise' && a.street < t.street)
    && earlier.some(a => a.seat !== t.turn && a.action === 'call' && a.street < t.street);
  const last = t.board.at(-1);
  const scare = last !== undefined && (rank(last) >= 13 || boardTexture(t.board).wet > .5);
  if (calledBefore && !(mine.blocker && scare)) return false;
  return mine.blocker && (positionOf(t) >= .5 || calledBefore);
}
function continuation(t: Table, o: Opponent, total: number, currentPot: number) {
  const seat = t.seats[o.i];
  if (!seat.chips) return 1;
  const cost = Math.min(seat.chips, Math.max(0, total - seat.bet));
  if (!cost) return 1;
  const price = cost / Math.max(1, currentPot + cost + total - t.seats[t.turn].bet);
  const read = opponentRead(t, o.i);
  const base = !t.street ? clamp(.2 + (o.starting - .4) * 1.5, .04, .98)
    : o.hand.kind === 'monster' ? .99 : o.hand.kind === 'strong' ? .9 : o.hand.kind === 'medium' ? .57
      : o.hand.outs ? .22 + o.hand.outs * .025 : .08;
  return clamp(base + (.48 - read.fold) * .7 - (price - .2) * 1.15, .02, .995);
}
/** Enumerate who continues (at most 16 subsets) against the same sampled deals for every size. */
function raiseEV(t: Table, deals: Deal[], total: number) {
  const me = t.seats[t.turn], cost = total - me.bet;
  let ev = 0;
  for (const deal of deals) {
    const chances = deal.opponents.map(o => continuation(t, o, total, pot(t)));
    for (let mask = 0; mask < 1 << deal.opponents.length; mask++) {
      let probability = 1;
      const continuing: Opponent[] = [];
      for (let n = 0; n < deal.opponents.length; n++) {
        const stays = !!(mask & (1 << n));
        probability *= stays ? chances[n] : 1 - chances[n];
        if (stays) continuing.push(deal.opponents[n]);
      }
      if (!probability) continue;
      if (!continuing.length) { ev += probability * pot(t); continue; }
      // Count only pots we can contest, and never charge an uncalled excess as a loss.
      const contributions = t.seats.map(s => s.invested);
      contributions[t.turn] += cost;
      for (const o of continuing) contributions[o.i] += Math.min(t.seats[o.i].chips, Math.max(0, total - t.seats[o.i].bet));
      const levels = [...new Set(contributions.filter(n => n > 0))].sort((a, b) => a - b);
      let previous = 0, returns = 0;
      for (const level of levels) {
        const contributors = contributions.map((n, i) => ({ n, i })).filter(x => x.n >= level);
        const amount = (level - previous) * contributors.length; previous = level;
        if (contributions[t.turn] < level) continue;
        const eligible = continuing.filter(o => contributions[o.i] >= level);
        returns += amount * share(deal, eligible);
      }
      ev += probability * (returns - cost);
    }
  }
  return ev / deals.length;
}
export type DecisionMode = 'check' | 'call' | 'fold' | 'value' | 'semi-bluff' | 'bluff';
export interface DecisionAnalysis {
  decision: { move: Action; total?: number };
  mode: DecisionMode;
  equity: number;
  odds: number;
  baselineEV: number;
  raiseEV?: number;
}
export function analyzeDecision(t: Table, random = Math.random, samples = t.street === 0 ? 180 : 260): DecisionAnalysis {
  const me = t.seats[t.turn], l = legal(t), style = profiles[t.turn];
  if (!me || t.done || !style) throw Error('当前无需机器人行动。');
  const deals = simulate(t, random, samples);
  const equity = deals.reduce((n, d) => n + share(d), 0) / deals.length;
  const opponents = t.seats.map((s, i) => ({ s, i })).filter(x => x.i !== t.turn && !x.s.folded);
  const position = positionOf(t), f = analyzeHand(me.hand, t.board);
  const eligiblePot = t.seats.reduce((n, s) => n + Math.min(s.invested, me.invested + l.call), 0);
  const odds = l.call / Math.max(1, eligiblePot + l.call);
  const realization = t.street === 3 ? 0 : (1 - position) * .025 + (opponents.length > 1 ? .025 : .01)
    + (!t.street && startingStrength(me.hand) < .45 ? .05 : 0);
  const callEV = (equity - realization) * (eligiblePot + l.call) - l.call;
  const baselineEV = l.call ? Math.max(0, callEV) : equity * eligiblePot;
  const base: DecisionAnalysis = { decision: { move: !l.call ? 'check' : callEV >= 0 || equity >= .995 ? 'call' : 'fold' },
    mode: !l.call ? 'check' : callEV >= 0 || equity >= .995 ? 'call' : 'fold', equity, odds, baselineEV };
  if (!l.raise) return base;
  const value = equity >= (opponents.length > 1 ? .67 : .59) - style.aggression * .08
    && (!t.street || f.kind !== 'air');
  const facingRaises = (t.actions ?? []).filter(a => a.street === t.street && a.action === 'raise');
  const folded = opponents.reduce((p, o) => p * opponentRead(t, o.i).fold, 1);
  const bluffFrequency = clamp(style.bluff * 2.5 * (folded + .3) * (position >= .5 ? 1.2 : .7)
    / (1 + facingRaises.length), 0, .4);
  const bluff = !value && bluffOpportunity(t, equity) && random() < bluffFrequency;
  if (!value && !bluff) return base;
  const deepest = Math.max(...opponents.map(o => o.s.bet + o.s.chips));
  const max = Math.min(l.max, deepest);
  if (max <= t.current || (max < l.min && max !== l.max)) return base;
  const fractions = bluff ? [.33, .5, .65] : boardTexture(t.board).wet > .5 ? [.5, .75, 1] : [.33, .5, .75];
  const sizes = [...new Set(fractions.map(fraction => Math.min(max, Math.max(l.min,
    t.current + Math.round(Math.max(10, (pot(t) + l.call) * fraction) / 5) * 5))))];
  const candidates = sizes.map(total => ({ total, ev: raiseEV(t, deals, total) }));
  const best = candidates.reduce((a, b) => b.ev > a.ev ? b : a);
  // Personality varies only marginal choices/sizing. It never randomly inflates showdown equity.
  const margin = Math.max(1, pot(t)) * .012;
  if (best.ev < baselineEV || (best.ev - baselineEV < margin && random() > .5 + style.aggression)) return base;
  const nearBest = candidates.filter(c => c.ev >= best.ev - margin);
  const chosen = nearBest[Math.floor(random() * nearBest.length)];
  return { ...base, decision: { move: 'raise', total: chosen.total },
    mode: value ? 'value' : f.outs ? 'semi-bluff' : 'bluff', raiseEV: chosen.ev };
}
export function decide(t: Table, random = Math.random) { return analyzeDecision(t, random).decision; }
parentPort?.on('message', (table: Table) => {
  try { parentPort!.postMessage({ decision: decide(table) }); }
  catch { parentPort!.postMessage({ error: '电脑暂时无法决策，请重试。' }); }
});
