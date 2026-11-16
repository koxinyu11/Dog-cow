import type { PokerReply, PokerRequest } from './poker.js';
export type ExchangeAction = 'exchangeCoins' | 'exchangeChips';
export interface ExchangeIntent { action: ExchangeAction; amount: number; requestId: string; createdAt: number }
export const EXCHANGE_OUTBOX_KEY = 'dogcow.poker.exchange.pending.v1';
export const EXCHANGE_LIFETIME = 24 * 60 * 60 * 1000;
interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
/** Durable single-operation outbox. Transport failure never creates a new money command. */
export class PokerExchangeClient {
  constructor(private storage: Storage, private invoke: (request: PokerRequest) => Promise<PokerReply>) {}
  pending(): ExchangeIntent | null {
    const raw = this.storage.getItem(EXCHANGE_OUTBOX_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw) as ExchangeIntent;
    if (!v || !['exchangeCoins', 'exchangeChips'].includes(v.action) || !Number.isSafeInteger(v.amount) || v.amount <= 0 || typeof v.requestId !== 'string' || !v.requestId || !Number.isSafeInteger(v.createdAt)) throw Error('待核对兑换记录异常，请保留记录并检查本机数据。');
    return v;
  }
  private finish(reply: PokerReply): PokerReply {
    if (reply.exchangeStatus === 'applied' && !reply.view?.pending) this.storage.removeItem(EXCHANGE_OUTBOX_KEY);
    return reply;
  }
  private async settleReply(reply: PokerReply): Promise<PokerReply> {
    // A definitive rule rejection has no candidate write, but verify the receipt before unlocking.
    const intent = this.pending();
    if (intent && reply.errorCode === 'POKER_RULE' && reply.view && !reply.view.pending) {
      const checked = await this.invoke({ ...intent, action: 'exchangeStatus' });
      if (!checked.error && checked.exchangeStatus === 'notFound' && checked.view && !checked.view.pending) {
        this.storage.removeItem(EXCHANGE_OUTBOX_KEY);
        return { ...reply, view: checked.view };
      }
      return this.finish(checked);
    }
    return this.finish(reply);
  }
  async submit(action: ExchangeAction, amount: number): Promise<PokerReply> {
    if (this.pending()) throw Error('请先核对上一笔兑换。');
    const intent: ExchangeIntent = { action, amount, requestId: crypto.randomUUID(), createdAt: Date.now() };
    this.storage.setItem(EXCHANGE_OUTBOX_KEY, JSON.stringify(intent));
    return this.settleReply(await this.invoke(intent));
  }
  async reconcile(retry = false): Promise<PokerReply> {
    const intent = this.pending();
    if (!intent) return this.invoke({ action: 'view' });
    const reply = await this.invoke({ ...intent, action: 'exchangeStatus' });
    if (reply.error) return reply;
    if (reply.exchangeStatus === 'applied') return this.finish(reply);
    if (reply.exchangeStatus === 'expired') return { ...reply, error: '本次请求已失效，已刷新余额；请核对余额后结束本次操作。' };
    if (!retry) return { ...reply, error: '本次兑换结果待核对，请重试核对原操作。' };
    if (reply.exchangeStatus === 'pending') {
      const saved = await this.invoke({ action: 'retry' });
      if (saved.error || saved.view?.pending) return saved;
      return this.reconcile();
    }
    if (reply.exchangeStatus === 'notFound') return this.settleReply(await this.invoke(intent));
    return { ...reply, error: '暂时无法核对兑换结果，请重试。' };
  }
  async dismissExpired(): Promise<PokerReply> {
    const reply = await this.reconcile();
    if (reply.exchangeStatus !== 'expired' || !reply.view || reply.view.pending) return reply;
    this.storage.removeItem(EXCHANGE_OUTBOX_KEY);
    return { ...reply, error: undefined };
  }
}
