import { rank, score, suit, type Card } from '../../shared/poker/engine.js';
export type HandKind = 'air' | 'medium' | 'strong' | 'monster';
export interface HandFeatures { kind: HandKind; category: number; outs: number; blocker: boolean }
const category = (cards: Card[]) => Math.floor(score(cards) / 15 ** 5);
export function boardTexture(board: Card[]) {
  const suits = [0, 1, 2, 3].map(s => board.filter(c => suit(c) === s).length);
  const ranks = new Set(board.map(rank)); if (ranks.has(14)) ranks.add(1);
  const connected = Math.max(0, ...Array.from({ length: 10 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => i + j + 1).filter(r => ranks.has(r)).length));
  return { wet: (Math.max(0, ...suits) >= 3 ? .55 : .1) + (connected >= 3 ? .35 : 0), suits };
}
/** Draws must use a hole card: four suited/connected community cards alone are not our draw. */
export function analyzeHand(hand: Card[], board: Card[]): HandFeatures {
  if (hand.length !== 2) throw Error('机器人缺少自身手牌。');
  const all = [...hand, ...board], cat = category(all), boardCat = category(board);
  const hr = hand.map(rank), br = board.map(rank), top = Math.max(0, ...br);
  const pocket = hr[0] === hr[1];
  const paired = hr.filter(r => br.includes(r));
  const boardOnly = board.length === 5 && score(all) === score(board);
  let kind: HandKind = 'air';
  if (!boardOnly) {
    if (cat >= 4 && cat > boardCat) kind = 'monster';
    else if (cat >= 4) kind = 'strong';
    else if (cat === 3 && cat > boardCat) kind = pocket ? 'monster' : 'strong';
    else if (cat === 2 && boardCat === 0) kind = 'strong';
    else if (pocket || paired.length) {
      const pairRank = pocket ? hr[0] : Math.max(...paired);
      const kicker = hr.find(r => r !== pairRank) ?? pairRank;
      kind = pairRank > top || (pairRank === top && kicker >= 10) ? 'strong' : 'medium';
    } else if (cat >= 2 && cat === boardCat) kind = 'medium';
  }
  const outs = new Set<Card>();
  if (board.length >= 3 && board.length < 5 && cat < 4) {
    for (const s of new Set(hand.map(suit))) {
      if (all.filter(c => suit(c) === s).length === 4)
        for (let c = s * 13; c < (s + 1) * 13; c++) if (!all.includes(c)) outs.add(c);
    }
    const ranks = new Set(all.map(rank)); if (ranks.has(14)) ranks.add(1);
    const holeRanks = new Set(hr); if (holeRanks.has(14)) holeRanks.add(1);
    const boardRanks = new Set(br); if (boardRanks.has(14)) boardRanks.add(1);
    for (let low = 1; low <= 10; low++) {
      const window = Array.from({ length: 5 }, (_, i) => low + i);
      const missing = window.filter(r => !ranks.has(r));
      if (missing.length !== 1 || !window.some(r => holeRanks.has(r) && !boardRanks.has(r))) continue;
      const target = missing[0] === 1 ? 14 : missing[0];
      for (let s = 0; s < 4; s++) { const c = s * 13 + target - 2; if (!all.includes(c)) outs.add(c); }
    }
  }
  const texture = boardTexture(board);
  const blocker = hand.some(c => rank(c) === 14 && (texture.suits[suit(c)] >= 3 || !br.includes(14)))
    || hand.some(c => rank(c) === 13 && texture.suits[suit(c)] >= 3 && !board.some(b => rank(b) === 14 && suit(b) === suit(c)));
  return { kind, category: cat, outs: outs.size, blocker };
}
