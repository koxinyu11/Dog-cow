/** Calibration model only: integer hundredths of a coin; no wallet, clock or storage access. */
export const INDUSTRIES = ['消费', '食品农业', '医药', '金融', '地产', '工业', '能源', '公用事业', '科技', '半导体', '互联网', '传媒'] as const;
export const STRATEGIES = ['value', 'growth', 'dividend', 'turnaround', 'trend', 'reversion', 'factor', 'rotation', 'event', 'speculator', 'maker', 'sentiment'] as const;
export type Strategy = typeof STRATEGIES[number];
export type Scenario = 'normal' | 'thin' | 'boom' | 'panic' | 'concentration';
export interface Financials {
  revenue: number;
  profit: number;
  cash: number;
  debt: number;
  growth: number;
  quality: number;
  dividend: number;
}
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface Security {
  id: number;
  name: string;
  industry: number;
  price: number;
  initialPrice: number;
  previous: number;
  momentum: number;
  supply: number;
  volume: number;
  lastTrade: number;
  history: number[];
  candles?: Candle[];
  financials: Financials;
  /** Only disclosed financials may be passed to strategy evaluation. */
  published: Financials;
  margin: number;
  capacity: number;
  sensitivity: number;
  payout: number;
  news: number;
  totalDividends: number;
  /** Structural demand is separate from reported growth and the temporary sector cycle. */
  growthAnchor: number;
  structuralGrowth: number;
  baseDemand: number;
  marketCapacity: number;
}
export interface Fund {
  id: number;
  name: string;
  basket: { security: number; quantity: number }[];
  units: number;
  cash: number;
  nav: number;
  creations: number;
  redemptions: number;
  /** Trading units per physical basket. Primary creation/redemption uses whole lots. */
  unitSize?: number;
}
export interface Account {
  id: number;
  strategy: Strategy;
  identity: 'institution' | 'whale' | 'retail-pool' | 'maker' | 'player';
  cash: number;
  holdings: number[];
  initialWealth: number;
  fees: number;
  turnover: number;
  patience: number;
  bias: number;
  watch: number[];
}
export interface Order { account: number; security: number; side: 'buy' | 'sell'; price: number; quantity: number; fundPlan?: number; clientOrder?: string }
export interface Trade { buyer: number; seller: number; security: number; price: number; quantity: number; buyerPlan?: number; sellerPlan?: number; buyerOrder?: string; sellerOrder?: string }
export interface FundPlan {
  fund: number;
  account: number;
  create: boolean;
  units: number;
  started: number;
  stage: 'acquire' | 'distribute';
  remaining: { security: number; quantity: number }[];
}
export interface Parameters {
  feeBps: number;
  spreadBps: number;
  orderFraction: number;
  fundamentalWeight: number;
}
export const DEFAULT_PARAMETERS: Parameters = { feeBps: 10, spreadBps: 45, orderFraction: 0.006, fundamentalWeight: 0.025 };
export interface Market {
  seed: number;
  randomState: number;
  economicState: number;
  minute: number;
  scenario: Scenario;
  parameters: Parameters;
  securities: Security[];
  funds: Fund[];
  accounts: Account[];
  sectors: number[];
  sentiment: number;
  fundPlans: FundPlan[];
  treasury: number;
  initialCash: number;
  initialIssuerCash: number;
  operatingCash: number;
  dividends: number;
  externalCash?: number;
  submitted: number;
  filled: number;
  notional: number;
  trades: number;
  etfArbitrages: number;
  completedArbitrages: number;
  expiredArbitrages: number;
  events: { minute: number; industry: number; impact: number; title: string }[];
}
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export function random(market: { randomState: number }): number {
  market.randomState = (Math.imul(market.randomState, 1664525) + 1013904223) >>> 0;
  return market.randomState / 2 ** 32;
}
export function economicRandom(market: Market): number {
  const stream = { randomState: market.economicState };
  const value = random(stream);
  market.economicState = stream.randomState;
  return value;
}
export function publicValue(security: Security): number {
  const f = security.published;
  const multiple = clamp(12 + f.quality * 10 + f.growth * 120, 6, 32);
  return Math.max(100, f.profit * 4 * multiple / security.supply + (f.cash - f.debt) * 0.35 / security.supply);
}
export function wealth(market: Market, account: Account): number {
  return account.cash + account.holdings.reduce((sum, quantity, id) => sum + quantity * market.securities[id].price, 0);
}
