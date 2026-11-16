/** Local fishing rules. Prices and rewards never come from renderer requests. */
export const FISHING_KEY = 'dogcow.fishing.v1';
export const rarities = ['常见', '少见', '稀有', '珍奇', '传说'] as const;
export const rods = [
  { id: 'bamboo', name: '竹竿', capacity: 2, price: 8, wait: 1, color: '#bc9860', durability: 40 },
  { id: 'wood', name: '木柄竿', capacity: 6, price: 45, wait: .9, color: '#a16b46', durability: 90 },
  { id: 'pro', name: '专业竿', capacity: 16, price: 180, wait: .8, color: '#648b87', durability: 180 },
  { id: 'collector', name: '收藏竿', capacity: 45, price: 650, wait: .7, color: '#b39551', durability: 400 },
] as const;
export const tools = [
  { id: 'float', name: '灵敏浮标', price: 35, description: '等待时间缩短 15%' },
  { id: 'baitbox', name: '双层饵盒', price: 60, description: '解锁虫饵，偏向较稀有的鱼' },
  { id: 'net', name: '软网抄网', price: 95, description: '鱼的尺寸增加 15%，重量也会增加' },
] as const;
export const spots = [
  { id: 'pond', name: '午后池塘', description: '浅水 · 建议承重 2 kg', required: 0 },
  { id: 'river', name: '芦苇河湾', description: '深水 · 建议承重 16 kg，有断竿风险', required: 5 },
] as const;
export type Category = 'fish' | 'creature' | 'junk' | 'treasure';
export const categories: readonly { id: Category; name: string; share: number }[] = [
  { id: 'creature', name: '水边生物', share: .06 },
  { id: 'junk', name: '工位旧物', share: .026 },
  { id: 'treasure', name: '稀有宝物', share: .004 },
  { id: 'fish', name: '鱼', share: .16 },
];
/** Share of casts that come back with only water or weeds. */
export const EMPTY_SHARE = .4;
/** Share of casts that bring up the tiny everyday fish, at either spot. */
export const TINY_SHARE = .35;
export const TINY_ID = 'wheat';
/** Chance that a mussel carries a pearl; the pearl gets its own book entry. */
export const PEARL_CHANCE = .08;
export type Shape = 'tiny' | 'pearl' | 'round' | 'slim' | 'perch' | 'cat' | 'eel' | 'fancy' | 'dragon' | 'crayfish' | 'snail' | 'turtle' | 'crab' | 'mussel' | 'otter'
  | 'badge' | 'key' | 'keycap' | 'bottle' | 'mug' | 'trophy' | 'coin' | 'compass';
export type Pattern = 'spots' | 'stripes' | 'scales' | 'glow';
/** `visitor` entries are recorded in the book but never enter the bag. Only fish and creatures can break a rod. */
export interface Species { id: string; name: string; category: Category; shape: Shape; pattern?: Pattern; accent?: string; rarity: number; price: number; min: number; max: number; color: string; spot: SpotId | 'any'; weight: number; note: string; visitor?: boolean }
type Entry = Omit<Species, 'category'>;
const group = (category: Category, list: Entry[]): Species[] => list.map(item => ({ ...item, category }));
export const species: readonly Species[] = [
  ...group('fish', [
    { id: 'wheat', name: '麦穗鱼', shape: 'tiny', accent: '#7f8f86', rarity: 0, price: 1, min: .01, max: .03, color: '#c3cdbd', spot: 'any', weight: 0, note: '指甲盖那么大，但每天都来报到。' },
    { id: 'crucian', name: '小鲫鱼', shape: 'round', pattern: 'scales', rarity: 0, price: 2, min: .2, max: .8, color: '#afc6b4', spot: 'pond', weight: 32, note: '池塘里的老邻居。' },
    { id: 'minnow', name: '白条鱼', shape: 'slim', rarity: 0, price: 2, min: .1, max: .5, color: '#b0d0db', spot: 'pond', weight: 28, note: '闪一下，就溜走了。' },
    { id: 'medaka', name: '青鳉', shape: 'slim', accent: '#7fb0a8', rarity: 0, price: 2, min: .05, max: .2, color: '#c9d8c0', spot: 'pond', weight: 22, note: '小小一条，眼睛很亮。' },
    { id: 'loach', name: '泥鳅', shape: 'eel', pattern: 'spots', accent: '#6f6550', rarity: 0, price: 3, min: .1, max: .4, color: '#a99b78', spot: 'pond', weight: 18, note: '滑溜溜，最会找借口溜走。' },
    { id: 'perch', name: '花鲈', shape: 'perch', pattern: 'spots', accent: '#5e7f74', rarity: 1, price: 5, min: .5, max: 1.8, color: '#8dada1', spot: 'pond', weight: 18, note: '身上的斑点从不打卡。' },
    { id: 'salt', name: '咸鱼', shape: 'round', accent: '#8e9899', rarity: 1, price: 6, min: .3, max: 1.2, color: '#bac4c5', spot: 'pond', weight: 14, note: '今天也想平躺一会儿。' },
    { id: 'koi', name: '日落锦鲤', shape: 'round', pattern: 'spots', accent: '#f4efe2', rarity: 2, price: 15, min: .7, max: 2.5, color: '#e6a17d', spot: 'pond', weight: 6, note: '把一小片晚霞带上岸。' },
    { id: 'betta', name: '睡莲斗鱼', shape: 'fancy', accent: '#8e6fb3', rarity: 2, price: 16, min: .05, max: .3, color: '#c98aa8', spot: 'pond', weight: 5, note: '尾巴比工位绿植还要舒展。' },
    { id: 'moon', name: '月光鱼', shape: 'fancy', pattern: 'glow', accent: '#f5f0ff', rarity: 3, price: 35, min: .4, max: 1.6, color: '#c0b6da', spot: 'pond', weight: 2, note: '白天也能遇见的月光。' },
    { id: 'carp', name: '青背鲤鱼', shape: 'round', pattern: 'scales', accent: '#5f8270', rarity: 0, price: 3, min: 1, max: 4, color: '#8aab94', spot: 'river', weight: 32, note: '总在芦苇边慢慢转圈。' },
    { id: 'silver', name: '银飘鱼', shape: 'slim', accent: '#9fb3c1', rarity: 0, price: 3, min: .1, max: .6, color: '#c5d3dc', spot: 'river', weight: 24, note: '一群一群，像会议纪要一样飘过。' },
    { id: 'grass', name: '大草鱼', shape: 'perch', pattern: 'scales', accent: '#748a58', rarity: 1, price: 7, min: 2, max: 8, color: '#98ae79', spot: 'river', weight: 27, note: '这一口草，吃得有点多。' },
    { id: 'catfish', name: '长须鲶鱼', shape: 'cat', accent: '#6c7987', rarity: 1, price: 8, min: 3, max: 10, color: '#8f9da9', spot: 'river', weight: 20, note: '胡须里藏着河湾的故事。' },
    { id: 'yellowcat', name: '黄颡鱼', shape: 'cat', pattern: 'stripes', accent: '#8c7134', rarity: 1, price: 7, min: .3, max: 1.5, color: '#c7a75a', spot: 'river', weight: 18, note: '被拎起来会嘎嘎抱怨。' },
    { id: 'momo', name: '摸摸鱼', shape: 'round', pattern: 'stripes', accent: '#c08a5e', rarity: 2, price: 18, min: 1, max: 6, color: '#e1b58e', spot: 'river', weight: 6, note: '原创幻想鱼。它也在摸鱼。' },
    { id: 'mandarin', name: '锦鳞鳜', shape: 'perch', pattern: 'spots', accent: '#5e5d34', rarity: 2, price: 20, min: 1, max: 5, color: '#a9a66a', spot: 'river', weight: 4, note: '花纹像一张认真画的地图。' },
    { id: 'gold', name: '金鳞鱼', shape: 'round', pattern: 'glow', accent: '#fff2b8', rarity: 3, price: 40, min: 5, max: 15, color: '#d9bb66', spot: 'river', weight: 2.5, note: '河面上缓缓移动的小太阳。' },
    { id: 'cloud', name: '云游龙鱼', shape: 'dragon', pattern: 'glow', accent: '#eef1fb', rarity: 4, price: 85, min: 14, max: 36, color: '#bdc5df', spot: 'river', weight: .5, note: '原创幻想鱼。偶尔从云里来做客。' },
  ]),
  ...group('creature', [
    { id: 'crayfish', name: '小龙虾', shape: 'crayfish', rarity: 0, price: 3, min: .03, max: .1, color: '#c8664e', spot: 'pond', weight: 40, note: '举着钳子，像在申请加薪。' },
    { id: 'snail', name: '田螺', shape: 'snail', accent: '#c9b48a', rarity: 0, price: 2, min: .02, max: .06, color: '#8b7b62', spot: 'pond', weight: 40, note: '慢慢来，比较快。' },
    { id: 'turtle', name: '小乌龟', shape: 'turtle', accent: '#4f6b45', rarity: 2, price: 20, min: .3, max: 1.8, color: '#7b9566', spot: 'pond', weight: 20, note: '在池塘边晒了一整个下午。' },
    { id: 'crab', name: '河蟹', shape: 'crab', rarity: 1, price: 8, min: .1, max: .4, color: '#7d7a5c', spot: 'river', weight: 45, note: '横着走，也能准时下班。' },
    { id: 'mussel', name: '河蚌', shape: 'mussel', accent: '#5f6d68', rarity: 1, price: 6, min: .2, max: .8, color: '#8c9a95', spot: 'river', weight: 45, note: '壳上一圈圈，是它的年终总结。' },
    { id: 'otter', name: '水獭来打招呼', shape: 'otter', accent: '#e7d6bd', rarity: 3, price: 0, min: 3, max: 6, color: '#8a6a4f', spot: 'river', weight: 10, note: '它看了看鱼篓，又游走了。只留在图鉴里。', visitor: true },
  ]),
  ...group('junk', [
    { id: 'badge', name: '旧工牌', shape: 'badge', rarity: 0, price: 1, min: .05, max: .05, color: '#7fa3b8', spot: 'pond', weight: 40, note: '照片里的人，看起来还没上班。' },
    { id: 'key', name: '工位钥匙', shape: 'key', rarity: 0, price: 2, min: .02, max: .02, color: '#c3a35e', spot: 'pond', weight: 35, note: '不知道是哪个抽屉的。' },
    { id: 'keycap', name: '掉落的 Esc 键帽', shape: 'keycap', rarity: 1, price: 1, min: .01, max: .01, color: '#e4ddcf', spot: 'pond', weight: 25, note: '难怪那天退不出去。' },
    { id: 'bottle', name: '瓶中纸条', shape: 'bottle', rarity: 0, price: 2, min: .1, max: .1, color: '#9cc3b4', spot: 'river', weight: 40, note: '上面写着：今天也辛苦了。' },
    { id: 'mug', name: '咖啡杯', shape: 'mug', rarity: 0, price: 3, min: .3, max: .3, color: '#e0d6c6', spot: 'river', weight: 40, note: '杯底还有一圈早会的咖啡渍。' },
    { id: 'trophy', name: '生锈的年度奖杯', shape: 'trophy', rarity: 2, price: 6, min: .8, max: .8, color: '#b39551', spot: 'river', weight: 20, note: '“最佳摸鱼奖”，字迹已经模糊。' },
  ]),
  ...group('treasure', [
    { id: 'wish', name: '许愿硬币', shape: 'coin', rarity: 3, price: 60, min: .01, max: .01, color: '#d9b45a', spot: 'pond', weight: 1, note: '有人许愿准点下班，好像实现了。' },
    { id: 'pearl', name: '河蚌珍珠', shape: 'pearl', accent: '#f4eef0', rarity: 3, price: 45, min: .01, max: .01, color: '#8c9a95', spot: 'river', weight: 0, note: '只会藏在少数河蚌里。' },
    { id: 'compass', name: '古铜罗盘', shape: 'compass', rarity: 4, price: 120, min: .4, max: .4, color: '#b07f4f', spot: 'river', weight: 1, note: '指针永远指向下班的方向。' },
  ]),
];
export const fishCount = species.filter(s => s.category === 'fish').length;
/** Spot unlocks count only discovered fish, not creatures or objects. */
export const fishFound = (book: Record<string, unknown>) => Object.keys(book).filter(id => species.find(s => s.id === id)?.category === 'fish').length;
export type RodId = typeof rods[number]['id'];
export type ToolId = typeof tools[number]['id'];
export type SpotId = typeof spots[number]['id'];
export type Bait = 'plain' | 'worm';
/** `at` (ms epoch) is absent on catches saved before it was recorded. */
export interface Catch { id: string; species: string; kg: number; value: number; locked: boolean; at?: number }
export type FishingResult = { kind: Category | 'empty' | 'broken'; name: string; cause?: 'wear'; kg?: number; species?: string; newDiscovery?: boolean; value?: number };
export interface FishingRound { id: string; rod: RodId; signal: '轻轻晃动' | '缓缓横移' | '明显绷紧'; wait: number; result: FishingResult }
export interface FishingState {
  version: 1; rods: Record<RodId, number>; equipped: RodId; tools: ToolId[]; spot: SpotId; bait: Bait;
  /** Reels used by the rod currently in hand of each type; spares start fresh. */
  wear: Record<RodId, number>;
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
export const emptyFishing = (): FishingState => ({ version: 1, rods: { bamboo: 1, wood: 0, pro: 0, collector: 0 }, equipped: 'bamboo', wear: { bamboo: 0, wood: 0, pro: 0, collector: 0 }, tools: [], spot: 'pond', bait: 'plain', bag: [], book: {}, total: 0, round: null, last: null, requests: [] });
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100;
function validResult(v: unknown): v is FishingResult {
  return obj(v) && ['fish', 'creature', 'junk', 'treasure', 'empty', 'broken'].includes(String(v.kind)) && typeof v.name === 'string' && v.name.length <= 100
    && (v.kg === undefined || finite(v.kg)) && (v.value === undefined || count(v.value))
    && (v.species === undefined || species.some(s => s.id === v.species)) && (v.newDiscovery === undefined || typeof v.newDiscovery === 'boolean') && (v.cause === undefined || v.cause === 'wear');
}
export function parseFishing(raw: string | null): FishingState {
  if (raw === null) return emptyFishing();
  const v: unknown = JSON.parse(raw);
  if (!obj(v) || v.version !== 1 || !obj(v.rods) || !rods.every(r => count((v.rods as Record<string, unknown>)[r.id]) && Number((v.rods as Record<string, unknown>)[r.id]) <= 999)
    || !rods.some(r => r.id === v.equipped) || !Array.isArray(v.tools) || !v.tools.every(t => tools.some(x => x.id === t))
    || !spots.some(s => s.id === v.spot) || !['plain', 'worm'].includes(String(v.bait)) || !count(v.total)
    || !Array.isArray(v.bag) || v.bag.length > 200 || !v.bag.every(c => obj(c) && typeof c.id === 'string' && c.id.length <= 100 && species.some(s => s.id === c.species && !s.visitor) && finite(c.kg) && count(c.value) && typeof c.locked === 'boolean' && (c.at === undefined || count(c.at)))
    || new Set(v.bag.map(c => c.id)).size !== v.bag.length || !obj(v.book) || Object.entries(v.book).some(([id, entry]) => !species.some(s => s.id === id) || !obj(entry) || !count(entry.count) || !finite(entry.largest))
    || !Array.isArray(v.requests) || v.requests.length > 128 || !v.requests.every(id => typeof id === 'string' && id.length <= 100)
    || (v.last !== null && !validResult(v.last))) throw Error('钓鱼存档异常，已保留原始数据。');
  if (v.round !== null && (!obj(v.round) || typeof v.round.id !== 'string' || v.round.id.length > 100 || !rods.some(r => r.id === (v.round as Record<string, unknown>).rod)
    || !['轻轻晃动', '缓缓横移', '明显绷紧'].includes(String(v.round.signal)) || !finite(v.round.wait) || !validResult(v.round.result))) throw Error('当前鱼竿记录异常，已保留原始数据。');
  // Saves from before rod wear carry no `wear`; treat every rod in hand as new.
  if (v.wear === undefined) v.wear = Object.fromEntries(rods.map(r => [r.id, 0]));
  else if (!obj(v.wear) || !rods.every(r => count((v.wear as Record<string, unknown>)[r.id]) && Number((v.wear as Record<string, unknown>)[r.id]) <= 100000)) throw Error('钓鱼存档异常，已保留原始数据。');
  return v as unknown as FishingState;
}
export function fishingView(state: FishingState, balance: number, pending = false, walletLocked = false): FishingView {
  const { requests: _requests, round, ...rest } = state;
  return { state: { ...rest, round: round ? { id: round.id, rod: round.rod, signal: round.signal, wait: round.wait } : null }, balance, pending, walletLocked };
}
/** Overload has a gradual risk; rods within capacity never break. */
export function breakChance(kg: number, capacity: number) { return kg <= capacity ? 0 : Math.min(.95, (kg / capacity - 1) * .6); }
/** Wear adds no risk for the first half of a rod's life, reaches 25% when worn out, and caps at 60%. */
export function wearChance(used: number, durability: number) {
  const ratio = used / durability;
  return ratio < .5 ? 0 : ratio <= 1 ? (ratio - .5) / .5 * .25 : Math.min(.6, .25 + (ratio - 1) * .5);
}
/** Remaining life of the rod in hand, 0–1. */
export const durabilityLeft = (state: Pick<FishingState, 'wear'>, id: RodId) => Math.max(0, 1 - (state.wear?.[id] ?? 0) / rods.find(r => r.id === id)!.durability);
export function rollRound(state: FishingState, id: string, random = Math.random): FishingRound {
  const rod = rods.find(r => r.id === state.equipped)!;
  const type = random();
  let result: FishingResult;
  let cut = EMPTY_SHARE + TINY_SHARE;
  const category = type < EMPTY_SHARE ? null : type < cut ? 'fish' : categories.find(c => type < (cut += c.share))?.id ?? 'fish';
  const tiny = species.find(s => s.id === TINY_ID)!;
  if (!category) result = random() < .5 ? { kind: 'empty', name: '只有水流经过' } : { kind: 'empty', name: '一团水草' };
  else if (type < EMPTY_SHARE + TINY_SHARE) {
    const kg = Math.round((tiny.min + random() * (tiny.max - tiny.min)) * 100) / 100;
    result = { kind: 'fish', name: tiny.name, species: tiny.id, kg, value: tiny.price, newDiscovery: !state.book[tiny.id] };
  } else {
    // Weight 0 entries (tiny fish, pearl) are only reachable through their dedicated branches.
    const pool = species.filter(s => (s.spot === state.spot || s.spot === 'any') && s.category === category && s.weight > 0);
    const weights = pool.map(s => s.weight * (state.bait === 'worm' && s.rarity >= 2 ? 1.8 : 1));
    let point = random() * weights.reduce((a, b) => a + b, 0);
    const pick = pool.find((_s, i) => (point -= weights[i]) < 0) ?? pool[pool.length - 1];
    const living = category === 'fish' || category === 'creature';
    // Cubed roll: most catches are small; near-max sizes are rare.
    const kg = Math.round((pick.min + random() ** 3 * (pick.max - pick.min)) * (living && state.tools.includes('net') ? 1.15 : 1) * 100) / 100;
    const value = pick.visitor ? undefined : living ? pick.price + Math.floor(pick.price * .25 * (kg / pick.max)) : pick.price;
    let snapped: FishingResult | null = null;
    const snap = (weight: number) => {
      const overload = breakChance(weight, rod.capacity);
      const worn = wearChance(state.wear?.[rod.id] ?? 0, rod.durability);
      const roll = random();
      if (roll >= 1 - (1 - overload) * (1 - worn)) return false;
      snapped = roll < overload ? { kind: 'broken', name: '鱼竿断了，水下的大家伙游走了', kg: weight } : { kind: 'broken', name: '鱼竿用旧了，啪地断了', kg: weight, cause: 'wear' };
      return true;
    };
    const pearl = pick.id === 'mussel' && random() < PEARL_CHANCE ? species.find(s => s.id === 'pearl')! : null;
    result = pearl ? { kind: 'treasure', name: '带珍珠的河蚌', species: pearl.id, kg, value: pearl.price + (value ?? 0), newDiscovery: !state.book[pearl.id] } :
      living && !pick.visitor && snap(kg) ? snapped! :
      { kind: category, name: pick.name, species: pick.id, kg, value, newDiscovery: !state.book[pick.id] };
  }
  const heavy = result.kind !== 'treasure' && result.kind !== 'junk' && (result.kg ?? 0) > rod.capacity * .8;
  return { id, rod: rod.id, wait: (5 + random() * 5) * rod.wait * (state.tools.includes('float') ? .85 : 1),
    signal: heavy ? '明显绷紧' : random() < .5 ? '轻轻晃动' : '缓缓横移', result };
}
