import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Search, Star, Wallet, TrendingUp, RefreshCw, X } from 'lucide-react';
import { INDUSTRIES } from '../../../../../shared/market/model';
import type { GameProps } from '../../registry';
import { MarketChart } from './Chart';
import { AnalysisChart } from './AnalysisChart';
import { TradePanel, money, percentage } from './TradePanel';
import { MarketWallet } from './Wallet';
import { useMarket } from './useMarket';
import './market.css';
const strategyNames: Record<string, string> = { value: '价值投资', growth: '成长投资', dividend: '红利资金', turnaround: '困境反转', trend: '趋势量化',
  reversion: '均值回归', factor: '多因子量化', rotation: '行业轮动', event: '事件驱动', speculator: '游资大户', maker: '做市资金', sentiment: '情绪散户' };
const compactMoney = (cents: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100);
export default function MarketGame(props: GameProps) {
  const [selected, setSelected] = useState(240), [tab, setTab] = useState<'market' | 'watch' | 'positions'>('market');
  const game = useMarket(props, selected), view = game.view;
  const [search, setSearch] = useState(''), [industry, setIndustry] = useState('all'), [sort, setSort] = useState('code');
  const [detail, setDetail] = useState<'chart' | 'facts' | 'news'>('chart'), [wallet, setWallet] = useState(false), [remaining, setRemaining] = useState(60000);
  const [log, setLog] = useState<'orders' | 'fills'>('orders'), [notice, setNotice] = useState('');
  useEffect(() => { if (view) setRemaining(view.nextTickMs); }, [view]);
  useEffect(() => { const timer = setInterval(() => setRemaining(value => Math.max(0, value - 1000)), 1000); return () => clearInterval(timer); }, []);
  const assets = useMemo(() => {
    if (!view) return [];
    return view.securities.filter(asset => (tab !== 'watch' || view.watchlist.includes(asset.id))
      && (tab !== 'positions' || view.positions.some(p => p.security === asset.id))
      && (industry === 'all' || (industry === 'etf' ? asset.kind === 'etf' : asset.kind === 'stock' && asset.industry === Number(industry)))
      && `${asset.name}${asset.code}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => sort === 'up' ? b.change - a.change : sort === 'down' ? a.change - b.change : a.id - b.id);
  }, [view, tab, search, industry, sort]);
  const send: typeof game.send = async action => {
    const ok = await game.send(action);
    if (ok && action.action !== 'view') setNotice(action.action === 'order' ? '委托已提交，等待下一轮撮合。' : action.action === 'cancel' ? '委托已撤销，预留资产已释放。' : action.action === 'watch' ? '' : '资金划转已保存。');
    return ok;
  };
  const disabled = game.disabled || props.paused;
  if (!view) return <div className="mk-app mk-loading"><TrendingUp size={34} /><h2>{game.busy ? '狗牛市正在开市…' : '狗牛市暂未载入'}</h2>
    <p>240 家公司 · 18 只 ETF · 300 个 NPC 资金账户</p>{game.error && <div role="alert">{game.error}<button onClick={() => void game.retry()}>重新载入</button></div>}</div>;
  const asset = view.securities[selected], position = view.positions.find(p => p.security === selected);
  const facts = asset.facts, annualEps = facts.profit * 4 / asset.supply;
  const profit = view.realized + view.unrealized + view.dividends;
  return <div className="mk-app" aria-busy={game.busy}>
    <header className="mk-masthead"><div><div className="mk-kicker"><span className="mk-live-dot" /> DOGCOW EXCHANGE</div><h1>狗牛市<span>DCX</span></h1></div>
      <div className="mk-session"><span>第 {Math.floor(view.minute / 240) + 1} 游戏季</span><strong>{remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : '撮合中'}</strong><small>下一轮行情</small></div>
      <button className="mk-wallet-button" onClick={() => setWallet(true)}><Wallet size={16} /> 转入 / 转出</button></header>
    {(game.error || game.uncertain) && <div className="mk-error" role="alert"><div>{game.error || '有一笔操作等待确认，请先核对原操作。'}{game.correlation && <small>问题编号 {game.correlation}</small>}</div><button disabled={game.busy} onClick={() => void game.retry()}><RefreshCw size={13} />{view.pending ? '重试保存' : '核对 / 重试'}</button></div>}
    <section className="mk-account" aria-label="证券资产"><div><span>证券总资产 / 币</span><strong>{money(view.equity)}</strong></div><div><span>可用资金</span><strong>{money(view.available)}</strong></div><div><span>持仓市值</span><strong>{money(view.positions.reduce((sum, p) => sum + p.value, 0))}</strong></div><div><span>累计盈亏 · 含分红</span><strong className={profit >= 0 ? 'mk-up' : 'mk-down'}>{profit > 0 ? '+' : ''}{money(profit)}</strong></div></section>
    {notice && <div className="mk-notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}><X size={12} /></button></div>}
    <div className="mk-workspace">
      <section className="mk-market-panel">
        <nav className="mk-tabs" aria-label="证券列表"><button aria-current={tab === 'market' ? 'page' : undefined} onClick={() => setTab('market')}>市场 <small>258</small></button><button aria-current={tab === 'watch' ? 'page' : undefined} onClick={() => setTab('watch')}>自选 <small>{view.watchlist.length}</small></button><button aria-current={tab === 'positions' ? 'page' : undefined} onClick={() => setTab('positions')}>持仓 <small>{view.positions.length}</small></button></nav>
        <div className="mk-filters"><label className="mk-search"><Search size={14} /><input aria-label="搜索公司或代码" placeholder="公司 / 代码" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="行业筛选" value={industry} onChange={e => setIndustry(e.target.value)}><option value="all">全部证券</option><option value="etf">ETF 基金</option>{INDUSTRIES.map((name, i) => <option key={name} value={i}>{name}</option>)}</select><select aria-label="证券排序" value={sort} onChange={e => setSort(e.target.value)}><option value="code">代码排序</option><option value="up">涨幅优先</option><option value="down">跌幅优先</option></select></div>
        <div className="mk-list-caption"><span>{assets.length} 只证券</span><span>涨跌较首次开市</span></div>
        <div className="mk-security-list" aria-label="证券行情">
          {assets.map(item => {
            const held = view.positions.find(p => p.security === item.id);
            return <button key={item.id} className={`mk-security ${selected === item.id ? 'is-selected' : ''}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
              <div className="mk-security-name"><strong>{item.name}</strong><span>{item.code} {item.kind === 'etf' ? '· ETF' : `· ${INDUSTRIES[item.industry]}`}{held ? ` · ${held.quantity}${item.kind === 'etf' ? '份' : '股'}` : ''}</span></div>
              <div className="mk-mini-chart"><MarketChart values={item.history.slice(-48)} compact positive={item.change >= 0} /></div>
              <div className={`mk-security-price ${item.change >= 0 ? 'mk-up' : 'mk-down'}`}><strong>{money(item.price)}</strong><span>{percentage(item.change)}</span></div>
            </button>;
          })}
          {!assets.length && <div className="mk-empty">{tab === 'positions' ? <><Wallet size={24} /><strong>还没有持仓</strong><button onClick={() => setWallet(true)}>转入狗牛币</button></> : tab === 'watch' ? '点证券旁的星标，加入自选。' : '没有匹配的证券'}</div>}
        </div>
      </section>
      <section className="mk-detail-panel">
        <header className="mk-security-heading"><div><span className="mk-kicker">{asset.code} / {asset.kind === 'etf' ? 'EXCHANGE TRADED FUND' : INDUSTRIES[asset.industry]}</span><h2>{asset.name}<button aria-label={view.watchlist.includes(selected) ? '取消自选' : '加入自选'} disabled={disabled} aria-pressed={view.watchlist.includes(selected)} onClick={() => void send({ action: 'watch', security: selected })}><Star size={18} fill={view.watchlist.includes(selected) ? 'currentColor' : 'none'} /></button></h2></div><div className={asset.change >= 0 ? 'mk-up' : 'mk-down'}><strong>{money(asset.price)}</strong><span>{percentage(asset.change)}</span></div></header>
        <nav className="mk-detail-tabs" aria-label="证券详情">{(['chart','facts','news'] as const).map(key => <button key={key} aria-current={detail === key ? 'page' : undefined} onClick={() => setDetail(key)}>{key === 'chart' ? '走势' : key === 'facts' ? '基本面' : '消息'}</button>)}</nav>
        <div className="mk-security-body">
          {detail === 'chart' && <><AnalysisChart asset={asset} minute={view.minute} /><div className="mk-quote-strip"><div><span>本轮成交量</span><b>{asset.volume.toLocaleString()}</b></div><div><span>最近成交</span><b>{asset.lastTrade < 0 ? '暂无成交' : `${Math.max(0, view.minute - asset.lastTrade)} 分钟前`}</b></div>{asset.nav !== undefined && <div><span>参考净值 / 币</span><b>{money(asset.nav)}</b></div>}</div></>}
          {detail === 'facts' && <div className="mk-facts"><div><span>{asset.kind === 'etf' ? '成分股' : '季度营收'}</span><strong>{asset.members ?? compactMoney(facts.revenue)}{asset.members ? ' 家' : ' 币'}</strong></div><div><span>季度净利润</span><strong>{compactMoney(facts.profit)} 币</strong></div><div><span>营收增长</span><strong className={facts.growth >= 0 ? 'mk-up' : 'mk-down'}>{percentage(facts.growth)}</strong></div><div><span>现金 / 负债</span><strong>{compactMoney(facts.cash)} / {compactMoney(facts.debt)}</strong></div><div><span>竞争力</span><strong>{Math.round(facts.quality * 100)}<small> / 100</small></strong></div><div><span>市盈率 · 年化</span><strong>{annualEps > 0 ? (asset.price / annualEps).toFixed(1) : '亏损'}</strong></div><div><span>最近每股 / 份分红</span><strong>{money(facts.dividend)} 币</strong></div>{asset.nav !== undefined && <div><span>折溢价</span><strong>{percentage(asset.price / asset.nav - 1)}</strong></div>}<small className="mk-muted">仅显示已披露数据；每 4 小时为一个游戏财报季度。企业经营每半小时推进。</small></div>}
          {detail === 'news' && <div className="mk-news">{view.news.filter(n => n.industry < 0 || n.industry === asset.industry || asset.kind === 'etf' && asset.industry < 0).map((news, i) => <article key={`${news.minute}-${i}`}><time>第 {news.minute} 分钟</time><strong>{news.title}</strong><span>{news.industry < 0 ? '全市场' : INDUSTRIES[news.industry]}</span></article>)}{!view.news.some(n => n.industry < 0 || n.industry === asset.industry || asset.kind === 'etf' && asset.industry < 0) && <p className="mk-muted">当前暂无相关新消息。</p>}</div>}
          <TradePanel key={selected} asset={asset} view={view} disabled={disabled} send={send} />
        </div>
        {position && <div className="mk-position-strip"><span>持有 <b>{position.quantity} {asset.kind === 'etf' ? '份' : '股'}</b></span><span>含手续费成本 <b>{money(position.cost)} 币</b></span><span className={position.value >= position.cost ? 'mk-up' : 'mk-down'}>浮动盈亏 <b>{money(position.value - position.cost)}</b></span></div>}
        <section className="mk-ledger"><header><div className="mk-tabs"><button aria-current={log === 'orders' ? 'page' : undefined} onClick={() => setLog('orders')}>当前委托 <small>{view.orders.length}</small></button><button aria-current={log === 'fills' ? 'page' : undefined} onClick={() => setLog('fills')}>成交记录</button></div><span>预留 {money(view.reserved)} 币</span></header>
          <div className="mk-ledger-rows">{log === 'orders' ? view.orders.map(order => <div key={order.id}><span className={order.side === 'buy' ? 'mk-up' : 'mk-down'}>{order.side === 'buy' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}{order.side === 'buy' ? '买' : '卖'}</span><button className="mk-text-link" onClick={() => setSelected(order.security)}>{view.securities[order.security].name}</button><span>{order.type === 'market' ? '市价' : money(order.price)}</span><span>待成交 {order.remaining}</span><button disabled={disabled} onClick={() => void send({ action: 'cancel', orderId: order.id })}>撤单</button></div>)
            : view.fills.slice(0, 20).map((fill, i) => <div key={`${fill.id}-${i}`}><span className={fill.side === 'buy' ? 'mk-up' : 'mk-down'}>{fill.side === 'buy' ? '买' : '卖'}</span><button className="mk-text-link" onClick={() => setSelected(fill.security)}>{view.securities[fill.security].name}</button><span>{money(fill.price)} × {fill.quantity}</span><span>费用 {money(fill.fee)}</span><small>{fill.minute} 分</small></div>)}
            {!(log === 'orders' ? view.orders.length : view.fills.length) && <p className="mk-muted">{log === 'orders' ? '暂无待成交委托' : '暂无成交记录'}</p>}</div>
        </section>
        <details className="mk-participants"><summary>市场参与者 <span>300 个 NPC 资金账户 · 12 种策略</span></summary><div>{view.participants.map(p => <section key={p.strategy}><strong>{strategyNames[p.strategy]}</strong><span>{p.accounts} 个账户</span><small>资产 {compactMoney(p.value)} 币</small></section>)}</div></details>
        <footer className="mk-footer">应用运行时行情每分钟推进 · 退出休市 · 游戏内股票与 ETF 均为虚构资产</footer>
      </section>
    </div>
    {wallet && <MarketWallet view={view} disabled={disabled} send={send} close={() => setWallet(false)} />}
  </div>;
}
