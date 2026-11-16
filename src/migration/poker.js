/** Shared by live loading, rule invariants and backup import. Never repairs or overwrites input. */
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = v => Number.isSafeInteger(v);
const count = v => integer(v) && v >= 0;
const text = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
const seat = v => integer(v) && v >= 0 && v < 5;
const cards = v => Array.isArray(v) && v.every(c => integer(c) && c >= 0 && c < 52) && new Set(v).size === v.length;
const five = v => Array.isArray(v) && v.length === 5;
const sum = v => v.reduce((a, b) => a + b, 0);
const requireValid = value => { if (!value) throw Error('德州存档格式或牌局状态无效，原始数据保留。'); };
const actions = ['fold', 'check', 'call', 'raise'];
const handNames = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺', '其他玩家弃牌'];
export function validatePokerTable(t) {
  requireValid(record(t) && text(t.id) && count(t.revision) && five(t.seats) && seat(t.dealer) && integer(t.street) && t.street >= 0 && t.street <= 3 && typeof t.done === 'boolean');
  requireValid(count(t.current) && integer(t.minRaise) && t.minRaise >= 10 && count(t.initial) && Array.isArray(t.events) && t.events.length <= 30 && t.events.every(text) && typeof t.message === 'string');
  requireValid(cards(t.deck) && cards(t.board) && t.board.length === [0, 3, 4, 5][t.street]);
  for (const s of t.seats) {
    requireValid(record(s) && text(s.name) && [s.chips, s.bet, s.invested, s.actedAt].every(count) && s.bet <= s.invested && s.bet <= t.current && s.actedAt <= t.current && typeof s.folded === 'boolean' && typeof s.acted === 'boolean' && typeof s.lastAction === 'string');
    requireValid(cards(s.hand) && (s.hand.length === 2 || (s.hand.length === 0 && s.folded)));
  }
  const allCards = [...t.deck, ...t.board, ...t.seats.flatMap(s => s.hand)];
  requireValid(allCards.length === 52 - t.street && new Set(allCards).size === allCards.length);
  const total = sum(t.seats.map(s => s.chips + s.invested));
  requireValid(count(total) && total === t.initial);
  if (t.done) requireValid(t.turn === -1 && t.seats.every(s => s.bet === 0 && s.invested === 0));
  else requireValid(seat(t.turn) && !t.seats[t.turn].folded && t.seats[t.turn].chips > 0 && t.seats.filter(s => !s.folded).length >= 2);
  if (t.actions !== undefined) requireValid(Array.isArray(t.actions) && t.actions.length <= 120 && t.actions.every(a => record(a) && seat(a.seat) && integer(a.street) && a.street >= 0 && a.street <= t.street && actions.includes(a.action) && [a.paid, a.total, a.potBefore].every(count) && a.paid <= a.total && a.total <= t.initial && a.potBefore <= t.initial));
  if (t.reads !== undefined) requireValid(five(t.reads) && t.reads.every(r => record(r) && [r.decisions, r.raises, r.calls, r.folds].every(count) && count(r.raises + r.calls + r.folds) && r.raises + r.calls + r.folds <= r.decisions));
  if (t.temperament !== undefined) requireValid(five(t.temperament) && t.temperament.every(n => Number.isFinite(n) && Math.abs(n) <= 1));
  if (t.settlement !== undefined) {
    const result = t.settlement;
    requireValid(t.done && record(result) && five(result.gains) && result.gains.every(count) && five(result.balancesBefore) && result.balancesBefore.every(count) && five(result.winningCards) && five(result.handNames) && result.handNames.every(n => handNames.includes(n)));
    requireValid(Array.isArray(result.awards) && result.awards.length > 0 && result.awards.length <= 5);
    const gained = [0, 0, 0, 0, 0];
    for (const a of result.awards) {
      requireValid(record(a) && text(a.label) && count(a.amount) && a.amount > 0 && typeof a.refund === 'boolean' && Array.isArray(a.recipients) && a.recipients.length > 0 && a.recipients.length <= 5);
      requireValid(a.recipients.every(r => record(r) && seat(r.seat) && count(r.amount) && r.amount > 0) && new Set(a.recipients.map(r => r.seat)).size === a.recipients.length && sum(a.recipients.map(r => r.amount)) === a.amount && (!a.refund || a.recipients.length === 1));
      for (const r of a.recipients) { requireValid(a.refund || !t.seats[r.seat].folded); gained[r.seat] += r.amount; }
    }
    requireValid(count(sum(gained)) && count(sum(result.balancesBefore)) && sum(gained) + sum(result.balancesBefore) === t.initial);
    requireValid(gained.every((n, i) => n === result.gains[i] && result.balancesBefore[i] + n === t.seats[i].chips));
    result.winningCards.forEach((list, i) => requireValid(cards(list) && (list.length === 0 || (list.length === 5 && !t.seats[i].folded && list.every(c => [...t.board, ...t.seats[i].hand].includes(c))))));
    if (result.netGains !== undefined) requireValid(five(result.netGains) && result.netGains.every((n, i) => integer(n) && n <= result.gains[i] && result.gains[i] - n <= t.initial) && sum(result.netGains) === 0);
  }
}
export function validatePokerState(s) {
  requireValid(record(s) && s.version === 1 && count(s.reserve) && Array.isArray(s.requests) && s.requests.length <= 128 && s.requests.every(text) && new Set(s.requests).size === s.requests.length && typeof s.leaving === 'boolean' && Object.hasOwn(s, 'table'));
  if (s.table !== null) validatePokerTable(s.table);
  else requireValid(!s.leaving);
  if (s.brought !== undefined) requireValid(count(s.brought) && s.brought > 0);
  if (s.lastSession !== undefined) requireValid(record(s.lastSession) && count(s.lastSession.brought) && count(s.lastSession.returned));
  if (s.exchangeFloor !== undefined) requireValid(count(s.exchangeFloor));
  if (s.exchanges !== undefined) requireValid(Array.isArray(s.exchanges) && s.exchanges.length <= 128 && new Set(s.exchanges.map(e => e?.requestId)).size === s.exchanges.length && s.exchanges.every(e => record(e) && text(e.requestId) && ['exchangeCoins', 'exchangeChips'].includes(e.action) && count(e.createdAt) && count(e.amount) && e.amount > 0 && (e.action !== 'exchangeChips' || e.amount % 100 === 0)));
  return s;
}
