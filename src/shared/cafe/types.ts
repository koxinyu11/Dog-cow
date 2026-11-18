/** Money is stored in integer cents; content references use stable IDs, never array positions. */
export type ContentId = string;
export type Segment = 'office' | 'student' | 'neighbor';
export type Shift = 'morning' | 'afternoon' | 'evening';
export type Recipe = Record<ContentId, number>;
export interface Ingredient {
  id: ContentId;
  name: string;
  unit: string;
  pack: number;
  price: number;
  shelfDays: number | null;
  freshnessDays: number | null;
}
export interface Drink {
  id: ContentId;
  name: string;
  short: string;
  recipe: Recipe;
  price: number;
  minutes: number;
  affinity: Record<Segment, number>;
}
export interface Location {
  id: ContentId;
  name: string;
  district: string;
  description: string;
  area: number;
  maxSeats: number;
  rent: number;
  depositMonths: number;
  fitout: number;
  footfall: Record<Shift, number>;
  weekend: number;
  segments: Record<Segment, number>;
  competition: number;
  color: string;
}
export interface Machine {
  id: ContentId;
  name: string;
  price: number;
  cupsPerHour: number;
  lifeWeeks: number;
}
export interface Role {
  id: ContentId;
  name: string;
  wage: number;
  brewPerHour: number;
  servicePerHour: number;
}
export interface CafeContent {
  revision: number;
  ingredients: Ingredient[];
  drinks: Drink[];
  locations: Location[];
  machines: Machine[];
  roles: Role[];
}
export interface ShiftPlan {
  open: boolean;
  owner: boolean;
  staff: Record<ContentId, number>;
}
export interface WeekPlan {
  prices: Record<ContentId, number>;
  purchases: Record<ContentId, number>;
  quality: 'house' | 'specialty';
  marketing: number;
  emergencyBudget: number;
  wagePremium: number;
  shifts: Record<Shift, ShiftPlan>;
}
export interface Setup {
  location: ContentId;
  machine: ContentId;
  seats: number;
  positioning: 'express' | 'cozy';
}
export interface Batch {
  ingredient: ContentId;
  quantity: number;
  unitCost: number;
  arrivedDay: number;
  quality: number;
}
export type Account =
  | 'cash'
  | 'inventory'
  | 'deposit'
  | 'equipment'
  | 'debt'
  | 'capital'
  | 'revenue'
  | 'materials'
  | 'wages'
  | 'rent'
  | 'utilities'
  | 'marketing'
  | 'depreciation'
  | 'interest'
  | 'waste'
  | 'disposal';
export interface Posting {
  account: Account;
  debit: number;
  credit: number;
}
export interface JournalEntry {
  day: number;
  kind: string;
  postings: Posting[];
}
export interface Finance {
  cash: number;
  inventory: number;
  deposit: number;
  equipment: number;
  debt: number;
  capital: number;
  retained: number;
}
export interface HourResult {
  day: number;
  hour: number;
  weather: 'clear' | 'rain';
  traffic: number;
  demand: number;
  served: number;
  queueLost: number;
  stockLost: number;
  seatLost: number;
  machineCapacity: number;
  laborCapacity: number;
  machineUsed: number;
  laborUsed: number;
  waitMinutes: number;
  sales: Record<ContentId, number>;
  revenue: number;
  cogs: number;
}
export interface WeekReport {
  week: number;
  openingCash: number;
  closingCash: number;
  revenue: number;
  cogs: number;
  wages: number;
  rent: number;
  utilities: number;
  marketing: number;
  depreciation: number;
  interest: number;
  waste: number;
  profit: number;
  cashChange: number;
  purchases: number;
  emergencyPurchases: number;
  served: number;
  demand: number;
  satisfaction: number;
  ownerHours: number;
  hours: HourResult[];
  sales: Record<ContentId, number>;
  journal: JournalEntry[];
  plan: WeekPlan;
}
export interface CafeState {
  version: 1;
  rulesVersion: 1;
  contentRevision: number;
  revision: number;
  seed: number;
  week: number;
  setup: Setup | null;
  phase: 'planning' | 'closed';
  finance: Finance;
  assets: { id: string; bookValue: number; weeklyDepreciation: number }[];
  capitalJournal: JournalEntry[];
  inventory: Batch[];
  reputation: number;
  morale: number;
  machineOwned: boolean;
  reports: WeekReport[];
  requests: string[];
}
export interface CafeView {
  state: CafeState;
  pending: boolean;
}
export type CafeAction =
  | { action: 'view' | 'retry' }
  | { action: 'setup'; setup: Setup }
  | { action: 'week'; plan: WeekPlan }
  | { action: 'loan' | 'repay'; amount: number }
  | { action: 'machine'; machine: ContentId }
  | { action: 'sellMachine' | 'liquidate' };
export type CafeRequest = CafeAction & { requestId: string; revision: number };
export interface CafeReply {
  view?: CafeView;
  error?: string;
  errorCode?: string;
  correlationId?: string;
}
