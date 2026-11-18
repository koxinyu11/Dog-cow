import type { Account, CafeState, JournalEntry, Posting, WeekReport } from './types.js';
const money = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount < 0) throw Error('账务金额无效。');
  return amount;
};
export function entry(
  day: number,
  kind: string,
  debit: Account,
  credit: Account,
  amount: number,
): JournalEntry {
  return {
    day,
    kind,
    postings: [
      { account: debit, debit: money(amount), credit: 0 },
      { account: credit, debit: 0, credit: amount },
    ],
  };
}
const expenses: Account[] = [
  'materials',
  'wages',
  'rent',
  'utilities',
  'marketing',
  'depreciation',
  'interest',
  'waste',
  'disposal',
];
const assets: Account[] = ['cash', 'inventory', 'deposit', 'equipment'];
export function post(state: CafeState, journal: JournalEntry[], line: JournalEntry) {
  if (line.postings.reduce((sum, p) => sum + p.debit - p.credit, 0) !== 0) throw Error('账务借贷不平。');
  for (const p of line.postings) apply(state, p);
  journal.push(line);
}
function apply(state: CafeState, p: Posting) {
  money(p.debit);
  money(p.credit);
  const delta = p.debit - p.credit;
  if (assets.includes(p.account)) state.finance[p.account as 'cash'] += delta;
  else if (p.account === 'debt' || p.account === 'capital') state.finance[p.account] -= delta;
  else if (p.account === 'revenue') state.finance.retained -= delta;
  else if (expenses.includes(p.account)) state.finance.retained -= delta;
}
export function balanceDifference(state: CafeState) {
  const f = state.finance;
  return f.cash + f.inventory + f.deposit + f.equipment - f.debt - f.capital - f.retained;
}
export function profitOf(
  r: Pick<
    WeekReport,
    'revenue' | 'cogs' | 'wages' | 'rent' | 'utilities' | 'marketing' | 'depreciation' | 'interest' | 'waste'
  >,
) {
  return (
    r.revenue - r.cogs - r.wages - r.rent - r.utilities - r.marketing - r.depreciation - r.interest - r.waste
  );
}
export const yuan = (cents: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(
    cents / 100,
  );
