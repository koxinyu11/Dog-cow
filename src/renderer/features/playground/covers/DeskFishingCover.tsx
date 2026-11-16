/** Lobby cover for desk-fishing. Kept tiny so the catalog stays light without loading the game. */
export function DeskFishingCover() {
  return <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="pg-df-sky" x2="0" y2="1"><stop stopColor="#bcd8db"/><stop offset="1" stopColor="#f4f0d8"/></linearGradient><linearGradient id="pg-df-water" x2="0" y2="1"><stop stopColor="#9cc2b5"/><stop offset="1" stopColor="#558f89"/></linearGradient></defs>
    <path d="M0 0h160v120H0z" fill="url(#pg-df-sky)"/>
    <circle cx="124" cy="26" r="11" fill="#fff1c4"/>
    <path d="M0 58Q40 40 80 52T160 48V70H0Z" fill="#9fbaa6"/>
    <path d="M0 64h160v56H0z" fill="url(#pg-df-water)"/>
    <path d="M86 78h20M110 92h26M70 100h18" stroke="#f7fbef" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M0 84Q24 78 46 90L60 120H0Z" fill="#8ea671"/>
    <path d="M14 94 72 86 92 98 26 108Z" fill="#c9a77a"/>
    <ellipse cx="44" cy="70" rx="11" ry="10" fill="#f3ebd6"/><path d="M36 64q4-6 10-5-2 6-10 9Z" fill="#7b6956"/>
    <ellipse cx="46" cy="76" rx="7" ry="4" fill="#e7bfa8"/><circle cx="41" cy="69" r="1.3" fill="#3a332b"/><circle cx="49" cy="69" r="1.3" fill="#3a332b"/>
    <path d="M36 92q-2-14 8-14 10 0 10 14Z" fill="#d9b36a"/>
    <path d="M52 82Q74 60 98 50" fill="none" stroke="#a16b46" strokeWidth="2" strokeLinecap="round"/>
    <path d="M98 50Q110 62 114 80" fill="none" stroke="#f6f0da" strokeWidth=".8"/>
    <ellipse cx="114" cy="82" rx="2.4" ry="3.4" fill="#f7efdc"/><path d="M111.6 82h4.8q0 3.5-2.4 3.6-2.4-.1-2.4-3.6Z" fill="#cf6f56"/>
    <ellipse cx="114" cy="86" rx="8" ry="2" fill="none" stroke="#e8f3ec" strokeOpacity=".7"/>
  </svg>;
}
