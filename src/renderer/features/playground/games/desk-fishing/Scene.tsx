import { rods, type FishingResult, type RodId, type SpotId } from '../../../../../shared/fishing';
export function FishArt({ color = '#9caf9a', rare = false, className = '' }: { color?: string; rare?: boolean; className?: string }) {
  return <svg className={`df-fish ${className}`} viewBox="0 0 120 64" aria-hidden="true"><path d="M85 31 112 12 108 33 112 53Z" fill={color}/><ellipse cx="53" cy="33" rx="39" ry="23" fill={color}/><path d="M40 12 61 1 74 14M45 51 65 63 77 50" fill={color}/><path d="M24 39Q50 56 76 40" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="7"/><path d="M54 23Q42 35 57 44" fill="none" stroke="#254d43" strokeOpacity=".25" strokeWidth="3"/><circle cx="29" cy="28" r="3.5" fill="#28473e"/><circle cx="28" cy="27" r="1" fill="#fff"/>{rare && <path d="m70 22 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#fff0b8" opacity=".85"/>}</svg>;
}
export function Scene({ rod, spot, phase, signal, paused, result, fishColor, net, float }: {
  rod: RodId; spot: SpotId; phase: 'idle' | 'waiting' | 'signal' | 'reeling'; signal?: string; paused: boolean;
  result: FishingResult | null; fishColor?: string; net: boolean; float: boolean;
}) {
  const active = phase !== 'idle';
  const night = new Date().getHours() >= 19 || new Date().getHours() < 6;
  return <div className={`df-scene ${night ? 'is-evening' : ''} ${paused ? 'is-paused' : ''}`} data-phase={phase} data-spot={spot}>
    <svg className="df-landscape" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="df-sky" x2="0" y2="1"><stop stopColor={night ? '#536b79' : '#d8e7d5'}/><stop offset="1" stopColor={night ? '#a0b6b0' : '#f3efd4'}/></linearGradient><linearGradient id="df-water" x2="0" y2="1"><stop stopColor={night ? '#597c80' : '#91b9ac'}/><stop offset="1" stopColor={night ? '#365f69' : '#629c94'}/></linearGradient></defs>
      <path fill="url(#df-sky)" d="M0 0h900v400H0z"/>
      <circle cx="735" cy="73" r="30" fill={night ? '#f3eed2' : '#f7e4ad'} opacity=".9"/>
      <path d="M0 120Q140 25 280 112T580 104T900 90V260H0Z" fill="#779a88" opacity=".35"/>
      <path d="M0 151Q100 90 250 147T540 136T900 125V280H0Z" fill="#608b79" opacity=".4"/>
      <path d="M0 185Q200 138 370 179T900 158V400H0Z" fill="url(#df-water)"/>
      <g className="df-clouds" fill="#f4f5de" opacity=".45"><ellipse cx="270" cy="63" rx="57" ry="8"/><ellipse cx="562" cy="94" rx="40" ry="5"/></g>
      <g className="df-ripples" fill="none" stroke="#d4e8d9" strokeWidth="2" opacity=".4"><path d="M360 218h90m120 26h80M470 320h110m130 24h90M190 280h70m430-145h65"/><path d="M440 365h40m-80-104h20m320 35h35"/></g>
      <g className="df-underfish" fill="#2f6968" opacity=".22"><path d="M550 275q30-17 50 0-20 17-50 0l-12 9v-18Z"/><path d="M720 331q23-12 40 0-17 12-40 0l-8 6v-12Z"/></g>
      <path d="M0 263Q80 247 164 285L260 400H0Z" fill="#75916c"/><path d="M0 287Q85 271 128 298L210 400H0Z" fill="#a7b58a"/>
      <g fill="#597c62"><path d="m28 280-8-75 19 67-1-95 9 97 19-62-10 75Z"/><path d="m857 204-9-90 18 73 6-100 7 96 21-55-13 77Z"/></g>
      {spot === 'river' && <g stroke="#728b59" strokeWidth="4" fill="none"><path d="M797 204q-7-90 8-118m11 115q-5-72 14-100m-3 110q10-77 31-84"/><path stroke="#aa9665" strokeWidth="8" d="m805 86 3-18m22 33 5-20m23 46 6-18"/></g>}
      <g><path d="m100 282 196-15 124 63-215 29Z" fill="#8e7056"/><path d="m100 282 196-15 124 49-215 29Z" fill="#c4a47a"/><path d="m141 279 116 62m-66-65 117 58m-66-63 115 56" stroke="#9a7c5e" strokeWidth="3"/><path d="M144 340v37m208-43v34" stroke="#765e4c" strokeWidth="11"/></g>
      {net && <g stroke="#d0b883" strokeWidth="4" fill="none"><path d="m120 300 57-33"/><ellipse cx="182" cy="263" rx="19" ry="12"/><path d="m165 268 14 15 17-16m-20-14 4 30m7-31-3 30" strokeWidth="1"/></g>}
      <g className="df-cow">
        <path d="m236 269 27 28m-8-27 31 18" fill="none" stroke="#534d43" strokeWidth="11" strokeLinecap="round"/>
        <path d="M220 228q36-12 49 22l-5 27-44-2Z" fill="#d6b873"/><path d="m220 246-15 23 30 5" fill="none" stroke="#e6dbc2" strokeWidth="12" strokeLinecap="round"/>
        <path d="m218 197-16-16q-6 14 10 24m44-7 15-17q8 16-9 24" fill="#c4a377"/>
        <ellipse cx="236" cy="211" rx="30" ry="28" fill="#eee5cc"/><path d="m212 194 18-6-6 24-14 1Z" fill="#786c59"/>
        <ellipse cx="240" cy="226" rx="21" ry="12" fill="#d6b29c"/><circle cx="233" cy="207" r="2.7" fill="#443e34"/><circle cx="251" cy="207" r="2.7" fill="#443e34"/><path d="M234 225v2m13-2v2" stroke="#806859" strokeWidth="3" strokeLinecap="round"/>
        <path d="m257 244 30-10" stroke="#eee5cc" strokeWidth="12" strokeLinecap="round"/>
      </g>
      <path className="df-rod" d={phase === 'reeling' ? 'M280 238Q330 150 393 113' : 'M280 238Q346 202 430 158'} fill="none" stroke={rods.find(r => r.id === rod)!.color} strokeWidth="5" strokeLinecap="round"/>
      {active && <g><path className="df-line" d={phase === 'reeling' ? 'M393 113Q500 110 570 199' : 'M430 158Q521 172 580 244'} fill="none" stroke="#f3edd5" strokeOpacity=".8" strokeWidth="1.4"/>
        <g className="df-bobber"><ellipse cx="580" cy="252" rx="23" ry="5" fill="none" stroke="#d6e5d7" opacity=".7"/><path d="M580 223v14" stroke="#f5e9c7" strokeWidth="2"/><ellipse cx="580" cy="242" rx={float ? 6 : 4} ry="9" fill="#f0dfb6"/><path d="M576 242h8v5q-4 8-8 0Z" fill={float ? '#d1a052' : '#cb8169'}/></g></g>}
      <g transform="translate(311 296)"><path d="m0 0 36 0-5 32H5Z" fill="#997a51"/><path d="M0 0q18-28 36 0" stroke="#765c3b" fill="none" strokeWidth="3"/><path d="m6 10 25 0M8 20h21m-18-17 3 26m10-26-2 26" stroke="#c6a374" strokeWidth="2"/></g>
      <g fill="#c7d6a0"><ellipse cx="749" cy="267" rx="17" ry="5"/><ellipse cx="787" cy="277" rx="21" ry="6"/></g>
    </svg>
    <div className="df-scene-title"><span>{spot === 'pond' ? 'THE AFTERNOON POND' : 'REED RIVER'}</span><strong>{spot === 'pond' ? '把时间，放慢一点。' : '去水深处，碰碰运气。'}</strong></div>
    {phase === 'signal' && <div className="df-signal" role="status"><span>◉</span> {signal}</div>}
    {phase === 'idle' && result && <div className={`df-catch ${result.kind === 'broken' ? 'is-broken' : ''}`} role="status">
      {result.kind === 'fish' ? <FishArt color={fishColor} rare={result.newDiscovery}/> : <span className="df-object">{result.kind === 'broken' ? '〰' : result.species === 'badge' ? '▤' : result.species === 'bottle' ? '♧' : '≈'}</span>}
      <div>{result.newDiscovery && <small>新发现</small>}<strong>{result.name}</strong><span>{result.kg ? `${result.kg.toFixed(2)} kg` : '下次会有什么呢'}{result.value !== undefined ? ` · ${result.value} 狗牛币` : ''}</span></div>
    </div>}
  </div>;
}
