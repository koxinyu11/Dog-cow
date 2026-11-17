import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../../registry';
import type { PokerRequest, PokerView } from '../../../../../shared/poker';
import { handName, legal, pot, rank, suit, type Card } from '../../../../../shared/poker/engine';
import { PokerExchangeClient } from '../../../../../shared/poker-exchange';
import { ChipStack } from './Chips';
import { ExchangeDialog } from './ExchangeDialog';
import { WinCelebration } from './WinCelebration';
import { useSettlement } from './useSettlement';
import './poker.css';
const symbols = ['♣', '♦', '♥', '♠'];
function PlayingCard({ card, small = false, winning = false }: {
    card?: Card;
    small?: boolean;
    winning?: boolean;
}) { return <span className={`pk-card ${small ? 'is-small' : ''} ${winning ? 'is-winning' : ''} ${card === undefined ? 'is-back' : suit(card) === 1 || suit(card) === 2 ? 'is-red' : ''}`}>{card === undefined ? <i>✦</i> : <><b>{['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'][rank(card)]}<small>{symbols[suit(card)]}</small></b><em>{symbols[suit(card)]}</em></>}</span>; }
export default function PokerGame({ paused, onActivity }: GameProps) {
    const [unresolvedExchange, setUnresolvedExchange] = useState(false);
    const [exchangeExpired, setExchangeExpired] = useState(false);
    const exchangeClient = useMemo(() => new PokerExchangeClient({
        getItem: key => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
        removeItem: key => window.localStorage.removeItem(key),
    }, request => window.playground.poker(request)), []);
    const [exchange, setExchange] = useState(false);
    const [buyIn, setBuyIn] = useState('1000');
    const [revealed, setRevealed] = useState(0);
    const [view, setView] = useState<PokerView>();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [amount, setAmount] = useState(20);
    const [help, setHelp] = useState(false);
    const live = useRef(true);
    const pending = useRef(false);
    const send = useCallback(async (request: PokerRequest | { action: 'dismissExchange' }) => {
        if (pending.current)
            return;
        pending.current = true;
        setBusy(true);
        setError('');
        try {
            const result = request.action === 'dismissExchange' ? await exchangeClient.dismissExpired()
                : request.action === 'exchangeCoins' || request.action === 'exchangeChips' ? await exchangeClient.submit(request.action, request.amount!)
                : exchangeClient.pending() ? await exchangeClient.reconcile(request.action === 'retry')
                : await window.playground.poker({ ...request, requestId: request.requestId ?? crypto.randomUUID() });
            if (live.current) setExchangeExpired(result.exchangeStatus === 'expired');
            if (!live.current)
                return;
            if (result.view)
                setView(result.view);
            if (result.error)
                setError(result.error);
        }
        catch {
            if (live.current)
                setError('本次结果尚未核对，请重试查询；不会另建兑换操作。');
        }
        finally {
            pending.current = false;
            if (live.current) {
                setBusy(false);
                try {
                    const unresolved = !!exchangeClient.pending();
                    setUnresolvedExchange(unresolved);
                    if (unresolved) setExchange(true);
                } catch { setUnresolvedExchange(true); }
            }
        }
    }, [exchangeClient]);
    useEffect(() => { live.current = true; void send({ action: 'view' }); return () => { live.current = false; }; }, [send]);
    const t = view?.table, l = t ? legal(t) : null;
    const mine = t?.seats[0];
    const settlement = useSettlement(t, paused || exchange, !!t && revealed >= t.board.length);
    const readyToLeave = !!t?.done && settlement.complete && revealed >= t.board.length;
    const entryAmount = Number(buyIn);
    const validEntry = Number.isSafeInteger(entryAmount) && entryAmount >= 1000 && entryAmount <= (view?.reserve ?? 0);
    const highlighted = t?.settlement?.winningCards.filter((_, i) => settlement.active ? !settlement.active.refund && settlement.active.recipients.some(r => r.seat === i) : settlement.finished && t.settlement!.awards.some(a => !a.refund && a.recipients.some(r => r.seat === i))).flat() ?? [];
    useEffect(() => {
        if (readyToLeave && view?.leaving && !busy && !error && !view.pending && !exchange && !paused)
            void send({ action: 'leave' });
    }, [readyToLeave, view?.leaving, busy, error, view?.pending, exchange, paused, send]);
    useEffect(() => {
        onActivity?.(!view || error || view.pending || unresolvedExchange ? 'blocked'
          : t && !exchange && !help && ((!t.done && t.turn !== 0) || (t.done && !settlement.complete)) ? 'progressing' : 'decision');
        return () => onActivity?.('blocked');
    }, [onActivity, !!view, error, view?.pending, unresolvedExchange, t?.id, t?.revision, exchange, help, settlement.complete]);
    const yours = !!t && !t.done && t.turn === 0;
    useEffect(() => {
        if (l)
            setAmount(Math.min(l.max, l.min));
    }, [t?.id, t?.revision]);
    useEffect(() => {
        if (paused || exchange || busy || error || view?.pending || !t || t.done || t.turn === 0)
            return;
        const timer = setTimeout(() => void send({ action: 'bot', tableId: t.id, revision: t.revision }), 650 + Math.random() * 650);
        return () => clearTimeout(timer);
    }, [paused, exchange, busy, error, view?.pending, t?.id, t?.revision, send]);
    useEffect(() => {
        if (!t) {
            setRevealed(0);
            return;
        }
        setRevealed(0);
    }, [t?.id]);
    useEffect(() => {
        if (paused || exchange || !t || revealed >= t.board.length)
            return;
        const timer = setTimeout(() => setRevealed(n => n + 1), 180);
        return () => clearTimeout(timer);
    }, [paused, exchange, t?.id, t?.board.length, revealed]);
    const move = (action: PokerRequest['move'], total?: number) => void send({ action: 'act', move: action, total, tableId: t?.id, revision: t?.revision });
    return <div className={`pk-root ${t ? 'is-at-table' : 'is-entry'}`}>
   <header className="pk-top"><span className="pk-brand">DOGCOW <i>POKER CLUB</i></span><div>
     <span className="pk-header-chips"><ChipStack amount={view?.reserve ?? 0}/><small>可用筹码</small></span>
     <button onClick={() => { setHelp(false); setExchange(true); }} disabled={!view || busy}>兑换</button>
     <button onClick={() => setHelp(!help)} aria-expanded={help}>规则</button>
     {t && <button disabled={busy || view?.pending || view?.leaving || (t.done && !readyToLeave)} onClick={() => void send({ action: 'leave' })}>{view?.leaving ? '本手后离桌' : '离桌'}</button>}
   </div></header>
   {help && <aside className="pk-help"><button onClick={() => setHelp(false)}>关闭</button>五人无限注德州 · 小盲 5 / 大盲 10。用两张底牌与五张公共牌组成最佳五张牌。先兑换筹码，再选择筹码入席；离桌返还筹码，可在兑换窗口换回狗牛币。关窗后可续局。电脑仅使用自己的牌与公开信息。<br />牌型：高牌 → 一对 → 两对 → 三条 → 顺子 → 同花 → 葫芦 → 四条 → 同花顺。</aside>}
   {error && !exchange && <div className="pk-error" role="alert">{error}<button disabled={busy} onClick={() => void send({ action: view?.pending ? 'retry' : 'view' })}>{view?.pending ? '重试保存' : '重试'}</button></div>}
   {exchange && view && <ExchangeDialog view={view} busy={busy} unresolved={unresolvedExchange} expired={exchangeExpired} error={error} send={send} close={() => setExchange(false)}/>}
   {!t ? <div className="pk-entry">
     <section className="pk-entry-identity">
       <div className="pk-entry-art" aria-hidden="true"><PlayingCard card={51}/><PlayingCard card={38}/></div>
       <h1>工位德州</h1><span className="pk-entry-blinds">五人桌 <i/> 盲注 5 / 10</span>
       {view?.lastSession && <div className="pk-session"><span>上次带入<b>{view.lastSession.brought.toLocaleString()}</b></span><span>带出<b>{view.lastSession.returned.toLocaleString()}</b></span><span>净赢<b className={view.lastSession.returned >= view.lastSession.brought ? 'is-positive' : ''}>{view.lastSession.returned >= view.lastSession.brought ? '+' : ''}{(view.lastSession.returned - view.lastSession.brought).toLocaleString()}</b></span></div>}
     </section>
     <section className="pk-entry-form">
       <label className="pk-number-label">带入筹码 <small>1,000 起</small><input aria-label="带入筹码" type="number" min="1000" step="1000" value={buyIn} disabled={busy || view?.pending} onChange={e => setBuyIn(e.target.value)}/></label>
       <div className="pk-exchange-quick">{[1000, 2000, 5000].map(n => <button key={n} disabled={busy || (view?.reserve ?? 0) < n} onClick={() => setBuyIn(String(n))}>{n.toLocaleString()}</button>)}</div>
       <button className="pk-primary" disabled={!view || busy || view.pending || !validEntry} onClick={() => void send({ action: 'join', amount: entryAmount })}>入席</button>
       <span className="pk-entry-feedback" role="status">{view && entryAmount > view.reserve ? '筹码不足，可在右上角兑换' : !validEntry ? '请输入至少 1,000 筹码' : '\u00a0'}</span>
     </section>
   </div> : <>
   <main className="pk-room">{settlement.celebrating && <WinCelebration amount={settlement.winAmount} paused={paused || exchange}/>}<div className={`pk-table ${paused || exchange ? 'is-animation-paused' : ''}`}>
     <div className="pk-felt-word">DOGCOW SOCIAL CLUB</div>
     <div className={`pk-dealer ${busy ? 'is-dealing' : ''}`}><span className="pk-dealer-figure">♠</span><small>荷官</small><div className="pk-deck"><PlayingCard small/><PlayingCard small/></div></div>
     <div className="pk-center">
       <div className="pk-pot"><small>{t.done ? '待分配筹码' : '底池'}</small><ChipStack amount={t.done && t.settlement ? t.settlement.awards.slice(settlement.paid).reduce((sum, a) => sum + a.amount, 0) : pot(t)}/></div>
       <div className="pk-community">{Array.from({ length: 5 }, (_, i) => (t.board[i] === undefined || i >= revealed) ? <span className="pk-card-slot" key={i}/> : <PlayingCard key={`${t.id}-${t.board[i]}`} card={t.board[i]} winning={t.done && highlighted.includes(t.board[i])}/>)}</div>
       <div className="pk-status" aria-live="polite">{t.done ? settlement.active ? `${settlement.active.label} · ${settlement.active.recipients.map(r => `${t.seats[r.seat].name} +${r.amount}`).join(' / ')}` : t.message : ['翻牌前', '翻牌', '转牌', '河牌'][t.street]}</div>
     </div>
     {t.done && t.settlement && revealed >= t.board.length && settlement.active?.recipients.map(r => {
                const targets = [[50, 103], [0, 77], [13, 0], [87, 0], [100, 77]];
                return <div key={`${settlement.paid}-${r.seat}`} aria-hidden="true" className="pk-payout-flight" style={{ '--target-x': `${targets[r.seat][0]}%`, '--target-y': `${targets[r.seat][1]}%` } as CSSProperties}><ChipStack amount={r.amount}/></div>;
            })}
     {t.seats.map((seat, i) => <section key={i} className={`pk-seat pk-seat-${i} ${t.turn === i ? 'is-active' : ''} ${seat.folded ? 'is-folded' : ''} ${t.done && t.settlement?.awards.some(a => !a.refund && a.recipients.some(r => r.seat === i)) ? 'is-winner' : ''}`}>
       <div className="pk-seat-meta"><span className={`pk-avatar pk-avatar-${i}`}>{['你', '稳', '牛', '慢', '灵'][i]}</span><div><b>{seat.name}</b><strong>{(t.done && t.settlement ? t.settlement.balancesBefore[i] + (settlement.credited[i] ?? 0) : seat.chips).toLocaleString()}</strong></div>{seat.lastAction === '小盲' && <span className="pk-position" title="小盲">SB</span>}{seat.lastAction === '大盲' && <span className="pk-position" title="大盲">BB</span>}{t.dealer === i && <span className="pk-position" title="庄家">D</span>}</div>
       <div className="pk-hole">{seat.hand.length ? seat.hand.map(c => <PlayingCard key={c} card={c} small={i !== 0} winning={t.done && highlighted.includes(c)}/>) : <><PlayingCard small/><PlayingCard small/></>}</div>
       <span className="pk-seat-action">{t.done && t.settlement?.awards.some(a => !a.refund && a.recipients.some(r => r.seat === i)) ? `赢家 · ${t.settlement.handNames[i]}` : seat.lastAction || (['', '谨慎稳健', '喜欢施压', '爱看下一张', '伺机而动'][i])}</span>
       {seat.bet > 0 && <div className="pk-bet"><ChipStack amount={seat.bet}/></div>}
       {t.done && (settlement.credited[i] ?? 0) > 0 && <span className="pk-seat-gain">获得 +{settlement.credited[i].toLocaleString()}</span>}
     </section>)}
   </div></main>
   <footer className="pk-controls">
     <div className="pk-hand-summary"><small>{t.done ? '本手已结束' : yours ? '轮到你了' : `${t.seats[t.turn]?.name ?? '荷官'}思考中`}</small><b>{mine && t.board.length >= 3 ? handName([...mine.hand, ...t.board]) : '两张底牌，无限可能'}</b></div>
     {t.done ? !readyToLeave ? <button disabled={busy || view.pending} onClick={() => { setRevealed(t.board.length); settlement.skip(); }}>跳过动画</button> : <button className="pk-primary" disabled={busy || view.pending} onClick={() => void send({ action: mine?.chips && !view.leaving ? 'next' : 'leave' })}>{mine?.chips && !view.leaving ? '下一手' : '离桌返还筹码'}</button> : <div className="pk-action-area">
       <div className="pk-raise"><div className="pk-quick">{[.5, 1].map(r => <button key={r} disabled={!yours || busy || !l?.raise} onClick={() => setAmount(Math.min(l!.max, Math.max(l!.min, t.current + Math.round(pot(t) * r))))}>{r === .5 ? '半池' : '满池'}</button>)}<button disabled={!yours || busy || !l?.raise} onClick={() => setAmount(l!.max)}>全押</button><output>{amount}</output></div><input aria-label="加注至" type="range" min={Math.min(l?.min ?? 0, l?.max ?? 0)} max={l?.max ?? 0} step="1" value={amount} disabled={!yours || busy || !l?.raise} onChange={e => setAmount(Number(e.target.value))}/></div>
       <div className="pk-buttons"><button disabled={!yours || busy || view.pending} onClick={() => move('fold')}>弃牌</button><button disabled={!yours || busy || view.pending} onClick={() => move(l?.call ? 'call' : 'check')}>{l?.call ? `跟注 ${l.call}` : '过牌'}</button><button className="pk-primary" disabled={!yours || busy || view.pending || !l?.raise} onClick={() => move('raise', amount)}>{amount === l?.max ? '全押' : '加注至'} {amount}</button></div>
     </div>}
   </footer></>}
 </div>;
}
