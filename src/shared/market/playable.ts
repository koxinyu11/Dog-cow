import { createMarket, assertMarket, updateFunds } from './simulation.js';
import { wealth } from './model.js';

/** The calibrated patient configuration, fixed explicitly for the playable market. */
export const PLAYABLE_PARAMETERS = { feeBps: 5, spreadBps: 30, orderFraction: 0.003, fundamentalWeight: 0.04 } as const;
export const ETF_UNIT_SIZE = 1000;
export function createPlayableMarket(seed: number, scenario: Parameters<typeof createMarket>[1] = 'normal', parameters = PLAYABLE_PARAMETERS) {
  const market = createMarket(seed, scenario, parameters);
  for (const fund of market.funds) {
    fund.unitSize = ETF_UNIT_SIZE;
    fund.units *= ETF_UNIT_SIZE;
    const security = market.securities[fund.id];
    security.supply *= ETF_UNIT_SIZE;
    security.price = Math.max(1, Math.round(security.price / ETF_UNIT_SIZE));
    security.previous = security.initialPrice = security.price;
    security.history = [security.price];
    for (const account of market.accounts) account.holdings[fund.id] *= ETF_UNIT_SIZE;
  }
  updateFunds(market);
  for (const account of market.accounts) account.initialWealth = wealth(market, account);
  assertMarket(market);
  return market;
}
