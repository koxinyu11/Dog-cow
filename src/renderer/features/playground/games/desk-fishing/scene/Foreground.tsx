import type { SpotId } from '../../../../../../shared/fishing';
const blades = (x: number, y: number, h: number, color: string, key: string) =>
  <path key={key} d={`M${x} ${y}q-3-${h * .6} -9-${h}M${x + 4} ${y}q1-${h * .7} 6-${h * 1.1}M${x + 8} ${y}q4-${h * .5} 12-${h * .8}`} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round"/>;
/** Near bank, dock and props. Fixed daylight colours; the time tint is applied on top. */
export function Bank({ spot }: { spot: SpotId }) {
  return <g>
    <path d="M0 252Q70 236 150 262 210 286 260 400H0Z" fill="#6f8c63"/>
    <path d="M0 272Q80 258 140 284 180 306 214 400H0Z" fill="#8ea671"/>
    <path d="M0 300Q60 290 110 310 140 330 160 400H0Z" fill="#a9bb84"/>
    <path d="M150 262Q210 286 260 400h-14Q206 300 150 268Z" fill="#5d7a55"/>
    <g>{[[18, 262, 28], [56, 268, 22], [100, 282, 18], [30, 300, 24], [128, 300, 16]].map(([x, y, h], i) => blades(x, y, h, i % 2 ? '#5f8357' : '#7a9a62', `b${i}`))}</g>
    <g fill="#f3efe0"><circle cx="40" cy="316" r="2.6"/><circle cx="76" cy="330" r="2.2"/><circle cx="24" cy="346" r="2.8"/></g>
    <g fill="#efd27a"><circle cx="40" cy="316" r="1"/><circle cx="76" cy="330" r=".9"/><circle cx="24" cy="346" r="1.1"/></g>
    <g><ellipse cx="120" cy="352" rx="22" ry="9" fill="#8b9184"/><ellipse cx="114" cy="348" rx="14" ry="5" fill="#a5ab9c"/></g>
    <g className="df-reeds">
      <path d="M836 400q-6-120 4-196M856 400q4-110 22-178M872 400q-2-90-20-150M890 400q6-100 4-170" fill="none" stroke="#5d7b52" strokeWidth="4" strokeLinecap="round"/>
      <path d="M840 204q-2-22 3-34M878 222q4-20 10-30M852 250q-6-18-6-30" stroke="#9a7b55" strokeWidth="9" strokeLinecap="round"/>
      <path d="M820 400q-10-60-32-100 30 30 40 100ZM900 400q-6-70 20-120-12 60-6 120Z" fill="#6f8f5f"/>
    </g>
    {spot === 'pond' ? <g className="df-lily">
      <path d="M720 300a26 7 0 1 0 52 0 26 7 0 1 0-52 0Zm26 0 14-6" fill="#8fb27a" stroke="#6f945f" strokeWidth="1"/>
      <path d="M770 322a30 8 0 1 0 60 0 30 8 0 1 0-60 0Z" fill="#a4c486"/>
      <g transform="translate(800 316)"><path d="M0 0q-8-10 0-18 8 8 0 18Zm0 0q-15-3-15-13 11-1 15 13Zm0 0q15-3 15-13-11-1-15 13Z" fill="#f4c9cb"/><path d="M0 0q-4-8 0-12 4 4 0 12Z" fill="#fde6e4"/><circle cy="-4" r="2.2" fill="#f2cd73"/></g>
    </g> : <g>
      <path d="M690 318q30-14 70-6 24 6 22 16-40 10-90 2Z" fill="#6c7a74"/><path d="M700 314q26-10 56-4" fill="none" stroke="#97a59d" strokeWidth="5" strokeLinecap="round"/>
      <path d="M760 286q16-8 34-2 8 6 0 10-20 4-36-2Z" fill="#7d8b84"/>
    </g>}
  </g>;
}
/** Wooden jetty seen from the side, with planks, posts and a few desk-worker props. */
export function Dock({ net }: { net: boolean }) {
  const planks = Array.from({ length: 9 }, (_, i) => i);
  return <g>
    <path d="M118 318v70M350 314v62M220 324v66" stroke="#5a4636" strokeWidth="12"/>
    <path d="M118 318v70M350 314v62" stroke="#7a604a" strokeWidth="4" transform="translate(-3 0)"/>
    <g fill="none" stroke="#dce9e1" strokeOpacity=".5"><ellipse cx="350" cy="376" rx="14" ry="3"/><ellipse cx="220" cy="390" rx="14" ry="3"/></g>
    <path d="M92 296 330 264 414 304 120 334Z" fill="#c9a77a"/>
    <g>{planks.map(i => { const t = i / 9, n = (i + 1) / 9; const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
      return <path key={i} d={`M${lerp(92, 330, t)} ${lerp(296, 264, t)}L${lerp(92, 330, n)} ${lerp(296, 264, n)}L${lerp(120, 414, n)} ${lerp(334, 304, n)}L${lerp(120, 414, t)} ${lerp(334, 304, t)}Z`} fill={i % 3 === 1 ? '#bf9c6e' : i % 3 === 2 ? '#d1b084' : '#c7a476'} stroke="#a8875f" strokeWidth="1"/>; })}</g>
    <path d="M120 334 414 304v10L120 346Z" fill="#8c6c4f"/>
    <path d="M120 346 414 314" stroke="#6e543e" strokeWidth="1.5"/>
    <g fill="#8b7258">{planks.map(i => <circle key={i} cx={124 + i * 32.6} cy={340 - i * 3.3} r="1.2"/>)}</g>
    <g transform="translate(324 274)">
      <path d="M0 4h38l-4 32H4Z" fill="#a37b52"/><path d="M0 4h38l-1 6H1Z" fill="#7d5c3c"/>
      <path d="M2 14h34M3 26h32" stroke="#6b6a68" strokeWidth="2.4"/><path d="M12 10v24M26 10v24" stroke="#8d6845" strokeWidth="1"/>
      <path d="M2 4q17-24 34 0" fill="none" stroke="#6b6a68" strokeWidth="2"/>
    </g>
    <g transform="translate(150 286)">
      <rect x="0" y="0" width="34" height="18" rx="3" fill="#6d8f8a"/><rect x="0" y="0" width="34" height="6" rx="3" fill="#86a8a2"/><rect x="13" y="4" width="8" height="5" rx="1" fill="#d9c47e"/>
    </g>
    <g transform="translate(196 284)">
      <rect x="0" y="0" width="12" height="18" rx="3" fill="#e9e3d4"/><rect x="0" y="0" width="12" height="5" rx="2" fill="#b65f4b"/>
      <path className="df-steam" d="M6-4q-4-6 0-12t0-12" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round"/>
    </g>
    {net && <g><path d="m144 296-34-62" stroke="#9a7a52" strokeWidth="3.5" strokeLinecap="round"/><ellipse cx="104" cy="222" rx="15" ry="12" fill="none" stroke="#9a7a52" strokeWidth="3" transform="rotate(-20 104 222)"/><path d="M92 226q12 18 24-2M96 216l12 18M112 214l-8 20" fill="none" stroke="#c9b48a" strokeWidth="1"/></g>}
  </g>;
}
