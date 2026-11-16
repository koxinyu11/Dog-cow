import { useState } from 'react';
import { rods, species, rarities, type FishingResult, type RodId, type SpotId } from '../../../../../shared/fishing';
import { CatchArt, OutcomeArt } from './Art';
import { palettes, timeOfDay, BOBBER } from './scene/palette';
import { Sky } from './scene/Sky';
import { Backdrop } from './scene/Backdrop';
import { Water } from './scene/Water';
import { Bank, Dock } from './scene/Foreground';
import { Angler } from './scene/Angler';
import { Tackle } from './scene/Tackle';
import { useSceneAnchor } from './scene/useSceneAnchor';
type Phase = 'idle' | 'waiting' | 'signal' | 'reeling';
/** Visual tier of a revealed result; drives the card style only. */
export function tierOf(result: FishingResult) {
  if (result.kind === 'broken') return 'broken';
  const entry = species.find(s => s.id === result.species);
  if (!entry) return 'empty';
  return entry.rarity >= 4 ? 'legend' : entry.rarity >= 2 ? 'rare' : 'common';
}
function ResultArt({ result }: { result: FishingResult }) {
  const entry = species.find(s => s.id === result.species);
  if (entry) return <CatchArt entry={entry}/>;
  return <OutcomeArt kind={result.kind === 'broken' ? 'broken' : result.name.includes('水草') ? 'weed' : 'empty'}/>;
}
export function Scene({ rod, spot, phase, signal, paused, result, net, float }: {
  rod: RodId; spot: SpotId; phase: Phase; signal?: string; paused: boolean; result: FishingResult | null; net: boolean; float: boolean;
}) {
  const { ref, viewBox, at } = useSceneAnchor();
  const anchor = at(BOBBER[0], BOBBER[1]);
  const time = timeOfDay();
  const p = palettes[time];
  const entry = result && species.find(s => s.id === result.species);
  const tier = result && tierOf(result);
  const caught = !!entry;
  const mood = phase !== 'idle' ? phase : caught ? 'happy' : 'idle';
  const key = result ? `${result.name}-${result.kg}-${result.species ?? ''}` : '';
  // The reveal plays once per result: a result restored on mount, or one already shown, stays still.
  const [settled, setSettled] = useState(key);
  const fresh = !!result && settled !== key;
  return <div className={`df-scene time-${time} ${paused ? 'is-paused' : ''}`} data-phase={phase} data-spot={spot} ref={ref} style={{ ['--df-title' as string]: p.title }}>
    <svg className="df-landscape" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="df-sky" x2="0" y2="1"><stop stopColor={p.sky[0]}/><stop offset=".6" stopColor={p.sky[1]}/><stop offset="1" stopColor={p.sky[2]}/></linearGradient>
        <linearGradient id="df-water" x2="0" y2="1"><stop stopColor={p.water[0]}/><stop offset="1" stopColor={p.water[1]}/></linearGradient>
        <radialGradient id="df-glow"><stop stopColor={p.glow} stopOpacity=".7"/><stop offset=".4" stopColor={p.glow} stopOpacity=".22"/><stop offset="1" stopColor={p.glow} stopOpacity="0"/></radialGradient>
        <radialGradient id="df-vignette" cx=".5" cy=".45" r=".75"><stop offset=".6" stopColor="#0d1f1c" stopOpacity="0"/><stop offset="1" stopColor="#0d1f1c" stopOpacity=".28"/></radialGradient>
        <filter id="df-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .22  0 0 0 0 .18  0 0 0 .55 0"/></filter>
      </defs>
      <Sky p={p} time={time}/>
      <Backdrop p={p} spot={spot}/>
      <Water p={p} spot={spot}/>
      <Bank spot={spot}/>
      <Dock net={net}/>
      <Angler mood={mood}/>
      <Tackle phase={phase} color={rods.find(r => r.id === rod)!.color} float={float}/>
      {time === 'night' && <g className="df-fireflies" fill="#f7f0a2">{[[90, 230], [820, 200], [700, 240], [150, 210], [866, 260], [40, 250]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" style={{ animationDelay: `${i * 1.1}s` }}/>)}</g>}
      <rect x="-50" y="-50" width="1000" height="500" fill={p.tint} opacity={p.tintOpacity} style={{ mixBlendMode: 'multiply' }}/>
      <rect x="-50" y="-50" width="1000" height="500" filter="url(#df-grain)" opacity=".14" style={{ mixBlendMode: 'multiply' }}/>
      <rect x="-50" y="-50" width="1000" height="500" fill="url(#df-vignette)"/>
    </svg>
    <div className="df-scene-title"><span>{spot === 'river' ? 'REED RIVER' : 'THE AFTERNOON POND'}</span><strong>{spot === 'river' ? '去水深处，碰碰运气。' : '把时间，放慢一点。'}</strong></div>
    {phase === 'signal' && <div className="df-signal" role="status" style={anchor}><i/>{signal}</div>}
    {phase === 'idle' && result && <>
      {caught && fresh && <div className="df-leap" key={`leap-${key}`} style={anchor} onAnimationEnd={() => setSettled(key)}><ResultArt result={result}/></div>}
      <div className={`df-catch tier-${tier} ${result.newDiscovery ? 'is-new' : ''} ${!fresh ? 'is-settled' : caught ? 'is-delayed' : ''}`} role="status" key={`card-${key}`} onAnimationEnd={event => { if (event.target === event.currentTarget) setSettled(key); }}>
        <span className="df-tag-hole" aria-hidden="true"/>
        {tier === 'legend' && <span className="df-sparkles" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <i key={i}/>)}</span>}
        <div className="df-catch-art"><ResultArt result={result}/></div>
        <div className="df-catch-text">
          <div className="df-catch-tags">{result.newDiscovery && <small className="df-new">图鉴 +1</small>}{entry && <small className={`df-tag rarity-${entry.rarity}`}>{rarities[entry.rarity]}</small>}</div>
          <strong>{result.name}</strong>
          <span>{entry?.visitor ? '它没有进鱼篓，只是来看看你' : result.kg ? `${result.kg.toFixed(2)} kg` : '下次会有什么呢'}{result.value !== undefined ? ` · ${result.value} 狗牛币` : ''}</span>
        </div>
      </div>
    </>}
  </div>;
}
