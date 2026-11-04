import type { Board } from './board.js';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Fields = Record<string, unknown>;
export interface Tag {
  id: string;
  label: string;
  color: string;
}
export interface Task extends Fields {
  id: string;
  date: string;
  title: string;
  note: string;
  priority: string;
  tags: Tag[];
  progress: number;
  done: boolean;
  hasTime: boolean;
  startTime: string;
  endTime: string;
  dueDate: string;
  calendarMark: boolean;
  markerColor: string;
}
export interface TaskState {
  tasks: Task[];
  tagLibrary: Array<{ label: string; color: string }>;
  seededWeeks: string[];
  settings: Record<string, string>;
}
export interface Layout {
  version: 1;
  order: string[];
  enabled: string[];
}
export interface Fact {
  at: number;
  recordedAt: number;
  updatedAt: number;
  source: string;
}
export interface FlexDay {
  mode: 'shift' | 'exempt';
  baseStartTime: string; baseEndTime: string; startAt: number; endAt: number;
  lunchCountsAsWork: boolean; lunchStartTime: string; lunchEndTime: string;
}
export interface Attendance {
  trackingFrom: string;
  days: Array<{
    date: string;
    clockIn: Fact | null;
    clockOut: Fact | null;
    flex?: FlexDay;
    breaks: Array<{ id: string; start: Fact; end: Fact | null }>;
  }>;
  modeDays: Array<{ date: string; stealMode: boolean; clockMode: boolean }>;
}
export interface Leave {
  id: string;
  date: string;
  fullDay: boolean;
  startTime: string;
  endTime: string;
  paid: boolean;
}
export interface Deduction {
  baseMode?: string;
  base?: number | string;
  taxDeductibleAmount?: number | string;
  method: string;
  rate: number | string;
  amount: number | string;
}
export interface Extra extends Deduction {
  id: string;
  name: string;
  taxDeductibleAmount: number | string;
}
export interface Payroll {
  city: string;
  taxMode: string;
  taxMonth: number | string;
  additionalDeduction: number | string;
  priorTaxableIncome: number | string;
  priorTaxPaid: number | string;
  socialBaseMode: string;
  socialBase: number | string;
  fundBaseMode: string;
  fundBase: number | string;
  items: Record<string, Deduction>;
  extras: Extra[];
}
export interface BonusConfig {
  enabled: boolean;
  amountMode: string;
  baseSalary: number | string;
  customAmount: number | string;
  taxMode: string;
  taxYear: number | string;
  annualMode: string;
  annualIncome: number | string;
  annualDeductions: number | string;
}
export interface IncomeSettings {
  bonus?: BonusConfig;
  payBasis: 'monthly' | 'daily';
  dailySalary: number | string;
  monthlySalary: number | string;
  startTime: string;
  endTime: string;
  workdays: number[];
  calendarMode: string;
  lunchCountsAsWork: boolean;
  lunchStartTime: string;
  lunchEndTime: string;
  stealMode: boolean;
  clockMode: boolean;
  flexEnabled: boolean;
  flexMode: 'shift' | 'exempt';
  salaryMode: string;
  payroll: Payroll;
}
export interface IncomeState {
  settings: IncomeSettings | null;
  leaves: Leave[];
  attendance: Attendance;
  now: number;
  snapshot: Fields | null;
  payrollResult: Fields | null;
  calendar: { busy: boolean; results: Record<string, Fields> };
  calculationError: { code: string; message: string } | null;
  migrationNotice: string;
}
export type Domain = 'tasks' | 'income' | 'home';
export interface UpdateState {
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'error';
  version: string;
  progress: number;
  message: string;
}
export interface Snapshot {
  updates?: UpdateState;
  compact: boolean;
  sequence: number;
  revisions: Record<Domain, number>;
  tasks: TaskState;
  taskError: string;
  layout: Layout;
  layoutWarning: string;
  board: Board;
  income: IncomeState;
  save: { dirty: boolean; error: string; readError: string };
  version: string;
}
export interface Result {
  applied: boolean;
  persisted: boolean;
  message: string;
  errors?: Record<string, string>;
  code?: string;
  snapshot?: Snapshot;
  completion?: { taskId: string; date: string; allDone: boolean };
}
export const methods = [
  'appearance',
  'bootstrap',
  'task',
  'copy',
  'layout',
  'board',
  'fun',
  'receiptImage',
  'settings',
  'leave',
  'removeLeave',
  'prepareClock',
  'clock',
  'refreshCalendar',
  'retrySave',
  'chooseImport',
  'commitImport',
  'exportBackup',
  'compact',
  'checkUpdates',
  'openUpdate',
  'openSource',
  'quit',
] as const;
export type Method = (typeof methods)[number];
export interface Bridge {
  invoke(method: Method, payload?: Fields): Promise<Result>;
  subscribe(callback: (snapshot: Snapshot) => void): () => void;
  beforeQuit(callback: (nonce: string) => void): () => void;
}
declare global {
  interface Window {
    dogcow: Bridge;
  }
}
