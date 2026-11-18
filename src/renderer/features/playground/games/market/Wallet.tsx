import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { MarketAction, MarketView } from '../../../../../shared/market/game';
import { money } from './TradePanel';
export function MarketWallet({ view, disabled, send, close }: { view: MarketView; disabled: boolean; send(action: MarketAction): Promise<boolean>; close(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [direction, setDirection] = useState<'deposit' | 'withdraw'>('deposit'), [amount, setAmount] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const maximum = direction === 'deposit' ? view.wallet : Math.floor(view.available / 100);
  const value = Number(amount), valid = Number.isSafeInteger(value) && value > 0 && value <= maximum;
  return <dialog className="mk-wallet" ref={dialog} onCancel={close} aria-labelledby="mk-wallet-title">
    <form onSubmit={e => { e.preventDefault(); if (valid) void send({ action: direction, amount: value }).then(ok => { if (ok) close(); }); }}>
      <header><div><small>DOGCOW SECURITIES</small><h2 id="mk-wallet-title">证券资金</h2></div><button type="button" aria-label="关闭资金窗口" onClick={close}><X size={18} /></button></header>
      <div className="mk-wallet-balances"><div><span>狗牛钱包</span><strong>{view.wallet.toLocaleString()}<small> 币</small></strong></div><div><span>证券可用</span><strong>{money(view.available)}<small> 币</small></strong></div></div>
      <div className="mk-segment"><button type="button" aria-pressed={direction === 'deposit'} onClick={() => setDirection('deposit')}>转入证券</button><button type="button" aria-pressed={direction === 'withdraw'} onClick={() => setDirection('withdraw')}>转回钱包</button></div>
      <label>狗牛币 / 整数<div className="mk-input-action"><input autoFocus type="number" min="1" step="1" max={maximum} value={amount} onChange={e => setAmount(e.target.value)} /><button type="button" onClick={() => setAmount(String(maximum))}>全部</button></div></label>
      {(view.walletError || maximum === 0) && <p className="mk-muted">{view.walletError || (direction === 'deposit' ? '钱包暂无狗牛币。可在主窗口兑换，或出售钓鱼收获。' : '暂无可转出的整币，已预留的资金需先撤单。')}</p>}
      <button type="submit" className="mk-submit" disabled={disabled || !!view.walletError || !valid}>{direction === 'deposit' ? '确认转入' : '确认转出'}</button>
      <small className="mk-muted">使用真实狗牛币；转出仅支持整币，零头保留在证券账户。</small>
    </form>
  </dialog>;
}
