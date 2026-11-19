import { serviceSlots } from './service.js';
import { cafeContent, STARTING_CAPITAL, item } from './content.js';
import { balanceDifference } from './finance.js';
import type { CafeContent, CafeState, WeekPlan, Setup } from './types.js';
export class CafeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CafeError';
  }
}
export const refuse = (message: string): never => {
  throw new CafeError('CAFE_RULE', message);
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
export function emptyCafe(seed: number, content = cafeContent): CafeState {
  return {
    version: 1,
    rulesVersion: 1,
    contentRevision: content.revision,
    revision: 0,
    seed,
    week: 1,
    setup: null,
    phase: 'planning',
    finance: {
      cash: STARTING_CAPITAL,
      inventory: 0,
      deposit: 0,
      equipment: 0,
      debt: 0,
      capital: STARTING_CAPITAL,
      retained: 0,
    },
    assets: [],
    capitalJournal: [],
    inventory: [],
    reputation: 50,
    morale: 70,
    machineOwned: false,
    reports: [],
    requests: [],
  };
}
export function validateSetup(value: unknown, content: CafeContent = cafeContent): asserts value is Setup {
  if (
    !record(value) ||
    !content.locations.some((l) => l.id === value.location) ||
    !content.machines.some((m) => m.id === value.machine) ||
    !integer(value.seats, 0, item(content.locations, String(value.location)).maxSeats) ||
    !['express', 'cozy'].includes(String(value.positioning))
  )
    refuse('开店配置无效。');
}
export function validatePlan(value: unknown, content: CafeContent = cafeContent): asserts value is WeekPlan {
  if (
    !record(value) ||
    !record(value.prices) ||
    !record(value.purchases) ||
    !record(value.shifts) ||
    !['house', 'specialty'].includes(String(value.quality)) ||
    !integer(value.marketing, 0, 200000) ||
    !integer(value.emergencyBudget, 0, 200000) ||
    !integer(value.wagePremium, 0, 40)
  )
    refuse('周计划格式无效。');
  const plan = value as unknown as WeekPlan;
  for (const drink of content.drinks)
    if (!integer(plan.prices[drink.id], 500, 6000)) refuse('饮品售价须在 ¥5–60 之间。');
  for (const ingredient of content.ingredients)
    if (!integer(plan.purchases[ingredient.id], 0, 100)) refuse('采购数量须在 0–100 包之间。');
  let ownerShifts = 0,
    openShifts = 0;
  for (const id of ['morning', 'afternoon', 'evening'] as const) {
    const shift = plan.shifts[id];
    if (
      !record(shift) ||
      typeof shift.open !== 'boolean' ||
      typeof shift.owner !== 'boolean' ||
      !record(shift.staff)
    )
      refuse('排班格式无效。');
    for (const role of content.roles)
      if (!integer(shift.staff[role.id], 0, 4)) refuse('每班每类员工人数须在 0–4 之间。');
    if (!shift.open) continue;
    openShifts++;
    if (shift.owner) ownerShifts++;
    const brew =
      (shift.owner ? 20 : 0) + content.roles.reduce((n, r) => n + shift.staff[r.id] * r.brewPerHour, 0);
    if (!brew) refuse('营业班次至少安排店主或一位咖啡师。');
  }
  if (ownerShifts > 2) refuse('店主每天最多工作两个班次（8 小时）。');
  if (!openShifts) refuse('至少选择一个营业班次。');
}
/** Strict load boundary. Future schema/rules/content revisions are rejected, never silently reset. */
export function parseCafe(raw: string | null, seed = 1, content = cafeContent): CafeState {
  if (raw === null) return emptyCafe(seed, content);
  try {
    const s = JSON.parse(raw) as CafeState;
    if (
      !record(s) ||
      s.version !== 1 ||
      s.rulesVersion !== 1 ||
      s.contentRevision !== content.revision ||
      !integer(s.revision, 0, 1e9) ||
      !integer(s.week, 1, 100000) ||
      !integer(s.seed, 0, 4294967295) ||
      !['planning', 'closed'].includes(s.phase) ||
      !record(s.finance) ||
      typeof s.machineOwned !== 'boolean' ||
      !integer(s.reputation, 0, 100) ||
      !integer(s.morale, 0, 100) ||
      !Array.isArray(s.requests) ||
      s.requests.length > 128 ||
      s.requests.some((r) => typeof r !== 'string' || r.length > 100) ||
      !Array.isArray(s.assets) ||
      s.assets.length > 100 ||
      !Array.isArray(s.capitalJournal) ||
      s.capitalJournal.length > 256 ||
      !Array.isArray(s.inventory) ||
      s.inventory.length > 3000 ||
      !Array.isArray(s.reports) ||
      s.reports.length > 52
    )
      throw Error();
    for (const [id, amount] of Object.entries(s.finance))
      if (!integer(amount, id === 'retained' ? -1e12 : 0, 1e12)) throw Error();
    for (const id of ['cash', 'inventory', 'deposit', 'equipment', 'debt', 'capital', 'retained'])
      if (!Object.hasOwn(s.finance, id)) throw Error();
    if (new Set(s.assets.map((a) => a.id)).size !== s.assets.length) throw Error();
    for (const a of s.assets)
      if (
        !record(a) ||
        typeof a.id !== 'string' ||
        !integer(a.bookValue, 0, 1e12) ||
        !integer(a.weeklyDepreciation, 0, 1e12)
      )
        throw Error();
    if (
      s.assets.reduce((n, a) => n + a.bookValue, 0) !== s.finance.equipment ||
      s.machineOwned !== s.assets.some((a) => a.id === 'machine')
    )
      throw Error();
    if (s.setup !== null) validateSetup(s.setup, content);
    if (s.machineOwned && !s.setup) throw Error();
    if (s.run !== undefined) {
      if (
        !record(s.run) ||
        typeof s.run.id !== 'string' ||
        !s.run.id ||
        s.run.id.length > 100 ||
        !s.setup ||
        !s.machineOwned ||
        s.phase !== 'planning'
      )
        throw Error();
      validatePlan(s.run.plan, content);
      if (!integer(s.run.cursor, 0, serviceSlots(s.run.plan, s.week).length * 60)) throw Error();
    }
    for (const b of s.inventory)
      if (
        !record(b) ||
        !content.ingredients.some((i) => i.id === b.ingredient) ||
        !integer(b.quantity, 1, 100000) ||
        !integer(b.unitCost, 1, 100000) ||
        !integer(b.arrivedDay, 0, 1e6) ||
        ![1, 1.12].includes(b.quality)
      )
        throw Error();
    if (
      s.inventory.reduce((n, b) => n + b.quantity * b.unitCost, 0) !== s.finance.inventory ||
      balanceDifference(s) !== 0
    )
      throw Error();
    let previous = 0;
    for (const r of s.reports) {
      if (
        !record(r) ||
        !integer(r.week, previous + 1, s.week - 1) ||
        !Array.isArray(r.hours) ||
        r.hours.length > 84 ||
        !Array.isArray(r.journal) ||
        r.journal.length > 250
      )
        throw Error();
      previous = r.week;
      validatePlan(r.plan, content);
      for (const field of [
        'openingCash',
        'closingCash',
        'revenue',
        'cogs',
        'wages',
        'rent',
        'utilities',
        'marketing',
        'depreciation',
        'interest',
        'waste',
        'purchases',
        'emergencyPurchases',
        'served',
        'demand',
        'ownerHours',
        'satisfaction',
      ])
        if (!integer(r[field as keyof typeof r], 0, 1e12)) throw Error();
      if (!integer(r.profit, -1e12, 1e12) || !integer(r.cashChange, -1e12, 1e12) || !record(r.sales))
        throw Error();
      for (const d of content.drinks) if (!integer(r.sales[d.id], 0, 1000000)) throw Error();
      for (const h of r.hours) {
        if (!record(h) || !['clear', 'rain'].includes(h.weather) || !record(h.sales)) throw Error();
        for (const key of [
          'day',
          'hour',
          'traffic',
          'demand',
          'served',
          'queueLost',
          'stockLost',
          'seatLost',
          'revenue',
          'cogs',
        ])
          if (!integer(h[key as keyof typeof h], 0, 1e12)) throw Error();
        for (const key of ['machineCapacity', 'laborCapacity', 'machineUsed', 'laborUsed', 'waitMinutes'])
          if (
            typeof h[key as keyof typeof h] !== 'number' ||
            !Number.isFinite(h[key as keyof typeof h]) ||
            Number(h[key as keyof typeof h]) < 0
          )
            throw Error();
        for (const d of content.drinks) if (!integer(h.sales[d.id], 0, 1000000)) throw Error();
      }
      for (const j of r.journal)
        if (
          !record(j) ||
          !integer(j.day, 0, 1e6) ||
          typeof j.kind !== 'string' ||
          !Array.isArray(j.postings) ||
          j.postings.length !== 2 ||
          j.postings.some((p) => !record(p) || !integer(p.debit, 0, 1e12) || !integer(p.credit, 0, 1e12)) ||
          j.postings.reduce((n, p) => n + p.debit - p.credit, 0) !== 0
        )
          throw Error();
    }
    return s;
  } catch {
    throw new CafeError(
      'CAFE_READ_FAILED',
      '咖啡馆存档无法读取或版本不兼容，原始数据已保留。请从有效备份恢复。',
    );
  }
}
