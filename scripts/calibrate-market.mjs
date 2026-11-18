import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createMarket, stepMarket, assertMarket, strategyReturns } from '../dist-electron/src/shared/market/simulation.js';
import { DEFAULT_PARAMETERS, STRATEGIES, wealth } from '../dist-electron/src/shared/market/model.js';
import { createPlayableMarket } from '../dist-electron/src/shared/market/playable.js';

// Train/holdout seeds are intentionally disjoint. Metrics are gameplay targets, not market forecasts.
const smoke = process.argv.includes('--smoke');
const playable = process.argv.includes('--playable');
const directory = new URL(`../output/dogcow-market/${playable ? 'v2.2' : 'v2.1'}/`, import.meta.url);
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * q)] ?? 0; };
const pct = n => `${(n * 100).toFixed(2)}%`;
const round = n => Number(n.toFixed(5));

function run(seed, scenario, parameters, minutes, phase, experiment) {
  const market = playable ? createPlayableMarket(seed, scenario, parameters) : createMarket(seed, scenario, parameters);
  let investor;
  if (experiment?.budget) {
    investor = { ...market.accounts[299], id: 300, strategy: experiment.strategy, identity: 'retail-pool', cash: experiment.budget,
      holdings: Array(258).fill(0), initialWealth: experiment.budget, fees: 0, turnover: 0,
      watch: Array.from({ length: 258 }, (_, id) => id) };
    market.accounts.push(investor);
    market.initialCash += investor.cash;
  } else if (experiment) {
    investor = market.accounts[299];
    investor.strategy = experiment.strategy;
  }
  const initialInvestor = investor && { cash: investor.cash, holdings: [...investor.holdings], wealth: wealth(market, investor),
    affordableStocks: market.securities.slice(0, 240).filter(s => s.price * 1.001 <= investor.cash).length,
    affordableEtfs: market.funds.filter(f => market.securities[f.id].price * 1.001 <= investor.cash).length };
  const initialCap = market.securities.slice(0, 240).reduce((sum, s) => sum + s.price * s.supply, 0);
  const times = [], premiums = [], minuteReturns = [], index = [], checkpoints = [];
  const peaks = market.securities.slice(0, 240).map(s => s.price);
  let maxDrawdown = 0, maxMinuteMove = 0, indexPeak = 1, indexDrawdown = 0;
  let staleSamples = 0, samples = 0, maxHourlyReturn = -Infinity, minHourlyReturn = Infinity;
  const hourly = [1];
  const started = performance.now();
  for (let minute = 1; minute <= minutes; minute++) {
    const tickStarted = performance.now();
    stepMarket(market);
    times.push(performance.now() - tickStarted);
    for (const s of market.securities.slice(0, 240)) {
      const move = Math.abs(s.price / s.previous - 1);
      maxMinuteMove = Math.max(maxMinuteMove, move);
      if (minute % 5 === 0) minuteReturns.push(move);
      peaks[s.id] = Math.max(peaks[s.id], s.price);
      maxDrawdown = Math.max(maxDrawdown, 1 - s.price / peaks[s.id]);
    }
    if (minute % 30 === 0) {
      assertMarket(market);
      for (const fund of market.funds) premiums.push(Math.abs(market.securities[fund.id].price / fund.nav - 1));
      for (const s of market.securities.slice(0, 240)) { staleSamples += Number(minute - s.lastTrade > 30); samples++; }
      const cap = market.securities.slice(0, 240).reduce((sum, s) => sum + s.price * s.supply, 0) / initialCap;
      index.push({ minute, value: round(cap) });
      indexPeak = Math.max(indexPeak, cap);
      indexDrawdown = Math.max(indexDrawdown, 1 - cap / indexPeak);
    }
    if (minute % 60 === 0) {
      const value = index.at(-1).value;
      const change = value / hourly.at(-1) - 1;
      maxHourlyReturn = Math.max(maxHourlyReturn, change);
      minHourlyReturn = Math.min(minHourlyReturn, change);
      hourly.push(value);
    }
    if (minute % 240 === 0) checkpoints.push({ minute, returns: strategyReturns(market) });
  }
  assertMarket(market);
  const finalCap = market.securities.slice(0, 240).reduce((sum, s) => sum + s.price * s.supply, 0);
  const stockReturns = market.securities.slice(0, 240).map(s => s.price / s.initialPrice - 1);
  const initialWealth = market.accounts.reduce((sum, a) => sum + a.initialWealth, 0);
  const result = {
    phase, seed, scenario, minutes, parameters, elapsedMs: round(performance.now() - started),
    metrics: { indexReturn: finalCap / initialCap - 1, indexDrawdown, maxStockDrawdown: maxDrawdown,
      maxMinuteMove, minuteMoveP95: quantile(minuteReturns, 0.95), stockReturnP10: quantile(stockReturns, 0.1),
      stockReturnP90: quantile(stockReturns, 0.9), fillRate: market.filled / Math.max(1, market.submitted),
      stale30m: staleSamples / Math.max(1, samples), etfPremiumP95: quantile(premiums, 0.95), etfPremiumMax: Math.max(0, ...premiums),
      feesToInitialWealth: market.treasury / initialWealth, dividendsToInitialWealth: market.dividends / initialWealth,
      tickP95Ms: quantile(times, 0.95), tickMaxMs: Math.max(...times), maxHourlyReturn, minHourlyReturn,
      trades: market.trades, etfConversions: market.etfArbitrages, completedArbitrages: market.completedArbitrages,
      expiredArbitrages: market.expiredArbitrages, pendingArbitrages: market.fundPlans.length },
    investor: investor && {
      strategy: investor.strategy, initialWealth: initialInvestor.wealth, initialCash: initialInvestor.cash,
      initialHoldings: initialInvestor.holdings,
      return: wealth(market, investor) / initialInvestor.wealth - 1,
      passiveReturn: (initialInvestor.cash + initialInvestor.holdings.reduce((sum, quantity, id) => sum
        + quantity * (market.securities[id].price + market.securities[id].totalDividends), 0)) / initialInvestor.wealth - 1,
      fees: investor.fees / initialInvestor.wealth, turnover: investor.turnover / initialInvestor.wealth,
      affordableStocks: initialInvestor.affordableStocks, affordableEtfs: initialInvestor.affordableEtfs,
      endCash: investor.cash, endHoldings: investor.holdings.reduce((sum, quantity) => sum + quantity, 0),
    },
    strategies: strategyReturns(market), index, checkpoints,
    sectors: Array.from({ length: 12 }, (_, industry) => {
      const stocks = market.securities.slice(industry * 20, industry * 20 + 20);
      return stocks.reduce((sum, s) => sum + s.price, 0) / stocks.reduce((sum, s) => sum + s.initialPrice, 0) - 1;
    }),
    checks: {
      conservation: true,
      executable: market.trades > 0,
      minuteMove: maxMinuteMove < 0.08,
      liquidity: staleSamples / Math.max(1, samples) < (scenario === 'thin' ? 0.55 : 0.25),
      etfTracking: quantile(premiums, 0.95) < 0.03,
      feeDrain: market.treasury / initialWealth / (minutes / 1440) < 0.02,
      performance: quantile(times, 0.95) < 100,
      runaway: Math.abs(finalCap / initialCap - 1) < (minutes > 1440 ? 1 : 0.35),
    },
  };
  console.log(`${phase} seed=${seed} ${scenario} ${minutes}m: index ${pct(result.metrics.indexReturn)}, fills ${pct(result.metrics.fillRate)}, stale ${pct(result.metrics.stale30m)}, ETF p95 ${pct(result.metrics.etfPremiumP95)}, tick p95 ${result.metrics.tickP95Ms.toFixed(2)}ms; checks ${Object.values(result.checks).filter(Boolean).length}/${Object.keys(result.checks).length}`);
  return result;
}

const candidates = [
  { name: 'balanced', parameters: DEFAULT_PARAMETERS },
  { name: 'patient', parameters: { ...DEFAULT_PARAMETERS, feeBps: 5, spreadBps: 30, orderFraction: 0.003, fundamentalWeight: 0.04 } },
  { name: 'active', parameters: { ...DEFAULT_PARAMETERS, feeBps: 8, spreadBps: 25, orderFraction: 0.008, fundamentalWeight: 0.04 } },
];
const training = [];
for (const candidate of candidates) for (const seed of smoke ? [11] : [11, 29])
  training.push({ candidate: candidate.name, ...run(seed, 'normal', candidate.parameters, smoke ? 120 : 720, 'train') });
const scores = candidates.map(candidate => {
  const runs = training.filter(r => r.candidate === candidate.name);
  const score = runs.reduce((sum, r) => sum + Object.values(r.checks).filter(v => !v).length * 100
    + r.metrics.stale30m * 10 + r.metrics.etfPremiumP95 * 10 + r.metrics.feesToInitialWealth * 20, 0) / runs.length;
  return { ...candidate, score };
}).sort((a, b) => a.score - b.score);
const selected = scores[0];
console.log(`Selected from training only: ${selected.name}`);
const holdout = [];
for (const scenario of ['normal', 'thin', 'boom', 'panic', 'concentration']) for (const seed of smoke ? [101] : [101, 202, 401, 502])
  holdout.push(run(seed, scenario, selected.parameters, smoke ? 250 : 1440, seed < 400 ? 'regression' : 'fresh-holdout'));
if (!smoke) for (const seed of [303, 603]) holdout.push(run(seed, 'normal', selected.parameters, 10080, seed < 400 ? 'long-regression' : 'long-holdout'));
const paired = [], wallets = [];
if (!smoke) {
  for (const seed of [701, 809]) for (const strategy of STRATEGIES.filter(s => s !== 'maker'))
    paired.push(run(seed, 'normal', selected.parameters, 720, 'equal-assets', { strategy }));
  for (const seed of [701, 809]) for (const coins of [100, 1000, 10000])
    wallets.push(run(seed, 'normal', selected.parameters, 720, 'small-wallet', { strategy: 'value', budget: coins * 100 }));
}
const failures = [...holdout, ...paired, ...wallets].flatMap(r => Object.entries(r.checks).filter(([, pass]) => !pass)
  .map(([check]) => ({ phase: r.phase, seed: r.seed, scenario: r.scenario, strategy: r.investor?.strategy, budget: r.investor?.initialCash, check })));
const winners = holdout.map(r => Object.entries(r.strategies).sort((a, b) => b[1] - a[1])[0][0]);
const report = { schemaVersion: 2, modelVersion: playable ? 'v2.2' : 'v2.1', generatedAt: new Date().toISOString(), mode: smoke ? 'smoke' : 'full',
  selected, scores, training, holdout, paired, wallets, failures, uniqueWinningStrategies: [...new Set(winners)],
  limitations: ['Aggregate NPC strategy returns use different initial portfolios; paired trials start with identical account assets per seed but affect their own market path.',
    'No real wallet transfers, player interface, persistent orders, offline progression or ETF rebalance yet.',
    'Minute-local orders; ETF arbitrage legs require real fills. Incomplete plans expire after 60 minutes and retain their actual inventory.',
    'Small-wallet trials add one funded calibration account. Starting cash is synthetic, not connected to user balances; ETF units may be unaffordable.',
    'Clock manipulation, persistence failures and duplicate commands require later main-process integration tests.'] };
await mkdir(directory, { recursive: true });
await writeFile(new URL('calibration.json', directory), `${JSON.stringify(report, null, 2)}\n`);
const rows = holdout.map(r => `| ${r.seed} | ${r.scenario} | ${r.minutes} | ${pct(r.metrics.indexReturn)} | ${pct(r.metrics.fillRate)} | ${pct(r.metrics.stale30m)} | ${pct(r.metrics.etfPremiumP95)} | ${pct(r.metrics.feesToInitialWealth)} | ${r.metrics.tickP95Ms.toFixed(2)} | ${Object.values(r.checks).filter(Boolean).length}/8 |`).join('\n');
const strategyRows = STRATEGIES.map(strategy => `| ${strategy} | ${holdout.map(r => pct(r.strategies[strategy])).join(' / ')} |`).join('\n');
const pairedRows = paired.map(r => `| ${r.seed} | ${r.investor.strategy} | ${pct(r.investor.return)} | ${pct(r.investor.passiveReturn)} | ${pct(r.investor.return - r.investor.passiveReturn)} | ${pct(r.investor.fees)} |`).join('\n');
const walletRows = wallets.map(r => `| ${r.seed} | ${r.investor.initialCash / 100} | ${r.investor.affordableStocks} | ${r.investor.affordableEtfs} | ${pct(r.investor.return)} | ${pct(r.investor.fees)} | ${r.investor.endHoldings} |`).join('\n');
await writeFile(new URL('calibration.md', directory), `# 狗牛市 ${report.modelVersion} 校准报告\n\n模式：${report.mode}。选定参数：${selected.name}；仅用训练种子选择，回归种子101/202/303、新留出种子401/502/603不再调参。原报告保留在上级目录。\n\n240 家公司、18 只 ETF、300 个NPC资金账户、12 种策略。时间为现实分钟的加速运行；经营随机序列独立于交易决策。\n\n${JSON.stringify(selected.parameters)}\n\n| 种子 | 场景 | 分钟 | 股价指数收益* | 委托数量成交率 | 超过30分钟未成交股票占比 | ETF绝对折溢价P95 | 手续费/初始财富 | 单步P95毫秒 | 检查 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\n*股价指数不含分红，账户策略收益包含现金分红。未成交占比为每半小时采样均值；成交率按买卖双方委托股数计算，不跨证券解释成交额。\n\n失败检查：${failures.length ? JSON.stringify(failures) : '无'}。策略最高收益类型：${report.uniqueWinningStrategies.join(', ')}。\n\n## 相同初始资产对照\n\n每个种子中替换同一个账户的交易策略，其余初始资产、个性、研究列表一致。各策略会影响自己的市场路径，不能当作同一条价格路径上的收益排名。不交易基线按该次运行的最终价格及累计分红计价；超额列为收益率之差。做市策略依赖专用库存/报价职责，未混入普通账户对照。\n\n| 种子 | 策略 | 主动收益 | 原持仓不交易收益 | 超额 | 手续费/初始财富 |\n|---|---|---:|---:|---:|---:|\n${pairedRows}\n\n## 普通钱包规模试验\n\n增加一个独立模拟价投账户，从纯现金开始，研究全部证券；其余300个NPC不变。每笔成交仍须有真实对手盘。未设置补贴或最低收益承诺。收益包含分红与手续费。\n\n| 种子 | 初始狗牛币 | 可买至少1股的公司数 | 可买至少1份的ETF数 | 收益 | 手续费/初始资产 | 期末总持有股/份数 |\n|---|---:|---:|---:|---:|---:|---:|\n${walletRows}\n\n## NPC策略资金加权收益\n\n初始持仓、现金比例不同，这不是控制变量的策略优劣排名。各列依主表顺序。\n\n| 策略 | 各场景收益 |\n|---|---|\n${strategyRows}\n\n## 口径与边界\n\n- 守恒：交易账户+ETF现金+手续费=初始市场现金+公司分红；公司现金=初始现金+经营现金变化-分红。股票包含ETF持有的底层股份。\n- 原目标保持：单分钟最大股价变化<8%；常态超过30分钟无成交占比<25%（低流动性<55%）；ETF绝对折溢价P95<3%；手续费损耗<初始财富2%/现实日；单步P95<100ms；单日指数绝对变化<35%，七日<100%。这些是待体验校验的游戏阈值。\n- ${report.limitations.join('\n- ')}\n- 本轮不连接真实狗牛币，无法据此认定奖励经济平衡或可发布。\n`);
console.log(`Report: ${directory.pathname}calibration.md; holdout failures: ${failures.length}`);
if (failures.length) process.exitCode = 2;
