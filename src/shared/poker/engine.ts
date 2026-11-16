import { validatePokerTable } from '../../migration/poker.js';
/** Integer chips throughout. Rules have no clock, storage or UI dependencies. */
export type Card = number;
export type Action = 'fold' | 'check' | 'call' | 'raise';
export interface Seat {
    name: string;
    chips: number;
    hand: Card[];
    bet: number;
    invested: number;
    folded: boolean;
    acted: boolean;
    lastAction: string;
    actedAt: number;
}
export interface PotAward {
    label: string;
    amount: number;
    refund: boolean;
    recipients: {
        seat: number;
        amount: number;
    }[];
}
export interface Settlement {
    awards: PotAward[];
    gains: number[];
    balancesBefore: number[];
    winningCards: Card[][];
    handNames: string[];
    netGains?: number[];
}
export interface PublicAction {
    seat: number;
    street: number;
    action: Action;
    paid: number;
    total: number;
    potBefore: number;
}
export interface PlayerRead { decisions: number; raises: number; calls: number; folds: number }
export interface Table {
    id: string;
    revision: number;
    seats: Seat[];
    deck: Card[];
    board: Card[];
    dealer: number;
    turn: number;
    street: number;
    current: number;
    minRaise: number;
    done: boolean;
    message: string;
    initial: number;
    events: string[];
    temperament?: number[];
    settlement?: Settlement;
    actions?: PublicAction[];
    reads?: PlayerRead[];
}
export const rank = (c: Card) => c % 13 + 2;
export const suit = (c: Card) => Math.floor(c / 13);
export function score(cards: Card[]): number {
    if (cards.length < 5)
        return Math.max(...cards.map(rank), 0);
    let best = 0;
    for (let a = 0; a < cards.length - 4; a++)
        for (let b = a + 1; b < cards.length - 3; b++)
            for (let c = b + 1; c < cards.length - 2; c++)
                for (let d = c + 1; d < cards.length - 1; d++)
                    for (let e = d + 1; e < cards.length; e++) {
                        const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
                        const values = five.map(rank).sort((x, y) => y - x);
                        const groups = [...new Set(values)].map(v => [values.filter(x => x === v).length, v]).sort((x, y) => y[0] - x[0] || y[1] - x[1]);
                        const flush = five.every(x => suit(x) === suit(five[0]));
                        const unique = [...new Set(values)];
                        if (unique.includes(14))
                            unique.push(1);
                        let straight = 0;
                        for (let i = 0; i <= unique.length - 5; i++)
                            if (unique[i] - unique[i + 4] === 4)
                                straight = unique[i];
                        let cat = 0, kick = values;
                        if (flush && straight) {
                            cat = 8;
                            kick = [straight];
                        }
                        else if (groups[0][0] === 4) {
                            cat = 7;
                            kick = groups.map(g => g[1]);
                        }
                        else if (groups[0][0] === 3 && groups[1][0] === 2) {
                            cat = 6;
                            kick = groups.map(g => g[1]);
                        }
                        else if (flush)
                            cat = 5;
                        else if (straight) {
                            cat = 4;
                            kick = [straight];
                        }
                        else if (groups[0][0] === 3) {
                            cat = 3;
                            kick = groups.map(g => g[1]);
                        }
                        else if (groups[0][0] === 2 && groups[1][0] === 2) {
                            cat = 2;
                            kick = groups.map(g => g[1]);
                        }
                        else if (groups[0][0] === 2) {
                            cat = 1;
                            kick = groups.map(g => g[1]);
                        }
                        const packed = [cat, ...kick, ...Array(5 - kick.length).fill(0)].reduce((n, v) => n * 15 + v, 0);
                        best = Math.max(best, packed);
                    }
    return best;
}
export const handName = (cards: Card[]) => ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'][Math.floor(score(cards) / 15 ** 5)];
export const pot = (t: Table) => t.seats.reduce((n, s) => n + s.invested, 0);
function next(t: Table, from: number, predicate: (s: Seat) => boolean) {
    for (let i = 1; i <= t.seats.length; i++) {
        const n = (from + i) % t.seats.length;
        if (predicate(t.seats[n]))
            return n;
    }
    return -1;
}
function pay(s: Seat, n: number) { const amount = Math.min(s.chips, n); s.chips -= amount; s.bet += amount; s.invested += amount; }
function note(t: Table, line: string) { t.message = line; t.events = [...t.events, line].slice(-30); }
export function startTable(chips: number[], dealer: number, deck: Card[], id: string): Table {
    if (chips.length !== 5 || chips.some(n => !Number.isSafeInteger(n) || n < 0) || chips.filter(n => n > 0).length < 2 || deck.length !== 52 || new Set(deck).size !== 52 || deck.some(c => !Number.isInteger(c) || c < 0 || c > 51))
        throw Error('牌桌数据无效。');
    const names = ['你', '阿稳', '牛大胆', '慢半拍', '小机灵'];
    const t: Table = { id, revision: 0, seats: chips.map((n, i) => ({ name: names[i], chips: n, hand: [], bet: 0, invested: 0, folded: n === 0, acted: false, lastAction: '', actedAt: 0 })), deck: [...deck], board: [], dealer, turn: 0, street: 0, current: 10, minRaise: 10, done: false, message: '洗牌 · 发牌', initial: chips.reduce((a, b) => a + b, 0), events: [] };
    for (let round = 0; round < 2; round++)
        for (let i = 1; i <= 5; i++) {
            const s = t.seats[(dealer + i) % 5];
            if (!s.folded)
                s.hand.push(t.deck.pop()!);
        }
    const heads = t.seats.filter(s => !s.folded).length === 2;
    const small = heads ? dealer : next(t, dealer, s => !s.folded), big = next(t, small, s => !s.folded);
    pay(t.seats[small], 5);
    pay(t.seats[big], 10);
    t.seats[small].lastAction = '小盲';
    t.seats[big].lastAction = '大盲';
    t.turn = next(t, big, s => !s.folded && s.chips > 0);
    advance(t, big);
    return t;
}
export function legal(t: Table) {
    const s = t.seats[t.turn];
    if (t.done || !s)
        return { call: 0, min: 0, max: 0, raise: false };
    return { call: Math.min(s.chips, t.current - s.bet), min: t.current + t.minRaise, max: s.bet + s.chips, raise: t.seats.some((other, i) => i !== t.turn && !other.folded && other.chips > 0) && s.bet + s.chips > t.current && (!s.acted || t.current - s.actedAt >= t.minRaise) };
}
export function act(old: Table, action: Action, total?: number): Table {
    if (old.done)
        throw Error('本手已经结束。');
    const t = structuredClone(old), s = t.seats[t.turn], l = legal(t);
    const investmentBefore = s.invested, potBefore = pot(t), streetBefore = t.street;
    if (s.folded || !s.chips)
        throw Error('当前座位无法行动。');
    if (action === 'fold') {
        s.folded = true;
        s.lastAction = '弃牌';
    }
    else if (action === 'check') {
        if (l.call)
            throw Error('需要跟注才能继续。');
        s.lastAction = '过牌';
    }
    else if (action === 'call') {
        pay(s, l.call);
        s.lastAction = s.chips ? '跟注' : '全押';
    }
    else if (action === 'raise') {
        if (!l.raise || !Number.isSafeInteger(total) || total! > l.max || total! <= t.current || (total! < l.min && total !== l.max))
            throw Error('加注金额无效。');
        const increment = total! - t.current;
        pay(s, total! - s.bet);
        if (increment >= t.minRaise)
            t.minRaise = increment;
        t.current = total!;
        s.lastAction = s.chips ? `加注至 ${total}` : '全押';
    }
    else
        throw Error('行动无效。');
    s.acted = true;
    s.actedAt = t.current;
    t.actions = [...(t.actions ?? []), { seat: t.turn, street: streetBefore, action, paid: s.invested - investmentBefore, total: s.bet, potBefore }].slice(-120);
    t.reads ??= t.seats.map(() => ({ decisions: 0, raises: 0, calls: 0, folds: 0 }));
    const read = t.reads[t.turn];
    read.decisions++; if (action === 'raise') read.raises++; if (action === 'call') read.calls++; if (action === 'fold') read.folds++;
    t.revision++;
    note(t, `${s.name} · ${s.lastAction}`);
    advance(t, t.turn);
    assertTable(t);
    return t;
}
function advance(t: Table, from: number) {
    if (t.seats.filter(s => !s.folded).length === 1) {
        settle(t);
        return;
    }
    const pending = next(t, from, s => !s.folded && s.chips > 0 && (!s.acted || s.bet < t.current));
    if (pending !== -1) {
        const canAct = t.seats.filter(s => !s.folded && s.chips > 0);
        if (canAct.length > 1 || t.seats[pending].bet < t.current) {
            t.turn = pending;
            return;
        }
    }
    if (t.street === 3) {
        settle(t);
        return;
    }
    t.street++;
    t.deck.pop();
    const count = t.street === 1 ? 3 : 1;
    for (let i = 0; i < count; i++)
        t.board.push(t.deck.pop()!);
    for (const s of t.seats) {
        s.bet = 0;
        s.acted = false;
        s.actedAt = 0;
    }
    t.current = 0;
    t.minRaise = 10;
    note(t, ['', '翻牌', '转牌', '河牌'][t.street]);
    advance(t, t.dealer);
}
function settle(t: Table) {
    // Each investment tier is an independent pot; folded money remains eligible funding.
    const levels = [...new Set(t.seats.map(s => s.invested).filter(n => n > 0))].sort((a, b) => a - b);
    let previous = 0;
    const gains = Array(5).fill(0) as number[];
    const awards: PotAward[] = [];
    const balancesBefore = t.seats.map(s => s.chips);
    const contributions = t.seats.map(s => s.invested);
    const winningCards: Card[][] = t.seats.map(() => []);
    const handNames = t.seats.map(s => !s.folded && t.board.length === 5 ? handName([...s.hand, ...t.board]) : '其他玩家弃牌');
    for (const level of levels) {
        const contributors = t.seats.map((s, i) => ({ s, i })).filter(x => x.s.invested >= level);
        const amount = (level - previous) * contributors.length;
        previous = level;
        if (contributors.length === 1) {
            gains[contributors[0].i] += amount;
            awards.push({ label: '未跟注退回', amount, refund: true, recipients: [{ seat: contributors[0].i, amount }] });
            continue;
        }
        const eligible = contributors.filter(x => !x.s.folded);
        if (!eligible.length)
            throw Error('底池状态异常。');
        const best = Math.max(...eligible.map(x => score([...x.s.hand, ...t.board])));
        const winners = eligible.filter(x => score([...x.s.hand, ...t.board]) === best).sort((a, b) => (a.i - t.dealer + 4) % 5 - (b.i - t.dealer + 4) % 5);
        const recipients = winners.map((x, i) => ({ seat: x.i, amount: Math.floor(amount / winners.length) + (i < amount % winners.length ? 1 : 0) }));
        awards.push({ label: awards.filter(a => !a.refund).length ? `边池 ${awards.filter(a => !a.refund).length}` : '主池', amount, refund: false, recipients });
        recipients.forEach(x => {
            gains[x.seat] += x.amount;
            if (t.board.length === 5 && eligible.length > 1)
                winningCards[x.seat] = bestFive([...t.seats[x.seat].hand, ...t.board]);
        });
    }
    t.seats.forEach((s, i) => { s.chips += gains[i]; s.bet = 0; s.invested = 0; });
    t.settlement = { awards, gains, balancesBefore, winningCards, handNames, netGains: gains.map((gain, i) => gain - contributions[i]) };
    t.done = true;
    t.turn = -1;
    note(t, gains.map((n, i) => n ? `${t.seats[i].name} +${n}` : '').filter(Boolean).join(' · '));
    assertTable(t);
}
/** First best five in stable card order, used only for public showdown highlights. */
function bestFive(cards: Card[]): Card[] {
    const target = score(cards);
    for (let a = 0; a < cards.length - 4; a++)
        for (let b = a + 1; b < cards.length - 3; b++)
            for (let c = b + 1; c < cards.length - 2; c++)
                for (let d = c + 1; d < cards.length - 1; d++)
                    for (let e = d + 1; e < cards.length; e++) {
                        const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
                        if (score(five) === target)
                            return five;
                    }
    return [];
}
export function assertTable(t: Table) {
    validatePokerTable(t);
}
