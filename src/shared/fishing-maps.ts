import type { Species, SpotId } from './fishing.js';
export type WaterLayer = 'shallow' | 'bottom';
export interface FishingLocation { zone: string; layer: WaterLayer }
interface Zone { id: string; name: string; x: number; y: number; shallow: string; bottom: string; shapes: readonly string[] }
interface FishingMap { source: 'pond' | 'river'; title: string; subtitle: string; zones: readonly Zone[] }
/** New grounds reuse catalog habitats; location changes relative fish weights, not fixed encounters. */
export const fishingMaps: Partial<Record<SpotId, FishingMap>> = {
  lotus: { source: 'pond', title: 'LOTUS SHALLOWS', subtitle: '沿着荷影，找一处好水。', zones: [
    { id: 'leaves', name: '荷叶边', x: 470, y: 252, shallow: '荷影下，小鱼穿梭', bottom: '鲫鲤在叶根觅食', shapes: ['round', 'sail', 'star-koi'] },
    { id: 'grass', name: '草隙', x: 610, y: 270, shallow: '草间有细碎鱼影', bottom: '鳅鳝藏在水草根部', shapes: ['eel', 'cat', 'crayfish', 'snail', 'shrimp'] },
    { id: 'open', name: '亮水面', x: 555, y: 310, shallow: '成群游鱼掠过水光', bottom: '水底鱼群较杂', shapes: ['slim', 'needle', 'fan', 'diamond'] },
  ] },
  bridge: { source: 'river', title: 'OLD BRIDGE POOL', subtitle: '桥影深处，藏着大家伙。', zones: [
    { id: 'shade', name: '桥影', x: 485, y: 253, shallow: '桥下游过中型鱼', bottom: '深处有鲶鳗的动静', shapes: ['cat', 'eel', 'deep'] },
    { id: 'eddy', name: '回水湾', x: 610, y: 280, shallow: '缓流里，鱼群汇聚', bottom: '回水深处鱼种较杂', shapes: [] },
    { id: 'timber', name: '倒木旁', x: 540, y: 310, shallow: '掠食鱼在木影间巡游', bottom: '底层有大鱼动静', shapes: ['perch', 'needle', 'sturgeon', 'dragon'] },
  ] },
};
export function defaultLocation(spot: SpotId): FishingLocation | undefined {
  const map = fishingMaps[spot];
  return map ? { zone: map.zones[0].id, layer: 'shallow' } : undefined;
}
export function validLocation(spot: SpotId, value: unknown): value is FishingLocation {
  if (!value || typeof value !== 'object') return false;
  const v = value as FishingLocation;
  return (v.layer === 'shallow' || v.layer === 'bottom') && !!fishingMaps[spot]?.zones.some(z => z.id === v.zone);
}
export function locationWeight(spot: SpotId, location: FishingLocation | undefined, entry: Species) {
  const map = fishingMaps[spot];
  if (!map || !location) return 1;
  const zone = map.zones.find(z => z.id === location.zone)!;
  const preferred = zone.shapes.includes(entry.shape) ? 3 : 1;
  if (entry.category !== 'fish' && entry.category !== 'creature') return 1;
  const bottom = entry.shape === 'eel' || entry.shape === 'cat' || entry.shape === 'sturgeon' || entry.category === 'creature';
  const size = entry.max <= 1 ? 'small' : entry.max >= 5 ? 'large' : 'medium';
  const layer = location.layer === 'shallow' ? (size === 'small' ? 2.5 : size === 'large' ? .35 : 1)
    : (bottom ? 3 : size === 'large' ? 2.5 : size === 'small' ? .45 : 1);
  return preferred * layer;
}
