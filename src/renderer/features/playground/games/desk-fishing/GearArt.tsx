import { useId } from 'react';
import { rodLook, type SupplyId } from '../../../../../shared/fishing-gear';
type Look = ReturnType<typeof rodLook>;

/** The scene and shop share the same shaft, grip, reel and tip decorations. */
export function RodStroke({ d, look, width = 4.2 }: { d: string; look: Look; width?: number }) {
  const id = useId().replace(/:/g, '');
  const dash = { plain: '', leaf: '1 10', weave: '3 2', stars: '1 7', scales: '6 2 1 2', ice: '7 2 1 2', bones: '5 3' }[look.motif];
  return <>
    <defs><linearGradient id={`${id}rod`} x1="0" x2="100%" y1="100%" y2="0"><stop stopColor={look.color}/><stop offset=".65" stopColor={look.color}/><stop offset="1" stopColor={look.accent}/></linearGradient></defs>
    <path d={d} fill="none" stroke={look.id === 'default' ? look.color : `url(#${id}rod)`} strokeWidth={width} strokeLinecap="round"/>
    <path d={d} fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth={width * .27} strokeLinecap="round" transform="translate(-.6 -.6)"/>
    {dash && <path d={d} fill="none" stroke={look.accent} strokeWidth={width * .7} strokeDasharray={dash} strokeLinecap="round" opacity=".85"/>}
  </>;
}
export function RodGrip({ d, look, width }: { d: string; look: Look; width: number }) {
  return <><path d={d} stroke={look.grip} strokeWidth={width} strokeLinecap="round"/>
    {look.id !== 'default' && <path d={d} stroke={look.accent} strokeWidth={width * .7} strokeDasharray={look.motif === 'weave' ? '1 2' : '1 4'} strokeOpacity=".65"/>}</>;
}
export function RodReel({ x, y, look, radius = 6 }: { x: number; y: number; look: Look; radius?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${radius / 6})`}>
    <circle r="6" fill={look.accent} stroke={look.grip} strokeWidth="1.8"/>
    {look.motif === 'stars' ? <path d="M1-4a4 4 0 1 0 2 7A5 5 0 0 1 1-4Z" fill={look.color}/>
      : look.motif === 'ice' ? <path d="m0-4 3 4-3 4-3-4Z" fill={look.color} stroke="#fff" strokeWidth=".6"/>
      : look.motif === 'bones' ? <><ellipse rx="7.5" ry="2.8" transform="rotate(-32)" fill="none" stroke={look.color} strokeWidth="1"/><circle r="2" fill={look.color}/></>
      : look.motif === 'leaf' ? <path d="M-3 3q-1-6 6-6 0 6-6 6Z" fill={look.color}/>
      : <path d="m-2 1 5-3" stroke={look.grip} strokeWidth="1.5" strokeLinecap="round"/>}
  </g>;
}
export function RodTrim({ x, y, look, scale = 1 }: { x: number; y: number; look: Look; scale?: number }) {
  if (look.motif === 'plain' || look.motif === 'weave') return null;
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill={look.accent} stroke={look.color} strokeWidth=".8">
    {look.motif === 'leaf' && <path d="M0 0Q-10-9-12-2-9 5 0 0Z" fill={look.bobber}/>}
    {look.motif === 'stars' && <><path d="m-9-9 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z"/><circle cx="-19" cy="-2" r="1.2"/></>}
    {look.motif === 'scales' && <><path d="M0 0v9" fill="none"/><path d="M0 9q-7-8-9-3l6 7-5 7q7 2 8-5 1 7 8 5l-5-7 6-7q-2-5-9 3Z"/></>}
    {look.motif === 'ice' && <path d="M0 0-6-9M-6-9l-6 1m6-1 1-7M-3-4l6-7" fill="none" stroke={look.accent} strokeWidth="1.5"/>}
    {look.motif === 'bones' && <><path d="M0 0v10" fill="none"/><path d="m0 9 5 4-5 5-5-5Z"/><circle cx="-9" cy="-6" r="1.5" fill={look.color}/></>}
  </g>;
}
export function SupplyArt({ id }: { id: SupplyId | 'repair' }) {
  return <svg className="df-tool-art" viewBox="0 0 48 48" aria-hidden="true">
    {id === 'scout' && <><path d="M12 9h24l-2 31H14Z" fill="#a7b69b"/><path d="M14 14h20" stroke="#e8ddbb" strokeWidth="4"/><path d="M18 27q6-8 12 0-6 8-12 0Zm12 0 5-4v8Z" fill="#f1e3bd"/><circle cx="21" cy="26" r="1" fill="#536f63"/><path d="m33 5 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#d1ad64"/></>}
    {id === 'magnet' && <><path d="M13 9v17a11 11 0 0 0 22 0V9" fill="none" stroke="#a97566" strokeWidth="9"/><path d="M13 9v8M35 9v8" stroke="#bccbd0" strokeWidth="9"/><circle cx="24" cy="38" r="6" fill="#dbbc73"/><path d="m24 35 2 3-2 3-2-3Z" fill="#fff0b3"/></>}
    {id === 'guard' && <><path d="M24 4 40 10v13q0 14-16 22Q8 37 8 23V10Z" fill="#8eaba5"/><path d="M24 9 35 14v10q0 9-11 15-11-6-11-15V14Z" fill="none" stroke="#e3d7ac" strokeWidth="2"/><path d="M18 24h12M24 18v12" stroke="#f5ecd4" strokeWidth="3" strokeLinecap="round"/></>}
    {id === 'repair' && <><path d="M12 37 32 17" stroke="#b69c73" strokeWidth="8" strokeLinecap="round"/><path d="m29 5-3 9 8 8 9-3q0 10-10 10-13-2-11-14 1-7 7-10Z" fill="#95aaa7"/><circle cx="12" cy="37" r="2.5" fill="#eee6cf"/><path d="m10 7 3 5 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1Z" fill="#dbc98b"/></>}
  </svg>;
}
