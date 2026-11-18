/** Reproducible economic smoke test, not a claim of real-world market calibration. */
import assert from 'node:assert/strict';
import { cafeContent, defaultPlan } from '../dist-electron/src/shared/cafe/content.js';
import { emptyCafe, parseCafe } from '../dist-electron/src/shared/cafe/state.js';
import { applyCafeAction } from '../dist-electron/src/shared/cafe/commands.js';
import { balanceDifference } from '../dist-electron/src/shared/cafe/finance.js';
for (const location of cafeContent.locations) {
  const outcomes = [];
  for (let seed = 1; seed <= 12; seed++) {
    const plan = defaultPlan();
    if (location.id === 'campus')
      for (const id in plan.prices) plan.prices[id] = Math.round(plan.prices[id] * 0.85);
    let state = applyCafeAction(emptyCafe(seed), {
      action: 'setup',
      setup: {
        location: location.id,
        machine: 'starter',
        seats: location.id === 'community' ? 12 : 6,
        positioning: location.id === 'community' ? 'cozy' : 'express',
      },
    });
    for (let week = 0; week < 8; week++) {
      state = applyCafeAction(state, { action: 'week', plan });
      assert.equal(balanceDifference(state), 0);
      assert.ok(state.finance.cash >= 0);
      parseCafe(JSON.stringify(state));
    }
    assert.ok(
      state.finance.retained > 0,
      `${location.id} seed ${seed} cannot sustain this reference strategy`,
    );
    outcomes.push({ cash: state.finance.cash / 100, profit: state.finance.retained / 100 });
  }
  console.log(
    JSON.stringify({
      location: location.id,
      seeds: outcomes.length,
      weeksPerSeed: 8,
      minimumCash: Math.min(...outcomes.map((o) => o.cash)),
      minimumProfit: Math.min(...outcomes.map((o) => o.profit)),
    }),
  );
}
