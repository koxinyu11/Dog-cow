import { useEffect, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Phase = 'walk' | 'wait' | 'arrive' | 'eat';

export function LoadingScreen({ ready, onComplete, error }: {
  ready: boolean;
  onComplete: (done: true) => void;
  error?: string;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('walk');
  useEffect(() => {
    if (error) return;
    if (reduced) {
      if (ready) onComplete(true);
      return;
    }
    if (phase === 'wait') {
      if (ready) setPhase('arrive');
      return;
    }
    const delay = phase === 'walk' ? 550 : phase === 'arrive' ? 200 : 300;
    const timer = setTimeout(() => {
      if (phase === 'eat') onComplete(true);
      else setPhase(phase === 'walk' ? 'wait' : 'eat');
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, ready, reduced, error, onComplete]);
  return (
    <main className={`app-shell boot boot-loader phase-${phase} ${error ? 'has-error' : ''} ${reduced ? 'is-still' : ''}`} aria-busy={!error}>
      <div className="boot-pasture" aria-hidden="true">
        <div className="boot-path" />
        <span className="boot-cow"><span className="boot-cow-face">🐄</span></span>
        <span className="boot-grass">🌿</span>
      </div>
      <p role={error ? 'alert' : 'status'}>{error || (phase === 'eat' ? '准备好啦！' : '正在读取本机数据…')}</p>
    </main>
  );
}
