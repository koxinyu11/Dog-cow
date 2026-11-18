import { item } from './content.js';
import type { Batch, CafeContent, Recipe } from './types.js';
export function stock(batches: Batch[], id: string, day = Infinity) {
  return batches.reduce((n, b) => n + (b.ingredient === id && b.arrivedDay <= day ? b.quantity : 0), 0);
}
export function canMake(batches: Batch[], recipe: Recipe, day: number) {
  return Object.entries(recipe).every(([id, quantity]) => stock(batches, id, day) >= quantity);
}
/** Consume oldest deliveries first. Each batch retains its actual acquisition cost. */
export function consume(batches: Batch[], recipe: Recipe, day: number) {
  if (!canMake(batches, recipe, day)) throw Error('原料不足。');
  let cost = 0;
  for (const [id, amount] of Object.entries(recipe)) {
    let left = amount;
    for (const b of batches) {
      if (b.ingredient !== id || b.arrivedDay > day) continue;
      const used = Math.min(left, b.quantity);
      b.quantity -= used;
      left -= used;
      cost += used * b.unitCost;
      if (left === 0) break;
    }
  }
  return cost;
}
export function expire(batches: Batch[], day: number, content: CafeContent) {
  let cost = 0;
  for (const b of batches) {
    const life = item(content.ingredients, b.ingredient).shelfDays;
    if (life !== null && day - b.arrivedDay >= life) {
      cost += b.quantity * b.unitCost;
      b.quantity = 0;
    }
  }
  return cost;
}
/** Evaluate the actual oldest available beans, keeping quality attached to their batch. */
export function servingQuality(batches: Batch[], day: number, content: CafeContent) {
  const beans = batches.find((b) => b.ingredient === 'beans' && b.quantity > 0 && b.arrivedDay <= day);
  if (!beans) return 1;
  const limit = item(content.ingredients, 'beans').freshnessDays;
  return beans.quality * (limit !== null && day - beans.arrivedDay > limit ? 0.75 : 1);
}
