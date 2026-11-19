import type { Bait, FishingState, Species, SpotId } from './fishing.js';
import type { CharmId } from './fishing-gear.js';
import type { FishingLocation, WaterLayer } from './fishing-maps.js';
/** Conditions are separate from rarity: a restricted fish need not be rare. */
export interface FishEncounter {
  zone?: string;
  layer?: WaterLayer;
  bait?: Bait;
  charm?: CharmId;
  chance?: number;
  clue: string;
}
export function encounterMatches(entry: Species, spot: SpotId, location: FishingLocation | undefined, bait: Bait, charm: CharmId | null) {
  const rule = entry.encounter;
  return !rule || ((!rule.zone || rule.zone === location?.zone) && (!rule.layer || rule.layer === location?.layer)
    && (!rule.bait || rule.bait === bait) && (!rule.charm || rule.charm === charm));
}
export function eligibleSpecials(entries: readonly Species[], state: Pick<FishingState, 'spot' | 'location' | 'bait' | 'gear'>) {
  return entries.filter(s => s.encounter?.chance && (s.spot === 'any' || s.spot === state.spot)
    && encounterMatches(s, state.spot, state.location, state.bait, state.gear.charm));
}
