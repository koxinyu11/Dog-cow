import { cafeContent, item, SHIFTS, SHIFT_HOURS } from './content.js';
import { chooseDrink, chooseSegment, customerTraits, purchaseChance, randomSource } from './demand.js';
import { balanceDifference, entry, post, profitOf } from './finance.js';
import { canMake, consume, expire, servingQuality, stock } from './inventory.js';
import { staffing, weekBudget } from './operations.js';
import type { CafeContent, CafeState, HourResult, WeekPlan, WeekReport } from './types.js';

/** A versioned, seeded domain simulation. No clock, storage, renderer, IPC or global RNG. */
export function simulateWeek(
  previous: CafeState,
  plan: WeekPlan,
  content: CafeContent = cafeContent,
): CafeState {
  const state = structuredClone(previous);
  if (!state.setup || !state.machineOwned || state.phase !== 'planning') throw Error('请先完成开店配置。');
  const location = item(content.locations, state.setup.location);
  const machine = item(content.machines, state.setup.machine);
  const startDay = (state.week - 1) * 7;
  const budget = weekBudget(state, plan, content);
  const rng = randomSource(state.seed ^ Math.imul(state.week, 2654435761));
  const journal: WeekReport['journal'] = [];
  const report: WeekReport = {
    week: state.week,
    openingCash: state.finance.cash,
    closingCash: 0,
    revenue: 0,
    cogs: 0,
    wages: budget.wages,
    rent: budget.rent,
    utilities: budget.utilities,
    marketing: budget.marketing,
    depreciation: state.assets.reduce((n, a) => n + Math.min(a.bookValue, a.weeklyDepreciation), 0),
    interest: budget.interest,
    waste: 0,
    profit: 0,
    cashChange: 0,
    purchases: budget.purchases,
    emergencyPurchases: 0,
    served: 0,
    demand: 0,
    satisfaction: 0,
    ownerHours: SHIFTS.reduce(
      (n, shift) => n + (plan.shifts[shift].open && plan.shifts[shift].owner ? 28 : 0),
      0,
    ),
    hours: [],
    sales: Object.fromEntries(content.drinks.map((d) => [d.id, 0])),
    journal,
    plan: structuredClone(plan),
  };
  // Weekly supplier order, split into three D+1 deliveries. Fresh milk need not sit all week.
  for (const ingredient of content.ingredients) {
    const packs = plan.purchases[ingredient.id];
    const unitCost = Math.round(
      (ingredient.price / ingredient.pack) *
        (ingredient.id === 'beans' && plan.quality === 'specialty' ? 1.4 : 1),
    );
    const cost = packs * ingredient.pack * unitCost;
    post(state, journal, entry(startDay, '采购付款', 'inventory', 'cash', cost));
    for (let delivery = 0; delivery < 3; delivery++) {
      const quantity = (Math.floor(packs / 3) + (delivery < packs % 3 ? 1 : 0)) * ingredient.pack;
      if (quantity)
        state.inventory.push({
          ingredient: ingredient.id,
          quantity,
          unitCost,
          arrivedDay: startDay + 1 + delivery * 2,
          quality: ingredient.id === 'beans' && plan.quality === 'specialty' ? 1.12 : 1,
        });
    }
  }
  post(state, journal, entry(startDay, '本周推广', 'marketing', 'cash', budget.marketing));
  let happiness = 0;
  for (let d = 0; d < 7; d++) {
    const day = startDay + d;
    const spoiled = expire(state.inventory, day, content);
    if (spoiled) {
      report.waste += spoiled;
      post(state, journal, entry(day, '到期原料报废', 'waste', 'inventory', spoiled));
    }
    const weather = rng() < 0.22 ? 'rain' : 'clear';
    // Occupancy carries across hours, while all visitors leave before the next day opens.
    let occupiedUntil: number[] = [];
    for (const shift of SHIFTS) {
      if (!plan.shifts[shift].open) continue;
      const labor = staffing(plan, shift, state.morale, content);
      // Cross-trained staff share their time between brewing and counter service.
      const sharedCapacity =
        labor.brewing && labor.service ? 1.5 / (1 / labor.brewing + 1 / labor.service) : 0;
      for (const hour of SHIFT_HOURS[shift]) {
        const traffic = Math.round(
          location.footfall[shift] *
            (d >= 5 ? location.weekend : 1) *
            (weather === 'rain' ? 0.7 : 1) *
            (0.85 + rng() * 0.3),
        );
        const line: HourResult = {
          day,
          hour,
          weather,
          traffic,
          demand: 0,
          served: 0,
          queueLost: 0,
          stockLost: 0,
          seatLost: 0,
          machineCapacity: machine.cupsPerHour,
          laborCapacity: sharedCapacity,
          machineUsed: 0,
          laborUsed: 0,
          waitMinutes: 0,
          sales: Object.fromEntries(content.drinks.map((drink) => [drink.id, 0])),
          revenue: 0,
          cogs: 0,
        };
        let machineFree = hour * 60,
          laborFree = hour * 60;
        for (let visitor = 0; visitor < traffic; visitor++) {
          const segment = chooseSegment(location, rng);
          const drink = chooseDrink(content.drinks, segment, rng);
          if (rng() > purchaseChance(state, plan, drink, segment, location, day)) continue;
          line.demand++;
          const arrival = hour * 60 + (60 * visitor) / Math.max(1, traffic);
          const traits = customerTraits[segment];
          const workload = drink.minutes / 2;
          const machineMinutes = (60 / machine.cupsPerHour) * workload;
          const laborMinutes = sharedCapacity ? (60 / sharedCapacity) * workload : Infinity;
          const begins = Math.max(arrival, machineFree, laborFree);
          const wait = begins - arrival;
          if (wait > traits.patience || begins + Math.max(machineMinutes, laborMinutes) > (hour + 1) * 60) {
            line.queueLost++;
            continue;
          }
          occupiedUntil = occupiedUntil.filter((until) => until > arrival);
          const dineIn = rng() < traits.dineIn;
          if (dineIn && occupiedUntil.length >= state.setup.seats) {
            line.seatLost++;
            continue;
          }
          if (!canMake(state.inventory, drink.recipe, day)) {
            line.stockLost++;
            // Optional local supplier: one pack per missing ingredient, D+1 delivery, 50% premium.
            // Existing incoming orders prevent repeated replenishment for the same shortage.
            for (const [id, needed] of Object.entries(drink.recipe)) {
              if (stock(state.inventory, id) >= needed) continue;
              const ingredient = item(content.ingredients, id);
              const quality = id === 'beans' && plan.quality === 'specialty' ? 1.12 : 1;
              const unitCost = Math.round(
                (ingredient.price / ingredient.pack) * (quality > 1 ? 1.4 : 1) * 1.5,
              );
              const cost = unitCost * ingredient.pack;
              if (report.emergencyPurchases + cost > plan.emergencyBudget) continue;
              post(state, journal, entry(day, '临时补货付款', 'inventory', 'cash', cost));
              report.emergencyPurchases += cost;
              report.purchases += cost;
              state.inventory.push({
                ingredient: id,
                quantity: ingredient.pack,
                unitCost,
                arrivedDay: day + 1,
                quality,
              });
            }
            continue;
          }
          const quality = servingQuality(state.inventory, day, content);
          const cost = consume(state.inventory, drink.recipe, day);
          machineFree = begins + machineMinutes;
          laborFree = begins + laborMinutes;
          if (dineIn) occupiedUntil.push(begins + traits.stay);
          line.machineUsed += workload;
          line.laborUsed += workload;
          line.waitMinutes += wait;
          line.served++;
          line.sales[drink.id]++;
          line.revenue += plan.prices[drink.id];
          line.cogs += cost;
          const priceValue =
            (drink.price * traits.budget * (plan.quality === 'specialty' ? 1.12 : 1)) / plan.prices[drink.id];
          const ambiance = dineIn && state.setup.positioning === 'cozy' ? 6 : 0;
          happiness += Math.max(
            0,
            Math.min(
              100,
              75 +
                (priceValue - 1) * 28 -
                wait * 2 +
                ambiance +
                (quality - 1) * 60 -
                (plan.quality === 'specialty' && quality < 1.1 ? 6 : 0),
            ),
          );
        }
        if (line.served) line.waitMinutes = Math.round((line.waitMinutes / line.served) * 10) / 10;
        report.hours.push(line);
        report.served += line.served;
        report.demand += line.demand;
        report.revenue += line.revenue;
        report.cogs += line.cogs;
        for (const drink of content.drinks) report.sales[drink.id] += line.sales[drink.id];
        post(state, journal, entry(day, '咖啡销售', 'cash', 'revenue', line.revenue));
        post(state, journal, entry(day, '原料耗用', 'materials', 'inventory', line.cogs));
      }
    }
  }
  for (const account of ['wages', 'rent', 'utilities', 'interest'] as const)
    post(state, journal, entry(startDay + 6, account, account, 'cash', report[account]));
  post(state, journal, entry(startDay + 6, '设备折旧', 'depreciation', 'equipment', report.depreciation));
  for (const asset of state.assets) asset.bookValue -= Math.min(asset.bookValue, asset.weeklyDepreciation);
  state.inventory = state.inventory.filter((b) => b.quantity > 0);
  report.profit = profitOf(report);
  report.closingCash = state.finance.cash;
  report.cashChange = report.closingCash - report.openingCash;
  report.satisfaction = report.served ? Math.round(happiness / report.served) : 0;
  const fulfillment = report.demand ? report.served / report.demand : 1;
  state.reputation = Math.max(
    10,
    Math.min(95, Math.round(state.reputation * 0.8 + (report.satisfaction * 0.8 + fulfillment * 20) * 0.2)),
  );
  const workload =
    report.hours.reduce((n, h) => n + (h.laborCapacity ? h.laborUsed / h.laborCapacity : 0), 0) /
    Math.max(1, report.hours.length);
  state.morale = Math.max(
    25,
    Math.min(
      95,
      Math.round(state.morale * 0.85 + (65 + plan.wagePremium - Math.max(0, workload - 0.75) * 40) * 0.15),
    ),
  );
  state.week++;
  state.reports.push(report);
  if (state.reports.length > 52) state.reports.shift();
  if (balanceDifference(state) !== 0 || state.finance.cash < 0 || state.finance.inventory < 0)
    throw Error('经营账务校验失败，未提交本次结算。');
  return state;
}
