/** Decorative local SVG; no remote art, fonts or network requests. */
export function ParkScene() {
  return <svg className="pg-park" viewBox="0 0 720 320" fill="none" aria-hidden="true">
    <path d="M30 283Q175 228 343 269T690 271" stroke="currentColor" opacity=".18" strokeWidth="2" />
    <ellipse cx="360" cy="284" rx="148" ry="12" fill="currentColor" opacity=".06" />
    <path d="m299 279 61-128 61 128M311 253h98" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    <g className="pg-wheel">
      <circle cx="360" cy="145" r="102" stroke="currentColor" strokeWidth="4" />
      <circle cx="360" cy="145" r="87" stroke="currentColor" opacity=".25" strokeWidth="2" />
      {Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; const x = 360 + Math.cos(a) * 102; const y = 145 + Math.sin(a) * 102; return <g key={i}><path d={`M360 145L${x} ${y}`} stroke="currentColor" opacity=".45" strokeWidth="2" /><circle cx={x} cy={y} r="13" fill="var(--c-page)" stroke="currentColor" strokeWidth="3" /><circle cx={x} cy={y} r="5" fill="var(--c-accent)" /></g>; })}
      <circle cx="360" cy="145" r="12" fill="var(--c-accent)" stroke="currentColor" strokeWidth="3" />
    </g>
    <path d="M113 275v-51h85v51M102 224l53-48 54 48Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    <path d="M144 275v-29h23v29M155 176v-29l24 9-24 9" stroke="currentColor" strokeWidth="3" />
    <path d="M518 275v-66h73v66M506 209l48-32 49 32Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    <path d="M531 229h12m23 0h12m-47 20h12m23 0h12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".45" />
    <path d="m225 99 3-9 3 9 9 3-9 3-3 9-3-9-9-3ZM488 84l3-9 3 9 9 3-9 3-3 9-3-9-9-3Z" fill="var(--c-accent)" />
    <circle cx="127" cy="127" r="4" fill="currentColor" opacity=".35" /><circle cx="594" cy="128" r="5" fill="var(--c-accent)" opacity=".65" />
  </svg>;
}
