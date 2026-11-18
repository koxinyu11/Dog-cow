import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarketAction, MarketRequest, MarketView } from '../../../../../shared/market/game';
import type { GameProps } from '../../registry';
const OUTBOX = 'dogcow.market.outbox.v1';
export function useMarket({ diagnostics, onActivity }: GameProps, detail = 240) {
  const [view, setView] = useState<MarketView>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [correlation, setCorrelation] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const current = useRef<MarketView | undefined>(undefined), gate = useRef(false), alive = useRef(false);
  const pending = useRef<MarketRequest | null>(null);
  const selected = useRef(detail); selected.current = detail;
  const clearPending = () => { localStorage.removeItem(OUTBOX); pending.current = null; if (alive.current) setUncertain(false); };
  const send = useCallback(async (action: MarketAction, repeat?: MarketRequest, silent = false) => {
    if (gate.current) return false;
    const mutation = action.action !== 'view' && action.action !== 'retry';
    if (mutation && pending.current && !repeat) return false;
    gate.current = true;
    if (!silent) { setBusy(true); setError(''); setCorrelation(''); }
    const request: MarketRequest = repeat ?? { ...action, requestId: crypto.randomUUID(), revision: current.current?.revision ?? 0, createdAt: Date.now(), detail: selected.current };
    let submitted = false;
    try {
      if (mutation) { localStorage.setItem(OUTBOX, JSON.stringify(request)); pending.current = request; setUncertain(true); }
      submitted = true;
      const reply = await window.playground.market(request);
      if (pending.current && reply.view && !reply.view.pending && reply.view.receipts.includes(pending.current.requestId)) clearPending();
      if (mutation && reply.errorCode && ['MARKET_RULE', 'MARKET_STALE', 'MARKET_EXPIRED', 'MARKET_UNAVAILABLE', 'MARKET_TICK_FAILED'].includes(reply.errorCode)) clearPending();
      if (alive.current) {
        if (reply.view) { current.current = reply.view; setView(reply.view); }
        if (reply.error) { setError(reply.error); setCorrelation(reply.correlationId ?? ''); }
        else if (!silent) setError('');
      }
      return !reply.error;
    } catch (failure) {
      if (alive.current) {
        setError(submitted ? '无法确认操作结果，请核对并重试原操作；不会新建扣款。' : '无法保留操作回执，尚未提交。请重试。');
        setCorrelation(diagnostics.capture(failure, 'ipc'));
      }
      return false;
    } finally { gate.current = false; if (alive.current && !silent) setBusy(false); }
  }, [diagnostics]);
  useEffect(() => {
    alive.current = true;
    try {
      const raw = localStorage.getItem(OUTBOX);
      if (raw) {
        const request = JSON.parse(raw) as MarketRequest;
        if (!request || typeof request.action !== 'string' || typeof request.requestId !== 'string') throw Error('操作回执无效。');
        pending.current = request; setUncertain(true);
      }
    } catch (failure) { setError('上次操作回执无法读取，请通过游乐场诊断核对资产。'); setCorrelation(diagnostics.capture(failure, 'ipc')); }
    void send({ action: 'view' });
    const timer = window.setInterval(() => { void send({ action: 'view' }, undefined, true); }, 5000);
    return () => { alive.current = false; clearInterval(timer); };
  }, [send, diagnostics]);
  useEffect(() => { if (alive.current) void send({ action: 'view' }, undefined, true); }, [detail, send]);
  useEffect(() => { onActivity?.(busy ? 'progressing' : view && !error ? 'decision' : 'blocked'); }, [busy, view, error, onActivity]);
  const retry = async () => {
    if ((current.current?.pending || current.current?.engineError) && !await send({ action: 'retry' })) return;
    if (pending.current) await send(pending.current, pending.current);
    else await send({ action: 'view' });
  };
  return { view, busy, error, correlation, uncertain, send, retry, disabled: busy || !!view?.pending || !!view?.engineError || uncertain };
}
