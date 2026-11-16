import type { Palette } from './palette';
import type { SpotId } from '../../../../../../shared/fishing';
export const SHORE = 'M0 196Q200 186 450 192T900 190V400H0Z';
export function Water({ p, spot }: { p: Palette; spot: SpotId }) {
  const [sx] = p.sunAt;
  const river = spot === 'river';
  return <g>
    <path d={SHORE} fill="url(#df-water)"/>
    <path d="M0 196Q200 186 450 192T900 190V214Q600 206 450 210T0 212Z" fill={p.mid} opacity=".28"/>
    <path d="M0 196Q200 186 450 192T900 190" fill="none" stroke={p.shine} strokeOpacity=".5" strokeWidth="1.4"/>
    <g className="df-glitter" fill={p.shine}>{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={sx - 40 + (i % 2) * 18 + i * 3} y={212 + i * 14} width={70 - i * 9} height="2.2" rx="1.1" opacity={.55 - i * .07} style={{ animationDelay: `${i * .45}s` }}/>)}</g>
    <g className={river ? 'df-flow' : 'df-ripples'} fill="none" stroke={p.shine} strokeWidth="1.6" strokeLinecap="round" opacity=".38">
      <path d="M340 232h70m140 22h60M470 316h96m130 18h72M150 296h54m460-92h52M300 352h40m380-60h34"/>
    </g>
    {river && <g className="df-flow is-slow" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="5" strokeLinecap="round"><path d="M200 262h160M640 236h140M420 372h170"/></g>}
    <g className="df-underfish" fill="#163f45" opacity=".16"><path d="M552 290q28-15 48 0-20 15-48 0l-11 8v-16Z"/><path d="M722 338q20-11 36 0-16 11-36 0l-7 6v-12Z"/><path d="M420 330q14-8 26 0-12 8-26 0l-5 4v-8Z"/></g>
  </g>;
}
