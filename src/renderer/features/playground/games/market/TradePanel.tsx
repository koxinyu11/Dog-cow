import { useEffect, useState } from 'react';
import type { ListedSecurity, MarketAction, MarketView } from '../../../../../shared/market/game';
export const money = (cents: number) => (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const percentage = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
export function TradePanel({ asset, view, disabled, send }: { asset: ListedSecurity; view: MarketView; disabled: boolean; send(action: MarketAction): Promise<boolean> }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy'), [type, setType] = useState<'market' | 'limit'>('market');
  const [quantity, setQuantity] = useState('1'), [limit, setLimit] = useState('');
  useEffect(() => { setQuantity('1'); setLimit((asset.price / 100).toFixed(2)); }, [asset.id]);
  const shares = Number(quantity), limitCents = /^\d+(\.\d{1,2})?$/.test(limit) ? Math.round(Number(limit) * 100) : 0;
  const band = asset.kind === 'etf' ? 0.01 : 0.035;
  const price = type === 'limit' ? limitCents : Math.max(1, Math.round((asset.nav ?? asset.price) * (1 + (side === 'buy' ? band : -band))));
  const perShare = price + Math.ceil(price * view.feeBps / 10000);
  const position = view.positions.find(p => p.security === asset.id);
  const maximum = side === 'buy' ? Math.min(1000000, Math.floor(view.available / Math.max(1, perShare))) : position?.available ?? 0;
  const valid = Number.isSafeInteger(shares) && shares > 0 && shares <= maximum && price > 0;
  return <form className="mk-trade" onSubmit={event => { event.preventDefault(); if (valid) void send({ action: 'order', security: asset.id, side, type, quantity: shares, ...(type === 'limit' ? { price } : {}) }); }}>
    <div className="mk-trade-heading"><h3>交易委托</h3><span>手续费 {view.feeBps / 100}%</span></div>
    <div className="mk-segment"><button type="button" aria-pressed={side === 'buy'} className="mk-buy" onClick={() => setSide('buy')}>买入</button><button type="button" aria-pressed={side === 'sell'} className="mk-sell" onClick={() => setSide('sell')}>卖出</button></div>
    <label>委托方式<select value={type} onChange={e => setType(e.target.value as 'market' | 'limit')}><option value="market">市价 · 下一轮撮合</option><option value="limit">限价 · 持续等待</option></select></label>
    {type === 'limit' && <label>限价 / 狗牛币<input aria-label="委托限价" inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value)} /></label>}
    <label>数量 / {asset.kind === 'etf' ? '份' : '股'}<div className="mk-input-action"><input aria-label="委托数量" type="number" min="1" max="1000000" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} /><button type="button" disabled={maximum < 1} onClick={() => setQuantity(String(maximum))}>最大</button></div></label>
    <div className="mk-trade-estimate"><span>{side === 'buy' ? '最多预留' : '预计成交额'}</span><strong>{money((side === 'buy' ? perShare : price) * (Number.isFinite(shares) ? Math.max(0, shares) : 0))}<small> 币</small></strong></div>
    <small className="mk-muted">{side === 'buy' ? `可用 ${money(view.available)} 币` : `可卖 ${maximum} ${asset.kind === 'etf' ? '份' : '股'}`}</small>
    <button className={`mk-submit ${side}`} disabled={disabled || !valid} type="submit">{disabled ? '暂不可提交' : `${side === 'buy' ? '买入' : '卖出'}委托`}</button>
    <small className="mk-muted">{type === 'market' ? '市价有成交保护，下一轮未成交部分自动撤销。' : '限价委托持续有效，可随时撤销。'} 成交可能亏损。</small>
  </form>;
}
