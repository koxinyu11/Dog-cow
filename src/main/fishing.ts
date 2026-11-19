import { fishingMaps, defaultLocation } from '../shared/fishing-maps.js';
import { randomUUID } from 'node:crypto';
import { FISHING_KEY, awardSkins, fishFound, fishingView, parseFishing, repairPrice, repairedWear, rods, skinAvailable, tools, spots, rollRound, type FishingRequest, type FishingState, type FishingView, type FishingAction } from '../shared/fishing.js';
import { charms, isBaitSupply, MAX_SUPPLIES, rodSkins, supplies } from '../shared/fishing-gear.js';
import type { Coins } from './coins.js';
interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void }
export class FishingError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function refuse(message: string): never { throw new FishingError('FISHING_RULE', message); }
/** Called only inside the application's serialized command queue. */
export class Fishing {
  private before: FishingState | null = null;
  constructor(private store: Store, private coins: Coins, private random = Math.random, private now = Date.now) {}
  confirmSaved() { this.before = null; }
  view(): FishingView {
    const wallet = this.coins.view();
    return fishingView(this.before ?? parseFishing(this.store.getItem(FISHING_KEY)), wallet.balance, !!this.before, !!wallet.error || !!wallet.pendingSave);
  }
  execute(request: FishingRequest) {
    const actions: FishingAction[] = ['view', 'cast', 'reel', 'buyRod', 'buyTool', 'equip', 'spot', 'bait', 'sell', 'sellAll', 'lock', 'rescue', 'retry', 'buySkin', 'skin', 'buySupply', 'guard', 'repair', 'zone', 'layer', 'buyCharm', 'charm'];
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
      if (isBaitSupply(next.bait) && next.gear.stock[next.bait] < 1) refuse('补给不足，请先切换普通饵或购买补给。');
      next.round = rollRound(next, randomUUID(), this.random, this.now());
      next.last = null;
    } else if (action === 'reel') {
      if (!next.round || request.roundId !== next.round.id) refuse('这一竿已经结束，请刷新记录。');
      const round = next.round;
      const result = round.result;
      // Reservations are frozen in the hidden round and settled exactly once on reel.
      if (round.supply) {
        if (next.gear.stock[round.supply] < 1) refuse('本竿预留补给记录异常，请保留存档并查看诊断。');
        next.gear.stock[round.supply]--;
        if (next.gear.stock[round.supply] === 0 && next.bait === round.supply) next.bait = 'plain';
      }
      if (result.protected) {
        if (next.gear.stock.guard < 1) refuse('本竿护线扣记录异常，请保留存档并查看诊断。');
        next.gear.stock.guard--;
        if (next.gear.stock.guard === 0) next.gear.guard = false;
      }
      next.wear[round.rod] = (next.wear[round.rod] ?? 0) + 1;
      if (result.kind === 'broken') {
        next.rods[round.rod]--;
        next.wear[round.rod] = 0;
        const fallback = rods.find(r => next.rods[r.id] > 0);
        if (fallback) next.equipped = fallback.id;
      } else if (result.species && result.kg) {
        if (result.value !== undefined) next.bag.push({ id: round.id, species: result.species, kg: result.kg, value: result.value, locked: false, at: this.now() });
        const entry = next.book[result.species] ?? { count: 0, largest: 0 };
        next.book[result.species] = { count: entry.count + 1, largest: Math.max(entry.largest, result.kg) };
        if (result.kind === 'fish') next.total++;
      }
      next.last = result;
      next.round = null;
      awardSkins(next);
    } else if (action === 'buyRod') {
      const rod = rods.find(r => r.id === id);
      if (!rod) refuse('鱼竿不存在。');
      if (next.rods[rod.id] >= 999) refuse('这款鱼竿已经够多了。');
      delta = -rod.price;
      if (!next.rods[rod.id]) next.wear[rod.id] = 0;
      next.rods[rod.id]++;
      next.equipped = rod.id;
    } else if (action === 'buyTool') {
      const tool = tools.find(t => t.id === id);
      if (!tool) refuse('工具不存在。');
      if (next.tools.includes(tool.id)) refuse('已经拥有这件工具。');
      delta = -tool.price;
      next.tools.push(tool.id);
    } else if (action === 'buySkin') {
      const skin = rodSkins.find(s => s.id === id);
      if (!skin || skin.price <= 0) refuse('这款皮肤通过收集解锁。');
      if (next.gear.skins.includes(skin.id)) refuse('已经拥有这款皮肤。');
      delta = -skin.price;
      next.gear.skins.push(skin.id);
      next.gear.skin = skin.id;
    } else if (action === 'skin') {
      const skin = rodSkins.find(s => s.id === id);
      if (!skin || !skinAvailable(next, skin)) refuse('这款皮肤尚未解锁。');
      if (!next.gear.skins.includes(skin.id)) next.gear.skins.push(skin.id);
      next.gear.skin = skin.id;
    } else if (action === 'buySupply') {
      const supply = supplies.find(s => s.id === id);
      if (!supply) refuse('补给不存在。');
      if (fishFound(next.book) < supply.requiredFish) refuse(`发现 ${supply.requiredFish} 种鱼后可用${supply.name}。`);
      if (next.gear.stock[supply.id] + supply.pack > MAX_SUPPLIES) refuse(`这类补给最多存放 ${MAX_SUPPLIES} 份。`);
      delta = -supply.price;
      next.gear.stock[supply.id] += supply.pack;
    } else if (action === 'buyCharm') {
      const charm = charms.find(c => c.id === id);
      if (!charm) refuse('挂件不存在。');
      if (next.gear.charms.includes(charm.id)) refuse('已经拥有这件挂件。');
      if (fishFound(next.book) < charm.requiredFish) refuse(`发现 ${charm.requiredFish} 种鱼后可用${charm.name}。`);
      delta = -charm.price;
      next.gear.charms.push(charm.id);
      next.gear.charm = charm.id;
    } else if (action === 'charm') {
      const charm = charms.find(c => c.id === id);
      if (id !== 'none' && (!charm || !next.gear.charms.includes(charm.id))) refuse('这件挂件尚未拥有。');
      next.gear.charm = id === 'none' ? null : charm!.id;
    } else if (action === 'guard') {
      if (id !== 'on' && id !== 'off') refuse('护线选项无效。');
      if (id === 'on' && next.gear.stock.guard < 1) refuse('请先购买护线扣。');
      next.gear.guard = id === 'on';
    } else if (action === 'repair') {
      const rod = rods.find(r => r.id === next.equipped)!;
      if (!next.rods[rod.id]) refuse('已经断掉的竿无法保养，请先装备一根可用鱼竿。');
      if (next.wear[rod.id] === 0) refuse('这根鱼竿状态良好，无需保养。');
      delta = -repairPrice(rod.id);
      next.wear[rod.id] = repairedWear(next.wear[rod.id], rod.durability);
    } else if (action === 'equip') {
      const rod = rods.find(r => r.id === id);
      if (!rod || !next.rods[rod.id]) refuse('这根鱼竿暂不可用。');
      next.equipped = rod.id;
    } else if (action === 'spot') {
      const spot = spots.find(s => s.id === id);
      if (!spot) refuse('钓点不存在。');
      if (fishFound(next.book) < spot.required) refuse(`发现 ${spot.required} 种鱼后开放${spot.name}。`);
      next.spot = spot.id;
      next.location = defaultLocation(spot.id);
    } else if (action === 'zone' || action === 'layer') {
      const map = fishingMaps[next.spot];
      if (!map || !next.location) refuse('当前钓点不支持选择落点与水层。');
      if (action === 'zone') {
        if (!map.zones.some(z => z.id === id)) refuse('落点不存在。');
        next.location.zone = id!;
      } else {
        if (id !== 'shallow' && id !== 'bottom') refuse('水层不存在。');
        next.location.layer = id;
      }
    } else if (action === 'bait') {
      if (id !== 'plain' && id !== 'worm' && !isBaitSupply(id)) refuse('钓法不存在。');
      if (id === 'worm' && !next.tools.includes('baitbox')) refuse('购买双层饵盒后可用虫饵。');
      if (isBaitSupply(id)) {
        const supply = supplies.find(s => s.id === id)!;
        if (fishFound(next.book) < supply.requiredFish) refuse(`发现 ${supply.requiredFish} 种鱼后可用${supply.name}。`);
        if (next.gear.stock[id] < 1) refuse('该补给已用完，请先购买。');
      }
      next.bait = id;
    } else if (action === 'rescue') {
      if (Object.values(next.rods).some(n => n > 0)) refuse('背包里还有可用的鱼竿。');
      next.rods.bamboo = 1;
      next.wear.bamboo = 0;
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
