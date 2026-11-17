import { BOBBER, ROD_BASE, rodTip } from './palette';
import { rodLook, type RodSkinId } from '../../../../../../shared/fishing-gear';
import { RodGrip, RodReel, RodStroke, RodTrim } from '../GearArt';
type Phase = 'idle' | 'waiting' | 'signal' | 'reeling';
/** Rod, line and bobber. The rod re-mounts on cast so its swing animation replays. */
export function Tackle({ phase, color, float, skin = 'default', target = BOBBER }: { target?: readonly [number, number]; phase: Phase; color: string; float: boolean; skin?: RodSkinId }) {
  const look = rodLook(skin, color);
  const [bx, by] = ROD_BASE;
  const [tx, ty] = rodTip(phase);
  const [fx, fy] = target;
  const bend = phase === 'reeling' ? [bx + 60, ty + 30] : phase === 'signal' ? [bx + 70, by - 42] : [bx + 64, by - 40];
  const active = phase !== 'idle';
  const curve = `M${bx} ${by}Q${bend[0]} ${bend[1]} ${tx} ${ty}`;
  const bobber = skin === 'default' ? float ? '#d39a43' : '#cf6f56' : look.bobber;
  return <g data-rod-skin={skin}>
    <g className="df-rod-wrap" key={phase === 'waiting' ? 'cast' : 'rest'}>
      <RodStroke d={curve} look={look}/>
      <RodGrip d={`M${bx - 16} ${by + 12}L${bx + 6} ${by - 4}`} look={look} width={6.5}/>
      <RodReel x={bx - 2} y={by + 6} look={look}/>
      <circle cx={tx} cy={ty} r="1.8" fill={look.color}/><RodTrim x={tx} y={ty} look={look}/>
      {!active && <path d={`M${tx} ${ty}q2 30-4 52`} fill="none" stroke={look.line} strokeOpacity=".7" strokeWidth="1"/>}
      {!active && <circle cx={tx - 4} cy={ty + 54} r="3.4" fill={bobber}/>}
    </g>
    {active && <g className="df-cast">
      <path className="df-line" pathLength={1} d={phase === 'reeling' ? `M${tx} ${ty}L${fx} ${fy - 12}` : `M${tx} ${ty}Q${(tx + fx) / 2 + 10} ${phase === 'signal' ? ty + 20 : ty + 30} ${fx} ${fy - 12}`} fill="none" stroke={look.line} strokeOpacity=".85" strokeWidth={phase === 'reeling' ? 1.6 : 1.1}/>
      <g className="df-rings" fill="none" stroke="#e8f3ec"><ellipse cx={fx} cy={fy + 2} rx="22" ry="5"/><ellipse cx={fx} cy={fy + 2} rx="22" ry="5"/></g>
      {phase === 'waiting' && <g className="df-bubbles" fill="#eef7f1"><circle cx={fx + 16} cy={fy + 8} r="1.8"/><circle cx={fx - 14} cy={fy + 12} r="1.3"/><circle cx={fx + 24} cy={fy + 16} r="1.1"/></g>}
      {phase !== 'waiting' && <g className="df-drops" fill="#f2f8f3"><circle cx={fx - 14} cy={fy - 6} r="2"/><circle cx={fx + 14} cy={fy - 8} r="1.6"/><circle cx={fx + 2} cy={fy - 12} r="1.3"/><circle cx={fx - 4} cy={fy - 4} r="1.1"/></g>}
      <g className="df-bobber">
        <ellipse cx={fx} cy={fy + 3} rx="9" ry="2.4" fill="#16323a" opacity=".25"/>
        <path d={`M${fx} ${fy - 24}v12`} stroke="#3d3a33" strokeWidth="1.4"/>
        <ellipse cx={fx} cy={fy - 8} rx={float ? 6 : 4.6} ry="8" fill="#f7efdc"/>
        <path d={`M${fx - (float ? 6 : 4.6)} ${fy - 8}h${float ? 12 : 9.2}q0 8-${float ? 6 : 4.6} 9-${float ? 6 : 4.6}-1-${float ? 6 : 4.6}-9Z`} fill={bobber}/>
        <ellipse cx={fx - 2} cy={fy - 11} rx="1.4" ry="3" fill="#fff" opacity=".8"/>
        <circle cx={fx} cy={fy - 24} r="1.8" fill={bobber}/>
        {look.motif === 'leaf' && <path d={`M${fx} ${fy - 20}q-9-9-9-1 5 6 9 1Z`} fill={look.color}/>}
        {look.motif === 'ice' && <path d={`m${fx} ${fy - 18} 4 5-4 5-4-5Z`} fill={look.accent} opacity=".8"/>}
        <path d={`M${fx - 9} ${fy + 1}q9 3 18 0`} fill="none" stroke="#e8f3ec" strokeOpacity=".6" strokeWidth="1"/>
      </g>
    </g>}
  </g>;
}
