/** Local fishing rules. Prices and rewards never come from renderer requests. */
export const FISHING_KEY = 'dogcow.fishing.v1';
export const rarities = ['常见', '少见', '稀有', '珍奇', '传说'] as const;
export const rods = [
  { id: 'bamboo', name: '竹竿', capacity: 2, price: 8, wait: 1, color: '#bc9860' },
  { id: 'wood', name: '木柄竿', capacity: 6, price: 45, wait: .9, color: '#a16b46' },
  { id: 'pro', name: '专业竿', capacity: 16, price: 180, wait: .8, color: '#648b87' },
  { id: 'collector', name: '收藏竿', capacity: 45, price: 650, wait: .7, color: '#b39551' },
] as const;
export const tools = [
  { id: 'float', name: '灵敏浮标', price: 35, description: '等待时间缩短 15%', icon: '◉' },
  { id: 'baitbox', name: '双层饵盒', price: 60, description: '解锁虫饵，偏向较稀有的鱼', icon: '▣' },
  { id: 'net', name: '软网抄网', price: 95, description: '鱼的尺寸增加 15%，重量也会增加', icon: '⌗' },
] as const;
export const spots = [
  { id: 'pond', name: '午后池塘', description: '浅水 · 建议承重 2 kg', required: 0 },
  { id: 'river', name: '芦苇河湾', description: '深水 · 建议承重 16 kg，有断竿风险', required: 5 },
] as const;
export interface Species { id: string; name: string; rarity: number; price: number; min: number; max: number; color: string; spot: 'pond' | 'river'; weight: number; note: string }
export const species: readonly Species[] = [
  { id: 'crucian', name: '小鲫鱼', rarity: 0, price: 2, min: .2, max: .8, color: '#afc6b4', spot: 'pond', weight: 32, note: '池塘里的老邻居。' },
  { id: 'minnow', name: '白条鱼', rarity: 0, price: 2, min: .1, max: .5, color: '#b0d0db', spot: 'pond', weight: 28, note: '闪一下，就溜走了。' },
  { id: 'perch', name: '花鲈', rarity: 1, price: 5, min: .5, max: 1.8, color: '#8dada1', spot: 'pond', weight: 18, note: '身上的斑点从不打卡。' },
  { id: 'salt', name: '咸鱼', rarity: 1, price: 6, min: .3, max: 1.2, color: '#bac4c5', spot: 'pond', weight: 14, note: '今天也想平躺一会儿。' },
  { id: 'koi', name: '日落锦鲤', rarity: 2, price: 15, min: .7, max: 2.5, color: '#e6a17d', spot: 'pond', weight: 6, note: '把一小片晚霞带上岸。' },
  { id: 'moon', name: '月光鱼', rarity: 3, price: 35, min: .4, max: 1.6, color: '#c0b6da', spot: 'pond', weight: 2, note: '白天也能遇见的月光。' },
  { id: 'carp', name: '青背鲤鱼', rarity: 0, price: 3, min: 1, max: 4, color: '#8aab94', spot: 'river', weight: 32, note: '总在芦苇边慢慢转圈。' },
  { id: 'grass', name: '大草鱼', rarity: 1, price: 7, min: 2, max: 8, color: '#98ae79', spot: 'river', weight: 27, note: '这一口草，吃得有点多。' },
  { id: 'catfish', name: '长须鲶鱼', rarity: 1, price: 8, min: 3, max: 10, color: '#8f9da9', spot: 'river', weight: 20, note: '胡须里藏着河湾的故事。' },
  { id: 'momo', name: '摸摸鱼', rarity: 2, price: 18, min: 1, max: 6, color: '#e1b58e', spot: 'river', weight: 13, note: '原创幻想鱼。它也在摸鱼。' },
  { id: 'gold', name: '金鳞鱼', rarity: 3, price: 40, min: 5, max: 15, color: '#d9bb66', spot: 'river', weight: 6, note: '河面上缓缓移动的小太阳。' },
  { id: 'cloud', name: '云游龙鱼', rarity: 4, price: 85, min: 14, max: 36, color: '#bdc5df', spot: 'river', weight: 2, note: '原创幻想鱼。偶尔从云里来做客。' },
];
export type RodId = typeof rods[number]['id'];
export type ToolId = typeof tools[number]['id'];
export type SpotId = typeof spots[number]['id'];
export type Bait = 'plain' | 'worm';
export interface Catch { id: string; species: string; kg: number; value: number; locked: boolean }
export type FishingResult = { kind: 'fish' | 'junk' | 'empty' | 'broken'; name: string; kg?: number; species?: string; newDiscovery?: boolean; value?: number };
export interface FishingRound { id: string; rod: RodId; signal: '轻轻晃动' | '缓缓横移' | '明显绷紧'; wait: number; result: FishingResult }
export interface FishingState {
  version: 1; rods: Record<RodId, number>; equipped: RodId; tools: ToolId[]; spot: SpotId; bait: Bait;
  bag: Catch[]; book: Record<string, { count: number; largest: number }>; total: number;
  round: FishingRound | null; last: FishingResult | null; requests: string[];
}
export type FishingAction = 'view' | 'cast' | 'reel' | 'buyRod' | 'buyTool' | 'equip' | 'spot' | 'bait' | 'sell' | 'sellAll' | 'lock' | 'rescue' | 'retry';
export interface FishingRequest { action: FishingAction; requestId?: string; id?: string; roundId?: string }
export interface FishingView {
  state: Omit<FishingState, 'round' | 'requests'> & { round: Omit<FishingRound, 'result'> | null };
  balance: number; pending: boolean; walletLocked: boolean;
}
export interface FishingReply { view?: FishingView; error?: string; errorCode?: string; correlationId?: string }
export const emptyFishing = (): FishingState => ({ version: 1, rods: { bamboo: 1, wood: 0, pro: 0, collector: 0 }, equipped: 'bamboo', tools: [], spot: 'pond', bait: 'plain', bag: [], book: {}, total: 0, round: null, last: null, requests: [] });
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100;
function validResult(v: unknown): v is FishingResult {
  return obj(v) && ['fish', 'junk', 'empty', 'broken'].includes(String(v.kind)) && typeof v.name === 'string' && v.name.length <= 100
    && (v.kg === undefined || finite(v.kg)) && (v.value === undefined || count(v.value))
    && (v.species === undefined || species.some(s => s.id === v.species)) && (v.newDiscovery === undefined || typeof v.newDiscovery === 'boolean');
}
export function parseFishing(raw: string | null): FishingState {
  if (raw === null) return emptyFishing();
  const v: unknown = JSON.parse(raw);
  if (!obj(v) || v.version !== 1 || !obj(v.rods) || !rods.every(r => count((v.rods as Record<string, unknown>)[r.id]) && Number((v.rods as Record<string, unknown>)[r.id]) <= 999)
    || !rods.some(r => r.id === v.equipped) || !Array.isArray(v.tools) || !v.tools.every(t => tools.some(x => x.id === t))
    || !spots.some(s => s.id === v.spot) || !['plain', 'worm'].includes(String(v.bait)) || !count(v.total)
    || !Array.isArray(v.bag) || v.bag.length > 200 || !v.bag.every(c => obj(c) && typeof c.id === 'string' && c.id.length <= 100 && (species.some(s => s.id === c.species) || c.species === 'badge' || c.species === 'bottle') && finite(c.kg) && count(c.value) && typeof c.locked === 'boolean')
    || new Set(v.bag.map(c => c.id)).size !== v.bag.length || !obj(v.book) || Object.entries(v.book).some(([id, entry]) => !species.some(s => s.id === id) || !obj(entry) || !count(entry.count) || !finite(entry.largest))
    || !Array.isArray(v.requests) || v.requests.length > 128 || !v.requests.every(id => typeof id === 'string' && id.length <= 100)
    || (v.last !== null && !validResult(v.last))) throw Error('钓鱼存档异常，已保留原始数据。');
  if (v.round !== null && (!obj(v.round) || typeof v.round.id !== 'string' || v.round.id.length > 100 || !rods.some(r => r.id === (v.round as Record<string, unknown>).rod)
    || !['轻轻晃动', '缓缓横移', '明显绷紧'].includes(String(v.round.signal)) || !finite(v.round.wait) || !validResult(v.round.result))) throw Error('当前鱼竿记录异常，已保留原始数据。');
  return v as unknown as FishingState;
}
export function fishingView(state: FishingState, balance: number, pending = false, walletLocked = false): FishingView {
  const { requests: _requests, round, ...rest } = state;
  return { state: { ...rest, round: round ? { id: round.id, rod: round.rod, signal: round.signal, wait: round.wait } : null }, balance, pending, walletLocked };
}
/** Overload has a gradual risk; rods within capacity never break. */
export function breakChance(kg: number, capacity: number) { return kg <= capacity ? 0 : Math.min(.95, (kg / capacity - 1) * .6); }
export function rollRound(state: FishingState, id: string, random = Math.random): FishingRound {
  const rod = rods.find(r => r.id === state.equipped)!;
  const type = random();
  let result: FishingResult;
  if (type < .12) result = { kind: 'empty', name: '只有水流经过' };
  else if (type < .23) {
    const junk = random();
    result = junk < .4 ? { kind: 'junk', name: '旧工牌', species: 'badge', kg: .05, value: 1 } : junk < .7 ? { kind: 'junk', name: '瓶中纸条', species: 'bottle', kg: .1, value: 2 } : { kind: 'empty', name: '一团水草' };
  } else {
    const pool = species.filter(s => s.spot === state.spot);
    const weights = pool.map(s => s.weight * (state.bait === 'worm' && s.rarity >= 2 ? 1.8 : 1));
    let point = random() * weights.reduce((a, b) => a + b, 0);
    const fish = pool.find((_s, i) => (point -= weights[i]) < 0) ?? pool[pool.length - 1];
    const kg = Math.round((fish.min + random() * (fish.max - fish.min)) * (state.tools.includes('net') ? 1.15 : 1) * 100) / 100;
    result = random() < breakChance(kg, rod.capacity) ? { kind: 'broken', name: '鱼竿断了，水下的大家伙游走了', kg } :
      { kind: 'fish', name: fish.name, species: fish.id, kg, value: fish.price + Math.floor(fish.price * .25 * (kg / fish.max)), newDiscovery: !state.book[fish.id] };
  }
  const heavy = (result.kg ?? 0) > rod.capacity * .8;
  return { id, rod: rod.id, wait: (5 + random() * 5) * rod.wait * (state.tools.includes('float') ? .85 : 1),
    signal: heavy ? '明显绷紧' : random() < .5 ? '轻轻晃动' : '缓缓横移', result };
}
