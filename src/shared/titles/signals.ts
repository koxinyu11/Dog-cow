/**
 * Registry of every fact the title engine understands.
 * Adding a new kind of fact: add its id here, emit it from a collector, then
 * reference it from catalog conditions. Storage shape does not change.
 */
export const SIGNALS = {
  done: '任务 ID：首次完成',
  redone: '任务 ID：已计数的任务再次完成',
  'done-late': '任务 ID：所属日期比完成日早至少 7 天',
  clockin: '日期：成功上班打卡',
  ontime: '日期：下班打卡在排班结束后 0–10 分钟',
  exact: '日期：上班打卡与排班开始同一分钟',
  friday: '日期：排班工作日的周五有下班记录',
  monday: '日期：排班工作日的周一上班打卡',
  mood: '日期：保存有效精神状态',
  lunch: '日期：成功确认午餐',
  open: '日期：应用在前台可见',
  'open-rest': '日期：非排班日打开应用',
  comeback: '日期：距上次打开至少 14 天',
} as const;

export const LEDGERS = {
  steal: '日期 → 当天偷出金额（分）',
  owed: '日期 → 当天老板欠款（分）',
  lunch: '日期 → 确认的菜名',
  mood: '日期 → 精神状态 ID',
  hopes: '日期 → 当天未过期盼头数量',
} as const;

export type SignalId = keyof typeof SIGNALS;
export type LedgerId = keyof typeof LEDGERS;
export const isSignal = (value: string): value is SignalId => Object.hasOwn(SIGNALS, value);
export const isLedger = (value: string): value is LedgerId => Object.hasOwn(LEDGERS, value);
