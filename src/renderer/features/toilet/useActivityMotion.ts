import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ActivityKind } from '../../../shared/contracts';

/** Card state as seen by decoration. Derived from records; never owns the timer. */
export type SceneMode = 'idle' | 'running' | 'review' | 'off';
/** One-shot scene phase played on a real state change; '' means steady state. */
export type ScenePhase = '' | 'enter' | 'leave';

const PHASE_MS = 900;

/**
 * Plays `enter` when an activity starts and `leave` when it ends, only for changes seen
 * while mounted. Switching tabs or reopening the app shows the steady state without replay.
 */
export function useScenePhase(kind: ActivityKind, mode: SceneMode): ScenePhase {
  const previous = useRef({ kind, mode });
  const [phase, setPhase] = useState<ScenePhase>('');
  useEffect(() => {
    const before = previous.current;
    previous.current = { kind, mode };
    const next: ScenePhase = before.kind !== kind ? ''
      : mode === 'running' && before.mode === 'idle' ? 'enter'
      : before.mode === 'running' && mode === 'idle' ? 'leave' : '';
    setPhase(next);
    if (!next) return;
    const timer = setTimeout(() => setPhase(''), PHASE_MS);
    return () => clearTimeout(timer);
  }, [kind, mode]);
  return phase;
}

/** True while the window is hidden or the card is off-screen; CSS pauses decoration loops. */
export function useMotionPaused(ref: RefObject<HTMLElement | null>): boolean {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let visible = true;
    const update = () => setPaused(document.hidden || !visible);
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }) : null;
    observer?.observe(element);
    document.addEventListener('visibilitychange', update);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [ref]);
  return paused;
}
