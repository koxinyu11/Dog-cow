import { BOBBER, ROD_BASE, rodTip } from './palette';
type Phase = 'idle' | 'waiting' | 'signal' | 'reeling';
/** Rod, line and bobber. The rod re-mounts on cast so its swing animation replays. */
export function Tackle({ phase, color, float }: { phase: Phase; color: string; float: boolean }) {
  const [bx, by] = ROD_BASE;
  const [tx, ty] = rodTip(phase);
  const [fx, fy] = BOBBER;
  const bend = phase === 'reeling' ? [bx + 60, ty + 30] : phase === 'signal' ? [bx + 70, by - 42] : [bx + 64, by - 40];
  const active = phase !== 'idle';
  return <g>
    <g className="df-rod-wrap" key={phase === 'waiting' ? 'cast' : 'rest'}>
      <path d={`M${bx} ${by}Q${bend[0]} ${bend[1]} ${tx} ${ty}`} fill="none" stroke={color} strokeWidth="4.2" strokeLinecap="round"/>
      <path d={`M${bx} ${by}Q${bend[0]} ${bend[1]} ${tx} ${ty}`} fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="1.2" strokeLinecap="round" transform="translate(-1 -1)"/>
      <path d={`M${bx - 16} ${by + 12}L${bx + 6} ${by - 4}`} stroke="#3e3830" strokeWidth="6.5" strokeLinecap="round"/>
      <circle cx={bx - 2} cy={by + 6} r="6" fill="#e8e1cf" stroke="#5f584c" strokeWidth="2"/>
      <path d={`M${bx - 2} ${by + 6}l5-3`} stroke="#5f584c" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx={tx} cy={ty} r="1.8" fill={color}/>
      {!active && <path d={`M${tx} ${ty}q2 30-4 52`} fill="none" stroke="#f6f0da" strokeOpacity=".7" strokeWidth="1"/>}
      {!active && <circle cx={tx - 4} cy={ty + 54} r="3.4" fill="#cb8169"/>}
    </g>
    {active && <g className="df-cast">
      <path className="df-line" pathLength={1} d={phase === 'reeling' ? `M${tx} ${ty}L${fx} ${fy - 12}` : `M${tx} ${ty}Q${(tx + fx) / 2 + 10} ${phase === 'signal' ? ty + 20 : ty + 30} ${fx} ${fy - 12}`} fill="none" stroke="#f6f0da" strokeOpacity=".85" strokeWidth={phase === 'reeling' ? 1.6 : 1.1}/>
      <g className="df-rings" fill="none" stroke="#e8f3ec"><ellipse cx={fx} cy={fy + 2} rx="22" ry="5"/><ellipse cx={fx} cy={fy + 2} rx="22" ry="5"/></g>
      {phase === 'waiting' && <g className="df-bubbles" fill="#eef7f1"><circle cx={fx + 16} cy={fy + 8} r="1.8"/><circle cx={fx - 14} cy={fy + 12} r="1.3"/><circle cx={fx + 24} cy={fy + 16} r="1.1"/></g>}
      {phase !== 'waiting' && <g className="df-drops" fill="#f2f8f3"><circle cx={fx - 14} cy={fy - 6} r="2"/><circle cx={fx + 14} cy={fy - 8} r="1.6"/><circle cx={fx + 2} cy={fy - 12} r="1.3"/><circle cx={fx - 4} cy={fy - 4} r="1.1"/></g>}
      <g className="df-bobber">
        <ellipse cx={fx} cy={fy + 3} rx="9" ry="2.4" fill="#16323a" opacity=".25"/>
        <path d={`M${fx} ${fy - 24}v12`} stroke="#3d3a33" strokeWidth="1.4"/>
        <ellipse cx={fx} cy={fy - 8} rx={float ? 6 : 4.6} ry="8" fill="#f7efdc"/>
        <path d={`M${fx - (float ? 6 : 4.6)} ${fy - 8}h${float ? 12 : 9.2}q0 8-${float ? 6 : 4.6} 9-${float ? 6 : 4.6}-1-${float ? 6 : 4.6}-9Z`} fill={float ? '#d39a43' : '#cf6f56'}/>
        <ellipse cx={fx - 2} cy={fy - 11} rx="1.4" ry="3" fill="#fff" opacity=".8"/>
        <circle cx={fx} cy={fy - 24} r="1.8" fill={float ? '#d39a43' : '#cf6f56'}/>
        <path d={`M${fx - 9} ${fy + 1}q9 3 18 0`} fill="none" stroke="#e8f3ec" strokeOpacity=".6" strokeWidth="1"/>
      </g>
    </g>}
  </g>;
}
