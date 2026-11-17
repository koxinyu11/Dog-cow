import { useEffect, useRef, useState } from 'react';
import { isGameId, type GameActivity } from '../../../shared/game-progress';
import { captureFailure } from './game-diagnostics';
/** Reports state and input only. The main process owns elapsed time and persistence. */
export function useGameProgress(gameId: string, runId: string, activity: GameActivity, paused: boolean) {
  const latest = useRef({ activity, paused });
  latest.current = { activity, paused };
  const inputPending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const send = useRef<() => void>(() => {});
  useEffect(() => {
    if (!isGameId(gameId)) return;
    let alive = true;
    let inFlight = false;
    let again = false;
    let noticeTimer: ReturnType<typeof setTimeout>;
    const report = async () => {
      if (!alive) return;
      if (inFlight) { again = true; return; }
      inFlight = true;
      const input = inputPending.current; inputPending.current = false;
      try {
        const reply = await window.playground.gameActivity({ gameId, runId, ...latest.current, input });
        if (!alive) return;
        setError(reply.error ?? '');
        if (reply.notices.length) {
          setNotice(reply.notices.map(t => t.name).join(' · '));
          clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => setNotice(''), 5000);
        }
      } catch (failure) {
        inputPending.current ||= input;
        captureFailure(failure, 'ipc');
        if (alive) setError('游戏时长暂未保存，请重试。');
      } finally {
        inFlight = false;
        if (again && alive) { again = false; void report(); }
      }
    };
    send.current = () => { void report(); };
    void report();
    const timer = setInterval(() => void report(), 10_000);
    return () => {
      alive = false; clearInterval(timer); clearTimeout(noticeTimer);
      void window.playground.gameActivity().catch(failure => captureFailure(failure, 'ipc'));
    };
  }, [gameId, runId]);
  useEffect(() => { send.current(); }, [activity, paused]);
  return { error, notice, retry: () => send.current(), input: () => { inputPending.current = true; send.current(); } };
}
