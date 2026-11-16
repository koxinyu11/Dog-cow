import type { ExchangeIntent } from './poker-exchange.js';
import type { Action, Table } from './poker/engine.js';
export const POKER_KEY = 'dogcow.poker.v1';
export interface PokerSession {
    brought: number;
    returned: number;
}
export interface PokerState {
    version: 1;
    reserve: number;
    table: Table | null;
    requests: string[];
    leaving: boolean;
    brought?: number;
    lastSession?: PokerSession;
    exchanges?: ExchangeIntent[];
    exchangeFloor?: number;
}
export type PokerRequest = {
    action: 'view' | 'exchangeStatus' | 'join' | 'exchangeCoins' | 'exchangeChips' | 'act' | 'bot' | 'next' | 'leave' | 'retry';
    createdAt?: number;
    amount?: number;
    requestId?: string;
    tableId?: string;
    revision?: number;
    move?: Action;
    total?: number;
};
export interface PokerView {
    lastSession?: PokerSession;
    balance: number;
    reserve: number;
    table: Table | null;
    pending: boolean;
    leaving: boolean;
}
export interface PokerReply {
    exchangeStatus?: 'applied' | 'pending' | 'notFound' | 'expired';
    view?: PokerView;
    error?: string;
    errorCode?: string;
    correlationId?: string;
}
