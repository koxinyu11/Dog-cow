/** The dog-cow angler. Flat shapes, one light from the upper left, two tones per surface. */
export function Angler({ mood }: { mood: 'idle' | 'waiting' | 'signal' | 'reeling' | 'happy' }) {
  return <g className={`df-cow is-${mood}`}>
    <ellipse cx="246" cy="300" rx="44" ry="7" fill="#5b4532" opacity=".25"/>
    {/* legs over the dock edge */}
    <path d="M232 292q4 22 2 40" stroke="#4a5568" strokeWidth="12" strokeLinecap="round" fill="none"/>
    <path d="M256 290q8 22 8 40" stroke="#56627a" strokeWidth="12" strokeLinecap="round" fill="none"/>
    <g className="df-feet"><ellipse cx="236" cy="336" rx="9" ry="5" fill="#3a3530"/><ellipse cx="266" cy="334" rx="9" ry="5" fill="#3a3530"/></g>
    {/* body */}
    <g className="df-body">
      <path d="M210 296q-6-44 22-62 28-8 44 14 8 22 4 48Z" fill="#d9b36a"/>
      <path d="M210 296q-6-44 22-62 10-3 18-1-26 16-22 63Z" fill="#c59d55"/>
      <path d="M236 236 248 260 262 236" fill="none" stroke="#f3ead7" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M248 260v18" stroke="#5e8aa0" strokeWidth="1.6"/>
      <rect x="242" y="276" width="13" height="16" rx="2" fill="#f3efe4" stroke="#5e8aa0" strokeWidth="1.4"/>
      <rect x="245" y="279" width="7" height="5" rx="1" fill="#9db7c4"/>
      {/* back arm */}
      <path d="M232 252q8 22 40 12" stroke="#c59d55" strokeWidth="11" strokeLinecap="round" fill="none"/>
      <circle cx="276" cy="262" r="6" fill="#efe6d1"/>
    </g>
    {/* head */}
    <g className="df-head">
      <path d="M212 196q-20-10-22-26 14 0 26 16Z" fill="#b48c63"/>
      <path d="M264 192q20-8 24-24-14-2-28 14Z" fill="#b48c63"/>
      <path d="M220 178q-6-12 0-20 4 8 8 16Z M254 176q4-12 12-16 0 10-6 18Z" fill="#efe3c3"/>
      <ellipse cx="240" cy="204" rx="31" ry="28" fill="#f3ebd6"/>
      <path d="M210 210q-2-30 26-34-14 12-12 40Z" fill="#e3d7bb"/>
      <path d="M218 186q10-14 24-12-6 16-24 22Z" fill="#7b6956"/>
      <ellipse cx="246" cy="222" rx="20" ry="12" fill="#e7bfa8"/>
      <ellipse cx="242" cy="218" rx="10" ry="4" fill="#f1d2c0"/>
      <g className="df-eyes" fill="#3a332b"><ellipse cx="236" cy="203" rx="2.8" ry="3.2"/><ellipse cx="256" cy="203" rx="2.8" ry="3.2"/></g>
      <g fill="#fff"><circle cx="237" cy="202" r=".9"/><circle cx="257" cy="202" r=".9"/></g>
      <g fill="#a0705e"><ellipse cx="240" cy="224" rx="2" ry="1.5"/><ellipse cx="252" cy="224" rx="2" ry="1.5"/></g>
      <path className="df-mouth" d={mood === 'happy' ? 'M238 230q8 6 16 0' : mood === 'signal' ? 'M243 231a3 2.6 0 1 0 6 0 3 2.6 0 1 0-6 0' : 'M240 231q6 2 12 0'} fill={mood === 'signal' ? '#8a5848' : 'none'} stroke="#8a5848" strokeWidth="1.8" strokeLinecap="round"/>
      <g fill="#f0a99a" opacity=".5"><ellipse cx="226" cy="214" rx="5" ry="3"/><ellipse cx="266" cy="214" rx="5" ry="3"/></g>
      {mood === 'happy' && <g className="df-heart" fill="#e88a7c"><path d="M276 178q4-6 8 0 4-6 8 0-8 10-8 10t-8-10Z"/></g>}
    </g>
    {/* front arm holding the rod */}
    <path className="df-arm" d="M262 252q14 6 24-10" stroke="#d9b36a" strokeWidth="11" strokeLinecap="round" fill="none"/>
    <circle cx="287" cy="240" r="6.5" fill="#f3ebd6"/>
  </g>;
}
