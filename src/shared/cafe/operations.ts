import { cafeContent, item, SHIFTS, SHIFT_HOURS } from './content.js';
import type { CafeContent, CafeState, WeekPlan, Shift } from './types.js';
export function staffing(plan: WeekPlan, shift: Shift, morale: number, content = cafeContent) {
  const config = plan.shifts[shift];
  let brewing = config.owner ? 20 : 0,
    service = config.owner ? 20 : 0,
    wage = 0;
  for (const role of content.roles) {
    const count = config.staff[role.id];
    brewing += count * role.brewPerHour;
    service += count * role.servicePerHour;
    wage += Math.round(count * role.wage * (1 + plan.wagePremium / 100));
  }
  const efficiency = 0.85 + morale / 400;
  return { brewing: brewing * efficiency, service: service * efficiency, wage };
}
export function weekBudget(state: CafeState, plan: WeekPlan, content: CafeContent = cafeContent) {
  const location = state.setup ? item(content.locations, state.setup.location) : null;
  const purchases = content.ingredients.reduce(
    (sum, i) =>
      sum + plan.purchases[i.id] * i.price * (i.id === 'beans' && plan.quality === 'specialty' ? 1.4 : 1),
    0,
  );
  const wages = SHIFTS.reduce(
    (sum, shift) =>
      sum +
      (plan.shifts[shift].open
        ? staffing(plan, shift, state.morale, content).wage * SHIFT_HOURS[shift].length * 7
        : 0),
    0,
  );
  const hours = SHIFTS.reduce(
    (sum, shift) => sum + (plan.shifts[shift].open ? SHIFT_HOURS[shift].length * 7 : 0),
    0,
  );
  const rent = location ? Math.round((location.rent * 12) / 52) : 0;
  const utilities = 9000 + hours * 150;
  const interest = Math.round(state.finance.debt * 0.0015);
  return {
    purchases: Math.round(purchases),
    wages,
    rent,
    utilities,
    marketing: plan.marketing,
    interest,
    emergencyBudget: plan.emergencyBudget,
    total:
      Math.round(purchases) + wages + rent + utilities + plan.marketing + interest + plan.emergencyBudget,
  };
}
