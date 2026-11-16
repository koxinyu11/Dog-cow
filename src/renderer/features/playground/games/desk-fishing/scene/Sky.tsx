import type { Palette, Time } from './palette';
const stars = [[70, 34], [140, 78], [212, 26], [300, 58], [380, 22], [452, 66], [520, 30], [596, 84], [640, 40], [830, 32], [870, 92], [250, 104], [480, 110], [804, 128], [40, 110]];
function Cloud({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-60 12Q-58-6-36-6-30-26-6-22 6-38 30-26 52-30 56-8 74-6 74 12Z" fill={color} opacity=".9"/>
    <path d="M-60 12Q-20 4 74 12" fill="none" stroke="#000" strokeOpacity=".05" strokeWidth="6"/>
  </g>;
}
export function Sky({ p, time }: { p: Palette; time: Time }) {
  const [sx, sy] = p.sunAt;
  return <g>
    <path fill="url(#df-sky)" d="M0 0h900v240H0z"/>
    {time === 'night' && <g className="df-stars" fill="#fff8e6">{stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 4 ? 1.1 : 1.8} style={{ animationDelay: `${(i * .53) % 4}s` }}/>)}</g>}
    <circle cx={sx} cy={sy} r="120" fill="url(#df-glow)"/>
    <circle cx={sx} cy={sy} r="27" fill={p.sun}/>
    {time === 'night' ? <g fill="#d9d4bd" opacity=".5"><circle cx={sx - 8} cy={sy - 4} r="4"/><circle cx={sx + 6} cy={sy + 8} r="3"/><circle cx={sx + 9} cy={sy - 9} r="2"/></g> : <circle cx={sx - 7} cy={sy - 7} r="10" fill="#fff" opacity=".35"/>}
    <g className="df-clouds"><Cloud x={250} y={66} s={.9} color={p.cloud}/><Cloud x={560} y={104} s={.55} color={p.cloud}/><Cloud x={860} y={56} s={.7} color={p.cloud}/></g>
    {time === 'day' && <g className="df-birds" fill="none" stroke="#5c6f68" strokeWidth="1.4" strokeLinecap="round"><path d="M430 60q5-5 10 0 5-5 10 0"/><path d="M458 50q4-4 8 0 4-4 8 0"/></g>}
  </g>;
}
