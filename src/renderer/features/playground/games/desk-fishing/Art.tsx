import { useId, type ReactNode } from 'react';
import type { Species, Shape, ToolId } from '../../../../../shared/fishing';
/**
 * Template-based illustrations. A new catalog entry picks a `shape` (+ optional
 * `pattern`/`accent`) in shared/fishing.ts; add a template here only for a new silhouette.
 */
const INK = '#2f463d';
type Body = { body: ReactNode; fins: ReactNode; eye: [number, number] };
function fishBody(shape: Shape, c: string): Body {
  switch (shape) {
    case 'tiny': return { eye: [34, 31], fins: <><path d="M82 32 98 24 96 32 98 40Z" fill={c}/><path d="M50 25 58 20 64 25" fill={c}/></>, body: <ellipse cx="56" cy="32" rx="28" ry="8"/> };
    case 'slim': return { eye: [19, 31], fins: <><path d="M93 33 114 20 109 33 114 46Z" fill={c}/><path d="M48 23 60 15 68 23" fill={c}/></>, body: <ellipse cx="55" cy="33" rx="43" ry="12"/> };
    case 'perch': return { eye: [24, 29], fins: <><path d="M92 34 114 16 109 34 114 52Z" fill={c}/><path d="M34 17 40 4 46 15 52 3 58 15 64 5 70 16Z" fill={c}/><path d="M48 50 58 61 66 50" fill={c}/></>, body: <path d="M10 34Q28 11 66 14 92 18 96 34 90 50 60 52 26 53 10 34Z"/> };
    case 'cat': return { eye: [19, 31], fins: <><path d="M95 34 114 22 114 46Z" fill={c}/><path d="M44 22 54 13 64 22" fill={c}/><path d="M13 33Q4 25 3 15M13 37Q3 44 4 55M16 39Q12 50 14 58" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"/></>, body: <path d="M8 36Q14 21 46 21 86 23 98 34 86 46 46 48 14 50 8 36Z"/> };
    case 'eel': return { eye: [15, 30], fins: <path d="M104 31 116 24 116 40Z" fill={c}/>, body: <path d="M6 33Q10 24 30 27T72 30 108 30Q100 40 72 38T30 38 6 33Z"/> };
    case 'dragon': return { eye: [18, 28], fins: <><path d="M12 24 6 12M18 22 18 9" stroke={c} strokeWidth="3" strokeLinecap="round"/><path d="M8 32Q-2 40 2 50M10 30Q0 24 0 16" fill="none" stroke={c} strokeWidth="1.6"/><path d="M40 24 46 14 52 23M64 26 70 15 76 26" fill={c}/><path d="M102 32 118 18 112 33 118 50Z" fill={c}/></>, body: <path d="M6 30Q14 18 36 24T74 26 104 32Q96 44 72 38T36 40 6 30Z"/> };
    case 'fancy': return { eye: [30, 29], fins: <><path d="M74 32Q98 -2 117 9 104 32 117 55 98 66 74 32Z" fill={c} opacity=".78"/><path d="M34 17Q54 -6 78 18" fill={c} opacity=".85"/><path d="M40 46Q48 66 66 47" fill={c} opacity=".85"/></>, body: <ellipse cx="50" cy="32" rx="28" ry="17"/> };
    default: return { eye: [25, 28], fins: <><path d="M86 32 112 12 106 32 112 52Z" fill={c}/><path d="M38 13Q56 -2 73 14" fill={c}/><path d="M44 51Q56 63 68 51" fill={c}/></>, body: <ellipse cx="54" cy="32" rx="38" ry="22"/> };
  }
}
function Fish({ entry }: { entry: Species }) {
  const id = useId().replace(/:/g, '');
  const accent = entry.accent ?? INK;
  const { body, fins, eye } = fishBody(entry.shape, entry.color);
  return <>
    <defs>
      <linearGradient id={`${id}g`} x2="0" y2="1"><stop stopColor={accent} stopOpacity=".55"/><stop offset=".45" stopColor={entry.color}/><stop offset="1" stopColor="#fffaf0" stopOpacity=".9"/></linearGradient>
      <clipPath id={`${id}c`}>{body}</clipPath>
    </defs>
    <g className="df-fins">{fins}<g fill="none" stroke={accent} strokeOpacity=".35" strokeWidth="1">{fins}</g></g>
    <g fill={`url(#${id}g)`}>{body}</g>
    <g clipPath={`url(#${id}c)`}>
      <rect x="0" y="0" width="120" height="25" fill={accent} opacity=".22"/>
      {entry.pattern === 'spots' && <g fill={accent} opacity=".55"><circle cx="46" cy="22" r="4"/><circle cx="62" cy="30" r="3"/><circle cx="74" cy="21" r="3.5"/><circle cx="38" cy="36" r="2.5"/><circle cx="84" cy="33" r="2"/></g>}
      {entry.pattern === 'stripes' && <path d="M40 0v64M54 0v64M68 0v64M82 0v64" stroke={accent} strokeWidth="4" opacity=".4"/>}
      {entry.pattern === 'scales' && <path d="M36 22q5 6 10 0 5 6 10 0 5 6 10 0 5 6 10 0M42 32q5 6 10 0 5 6 10 0 5 6 10 0M36 42q5 6 10 0 5 6 10 0 5 6 10 0" fill="none" stroke={accent} strokeOpacity=".35" strokeWidth="1.4"/>}
      {entry.pattern === 'glow' && <ellipse cx="50" cy="22" rx="30" ry="6" fill={accent} opacity=".6"/>}
      <path d="M14 44Q50 58 96 42" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="6"/>
      <path d="M20 33Q56 28 100 33" fill="none" stroke={accent} strokeOpacity=".3" strokeWidth="1" strokeDasharray="2 3"/>
      <path d={`M${eye[0] + 9} ${eye[1] - 10}q6 10 0 20`} fill="none" stroke={accent} strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round"/>
    </g>
    <circle cx={eye[0]} cy={eye[1]} r="3.4" fill={INK}/><circle cx={eye[0] - 1} cy={eye[1] - 1} r="1.1" fill="#fff"/>
  </>;
}
const objects: Partial<Record<Shape, (c: string, a: string) => ReactNode>> = {
  crayfish: c => <><path d="M38 31Q20 14 8 20 14 28 26 28M38 37Q20 52 8 46 14 39 26 40" fill={c}/><path d="M36 30Q18 10 2 6M36 32Q22 18 10 14" fill="none" stroke={c} strokeWidth="1.4"/><ellipse cx="60" cy="34" rx="26" ry="10" fill={c}/><path d="M50 25v18M60 24v20M70 25v18" stroke="#fff" strokeOpacity=".3" strokeWidth="2"/><path d="M84 34 104 22 110 34 104 46Z" fill={c}/><path d="M52 44l-4 9M62 44v9M72 44l4 9" stroke={c} strokeWidth="2"/><circle cx="40" cy="30" r="2.2" fill={INK}/></>,
  snail: (c, a) => <><path d="M22 50Q60 58 100 48 94 41 42 43Z" fill={a}/><path d="M28 46 22 30M34 45 32 28" stroke={a} strokeWidth="2" strokeLinecap="round"/><circle cx="64" cy="30" r="20" fill={c}/><path d="M64 30a5 5 0 1 1 5 5 11 11 0 1 1-11-11 17 17 0 1 1 17 17" fill="none" stroke={a} strokeWidth="2.4"/></>,
  turtle: (c, a) => <><ellipse cx="34" cy="48" rx="7" ry="5" fill={a}/><ellipse cx="86" cy="48" rx="7" ry="5" fill={a}/><circle cx="98" cy="36" r="9" fill={a}/><circle cx="101" cy="34" r="1.8" fill={INK}/><path d="M26 42Q28 10 60 10 92 10 94 42Z" fill={c}/><path d="M48 18 60 13 72 18 72 32 60 37 48 32ZM48 18 36 26M72 18 84 26M48 32 34 40M72 32 86 40M60 37v5" fill="none" stroke={a} strokeWidth="2"/><path d="M24 42h72" stroke={a} strokeWidth="4" strokeLinecap="round"/></>,
  crab: c => <><path d="M38 40 20 50M38 44 22 58M82 40 100 50M82 44 98 58M44 46 34 60M76 46 86 60" stroke={c} strokeWidth="3" strokeLinecap="round"/><path d="M40 30 28 20M80 30 92 20" stroke={c} strokeWidth="4"/><path d="M14 18Q22 4 32 14 26 22 18 24ZM106 18Q98 4 88 14 94 22 102 24Z" fill={c}/><ellipse cx="60" cy="36" rx="26" ry="15" fill={c}/><path d="M52 22v-8M68 22v-8" stroke={c} strokeWidth="2"/><circle cx="52" cy="13" r="2.6" fill={INK}/><circle cx="68" cy="13" r="2.6" fill={INK}/><path d="M46 32q14 6 28 0" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="2"/></>,
  pearl: (c, a) => <><path d="M18 40Q28 52 60 52 94 52 104 40Z" fill={c}/><path d="M18 40Q26 6 62 8 98 10 104 40Z" fill={c} opacity=".85"/><path d="M24 40Q32 18 62 16 92 18 98 40Z" fill="#e9dfe2"/><path d="M28 40Q36 24 62 22 88 24 94 40Z" fill="#d7cbd2"/><circle cx="61" cy="34" r="9" fill={a}/><circle cx="58" cy="31" r="3" fill="#fff"/><circle cx="64" cy="37" r="5" fill="#d9cfe0" opacity=".5"/><path d="M98 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff"/></>,
  mussel: (c, a) => <><path d="M18 40Q28 12 70 14 104 18 104 36 90 54 50 52 20 50 18 40Z" fill={c}/><path d="M24 40Q36 22 70 22 98 26 98 36M30 42Q44 30 70 30 92 32 94 40M36 46Q52 38 72 39" fill="none" stroke={a} strokeWidth="1.6" opacity=".7"/></>,
  otter: (c, a) => <><path d="M14 58Q16 40 36 38L84 38Q104 40 106 58Z" fill="#7aa9a5" opacity=".5"/><ellipse cx="60" cy="44" rx="28" ry="16" fill={c}/><circle cx="60" cy="24" r="17" fill={c}/><circle cx="46" cy="11" r="4" fill={c}/><circle cx="74" cy="11" r="4" fill={c}/><ellipse cx="60" cy="29" rx="10" ry="7" fill={a}/><circle cx="53" cy="21" r="2.3" fill={INK}/><circle cx="67" cy="21" r="2.3" fill={INK}/><ellipse cx="60" cy="26" rx="3" ry="2" fill={INK}/><path d="M86 38Q98 22 92 14" stroke={c} strokeWidth="7" strokeLinecap="round"/></>,
  badge: c => <><path d="M60 2v10" stroke="#8f8574" strokeWidth="3"/><rect x="32" y="10" width="56" height="44" rx="6" fill="#f1ede3" stroke={c} strokeWidth="3"/><rect x="38" y="20" width="16" height="20" rx="2" fill={c} opacity=".55"/><path d="M60 24h22M60 32h16M38 47h44" stroke={c} strokeWidth="3" strokeLinecap="round"/><rect x="52" y="6" width="16" height="6" rx="3" fill="#8f8574"/></>,
  key: c => <><circle cx="34" cy="32" r="16" fill="none" stroke={c} strokeWidth="7"/><path d="M50 32h52M88 32v12M98 32v9" stroke={c} strokeWidth="7" strokeLinecap="round"/><circle cx="34" cy="32" r="3" fill={c}/></>,
  keycap: c => <><path d="M24 50 34 12h52l10 38Z" fill={c}/><path d="M24 50h72l-4 6H28Z" fill="#b9b0a0"/><path d="M38 18h44l6 26H32Z" fill="#fbf8f1"/><text x="60" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#6b6255" fontFamily="system-ui">Esc</text></>,
  bottle: c => <><path d="M54 4h12v12q14 6 14 20v20q0 6-6 6H46q-6 0-6-6V36q0-14 14-20Z" fill={c} opacity=".75"/><rect x="52" y="1" width="16" height="6" rx="2" fill="#a48662"/><rect x="48" y="30" width="24" height="20" rx="3" fill="#f3ead5" transform="rotate(-8 60 40)"/><path d="M52 37h14M52 43h10" stroke="#a48662" strokeWidth="1.6" transform="rotate(-8 60 40)"/><path d="M46 24q-2 10 0 24" stroke="#fff" strokeOpacity=".5" strokeWidth="3"/></>,
  mug: c => <><path d="M80 24q16 0 14 14-2 12-16 10" fill="none" stroke={c} strokeWidth="6"/><path d="M34 16h48v30q0 12-12 12H46q-12 0-12-12Z" fill={c}/><ellipse cx="58" cy="16" rx="24" ry="5" fill="#8c6b50"/><path d="M40 32q8 10 18 2" fill="none" stroke="#a88d73" strokeWidth="2" opacity=".6"/></>,
  trophy: c => <><path d="M40 8h40v16q0 18-20 20-20-2-20-20Z" fill={c}/><path d="M40 14H28q0 16 14 16M80 14h12q0 16-14 16" fill="none" stroke={c} strokeWidth="4"/><path d="M56 44h8v6h-8z" fill={c}/><rect x="42" y="50" width="36" height="8" rx="2" fill="#7f6a45"/><g fill="#8b5a3a" opacity=".55"><circle cx="50" cy="18" r="3"/><circle cx="66" cy="30" r="4"/><circle cx="72" cy="14" r="2"/></g></>,
  coin: c => <><circle cx="60" cy="32" r="24" fill={c}/><circle cx="60" cy="32" r="19" fill="none" stroke="#fff2c6" strokeWidth="2" opacity=".7"/><rect x="54" y="26" width="12" height="12" fill="#6e5428"/><path d="M96 10l3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM24 46l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#fff2b8"/></>,
  compass: c => <><circle cx="60" cy="32" r="26" fill={c}/><circle cx="60" cy="32" r="20" fill="#efe3c6"/><path d="M60 14v4M60 46v4M42 32h4M74 32h4" stroke={c} strokeWidth="2"/><path d="m60 17 6 15-6 15-6-15Z" fill="#b8574a"/><path d="m60 32 6 0-6 15-6-15Z" fill="#4f5d63"/><circle cx="60" cy="32" r="2.5" fill="#3a3027"/><rect x="55" y="1" width="10" height="7" rx="3" fill={c}/></>,
};
/** One illustration for any catalog entry. */
export function CatchArt({ entry, className = '', silhouette = false }: { entry: Species; className?: string; silhouette?: boolean }) {
  const draw = objects[entry.shape];
  return <svg className={`df-art rarity-${entry.rarity} ${silhouette ? 'is-silhouette' : ''} ${className}`} viewBox="0 0 120 64" aria-hidden="true">
    <ellipse className="df-art-shadow" cx="60" cy="61" rx="34" ry="2.6" fill="#1d2f2a" opacity=".12"/>
    {draw ? draw(entry.color, entry.accent ?? INK) : <Fish entry={entry}/>}
  </svg>;
}
/** Results that are not catalog entries: weeds, an empty hook, a broken rod. */
export function OutcomeArt({ kind, className = '' }: { kind: 'weed' | 'empty' | 'broken'; className?: string }) {
  return <svg className={`df-art ${className}`} viewBox="0 0 120 64" aria-hidden="true">
    {kind === 'weed' && <g fill="none" stroke="#6f9a62" strokeWidth="4" strokeLinecap="round"><path d="M44 60q-10-20 4-34t2-24"/><path d="M60 60q8-22-4-36t6-22" stroke="#86ad6c"/><path d="M76 60q-6-18 8-30" stroke="#5d8753"/><circle cx="58" cy="30" r="2" fill="#cfe2b8" stroke="none"/></g>}
    {kind === 'empty' && <g fill="none" stroke="#7d8a86" strokeWidth="3.5" strokeLinecap="round"><path d="M60 2v36q0 14 12 14t12-12"/><path d="M84 40l-6 2"/><circle cx="60" cy="2" r="2" fill="#7d8a86"/><path d="M28 56q8-4 16 0t16 0" stroke="#a9c6c0" strokeWidth="2"/></g>}
    {kind === 'broken' && <g strokeLinecap="round"><path d="M14 56 54 28" stroke="#a16b46" strokeWidth="6"/><path d="M66 24 104 6" stroke="#a16b46" strokeWidth="5"/><path d="M54 28l4-6 4 6 4-6" stroke="#c88d5b" strokeWidth="2" fill="none"/><path d="M104 6q10 20-6 50" fill="none" stroke="#d8d1bd" strokeWidth="1.4" strokeDasharray="3 4"/></g>}
  </svg>;
}
export function RodArt({ color, className = '' }: { color: string; className?: string }) {
  return <svg className={`df-rod-art ${className}`} viewBox="0 0 80 48" aria-hidden="true"><path d="M8 44Q36 22 76 4" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round"/><path d="M8 44l9-6" stroke="#3f3a33" strokeWidth="6" strokeLinecap="round"/><circle cx="22" cy="38" r="5" fill="#e9e1cd" stroke="#6b6253" strokeWidth="2"/><path d="M76 4q2 18-2 36" fill="none" stroke="#d8d1bd" strokeWidth="1"/><circle cx="40" cy="27" r="1.6" fill={color}/><circle cx="56" cy="17" r="1.6" fill={color}/></svg>;
}
export function ToolArt({ id }: { id: ToolId }) {
  return <svg className="df-tool-art" viewBox="0 0 48 48" aria-hidden="true">
    {id === 'float' && <><path d="M24 4v10" stroke="#5d6c66" strokeWidth="2"/><ellipse cx="24" cy="26" rx="8" ry="13" fill="#f0dfb6"/><path d="M16 26h16v4q-8 14-16 0Z" fill="#d1a052"/><path d="M8 42q8-4 16 0t16 0" fill="none" stroke="#8fb9ad" strokeWidth="2"/></>}
    {id === 'baitbox' && <><rect x="6" y="14" width="36" height="26" rx="4" fill="#9cb38f"/><path d="M6 26h36" stroke="#6c8a64" strokeWidth="2"/><rect x="6" y="10" width="36" height="8" rx="3" fill="#b9cbae"/><path d="M16 33q4-4 8 0t8 0" fill="none" stroke="#c87b62" strokeWidth="3" strokeLinecap="round"/></>}
    {id === 'net' && <><path d="m6 44 20-20" stroke="#a88a5f" strokeWidth="4" strokeLinecap="round"/><ellipse cx="32" cy="17" rx="12" ry="10" fill="none" stroke="#a88a5f" strokeWidth="3"/><path d="M22 20q10 18 20-2M26 10l8 16M36 8l-6 18" fill="none" stroke="#c9b48a" strokeWidth="1.2"/></>}
  </svg>;
}
