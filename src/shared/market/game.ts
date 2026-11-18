import type { Market, Financials, Candle } from './model.js';
export const MARKET_KEY = 'dogcow.market.v1';
export interface PlayerOrder {
  id: string;
  security: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price: number;
  quantity: number;
  remaining: number;
  minute: number;
}
export interface PlayerFill { id: string; minute: number; security: number; side: 'buy' | 'sell'; price: number; quantity: number; fee: number }
export interface MarketGameState {
  version: 1;
  revision: number;
  market: Market;
  player: number;
  orders: PlayerOrder[];
  fills: PlayerFill[];
  watchlist: number[];
  costBasis: number[];
  realized: number;
  dividends: number;
  netTransfers: number;
  receiptFloor: number;
  receipts: { id: string; signature: string; at: number }[];
}
export type MarketAction = { action: 'view' | 'retry' }
  | { action: 'deposit' | 'withdraw'; amount: number }
  | { action: 'order'; security: number; side: 'buy' | 'sell'; type: 'market' | 'limit'; quantity: number; price?: number }
  | { action: 'cancel'; orderId: string }
  | { action: 'watch'; security: number };
export type MarketRequest = MarketAction & { requestId: string; revision: number; createdAt: number; detail?: number };
export interface ListedSecurity {
  id: number; code: string; name: string; industry: number; kind: 'stock' | 'etf';
  price: number; change: number; volume: number; history: number[]; facts: Financials;
  nav?: number; members?: number; lastTrade: number; supply: number;
  candles?: Candle[];
}
export interface MarketView {
  revision: number; minute: number; pending: boolean; nextTickMs: number; feeBps: number;
  wallet: number; walletError: string; cash: number; available: number; reserved: number;
  engineError?: string;
  equity: number; unrealized: number; realized: number; dividends: number; netTransfers: number;
  securities: ListedSecurity[]; orders: PlayerOrder[]; fills: PlayerFill[]; watchlist: number[];
  positions: { security: number; quantity: number; available: number; cost: number; value: number }[];
  receipts: string[]; news: Market['events'];
  participants: { strategy: string; accounts: number; value: number; cash: number }[];
}
export interface MarketReply { view?: MarketView; error?: string; errorCode?: string; correlationId?: string }
