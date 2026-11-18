import { cafeContent, item, LOAN_LIMIT } from './content.js';
import { entry, post } from './finance.js';
import { weekBudget } from './operations.js';
import { simulateWeek } from './simulation.js';
import { refuse, validatePlan, validateSetup } from './state.js';
import type { CafeAction, CafeContent, CafeState, JournalEntry, Setup } from './types.js';
export function setupQuote(setup: Setup, content = cafeContent) {
  const location = item(content.locations, setup.location),
    machine = item(content.machines, setup.machine);
  const inventory = content.ingredients.reduce(
    (n, i) => n + i.price * (i.id === 'beans' || i.id === 'cups' ? 2 : 1),
    0,
  );
  const deposit = location.rent * location.depositMonths;
  const fitout = location.fitout + setup.seats * 30000;
  return {
    deposit,
    fitout,
    machine: machine.price,
    inventory,
    total: deposit + fitout + machine.price + inventory,
  };
}
export function applyCafeAction(
  previous: CafeState,
  request: CafeAction,
  content: CafeContent = cafeContent,
): CafeState {
  let state = structuredClone(previous);
  const journal: JournalEntry[] = [];
  const day = (state.week - 1) * 7;
  if (request.action === 'view' || request.action === 'retry') return state;
  if (request.action === 'setup') {
    if (state.setup) refuse('店铺已签约，不能重复开店。');
    validateSetup(request.setup, content);
    const quote = setupQuote(request.setup, content);
    if (quote.total > state.finance.cash) refuse('启动资金不足，请调整铺位或设备。');
    state.setup = structuredClone(request.setup);
    state.machineOwned = true;
    state.assets = [
      {
        id: 'machine',
        bookValue: quote.machine,
        weeklyDepreciation: Math.round(
          quote.machine / item(content.machines, request.setup.machine).lifeWeeks,
        ),
      },
      { id: 'fitout', bookValue: quote.fitout, weeklyDepreciation: Math.round(quote.fitout / 260) },
    ];
    post(state, journal, entry(day, '租赁押金', 'deposit', 'cash', quote.deposit));
    post(state, journal, entry(day, '装修与设备', 'equipment', 'cash', quote.fitout + quote.machine));
    post(state, journal, entry(day, '首批备货', 'inventory', 'cash', quote.inventory));
    state.inventory = content.ingredients.map((i) => ({
      ingredient: i.id,
      quantity: i.pack * (i.id === 'beans' || i.id === 'cups' ? 2 : 1),
      unitCost: Math.round(i.price / i.pack),
      arrivedDay: 0,
      quality: 1,
    }));
  } else {
    if (!state.setup || state.phase === 'closed') refuse('店铺尚未开业或已清算。');
    const setup = state.setup!;
    if (request.action === 'week') {
      validatePlan(request.plan, content);
      if (!state.machineOwned) refuse('请先购入咖啡机。');
      const budget = weekBudget(state, request.plan, content);
      if (budget.total > state.finance.cash)
        refuse('现金不足以覆盖本周采购和固定支出，请减少支出或申请周转贷款。');
      state = simulateWeek(state, request.plan, content);
    } else if (request.action === 'loan' || request.action === 'repay') {
      const amount = request.amount;
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > LOAN_LIMIT) refuse('贷款或还款金额无效。');
      if (request.action === 'loan') {
        if (state.finance.debt + amount > LOAN_LIMIT) refuse('贷款余额不能超过 ¥30,000。');
        post(state, journal, entry(day, '周转贷款', 'cash', 'debt', amount));
      } else {
        if (amount > state.finance.cash || amount > state.finance.debt)
          refuse('还款不能超过现金或贷款余额。');
        post(state, journal, entry(day, '偿还本金', 'debt', 'cash', amount));
      }
    } else if (request.action === 'sellMachine' || request.action === 'machine') {
      if (request.action === 'machine') item(content.machines, request.machine);
      if (request.action === 'machine' && state.machineOwned && request.machine === setup.machine)
        refuse('当前已拥有这台咖啡机。');
      if (state.machineOwned) {
        const bookValue = state.assets.find((a) => a.id === 'machine')!.bookValue;
        const proceeds = Math.round(bookValue * 0.6);
        if (
          request.action === 'machine' &&
          item(content.machines, request.machine).price > state.finance.cash + proceeds
        )
          refuse('设备更换资金不足。');
        post(state, journal, entry(day, '旧机出售', 'cash', 'equipment', proceeds));
        post(state, journal, entry(day, '设备处置损失', 'disposal', 'equipment', bookValue - proceeds));
        state.machineOwned = false;
        state.assets = state.assets.filter((a) => a.id !== 'machine');
      }
      if (request.action === 'sellMachine' && !previous.machineOwned) refuse('当前没有可出售的咖啡机。');
      if (request.action === 'machine') {
        const next = item(content.machines, request.machine);
        if (next.price > state.finance.cash) refuse('购机资金不足。');
        post(state, journal, entry(day, '购买咖啡机', 'equipment', 'cash', next.price));
        setup.machine = next.id;
        state.machineOwned = true;
        state.assets.push({
          id: 'machine',
          bookValue: next.price,
          weeklyDepreciation: Math.round(next.price / next.lifeWeeks),
        });
      }
    } else if (request.action === 'liquidate') {
      post(
        state,
        journal,
        entry(day, '装修设备清算', 'cash', 'equipment', Math.round(state.finance.equipment * 0.35)),
      );
      post(state, journal, entry(day, '设备清算损失', 'disposal', 'equipment', state.finance.equipment));
      post(state, journal, entry(day, '退租返还押金', 'cash', 'deposit', state.finance.deposit));
      post(state, journal, entry(day, '剩余原料报废', 'waste', 'inventory', state.finance.inventory));
      post(
        state,
        journal,
        entry(day, '偿还贷款', 'debt', 'cash', Math.min(state.finance.cash, state.finance.debt)),
      );
      state.assets = [];
      state.inventory = [];
      state.phase = 'closed';
      state.machineOwned = false;
    } else refuse('不支持的咖啡馆操作。');
  }
  if (journal.length) state.capitalJournal = [...state.capitalJournal, ...journal].slice(-256);
  return state;
}
