import { randomUUID } from 'node:crypto';
import { FISHING_KEY, fishingView, parseFishing, rods, tools, spots, rollRound, type FishingRequest, type FishingState, type FishingView, type FishingAction } from '../shared/fishing.js';
import type { Coins } from './coins.js';
interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void }
export class FishingError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function refuse(message: string): never { throw new FishingError('FISHING_RULE', message); }
/** Called only inside the application's serialized command queue. */
export class Fishing {
  private before: FishingState | null = null;
  constructor(private store: Store, private coins: Coins, private random = Math.random) {}
  confirmSaved() { this.before = null; }
  view(): FishingView {
    const wallet = this.coins.view();
    return fishingView(this.before ?? parseFishing(this.store.getItem(FISHING_KEY)), wallet.balance, !!this.before, !!wallet.error || !!wallet.pendingSave);
  }
  execute(request: FishingRequest) {
    const actions: FishingAction[] = ['view', 'cast', 'reel', 'buyRod', 'buyTool', 'equip', 'spot', 'bait', 'sell', 'sellAll', 'lock', 'rescue', 'retry'];
    if (!request || !actions.includes(request.action)) refuse('操作无效。');
    if (request.action === 'view') return;
    if (this.before) refuse('本次操作尚未保存，请先重试保存。');
    const wallet = this.coins.view();
    if (wallet.error || wallet.pendingSave) refuse('钱包暂不可用，请先在主界面处理钱包问题。');
    const old = parseFishing(this.store.getItem(FISHING_KEY));
    if (typeof request.requestId !== 'string' || !request.requestId || request.requestId.length > 100) refuse('操作编号无效，请重试。');
    if (old.requests.includes(request.requestId)) return;
    const next = structuredClone(old);
    const { action, id } = request;
    let delta = 0;
    if (next.round && !['reel'].includes(action)) refuse('请先收回当前鱼线。');
    if (action === 'cast') {
      if (!next.rods[next.equipped]) refuse('请先装备一根可用鱼竿。');
      if (next.bag.length >= 200) refuse('鱼篓满了，请先出售一些收获。');
      next.round = rollRound(next, randomUUID(), this.random);
      next.last = null;
    } else if (action === 'reel') {
      if (!next.round || request.roundId !== next.round.id) refuse('这一竿已经结束，请刷新记录。');
      const round = next.round;
      const result = round.result;
      if (result.kind === 'broken') {
        next.rods[round.rod]--;
        const fallback = rods.find(r => next.rods[r.id] > 0);
        if (fallback) next.equipped = fallback.id;
      } else if (result.species && result.kg && result.value !== undefined) {
        next.bag.push({ id: round.id, species: result.species, kg: result.kg, value: result.value, locked: false });
        if (result.kind === 'fish') {
          const entry = next.book[result.species] ?? { count: 0, largest: 0 };
          next.book[result.species] = { count: entry.count + 1, largest: Math.max(entry.largest, result.kg) };
          next.total++;
        }
      }
      next.last = result;
      next.round = null;
    } else if (action === 'buyRod') {
      const rod = rods.find(r => r.id === id);
      if (!rod) refuse('鱼竿不存在。');
      if (next.rods[rod.id] >= 999) refuse('这款鱼竿已经够多了。');
      delta = -rod.price;
      next.rods[rod.id]++;
      next.equipped = rod.id;
    } else if (action === 'buyTool') {
      const tool = tools.find(t => t.id === id);
      if (!tool) refuse('工具不存在。');
      if (next.tools.includes(tool.id)) refuse('已经拥有这件工具。');
      delta = -tool.price;
      next.tools.push(tool.id);
    } else if (action === 'equip') {
      const rod = rods.find(r => r.id === id);
      if (!rod || !next.rods[rod.id]) refuse('这根鱼竿暂不可用。');
      next.equipped = rod.id;
    } else if (action === 'spot') {
      const spot = spots.find(s => s.id === id);
      if (!spot || Object.keys(next.book).length < spot.required) refuse('发现 5 种鱼后开放河湾。');
      next.spot = spot.id;
    } else if (action === 'bait') {
      if (id !== 'plain' && id !== 'worm') refuse('鱼饵不存在。');
      if (id === 'worm' && !next.tools.includes('baitbox')) refuse('购买双层饵盒后可用虫饵。');
      next.bait = id;
    } else if (action === 'rescue') {
      if (Object.values(next.rods).some(n => n > 0)) refuse('背包里还有可用的鱼竿。');
      next.rods.bamboo = 1;
      next.equipped = 'bamboo';
    } else if (action === 'lock') {
      const item = next.bag.find(c => c.id === id);
      if (!item) refuse('这份收获已不在鱼篓里。');
      item.locked = !item.locked;
    } else if (action === 'sell' || action === 'sellAll') {
      const sold = next.bag.filter(c => !c.locked && (action === 'sellAll' || c.id === id));
      if (!sold.length) refuse('没有可出售的收获，锁定的鱼会保留。');
      delta = sold.reduce((sum, c) => sum + c.value, 0);
      const ids = new Set(sold.map(c => c.id));
      next.bag = next.bag.filter(c => !ids.has(c.id));
    } else refuse('操作无效。');
    if (wallet.balance + delta < 0) refuse('狗牛币不足，再钓几竿吧。');
    next.requests = [...next.requests, request.requestId].slice(-128);
    // Validate every candidate before touching either repository key.
    const raw = JSON.stringify(next);
    parseFishing(raw);
    if (delta) this.coins.fishing(delta, `fishing:${action}:${id ?? 'all'}`);
    this.store.setItem(FISHING_KEY, raw);
    this.before = old;
  }
}
