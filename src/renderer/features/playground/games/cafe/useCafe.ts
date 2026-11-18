import { useCallback, useEffect, useRef, useState } from 'react';
import type { CafeAction, CafeRequest, CafeView } from '../../../../../shared/cafe/types';
import type { GameProps } from '../../registry';
export function useCafe({ diagnostics, onActivity, paused }: GameProps) {
  const [view, setView] = useState<CafeView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [correlation, setCorrelation] = useState('');
  const current = useRef<CafeView | undefined>(undefined);
  const gate = useRef(false),
    mounted = useRef(false);
  const uncertain = useRef<CafeRequest | null>(null);
  const send = useCallback(
    async (action: CafeAction, repeat = false) => {
      if (gate.current) return false;
      gate.current = true;
      setBusy(true);
      setError('');
      setCode('');
      setCorrelation('');
      const request: CafeRequest =
        repeat && uncertain.current
          ? uncertain.current
          : { ...action, requestId: crypto.randomUUID(), revision: current.current?.state.revision ?? 0 };
      try {
        const result = await window.playground.cafe(request);
        if (!mounted.current) return false;
        uncertain.current = null;
        if (result.view) {
          current.current = result.view;
          setView(result.view);
        }
        if (result.error) {
          setError(result.error);
          setCode(result.errorCode ?? 'CAFE_FAILED');
          setCorrelation(result.correlationId ?? '');
        }
        return !result.error;
      } catch (failure) {
        if (request.action !== 'view' && request.action !== 'retry') uncertain.current = request;
        if (mounted.current) {
          setError('无法确认操作结果，请重试。重复请求不会重复结算。');
          setCode('CAFE_TRANSPORT');
          setCorrelation(diagnostics.capture(failure, 'ipc'));
        }
        return false;
      } finally {
        gate.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [diagnostics],
  );
  useEffect(() => {
    mounted.current = true;
    void send({ action: 'view' });
    return () => {
      mounted.current = false;
    };
  }, [send]);
  useEffect(() => {
    onActivity?.(busy ? 'progressing' : view && !error ? 'decision' : 'blocked');
  }, [busy, view, error, onActivity]);
  const retry = () =>
    send(view?.pending ? { action: 'retry' } : { action: 'view' }, !!uncertain.current && !view?.pending);
  return {
    view,
    busy,
    error,
    code,
    correlation,
    retry,
    send,
    disabled: busy || paused || !!view?.pending || !!uncertain.current,
  };
}
