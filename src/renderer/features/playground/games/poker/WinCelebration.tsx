import type { CSSProperties } from 'react';
import { Chip } from './Chips';
/** Decorative only, clipped to the room and never involved in wallet mutations. */
export function WinCelebration({ amount, paused }: { amount: number; paused: boolean }) {
  return <div className={`pk-celebration ${paused ? 'is-paused' : ''}`} role="status" aria-label={`赢得 ${amount.toLocaleString()} 筹码`}>
    <div className="pk-win-badge"><small>好牌，好手气</small><strong>净赢 +{amount.toLocaleString()}</strong></div>
    <div className="pk-rain" aria-hidden="true">{Array.from({ length: 30 }, (_, i) => <span className="pk-rain-particle" key={i} style={{ '--rain-x': `${(i * 37 + 9) % 95 + 2}%`, '--rain-delay': `${i % 7 * .055}s`, '--rain-rotate': `${i % 2 ? 260 : -300}deg` } as CSSProperties}>{i % 3 ? <Chip value={[5, 10, 25, 100, 500][i % 5]}/> : <span className="pk-gold-coin">◈</span>}</span>)}</div>
  </div>;
}
