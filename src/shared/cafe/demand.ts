import type { CafeState, Drink, Location, Segment, WeekPlan } from './types.js';
export function randomSource(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export const SEGMENTS: readonly Segment[] = ['office', 'student', 'neighbor'];
export const customerTraits = {
  office: { budget: 1.08, priceSensitivity: 2.0, dineIn: 0.12, stay: 20, patience: 5 },
  student: { budget: 0.82, priceSensitivity: 3.0, dineIn: 0.45, stay: 65, patience: 10 },
  neighbor: { budget: 1.05, priceSensitivity: 1.6, dineIn: 0.7, stay: 50, patience: 12 },
};
export function chooseSegment(location: Location, rng: () => number): Segment {
  const roll = rng();
  let total = 0;
  for (const id of SEGMENTS) {
    total += location.segments[id];
    if (roll < total) return id;
  }
  return 'neighbor';
}
export function chooseDrink(drinks: Drink[], segment: Segment, rng: () => number) {
  let roll = rng() * drinks.reduce((n, d) => n + d.affinity[segment], 0);
  for (const d of drinks) {
    roll -= d.affinity[segment];
    if (roll <= 0) return d;
  }
  return drinks[drinks.length - 1];
}
export function purchaseChance(
  state: CafeState,
  plan: WeekPlan,
  drink: Drink,
  segment: Segment,
  location: Location,
  day: number,
) {
  const traits = customerTraits[segment];
  const value = traits.budget * (plan.quality === 'specialty' ? 1.12 : 1);
  const priceRatio = plan.prices[drink.id] / (drink.price * value);
  const priceEffect = Math.exp(-traits.priceSensitivity * (priceRatio - 1));
  const fit =
    state.setup?.positioning === 'express'
      ? segment === 'office'
        ? 1.2
        : 0.95
      : segment === 'neighbor'
        ? 1.2
        : 0.95;
  const awareness = 0.68 + Math.min(0.25, day * 0.004) + 0.22 * (1 - Math.exp(-plan.marketing / 50000));
  const reputation = 0.65 + state.reputation / 140;
  return Math.min(
    0.55,
    Math.max(0.002, 0.095 * priceEffect * fit * awareness * reputation * location.competition),
  );
}
