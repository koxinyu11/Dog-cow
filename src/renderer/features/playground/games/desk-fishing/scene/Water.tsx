import type { Palette } from './palette';
import type { SpotId } from '../../../../../../shared/fishing';
export const SHORE = 'M0 196Q200 186 450 192T900 190V400H0Z';
export function Water({ p, spot }: { p: Palette; spot: SpotId }) {
  const [sx] = p.sunAt;
  const river = spot === 'river' || spot === 'bridge';
  return <g>
    <path d={SHORE} fill="url(#df-water)"/>
    <path d="M0 196Q200 186 450 192T900 190V214Q600 206 450 210T0 212Z" fill={p.mid} opacity=".28"/>
    <path d="M0 196Q200 186 450 192T900 190" fill="none" stroke={p.shine} strokeOpacity=".5" strokeWidth="1.4"/>
    <g className="df-glitter" fill={p.shine}>{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={sx - 40 + (i % 2) * 18 + i * 3} y={212 + i * 14} width={70 - i * 9} height="2.2" rx="1.1" opacity={.55 - i * .07} style={{ animationDelay: `${i * .45}s` }}/>)}</g>
    <g className={river ? 'df-flow' : 'df-ripples'} fill="none" stroke={p.shine} strokeWidth="1.6" strokeLinecap="round" opacity=".38">
      <path d="M340 232h70m140 22h60M470 316h96m130 18h72M150 296h54m460-92h52M300 352h40m380-60h34"/>
    </g>
    {river && <g className="df-flow is-slow" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="5" strokeLinecap="round"><path d="M200 262h160M640 236h140M420 372h170"/></g>}
    {spot === 'lotus' && <g className="df-lily">{[[430, 228, 22], [505, 232, 28], [682, 270, 32], [650, 340, 23], [760, 245, 30], [710, 365, 26]].map(([x,y,r], i) => <g key={i}>
      <ellipse cx={x} cy={y+3} rx={r} ry={r*.3} fill="#315f5a" opacity=".22"/>
      <path d={`M${x} ${y}l${r*.7} ${-r*.2}A${r} ${r*.29} 0 1 0 ${x+r} ${y}Z`} fill={i%2 ? '#89ad7a' : '#699b76'} stroke="#bbcea0" strokeWidth=".7"/>
      {i%2===0 && <g transform={`translate(${x} ${y-3})`}><path d="M0 0Q-20-8-12-19Q-3-18 0-5Q3-25 8-21Q18-11 0 0" fill="#e5b9bd"/><path d="M0 0Q-6-14 0-22Q8-12 0 0" fill="#f5d8cd"/><circle cy="-3" r="2" fill="#e4c679"/></g>}
    </g>)}</g>}
    {spot === 'bridge' && <g>
      <ellipse cx="483" cy="250" rx="78" ry="22" fill="#203e48" opacity=".2"/>
      <g fill="none" stroke={p.shine} opacity=".35"><ellipse cx="610" cy="300" rx="45" ry="12"/><path d="M575 305q40 18 75-2"/></g>
      <path d="M650 369 735 316 780 308M714 329l-4-35m25 22 30 9" stroke="#5e6050" strokeWidth="12" strokeLinecap="round" fill="none"/>
      <path d="m653 366 83-49 40-6" stroke="#a19574" strokeWidth="3" strokeLinecap="round" fill="none"/>
    </g>}
    <g className="df-underfish" fill="#163f45" opacity=".16"><path d="M552 290q28-15 48 0-20 15-48 0l-11 8v-16Z"/><path d="M722 338q20-11 36 0-16 11-36 0l-7 6v-12Z"/><path d="M420 330q14-8 26 0-12 8-26 0l-5 4v-8Z"/></g>
  </g>;
}
