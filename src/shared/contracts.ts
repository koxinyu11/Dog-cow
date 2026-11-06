import type { WindowTransition, WindowSnapshot } from './capsule.js';
import type { Board } from './board.js';
import type { TitlesView } from './titles/types.js';
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
export interface OvertimeConfig {
  enabled: boolean;
  workdayRate: number | string;
  restRate: number | string;
  holidayRate: number | string;
  minMinutes: number | string;
}
export interface OwedMessage { id: string; date: string; minutes: number; note: string; createdAt: number; updatedAt: number; amount: number }
export interface OwedView {
  error: string;
  ready: boolean;
  clockReady: boolean;
  enabled: boolean;
  month: string;
  today: number;
  total: number;
  parts: Record<'early' | 'late' | 'rest' | 'message', number>;
  seconds: Record<'early' | 'late' | 'rest' | 'message', number>;
  messages: OwedMessage[];
  days: Record<string, number>;
}
export interface IncomeSettings {
  bonus?: BonusConfig;
  overtime?: OvertimeConfig;
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
export type ActivityKind = 'toilet' | 'smoking' | 'coffee';
export interface ToiletRecord {
  kind: ActivityKind;
  id: string;
  startAt: number;
  endAt: number | null;
  status: 'running' | 'needs-review' | 'completed';
  endReason?: 'manual' | 'lunch' | 'offwork' | 'schedule-end' | 'review';
  interruption?: 'sleep' | 'restart' | 'cross-day' | 'clock-change';
}
export interface ToiletState {
  version: 2;
  legacyBackup?: string;
  records: ToiletRecord[];
  error: string;
  pendingSave?: boolean;
  pendingRecordId?: string;
}
export interface IncomeState {
  toilet?: ToiletState;
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
  errorCode?: string;
  correlationId?: string;
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'error' | 'preparing' | 'installing';
  version: string;
  progress: number;
  message: string;
}
export interface Snapshot {
  tray?: import('./tray.js').TrayState;
  updates?: UpdateState;
  compact: boolean;
  window: WindowSnapshot;
  sequence: number;
  revisions: Record<Domain, number>;
  tasks: TaskState;
  taskError: string;
  layout: Layout;
  layoutWarning: string;
  board: Board;
  /** First day of each upcoming official holiday, for hope countdowns. */
  hopeHolidays?: { name: string; date: string }[];
  income: IncomeState;
  titles?: TitlesView;
  owed?: OwedView;
  save: { dirty: boolean; error: string; readError: string };
  version: string;
}
export interface Result {
  trayPanel?: import('./tray.js').TrayPanelData;
  offwork?: { income: IncomeState; date: string };

  applied: boolean;
  persisted: boolean;
  message: string;
  errors?: Record<string, string>;
  code?: string;
  errorCode?: string;
  correlationId?: string;
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
  'iouImage',
  'owed',
  'settings',
  'leave',
  'removeLeave',
  'toilet',
  'titles',
  'prepareClock',
  'clock',
  'refreshCalendar',
  'retrySave',
  'chooseImport',
  'commitImport',
  'exportBackup',
  'windowMode',
  'windowModeReady',
  'windowTransitionReady',
  'capsulePreferences',
  'trayPreferences',
  'trayPanelAction',
  'retryTray',
  'copyTrayDiagnostics',
  'resetCapsulePosition',
  'capsuleMenu',
  'checkUpdates',
  'openUpdate',
  'installUpdate',
  'copyUpdateDiagnostics',
  'openSource',
  'quit',
] as const;
export type Method = (typeof methods)[number];
export interface Bridge {
  openHopes(callback: () => void): () => void;
  openIncomeSettings(callback: () => void): () => void;
  trayPanel(callback: (value: import('./tray.js').TrayPanelEvent) => void): () => void;
  invoke(method: Method, payload?: Fields): Promise<Result>;
  subscribe(callback: (snapshot: Snapshot) => void): () => void;
  windowTransition(callback: (transition: WindowTransition) => void): () => void;
  prepareWindowMode(callback: (nonce: string) => void): () => void;
  openCapsuleSettings(callback: (id: string) => void): () => void;
  beforeQuit(callback: (nonce: string) => void): () => void;
}
declare global {
  interface Window {
    dogcow: Bridge;
  }
}
