import { fishingTide, fishingShares, fishingRarityBoost, type FishingTideStamp } from './fishing-tide.js';
import { emptyGear, isBaitSupply, parseGear, rodSkins, type BaitSupply, type FishingGear, type RodSkin } from './fishing-gear.js';
/** Local fishing rules. Prices and rewards never come from renderer requests. */
export const FISHING_KEY = 'dogcow.fishing.v1';
export const rarities = ['常见', '少见', '稀有', '珍奇', '传说', '神话'] as const;
/** Absolute encounter probability per cast at an eligible spot, before rod failure. */
export const MYTHIC_CHANCE = 1 / 10000;
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
const stableShares = fishingShares();
export const categories: readonly { id: Category; name: string; share: number }[] = [
  { id: 'creature', name: '水边生物', share: stableShares.creature },
  { id: 'junk', name: '工位旧物', share: stableShares.junk },
  { id: 'treasure', name: '稀有宝物', share: stableShares.treasure },
  { id: 'fish', name: '鱼', share: stableShares.fish },
];
/** Share of casts that come back with only water or weeds. */
export const EMPTY_SHARE = stableShares.empty;
/** Share of casts that bring up the tiny everyday fish, at either spot. */
export const TINY_SHARE = stableShares.tiny;
export const TINY_ID = 'wheat';
/** Chance that a mussel carries a pearl; the pearl gets its own book entry. */
export const PEARL_CHANCE = .08;
export type Shape = 'tiny' | 'pearl' | 'round' | 'slim' | 'perch' | 'cat' | 'eel' | 'fancy' | 'dragon' | 'crayfish' | 'snail' | 'turtle' | 'crab' | 'mussel' | 'otter'
  | 'deep' | 'needle' | 'salmon' | 'sturgeon' | 'diamond' | 'sail' | 'fan'
  | 'star-koi' | 'glass' | 'lotus' | 'eclipse' | 'galaxy' | 'frost' | 'cloud-ray' | 'clockwork'
  | 'frog' | 'dragonfly' | 'shrimp' | 'kingfisher'
  | 'badge' | 'key' | 'keycap' | 'bottle' | 'mug' | 'trophy' | 'coin' | 'compass' | 'umbrella' | 'alarm'
  | 'watch' | 'crown' | 'star-bottle' | 'crystal' | 'jade' | 'seal' | 'envelope';
export type Pattern = 'spots' | 'stripes' | 'scales' | 'glow' | 'stars' | 'mask' | 'ribbon';
/** `visitor` entries are recorded in the book but never enter the bag. Only fish and creatures can break a rod. */
export interface Species { id: string; name: string; category: Category; shape: Shape; pattern?: Pattern; accent?: string; rarity: number; price: number; min: number; max: number; color: string; spot: SpotId | 'any'; weight: number; note: string; visitor?: boolean; castChance?: number }
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
    { id: 'bitterling', name: '彩鳍鳑鲏', shape: 'deep', pattern: 'ribbon', accent: '#b87587', rarity: 0, price: 2, min: .02, max: .08, color: '#a9c8c0', spot: 'pond', weight: 18, note: '背上披着一条淡淡的胭脂色。' },
    { id: 'redfin', name: '红鳍小鱼', shape: 'slim', pattern: 'ribbon', accent: '#c66d55', rarity: 0, price: 2, min: .03, max: .15, color: '#d6cead', spot: 'pond', weight: 18, note: '一路带着红色的小旗子。' },
    { id: 'gudgeon', name: '棒花鱼', shape: 'needle', pattern: 'spots', accent: '#796e50', rarity: 0, price: 3, min: .04, max: .2, color: '#bfb38c', spot: 'pond', weight: 16, note: '伏在沙底，假装自己是一截树枝。' },
    { id: 'goby', name: '虎纹虾虎鱼', shape: 'perch', pattern: 'stripes', accent: '#645b44', rarity: 0, price: 3, min: .03, max: .18, color: '#c6b985', spot: 'pond', weight: 16, note: '个子不大，站岗的架势很足。' },
    { id: 'gambusia', name: '食蚊鱼', shape: 'tiny', pattern: 'spots', accent: '#75806a', rarity: 0, price: 2, min: .01, max: .04, color: '#c5cfb2', spot: 'pond', weight: 16, note: '水面巡逻员，今天也没有闲着。' },
    { id: 'red-goldfish', name: '红尾金鱼', shape: 'fancy', pattern: 'scales', accent: '#bf5545', rarity: 1, price: 5, min: .08, max: .5, color: '#ebaa72', spot: 'pond', weight: 12, note: '尾巴一摆，像拆开了一封喜报。' },
    { id: 'blackmoor', name: '墨龙睛', shape: 'fan', pattern: 'mask', accent: '#a5a49d', rarity: 1, price: 6, min: .1, max: .6, color: '#555d62', spot: 'pond', weight: 12, note: '穿着黑礼服，在水里慢慢散步。' },
    { id: 'pearlscale', name: '珍珠鳞金鱼', shape: 'deep', pattern: 'spots', accent: '#fff5df', rarity: 1, price: 6, min: .08, max: .5, color: '#e7ba92', spot: 'pond', weight: 12, note: '圆滚滚的鳞片，像揣了一肚子米花。' },
    { id: 'lionhead', name: '狮头金鱼', shape: 'deep', pattern: 'mask', accent: '#ca5d42', rarity: 1, price: 7, min: .12, max: .8, color: '#efc288', spot: 'pond', weight: 10, note: '顶着一朵红云，晃晃悠悠。' },
    { id: 'comet', name: '彗星金鱼', shape: 'fan', pattern: 'ribbon', accent: '#f6e6ca', rarity: 1, price: 6, min: .1, max: .6, color: '#dc8a5d', spot: 'pond', weight: 12, note: '那条长尾巴，总比它晚一点到。' },
    { id: 'danio', name: '斑马鱼', shape: 'slim', pattern: 'stripes', accent: '#546b9c', rarity: 0, price: 3, min: .01, max: .05, color: '#c0d2df', spot: 'pond', weight: 18, note: '条纹衬衫洗得很干净。' },
    { id: 'whitecloud', name: '唐鱼', shape: 'slim', pattern: 'ribbon', accent: '#ce7869', rarity: 0, price: 3, min: .01, max: .06, color: '#b8c6a2', spot: 'pond', weight: 16, note: '侧身的一道亮线，是它的通行证。' },
    { id: 'guppy', name: '孔雀鱼', shape: 'fan', pattern: 'spots', accent: '#5d77a7', rarity: 1, price: 5, min: .01, max: .08, color: '#d3ac6b', spot: 'pond', weight: 12, note: '把最漂亮的扇子带到了池塘。' },
    { id: 'swordtail', name: '剑尾鱼', shape: 'needle', pattern: 'ribbon', accent: '#b87943', rarity: 1, price: 5, min: .03, max: .15, color: '#d8ad6d', spot: 'pond', weight: 12, note: '赶路时，尾巴像一把细细的剑。' },
    { id: 'platy', name: '红月光鱼', shape: 'deep', pattern: 'mask', accent: '#8a5d52', rarity: 1, price: 5, min: .02, max: .12, color: '#da8978', spot: 'pond', weight: 12, note: '把落日留在自己的小肚子上。' },
    { id: 'angelfish', name: '银燕神仙鱼', shape: 'diamond', pattern: 'stripes', accent: '#687986', rarity: 2, price: 16, min: .08, max: .4, color: '#c6d8d6', spot: 'pond', weight: 2, note: '背鳍和腹鳍像两张轻轻张开的帆。' },
    { id: 'gourami', name: '蓝曼龙', shape: 'deep', pattern: 'spots', accent: '#527f9a', rarity: 1, price: 7, min: .1, max: .6, color: '#9fbfca', spot: 'pond', weight: 10, note: '披着水蓝色的绸缎，不紧不慢。' },
    { id: 'paradise', name: '叉尾斗鱼', shape: 'fan', pattern: 'stripes', accent: '#a66d71', rarity: 2, price: 15, min: .03, max: .2, color: '#87b3b3', spot: 'pond', weight: 2, note: '条纹和尾鳍，都带着一点倔强。' },
    { id: 'tench', name: '绿背丁鱥', shape: 'round', pattern: 'scales', accent: '#526e4d', rarity: 0, price: 4, min: .3, max: 1.8, color: '#9eaf77', spot: 'pond', weight: 16, note: '安静地从水草下面经过。' },
    { id: 'rudd', name: '赤鳍珠星鱼', shape: 'slim', pattern: 'stars', accent: '#cf8a5e', rarity: 2, price: 16, min: .1, max: .8, color: '#d4c69b', spot: 'pond', weight: 2, note: '鳍边的一点红，藏在细碎亮斑里。' },
    { id: 'panda-loach', name: '熊猫鳅', shape: 'eel', pattern: 'mask', accent: '#444f50', rarity: 2, price: 18, min: .02, max: .15, color: '#dedbc9', spot: 'pond', weight: 2, note: '黑白相间，喜欢躲在石头后面。' },
    { id: 'lotus-shadow', name: '莲影胭脂鱼', shape: 'sail', pattern: 'stripes', accent: '#a06983', rarity: 3, price: 38, min: .4, max: 1.7, color: '#d7a3ad', spot: 'pond', weight: .8, note: '原创幻想鱼。游过时，水下像开了一朵莲。' },
    { id: 'opal', name: '流霞琉璃鱼', shape: 'diamond', pattern: 'glow', accent: '#f8dcbd', rarity: 4, price: 80, min: .1, max: .9, color: '#aebce0', spot: 'pond', weight: .3, note: '原创幻想鱼。鳍尖收着四季的晚霞。' },
    { id: 'bream', name: '武昌鱼', shape: 'deep', pattern: 'scales', accent: '#718b84', rarity: 0, price: 4, min: .4, max: 2, color: '#b7c4b5', spot: 'river', weight: 18, note: '扁扁的身子，转弯却很从容。' },
    { id: 'blackcarp', name: '青鱼', shape: 'round', pattern: 'scales', accent: '#4b6261', rarity: 0, price: 5, min: 2, max: 12, color: '#869d93', spot: 'river', weight: 18, note: '一身青灰，沉稳得像河湾的前辈。' },
    { id: 'bighead', name: '花鲢', shape: 'deep', pattern: 'spots', accent: '#65766d', rarity: 0, price: 4, min: 1, max: 8, color: '#b6bfa9', spot: 'river', weight: 16, note: '花斑宽宽地铺在侧身。' },
    { id: 'silvercarp', name: '白鲢', shape: 'slim', pattern: 'scales', accent: '#8a9f9c', rarity: 0, price: 4, min: 1, max: 7, color: '#d3d9c8', spot: 'river', weight: 16, note: '银白的身子，从水光里一闪而过。' },
    { id: 'dace', name: '赤眼鳟', shape: 'slim', pattern: 'ribbon', accent: '#b77964', rarity: 0, price: 4, min: .3, max: 2, color: '#b6bba1', spot: 'river', weight: 16, note: '眼边一抹红，像刚熬过一场早会。' },
    { id: 'barbel', name: '倒刺鲃', shape: 'needle', pattern: 'scales', accent: '#657d65', rarity: 1, price: 8, min: .5, max: 3, color: '#adbc8c', spot: 'river', weight: 12, note: '贴着石头，在流急的地方找路。' },
    { id: 'mudcarp', name: '鲮鱼', shape: 'slim', pattern: 'scales', accent: '#6b8a86', rarity: 0, price: 4, min: .2, max: 1.5, color: '#bdc9b3', spot: 'river', weight: 18, note: '河底的小石子，它都认得。' },
    { id: 'shiner', name: '宽鳍鱲', shape: 'salmon', pattern: 'ribbon', accent: '#a57189', rarity: 1, price: 8, min: .1, max: .8, color: '#a3bfb7', spot: 'river', weight: 12, note: '水光一照，身侧会泛出淡淡的彩色。' },
    { id: 'sweetfish', name: '香鱼', shape: 'salmon', pattern: 'scales', accent: '#7b8f5c', rarity: 1, price: 9, min: .1, max: .6, color: '#c3ce9d', spot: 'river', weight: 12, note: '清清爽爽，沿着浅滩逆流而上。' },
    { id: 'trout', name: '虹鳟', shape: 'salmon', pattern: 'spots', accent: '#a26c87', rarity: 2, price: 20, min: .5, max: 4, color: '#a9bdb1', spot: 'river', weight: 2, note: '一道粉色虹光，藏在细密斑点下面。' },
    { id: 'salmon', name: '回游鲑', shape: 'salmon', pattern: 'stripes', accent: '#7e8e8d', rarity: 2, price: 22, min: 1, max: 8, color: '#b4c5c6', spot: 'river', weight: 2, note: '逆着水流，记得来时的路。' },
    { id: 'snakehead', name: '乌鳢', shape: 'perch', pattern: 'mask', accent: '#475f50', rarity: 1, price: 9, min: .5, max: 5, color: '#8a9a76', spot: 'river', weight: 12, note: '斑驳的外套，适合躲进芦苇影子里。' },
    { id: 'yellow-eel', name: '黄鳝', shape: 'eel', pattern: 'glow', accent: '#bc9d53', rarity: 0, price: 4, min: .1, max: 1, color: '#a9a064', spot: 'river', weight: 16, note: '长长一条，弯成自己的下班路线。' },
    { id: 'spotted-eel', name: '花鳗', shape: 'eel', pattern: 'spots', accent: '#5a6551', rarity: 1, price: 9, min: .3, max: 3, color: '#a3aa7f', spot: 'river', weight: 12, note: '满身碎花，游得悄无声息。' },
    { id: 'pike', name: '长吻狗鱼', shape: 'needle', pattern: 'spots', accent: '#62764e', rarity: 2, price: 24, min: 1, max: 9, color: '#a7b77e', spot: 'river', weight: 2, note: '吻尖长长的，像在认真挑选猎物。' },
    { id: 'silver-sturgeon', name: '银甲鲟', shape: 'sturgeon', pattern: 'scales', accent: '#667e92', rarity: 2, price: 25, min: 2, max: 14, color: '#a9bac4', spot: 'river', weight: 2, note: '原创幻想鱼。背上的银甲排得整整齐齐。' },
    { id: 'shovel', name: '长吻铲鱼', shape: 'sturgeon', pattern: 'ribbon', accent: '#a39073', rarity: 1, price: 10, min: .5, max: 5, color: '#c3bd9e', spot: 'river', weight: 10, note: '原创幻想鱼。用长长的吻翻找河底的小秘密。' },
    { id: 'river-butterfly', name: '河湾蝴蝶鱼', shape: 'diamond', pattern: 'stripes', accent: '#6f7fa9', rarity: 2, price: 22, min: .1, max: .7, color: '#c7b4d8', spot: 'river', weight: 2, note: '原创幻想鱼。像一只留在水里的蝴蝶。' },
    { id: 'reed-sail', name: '芦叶帆鳍', shape: 'sail', pattern: 'mask', accent: '#687e58', rarity: 3, price: 42, min: .6, max: 4, color: '#b5c497', spot: 'river', weight: .8, note: '原创幻想鱼。背鳍展开，就能借走一点河风。' },
    { id: 'jade-eel', name: '翡翠鳗', shape: 'eel', pattern: 'glow', accent: '#d2efe1', rarity: 3, price: 40, min: 1, max: 6, color: '#6cab99', spot: 'river', weight: .8, note: '原创幻想鱼。游过的地方，水色会亮一会儿。' },
    { id: 'obsidian', name: '曜石盘鱼', shape: 'deep', pattern: 'glow', accent: '#a7a6c8', rarity: 3, price: 45, min: .6, max: 3, color: '#666d86', spot: 'river', weight: .7, note: '原创幻想鱼。深色的圆盘里，藏着一圈微光。' },
    { id: 'gilded-barbel', name: '龙纹金鲃', shape: 'round', pattern: 'stars', accent: '#fff0b3', rarity: 4, price: 95, min: 3, max: 18, color: '#bda35e', spot: 'river', weight: .2, note: '原创幻想鱼。金纹像河床里慢慢长出的星座。' },
    { id: 'star-koi', name: '星砂锦鲤', shape: 'star-koi', pattern: 'stars', accent: '#fff0b4', rarity: 5, price: 220, min: .3, max: 1.7, color: '#7c91ba', spot: 'pond', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。每一粒星砂，都在长长的尾鳍上发光。' },
    { id: 'glass-medaka', name: '玻璃月鳉', shape: 'glass', pattern: 'glow', accent: '#edfaff', rarity: 5, price: 200, min: .02, max: .09, color: '#a8d8df', spot: 'pond', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。透过身体，能看见一条细细的月光。' },
    { id: 'lotus-betta', name: '莲冠斗鱼', shape: 'lotus', pattern: 'ribbon', accent: '#f7e0b8', rarity: 5, price: 240, min: .05, max: .3, color: '#c48da6', spot: 'pond', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。层层莲瓣作冠，连水草都会让开一点。' },
    { id: 'eclipse-scale', name: '日蚀墨鳞', shape: 'eclipse', pattern: 'glow', accent: '#eacb78', rarity: 5, price: 280, min: .2, max: 1.5, color: '#42485b', spot: 'pond', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。墨色圆鳞的边缘，亮着一圈被遮住的太阳。' },
    { id: 'galaxy-dragon', name: '银河龙鱼', shape: 'galaxy', pattern: 'stars', accent: '#e7e8ff', rarity: 5, price: 420, min: 4, max: 24, color: '#8c88ba', spot: 'river', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。长须划过水面，拖出一道弯弯的星轨。' },
    { id: 'frost-sturgeon', name: '霜角白鲟', shape: 'frost', pattern: 'scales', accent: '#eefcff', rarity: 5, price: 400, min: 3, max: 20, color: '#a7c8d1', spot: 'river', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。霜白骨板一片片，吻尖像结了一枝冰。' },
    { id: 'cloud-ray', name: '流云银鳐', shape: 'cloud-ray', pattern: 'ribbon', accent: '#eef1ff', rarity: 5, price: 380, min: 1, max: 12, color: '#a6bad8', spot: 'river', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。宽宽的翼鳍合拢时，像一朵慢慢散去的云。' },
    { id: 'clock-fish', name: '时光骨鱼', shape: 'clockwork', pattern: 'glow', accent: '#f5dfac', rarity: 5, price: 460, min: .5, max: 5, color: '#91a4a0', spot: 'river', weight: 0, castChance: MYTHIC_CHANCE, note: '原创幻想鱼。骨架间的小小钟环，只在下班后往前走。' },
  ]),
  ...group('creature', [
    { id: 'crayfish', name: '小龙虾', shape: 'crayfish', rarity: 0, price: 3, min: .03, max: .1, color: '#c8664e', spot: 'pond', weight: 40, note: '举着钳子，像在申请加薪。' },
    { id: 'snail', name: '田螺', shape: 'snail', accent: '#c9b48a', rarity: 0, price: 2, min: .02, max: .06, color: '#8b7b62', spot: 'pond', weight: 40, note: '慢慢来，比较快。' },
    { id: 'turtle', name: '小乌龟', shape: 'turtle', accent: '#4f6b45', rarity: 2, price: 20, min: .3, max: 1.8, color: '#7b9566', spot: 'pond', weight: 20, note: '在池塘边晒了一整个下午。' },
    { id: 'crab', name: '河蟹', shape: 'crab', rarity: 1, price: 8, min: .1, max: .4, color: '#7d7a5c', spot: 'river', weight: 45, note: '横着走，也能准时下班。' },
    { id: 'mussel', name: '河蚌', shape: 'mussel', accent: '#5f6d68', rarity: 1, price: 6, min: .2, max: .8, color: '#8c9a95', spot: 'river', weight: 45, note: '壳上一圈圈，是它的年终总结。' },
    { id: 'otter', name: '水獭来打招呼', shape: 'otter', accent: '#e7d6bd', rarity: 3, price: 0, min: 3, max: 6, color: '#8a6a4f', spot: 'river', weight: 10, note: '它看了看鱼篓，又游走了。只留在图鉴里。', visitor: true },
    { id: 'frog', name: '荷叶小蛙', shape: 'frog', accent: '#dbe6a1', rarity: 1, price: 6, min: .03, max: .15, color: '#89a76c', spot: 'pond', weight: 25, note: '在荷叶上坐得端端正正，像在等散会。' },
    { id: 'dragonfly', name: '蓝尾蜻蜓', shape: 'dragonfly', accent: '#d6e6e6', rarity: 2, price: 0, min: .01, max: .02, color: '#719eb6', spot: 'pond', weight: 10, note: '只在浮标上歇一歇，挥挥翅膀就走。只记入图鉴。', visitor: true },
    { id: 'shrimp', name: '透明小虾', shape: 'shrimp', accent: '#e4d4ba', rarity: 0, price: 2, min: .01, max: .05, color: '#b9cdc0', spot: 'river', weight: 35, note: '弓着身子，一弹就不见了。' },
    { id: 'kingfisher', name: '翠鸟来探班', shape: 'kingfisher', accent: '#d5a05f', rarity: 3, price: 0, min: .04, max: .12, color: '#679f9e', spot: 'river', weight: 6, note: '蓝绿色的小客人，来看看你今天钓得怎样。只记入图鉴。', visitor: true },
  ]),
  ...group('junk', [
    { id: 'badge', name: '旧工牌', shape: 'badge', rarity: 0, price: 1, min: .05, max: .05, color: '#7fa3b8', spot: 'pond', weight: 40, note: '照片里的人，看起来还没上班。' },
    { id: 'key', name: '工位钥匙', shape: 'key', rarity: 0, price: 2, min: .02, max: .02, color: '#c3a35e', spot: 'pond', weight: 35, note: '不知道是哪个抽屉的。' },
    { id: 'keycap', name: '掉落的 Esc 键帽', shape: 'keycap', rarity: 1, price: 1, min: .01, max: .01, color: '#e4ddcf', spot: 'pond', weight: 25, note: '难怪那天退不出去。' },
    { id: 'bottle', name: '瓶中纸条', shape: 'bottle', rarity: 0, price: 2, min: .1, max: .1, color: '#9cc3b4', spot: 'river', weight: 40, note: '上面写着：今天也辛苦了。' },
    { id: 'mug', name: '咖啡杯', shape: 'mug', rarity: 0, price: 3, min: .3, max: .3, color: '#e0d6c6', spot: 'river', weight: 40, note: '杯底还有一圈早会的咖啡渍。' },
    { id: 'trophy', name: '生锈的年度奖杯', shape: 'trophy', rarity: 2, price: 6, min: .8, max: .8, color: '#b39551', spot: 'river', weight: 20, note: '“最佳摸鱼奖”，字迹已经模糊。' },
    { id: 'umbrella', name: '忘带走的折叠伞', shape: 'umbrella', rarity: 1, price: 2, min: .3, max: .3, color: '#8a9bb2', spot: 'pond', weight: 12, note: '雨停以后，它在池塘里多待了一会儿。' },
    { id: 'alarm', name: '不响的上班闹钟', shape: 'alarm', rarity: 1, price: 3, min: .25, max: .25, color: '#b5957c', spot: 'river', weight: 12, note: '泡了这么久，终于不用再叫人起床。' },
  ]),
  ...group('treasure', [
    { id: 'wish', name: '许愿硬币', shape: 'coin', rarity: 3, price: 60, min: .01, max: .01, color: '#d9b45a', spot: 'pond', weight: 1, note: '有人许愿准点下班，好像实现了。' },
    { id: 'pearl', name: '河蚌珍珠', shape: 'pearl', accent: '#f4eef0', rarity: 3, price: 45, min: .01, max: .01, color: '#8c9a95', spot: 'river', weight: 0, note: '只会藏在少数河蚌里。' },
    { id: 'compass', name: '古铜罗盘', shape: 'compass', rarity: 4, price: 120, min: .4, max: .4, color: '#b07f4f', spot: 'river', weight: 1, note: '指针永远指向下班的方向。' },
    { id: 'offwork-watch', name: '下班怀表', shape: 'watch', accent: '#c5e5df', rarity: 5, price: 360, min: .18, max: .18, color: '#c5a567', spot: 'pond', weight: 0, castChance: MYTHIC_CHANCE, note: '表盘永远停在准点下班的那一分钟。收好它，今天别再加班。' },
    { id: 'lost-crown', name: '失落王冠', shape: 'crown', accent: '#a7cfc1', rarity: 5, price: 480, min: .7, max: .7, color: '#d1b56f', spot: 'river', weight: 0, castChance: MYTHIC_CHANCE, note: '河底藏着一顶旧王冠，宝石里映着一个不用打卡的王国。' },
    { id: 'star-bottle', name: '星砂瓶', shape: 'star-bottle', accent: '#f5d8a0', rarity: 3, price: 75, min: .12, max: .12, color: '#9ebfc9', spot: 'pond', weight: 3, note: '瓶底装着细细的星砂，摇一摇就像一小片夜空。' },
    { id: 'moon-crystal', name: '月光水晶', shape: 'crystal', accent: '#efe9ff', rarity: 3, price: 95, min: .2, max: .2, color: '#b1a4cf', spot: 'river', weight: 3, note: '贴近看，里面有一弯不会落下的月亮。' },
    { id: 'jade-charm', name: '翡翠平安扣', shape: 'jade', accent: '#c5e9c9', rarity: 3, price: 90, min: .05, max: .05, color: '#79aa8d', spot: 'pond', weight: 2, note: '圆圆的一枚，像把平安和顺利都扣在了一起。' },
    { id: 'fish-seal', name: '鱼王金印', shape: 'seal', accent: '#f5dba0', rarity: 4, price: 140, min: .3, max: .3, color: '#bb9a54', spot: 'river', weight: 1, note: '印底刻着一条小鱼，还有两个字：收工。' },
    { id: 'year-end-envelope', name: '年终红包', shape: 'envelope', accent: '#f0cf80', rarity: 3, price: 88, min: .02, max: .02, color: '#bd6b60', spot: 'river', weight: 3, note: '防水纸封得严严实实，里面是一点迟来的好消息。' },
  ]),
];
export const fishCount = species.filter(s => s.category === 'fish').length;
/** Spot unlocks count only discovered fish, not creatures or objects. */
export const fishFound = (book: Record<string, unknown>) => Object.keys(book).filter(id => species.find(s => s.id === id)?.category === 'fish').length;
export type RodId = typeof rods[number]['id'];
export type ToolId = typeof tools[number]['id'];
export type SpotId = typeof spots[number]['id'];
export type Bait = 'plain' | 'worm' | BaitSupply;
/** `at` (ms epoch) is absent on catches saved before it was recorded. */
export interface Catch { id: string; species: string; kg: number; value: number; locked: boolean; at?: number }
export type FishingResult = { kind: Category | 'empty' | 'broken'; name: string; cause?: 'wear'; kg?: number; species?: string; newDiscovery?: boolean; value?: number; protected?: boolean };
export interface FishingRound { id: string; rod: RodId; signal: '轻轻晃动' | '缓缓横移' | '明显绷紧'; wait: number; result: FishingResult; supply?: BaitSupply; tide?: FishingTideStamp }
export interface FishingState {
  version: 1; rods: Record<RodId, number>; equipped: RodId; tools: ToolId[]; spot: SpotId; bait: Bait;
  /** Reels used by the rod currently in hand of each type; spares start fresh. */
  wear: Record<RodId, number>;
  gear: FishingGear;
  bag: Catch[]; book: Record<string, { count: number; largest: number }>; total: number;
  round: FishingRound | null; last: FishingResult | null; requests: string[];
}
export type FishingAction = 'view' | 'cast' | 'reel' | 'buyRod' | 'buyTool' | 'equip' | 'spot' | 'bait' | 'sell' | 'sellAll' | 'lock' | 'rescue' | 'retry'
  | 'buySkin' | 'skin' | 'buySupply' | 'guard' | 'repair';
export interface FishingRequest { action: FishingAction; requestId?: string; id?: string; roundId?: string }
export interface FishingView {
  state: Omit<FishingState, 'round' | 'requests'> & { round: Pick<FishingRound, 'id' | 'rod' | 'signal' | 'wait' | 'tide'> | null };
  balance: number; pending: boolean; walletLocked: boolean;
}
export interface FishingReply { view?: FishingView; error?: string; errorCode?: string; correlationId?: string }
export const emptyFishing = (): FishingState => ({ version: 1, rods: { bamboo: 1, wood: 0, pro: 0, collector: 0 }, equipped: 'bamboo', wear: { bamboo: 0, wood: 0, pro: 0, collector: 0 }, gear: emptyGear(), tools: [], spot: 'pond', bait: 'plain', bag: [], book: {}, total: 0, round: null, last: null, requests: [] });
export function skinAvailable(state: Pick<FishingState, 'book' | 'gear'>, skin: RodSkin) {
  return state.gear.skins.includes(skin.id) || ('reward' in skin && (skin.reward === 'catalog30'
    ? Object.keys(state.book).length >= 30 : species.some(s => s.rarity === 5 && state.book[s.id])));
}
export function awardSkins(state: Pick<FishingState, 'book' | 'gear'>) {
  for (const skin of rodSkins) if ('reward' in skin && skinAvailable(state, skin) && !state.gear.skins.includes(skin.id)) state.gear.skins.push(skin.id);
}
export const repairPrice = (id: RodId) => Math.ceil(rods.find(r => r.id === id)!.price * .3);
export const repairedWear = (used: number, durability: number) => Math.max(0, Math.min(used, durability) - Math.ceil(durability / 2));
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100;
function validResult(v: unknown): v is FishingResult {
  return obj(v) && ['fish', 'creature', 'junk', 'treasure', 'empty', 'broken'].includes(String(v.kind)) && typeof v.name === 'string' && v.name.length <= 100
    && (v.kg === undefined || finite(v.kg)) && (v.value === undefined || count(v.value))
    && (v.species === undefined || species.some(s => s.id === v.species)) && (v.newDiscovery === undefined || typeof v.newDiscovery === 'boolean') && (v.cause === undefined || v.cause === 'wear')
    && (v.protected === undefined || typeof v.protected === 'boolean');
}
export function parseFishing(raw: string | null): FishingState {
  if (raw === null) return emptyFishing();
  const v: unknown = JSON.parse(raw);
  if (!obj(v) || v.version !== 1 || !obj(v.rods) || !rods.every(r => count((v.rods as Record<string, unknown>)[r.id]) && Number((v.rods as Record<string, unknown>)[r.id]) <= 999)
    || !rods.some(r => r.id === v.equipped) || !Array.isArray(v.tools) || !v.tools.every(t => tools.some(x => x.id === t))
    || !spots.some(s => s.id === v.spot) || !['plain', 'worm', 'scout', 'magnet'].includes(String(v.bait)) || !count(v.total)
    || !Array.isArray(v.bag) || v.bag.length > 200 || !v.bag.every(c => obj(c) && typeof c.id === 'string' && c.id.length <= 100 && species.some(s => s.id === c.species && !s.visitor) && finite(c.kg) && count(c.value) && typeof c.locked === 'boolean' && (c.at === undefined || count(c.at)))
    || new Set(v.bag.map(c => c.id)).size !== v.bag.length || !obj(v.book) || Object.entries(v.book).some(([id, entry]) => !species.some(s => s.id === id) || !obj(entry) || !count(entry.count) || !finite(entry.largest))
    || !Array.isArray(v.requests) || v.requests.length > 128 || !v.requests.every(id => typeof id === 'string' && id.length <= 100)
    || (v.last !== null && !validResult(v.last))) throw Error('钓鱼存档异常，已保留原始数据。');
  if (v.round !== null && (!obj(v.round) || typeof v.round.id !== 'string' || v.round.id.length > 100 || !rods.some(r => r.id === (v.round as Record<string, unknown>).rod)
    || !['轻轻晃动', '缓缓横移', '明显绷紧'].includes(String(v.round.signal)) || !finite(v.round.wait) || !validResult(v.round.result)
    || (v.round.supply !== undefined && !isBaitSupply(v.round.supply))
    || (v.round.tide !== undefined && (!obj(v.round.tide) || v.round.tide.version !== 2 || !count(v.round.tide.at)
      || typeof v.round.tide.activity !== 'number' || !Number.isFinite(v.round.tide.activity) || v.round.tide.activity < 0 || v.round.tide.activity > 1)))) throw Error('当前鱼竿记录异常，已保留原始数据。');
  // Saves from before rod wear carry no `wear`; treat every rod in hand as new.
  if (v.wear === undefined) v.wear = Object.fromEntries(rods.map(r => [r.id, 0]));
  else if (!obj(v.wear) || !rods.every(r => count((v.wear as Record<string, unknown>)[r.id]) && Number((v.wear as Record<string, unknown>)[r.id]) <= 100000)) throw Error('钓鱼存档异常，已保留原始数据。');
  v.gear = parseGear(v.gear);
  return v as unknown as FishingState;
}
export function fishingView(state: FishingState, balance: number, pending = false, walletLocked = false): FishingView {
  const { requests: _requests, round, ...rest } = state;
  return { state: { ...rest, round: round ? { id: round.id, rod: round.rod, signal: round.signal, wait: round.wait, ...(round.tide ? { tide: round.tide } : {}) } : null }, balance, pending, walletLocked };
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
/** Absolute per-cast shares. Fixed encounters reserve space before bait-adjusted weights. */
export function fishingCategories(bait: Bait, activity = 0) {
  const shares = fishingShares(activity);
  return categories.map(c => ({ ...c, share: shares[c.id] + (bait === 'magnet' ? c.id === 'treasure' ? .008 : c.id === 'junk' ? -.008 : 0 : 0) }));
}
export function fishingPool(spot: SpotId, category: Category, bait: Bait, book: Record<string, unknown> = {}, activity = 0) {
  const eligible = species.filter(s => (s.spot === spot || s.spot === 'any') && s.category === category);
  const fixed = eligible.filter(s => s.castChance !== undefined);
  const regular = eligible.filter(s => s.castChance === undefined && s.weight > 0);
  const share = fishingCategories(bait, activity).find(c => c.id === category)!.share;
  const fixedChance = (s: Species) => s.castChance! * (1 + 9 * activity);
  const reserved = fixed.reduce((sum, s) => sum + fixedChance(s), 0);
  const weights = regular.map(s => s.weight * (category === 'fish' ? fishingRarityBoost(s.rarity, activity) : 1) * (bait === 'worm' && s.rarity >= 2 ? 1.8 : bait === 'scout' && category === 'fish' && !book[s.id] ? 3 : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total || reserved >= share || fixed.some(s => !Number.isFinite(s.castChance) || s.castChance! <= 0)) throw Error('钓获概率配置无效。');
  return [
    ...fixed.map(entry => ({ entry, chance: fixedChance(entry) })),
    ...regular.map((entry, i) => ({ entry, chance: (share - reserved) * weights[i] / total })),
  ];
}
export function rollRound(state: FishingState, id: string, random = Math.random, at?: number): FishingRound {
  const conditions = at === undefined ? undefined : fishingTide(at);
  const activity = conditions?.activity ?? 0;
  const { empty, tiny: tinyShare } = fishingShares(activity);
  const rod = rods.find(r => r.id === state.equipped)!;
  const type = random();
  let result: FishingResult;
  let cut = empty + tinyShare;
  const shares = fishingCategories(state.bait, activity);
  const category = type < empty ? null : type < cut ? 'fish' : shares.find(c => type < (cut += c.share))?.id ?? 'fish';
  const tiny = species.find(s => s.id === TINY_ID)!;
  if (!category) result = random() < .5 ? { kind: 'empty', name: '只有水流经过' } : { kind: 'empty', name: '一团水草' };
  else if (type < empty + tinyShare) {
    const kg = Math.round((tiny.min + random() * (tiny.max - tiny.min)) * 100) / 100;
    result = { kind: 'fish', name: tiny.name, species: tiny.id, kg, value: tiny.price, newDiscovery: !state.book[tiny.id] };
  } else {
    // Tiny fish and pearls retain their dedicated branches; fixed entries are not weighted twice.
    const pool = fishingPool(state.spot, category, state.bait, state.book, activity);
    let point = random() * shares.find(c => c.id === category)!.share;
    const pick = (pool.find(s => (point -= s.chance) < 0) ?? pool[pool.length - 1]).entry;
    const living = category === 'fish' || category === 'creature';
    // Cubed roll: most catches are small; near-max sizes are rare.
    const kg = Math.round((pick.min + random() ** 3 * (pick.max - pick.min)) * (living && state.tools.includes('net') ? 1.15 : 1) * 100) / 100;
    const value = pick.visitor ? undefined : living ? pick.price + Math.floor(pick.price * .25 * (kg / pick.max)) : pick.price;
    let snapped: FishingResult | null = null;
    let protectedCatch = false;
    const snap = (weight: number) => {
      const overload = breakChance(weight, rod.capacity);
      const worn = wearChance(state.wear?.[rod.id] ?? 0, rod.durability);
      const roll = random();
      if (roll >= 1 - (1 - overload) * (1 - worn)) return false;
      if (state.gear.guard && state.gear.stock.guard > 0) { protectedCatch = true; return false; }
      snapped = roll < overload ? { kind: 'broken', name: '鱼竿断了，水下的大家伙游走了', kg: weight } : { kind: 'broken', name: '鱼竿用旧了，啪地断了', kg: weight, cause: 'wear' };
      return true;
    };
    const pearl = pick.id === 'mussel' && random() < PEARL_CHANCE ? species.find(s => s.id === 'pearl')! : null;
    result = pearl ? { kind: 'treasure', name: '带珍珠的河蚌', species: pearl.id, kg, value: pearl.price + (value ?? 0), newDiscovery: !state.book[pearl.id] } :
      living && !pick.visitor && snap(kg) ? snapped! :
      { kind: category, name: pick.name, species: pick.id, kg, value, newDiscovery: !state.book[pick.id] };
    if (protectedCatch) result.protected = true;
  }
  const heavy = result.kind !== 'treasure' && result.kind !== 'junk' && (result.kg ?? 0) > rod.capacity * .8;
  return { id, rod: rod.id, wait: (5 + random() * 5) * rod.wait * (state.tools.includes('float') ? .85 : 1),
    ...(conditions ? { tide: { version: conditions.version, at: conditions.at, activity } } : {}),
    signal: heavy ? '明显绷紧' : random() < .5 ? '轻轻晃动' : '缓缓横移', result,
    ...(isBaitSupply(state.bait) ? { supply: state.bait } : {}) };
}
