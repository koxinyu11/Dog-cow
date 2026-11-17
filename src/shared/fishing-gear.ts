/** Fishing cosmetics and supplies. All prices and quantities are authoritative game rules. */
export const rodSkins = [
  { id: 'default', name: '原竿外观', price: 0, motif: 'plain', color: '#bc9860', accent: '#e8e1cf', grip: '#3e3830', line: '#f6f0da', bobber: '#cf6f56', note: '每根鱼竿原来的样子。' },
  { id: 'mint', name: '薄荷奶油', price: 18, motif: 'leaf', color: '#76aa92', accent: '#f4e8c7', grip: '#d6c5a3', line: '#d4efdf', bobber: '#78af8b', note: '薄荷竿身、奶油握把和一片小叶子。' },
  { id: 'sunset', name: '落日橘', price: 45, motif: 'weave', color: '#d98a59', accent: '#f6d3a0', grip: '#966849', line: '#ffe5c5', bobber: '#df9861', note: '橙红的晚霞，绕在编织握把上。' },
  { id: 'starlight', name: '夜航星河', price: 90, motif: 'stars', color: '#626d9c', accent: '#e5dcff', grip: '#454c72', line: '#dedaf7', bobber: '#999aca', note: '深蓝星纹与一只小小的月牙卷轮。' },
  { id: 'koi', name: '锦鲤赤金', price: 160, motif: 'scales', color: '#bd6656', accent: '#ecd18d', grip: '#815140', line: '#f8e5b5', bobber: '#ce9f53', note: '红金鳞纹，竿尖挂着一条小鱼尾。' },
  { id: 'frost', name: '霜晶银枝', price: 0, reward: 'catalog30', motif: 'ice', color: '#a3c7d0', accent: '#f0fbff', grip: '#819fae', line: '#e4faff', bobber: '#a1d8e2', note: '冰晶分节，银白卷轮。发现 30 条图鉴解锁。' },
  { id: 'galaxy', name: '银河龙骨', price: 0, reward: 'mythic', motif: 'bones', color: '#8d85b5', accent: '#e8d9ad', grip: '#5d587f', line: '#e3ddff', bobber: '#b9a6dc', note: '骨节与星轨，纪念第一次遇见神话。' },
] as const;
export type RodSkin = typeof rodSkins[number];
export type RodSkinId = RodSkin['id'];
export const supplies = [
  { id: 'scout', name: '探索鱼饵', price: 10, pack: 10, requiredFish: 10, note: '未发现的常规鱼权重 ×3', unit: '份' },
  { id: 'magnet', name: '寻宝磁钩', price: 10, pack: 10, requiredFish: 0, note: '宝物直钓池提升到 1.2%', unit: '份' },
  { id: 'guard', name: '护线扣', price: 8, pack: 1, requiredFish: 0, note: '将要断竿时消耗，保住鱼竿与本次收获', unit: '枚' },
] as const;
export type SupplyId = typeof supplies[number]['id'];
export type BaitSupply = Exclude<SupplyId, 'guard'>;
export const MAX_SUPPLIES = 999;
export interface FishingGear {
  skin: RodSkinId;
  skins: RodSkinId[];
  stock: Record<SupplyId, number>;
  guard: boolean;
}
export const emptyGear = (): FishingGear => ({ skin: 'default', skins: ['default'], stock: { scout: 0, magnet: 0, guard: 0 }, guard: false });
export const isBaitSupply = (id: unknown): id is BaitSupply => id === 'scout' || id === 'magnet';
export function parseGear(raw: unknown): FishingGear {
  if (raw === undefined) return emptyGear();
  const value = raw as FishingGear | null;
  if (!value || typeof value !== 'object' || !Array.isArray(value.skins) || value.skins.length > rodSkins.length
    || !value.skins.includes('default') || !value.skins.includes(value.skin) || new Set(value.skins).size !== value.skins.length
    || !value.skins.every(id => rodSkins.some(s => s.id === id)) || typeof value.guard !== 'boolean'
    || !value.stock || typeof value.stock !== 'object'
    || !supplies.every(s => Number.isSafeInteger(value.stock[s.id]) && value.stock[s.id] >= 0 && value.stock[s.id] <= MAX_SUPPLIES))
    throw Error('钓鱼装备记录异常，已保留原始数据。');
  return value;
}
/** One look drives previews and the actual rod; the default retains each rod's own color. */
export function rodLook(id: RodSkinId, baseColor: string) {
  const skin = rodSkins.find(s => s.id === id) ?? rodSkins[0];
  return { ...skin, color: skin.id === 'default' ? baseColor : skin.color };
}
