import { randomInt, randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { validatePokerState } from '../migration/poker.js';
import { EXCHANGE_LIFETIME, type ExchangeIntent } from '../shared/poker-exchange.js';
import { act, assertTable, startTable, type Table } from '../shared/poker/engine.js';
import { POKER_KEY, type PokerState, type PokerRequest, type PokerView } from '../shared/poker.js';
import type { Coins } from './coins.js';
interface Store {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export class PokerError extends Error {
    constructor(readonly code: string, message: string) { super(message); }
}
const refuse = (message: string): never => { throw new PokerError('POKER_RULE', message); };
export class Poker {
    private before: PokerState | null = null;
    constructor(private store: Store, private coins: Coins) { }
    private read(): PokerState {
        const raw = this.store.getItem(POKER_KEY);
        if (raw === null)
            return { version: 1, reserve: 0, table: null, requests: [], leaving: false };
        const s = JSON.parse(raw) as PokerState;
        validatePokerState(s);
        return s;
    }
    confirmSaved() { this.before = null; }
    view(): PokerView {
        const s = structuredClone(this.before ?? this.read());
        if (s.table) {
            s.table.deck = [];
            s.table.seats.forEach((seat, i) => {
                if (i !== 0 && (!s.table!.done || seat.folded || s.table!.board.length < 5))
                    seat.hand = [];
            });
        }
        return { balance: this.coins.view().balance, reserve: s.reserve, table: s.table, pending: !!this.before, leaving: s.leaving, lastSession: s.lastSession };
    }
    exchangeStatus(r: PokerRequest): NonNullable<import('../shared/poker.js').PokerReply['exchangeStatus']> {
        const candidate = this.read();
        const saved = this.before ?? candidate;
        if (saved.exchanges?.some(e => e.requestId === r.requestId)) return 'applied';
        if (candidate.exchanges?.some(e => e.requestId === r.requestId)) return 'pending';
        return this.expired(r, candidate) ? 'expired' : 'notFound';
    }
    private expired(r: PokerRequest, s: PokerState) {
        return !Number.isSafeInteger(r.createdAt) || r.createdAt! <= (s.exchangeFloor ?? 0) || r.createdAt! < Date.now() - EXCHANGE_LIFETIME || r.createdAt! > Date.now() + 5000;
    }
    async decision(request: PokerRequest) {
        if (this.before)
            refuse('本次操作尚未保存，请先重试保存。');
        const s = this.read(), t = s.table;
        if (!t || t.done || t.turn === 0)
            refuse('当前无需电脑行动。');
        this.match(t!, request);
        const visible = structuredClone(t!);
        visible.deck = [];
        visible.seats.forEach((seat, i) => {
            if (i !== visible.turn)
                seat.hand = [];
        });
        return await new Promise<{
            move: NonNullable<PokerRequest['move']>;
            total?: number;
        }>((resolve, reject) => {
            const worker = new Worker(new URL('./poker/strategy.js', import.meta.url));
            const timer = setTimeout(() => { void worker.terminate(); reject(new PokerError('POKER_AI_FAILED', '电脑思考超时，请重试。')); }, 10000);
            const finish = () => { clearTimeout(timer); void worker.terminate(); };
            worker.once('message', value => {
                finish();
                if (value.error)
                    reject(new PokerError('POKER_AI_FAILED', value.error));
                else
                    resolve(value.decision);
            });
            worker.once('error', () => { finish(); reject(new PokerError('POKER_AI_FAILED', '电脑暂时无法决策，请重试。')); });
            worker.postMessage(visible);
        });
    }
    private match(t: Table, r: PokerRequest) {
        if (r.tableId !== t.id || r.revision !== t.revision)
            refuse('牌桌已更新，请重试。');
    }
    execute(r: PokerRequest, decision?: {
        move: NonNullable<PokerRequest['move']>;
        total?: number;
    }) {
        if (r.action === 'view')
            return;
        if (this.before)
            refuse('本次操作尚未保存，请先重试保存。');
        if (!r.requestId || r.requestId.length > 100)
            refuse('操作编号无效。');
        const old = this.read();
        const exchange = r.action === 'exchangeCoins' || r.action === 'exchangeChips';
        if (exchange) {
            const prior = old.exchanges?.find(e => e.requestId === r.requestId);
            if (prior) {
                if (prior.action !== r.action || prior.amount !== r.amount || prior.createdAt !== r.createdAt) refuse('兑换编号与原参数不一致。');
                return;
            }
            if (this.expired(r, old)) refuse('兑换请求已失效，请核对余额后重新操作。');
        } else if (old.requests.includes(r.requestId!)) return;
        const wallet = this.coins.view();
        if (wallet.error || wallet.pendingSave)
            refuse('钱包暂不可用，请先在主界面处理。');
        const s = structuredClone(old);
        let delta = 0;
        if (r.action === 'exchangeCoins' || r.action === 'exchangeChips') {
            const amount = r.amount;
            if (!Number.isSafeInteger(amount) || amount! <= 0)
                refuse('请输入有效的兑换数量。');
            if (r.action === 'exchangeCoins') {
                if (wallet.balance < amount!)
                    refuse('狗牛币不足。');
                const nextReserve = s.reserve + amount! * 100;
                if (!Number.isSafeInteger(nextReserve))
                    refuse('兑换数量过大。');
                s.reserve = nextReserve;
                delta = -amount!;
            }
            else {
                if (amount! % 100 !== 0)
                    refuse('每 100 筹码兑换 1 狗牛币，零头可保留。');
                if (s.reserve < amount!)
                    refuse('可用筹码不足，桌上筹码需离桌后兑换。');
                s.reserve -= amount!;
                delta = amount! / 100;
            }
        }
        else if (r.action === 'join') {
            if (s.table)
                refuse('请先完成当前牌桌的离桌结算。');
            const chips = r.amount;
            if (!Number.isSafeInteger(chips) || chips! < 1000)
                refuse('至少带入 1,000 筹码。');
            if (s.reserve < chips!)
                refuse('可用筹码不足，请先兑换。');
            s.reserve -= chips!;
            s.brought = chips!;
            s.lastSession = undefined;
            s.leaving = false;
            s.table = this.newHand([chips!, 1000, 1000, 1000, 1000], 0);
        }
        else if (r.action === 'leave') {
            if (!s.table)
                refuse('当前没有牌桌。');
            s.leaving = true;
        }
        else if (r.action === 'next') {
            if (!s.table?.done)
                refuse('请先完成本手。');
            if (s.table!.seats[0].chips === 0)
                s.leaving = true;
            else {
                const amounts = s.table!.seats.map(seat => seat.chips || 1000);
                s.table = this.newHand(amounts, (s.table!.dealer + 1) % 5, s.table!.reads);
            }
        }
        else if (r.action === 'act' || r.action === 'bot') {
            if (!s.table || s.table.done)
                refuse('当前没有进行中的牌局。');
            this.match(s.table!, r);
            if ((r.action === 'act' && s.table!.turn !== 0) || (r.action === 'bot' && s.table!.turn === 0))
                refuse('尚未轮到该玩家。');
            const choice = r.action === 'bot' ? decision : { move: r.move, total: r.total };
            if (!choice?.move)
                refuse('行动无效。');
            s.table = act(s.table!, choice!.move!, choice!.total);
        }
        else
            refuse('操作无效。');
        if (r.action === 'leave' && s.table?.done) {
            const returned = s.table.seats[0].chips;
            if (!Number.isSafeInteger(s.reserve + returned))
                refuse('筹码余额超出范围。');
            s.reserve += returned;
            s.lastSession = { brought: s.brought ?? 1000, returned };
            s.brought = undefined;
            s.table = null;
            s.leaving = false;
        }
        if (exchange) {
            const receipt: ExchangeIntent = { action: r.action as ExchangeIntent['action'], amount: r.amount!, requestId: r.requestId!, createdAt: r.createdAt! };
            const receipts = [...(s.exchanges ?? []), receipt];
            const retired = receipts.slice(0, Math.max(0, receipts.length - 128));
            s.exchangeFloor = Math.max(s.exchangeFloor ?? 0, ...retired.map(e => e.createdAt));
            s.exchanges = receipts.slice(-128);
        }
        validatePokerState(s);
        s.requests = [...s.requests, r.requestId!].slice(-128);
        if (s.table)
            assertTable(s.table);
        if (delta)
            this.coins.poker(delta);
        this.store.setItem(POKER_KEY, JSON.stringify(s));
        this.before = old;
    }
    private newHand(chips: number[], dealer: number, reads?: Table['reads']) {
        const deck = Array.from({ length: 52 }, (_, i) => i);
        for (let i = 51; i > 0; i--) {
            const j = randomInt(i + 1);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        const table = startTable(chips, dealer, deck, randomUUID());
        table.reads = reads ? structuredClone(reads) : chips.map(() => ({ decisions: 0, raises: 0, calls: 0, folds: 0 }));
        table.temperament = chips.map(n => n < 500 ? .045 : n > 1600 ? -.025 : 0);
        return table;
    }
}
