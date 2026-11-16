import type { Palette } from './palette';
import type { SpotId } from '../../../../../../shared/fishing';
/** Far bank for each spot. Lighter, cooler and flatter than the foreground. */
function Trees({ d, color }: { d: string; color: string; light?: string }) {
  return <g><path d={d} fill={color}/><path d={d} fill="#000" opacity=".06" transform="translate(0 6)"/></g>;
}
export function Backdrop({ p, spot }: { p: Palette; spot: SpotId }) {
  if (spot === 'river') return <g>
    <path d="M0 168 70 104 120 132 196 64 252 112 330 52 412 128 488 92 560 140 640 70 720 122 800 84 900 132V200H0Z" fill={p.haze}/>
    <path d="M196 64 230 96 214 132 252 112ZM330 52 360 96 340 132 412 128ZM640 70 676 110 650 140 720 122Z" fill="#fff" opacity=".18"/>
    <path d="M0 178Q90 140 190 160T380 150 600 160 900 146V200H0Z" fill={p.far}/>
    <g fill={p.mid}>
      <path d="M0 192Q40 160 80 176 110 150 150 172 190 158 230 178L230 200H0Z"/>
      <path d="M640 186Q680 150 720 170 760 140 800 166 850 150 900 170V200H640Z"/>
    </g>
    <g className="df-willow" fill="none" stroke={p.mid} strokeWidth="2.4" strokeLinecap="round"><path d="M780 168V120"/><path d="M780 122q-24 6-30 40M780 122q-12 10-14 42M780 122q12 10 14 42M780 122q24 6 30 40M780 120q-36 0-44 30M780 120q36 0 44 30"/></g>
    <g fill={p.far}><path d="M380 186q70-50 140 0h-16q-54-36-108 0Z"/><rect x="372" y="184" width="156" height="5" rx="2"/></g>
    <path d="M380 192q70 34 140 0h-16q-54 22-108 0Z" fill={p.far} opacity=".35"/>
  </g>;
  return <g>
    <path d="M0 150Q120 86 260 132T560 112 900 120V200H0Z" fill={p.haze}/>
    <path d="M0 176Q140 136 300 160T620 150 900 150V200H0Z" fill={p.far}/>
    <Trees color={p.mid} light="#fff" d="M0 194V176Q20 156 44 170 60 148 86 166 104 152 128 170 150 160 170 178 190 166 212 182L220 194ZM560 194 566 180Q590 156 616 172 636 150 664 168 690 154 712 172 740 160 760 180 790 168 820 182 860 166 900 176V194Z"/>
    <g transform="translate(640 150)" fill={p.mid}>
      <path d="M-22 14 0 0 22 14Z"/><path d="M-26 15h52v3h-52z"/><path d="M-18 18h4v18h-4zM14 18h4v18h-4z"/><path d="M-22 34h44v4h-44z"/>
    </g>
  </g>;
}
