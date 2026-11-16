import { useEffect, useRef, useState } from 'react';
import type { PokerRequest, PokerView } from '../../../../../shared/poker';
import { Chip, chipValues } from './Chips';
export function ExchangeDialog({ view, busy, unresolved, expired, error, send, close }: {
    view: PokerView;
    busy: boolean;
    unresolved: boolean;
    expired: boolean;
    error: string;
    send(request: PokerRequest | { action: 'dismissExchange' }): Promise<void>;
    close(): void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [direction, setDirection] = useState<'exchangeCoins' | 'exchangeChips'>('exchangeCoins');
    const [input, setInput] = useState('10');
    const quantity = Number(input);
    const coinsToChips = direction === 'exchangeCoins';
    const available = coinsToChips ? view.balance : view.reserve;
    const valid = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= available && (coinsToChips || quantity % 100 === 0) && Number.isSafeInteger(quantity * (coinsToChips ? 100 : 1));
    useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
    const switchDirection = () => { setDirection(coinsToChips ? 'exchangeChips' : 'exchangeCoins'); setInput(coinsToChips ? '1000' : '10'); };
    return <dialog ref={dialog} className="pk-exchange" aria-labelledby="pk-exchange-title" onCancel={e => { e.preventDefault(); if (!busy && !view.pending && !unresolved)
        close(); }}>
    <header><div><small>DOGCOW CASHIER</small><h2 id="pk-exchange-title">筹码兑换</h2></div><button autoFocus disabled={busy || view.pending || unresolved} onClick={close} aria-label="关闭兑换窗口">✕</button></header>
    <div className="pk-exchange-balances"><span>狗牛币<strong>◈ {view.balance.toLocaleString()}</strong></span><span>可用筹码<strong>{view.reserve.toLocaleString()}</strong></span></div>
    <div className="pk-exchange-direction"><b>{coinsToChips ? '狗牛币 → 筹码' : '筹码 → 狗牛币'}</b><button disabled={busy || view.pending || unresolved} onClick={switchDirection}>⇄ 切换</button></div>
    <label className="pk-number-label">{coinsToChips ? '支付狗牛币' : '支付筹码'}<input type="number" min={coinsToChips ? 1 : 100} step={coinsToChips ? 1 : 100} value={input} disabled={busy || view.pending || unresolved} onChange={e => setInput(e.target.value)}/></label>
    <div className="pk-exchange-quick">{(coinsToChips ? [1, 10, 50] : [100, 1000, 5000]).map(n => <button key={n} disabled={busy || view.pending || unresolved || available < n} onClick={() => setInput(String(n))}>{n.toLocaleString()}</button>)}<button disabled={busy || view.pending || unresolved} onClick={() => setInput(String(coinsToChips ? available : Math.floor(available / 100) * 100))}>全部</button></div>
    <div className="pk-exchange-receipt"><small>到账 {coinsToChips ? '筹码' : '狗牛币'}</small><strong>{valid ? (coinsToChips ? quantity * 100 : quantity / 100).toLocaleString() : '—'}</strong><small>1 狗牛币 = 100 筹码</small></div>
    {error && <p className="pk-dialog-error" role="alert">{error}</p>}
    {unresolved ? <button className="pk-primary" disabled={busy} onClick={() => void send({ action: expired ? 'dismissExchange' : 'retry' })}>{expired ? '已核对余额，结束本次操作' : '核对原兑换'}</button> : view.pending ? <button className="pk-primary" disabled={busy} onClick={() => void send({ action: 'retry' })}>重试保存</button> : <button className="pk-primary" disabled={busy || !valid} onClick={() => void send({ action: direction, amount: quantity })}>{busy ? '正在兑换…' : '确认兑换'}</button>}
    <small className="pk-exchange-note">{quantity > available ? '可用余额不足' : !coinsToChips && quantity % 100 ? '按 100 筹码的整数倍兑换，零头保留' : view.table ? '桌上筹码在离桌后返还至可用余额' : '兑换完成后，可使用筹码入席'}</small>
    <div className="pk-chip-legend">{[...chipValues].reverse().map(value => <Chip key={value} value={value}/>)}</div>
  </dialog>;
}
