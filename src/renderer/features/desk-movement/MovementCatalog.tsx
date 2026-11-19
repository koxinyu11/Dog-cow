import { useEffect, useState } from 'react';
import { Check, Plus, Timer } from 'lucide-react';
import { deskMoveIds, deskMoves, deskRegions, supports, type DeskMove, type DeskRegion } from '../../../shared/desk-movement';
import { Segmented } from '../../ui';
import { MovementDiagram } from './MovementDiagram';
import { ICON, STROKE, regionIcons, supportIcons, supportLabels, type DeskSupport } from './movement-icons';
import { duration } from './movement-stats';

/** Static peak pose; plays the loop while hovered or focused. */
export function MovementThumb({ move, active = false }: { move: DeskMove; active?: boolean }) {
  const [elapsed, setElapsed] = useState(2000);
  useEffect(() => {
    if (!active) { setElapsed(2000); return; }
    const start = performance.now() - 2000;
    let frame = requestAnimationFrame(function tick(time) {
      setElapsed(time - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return <span className="dm-thumb" aria-hidden="true"><MovementDiagram move={move} elapsed={elapsed} /></span>;
}

function MoveTile({ id, selected, onSelect }: { id: DeskMove; selected?: boolean; onSelect(): void }) {
  const [hover, setHover] = useState(false);
  const move = deskMoves[id];
  const SupportIcon = supportIcons[move.support];
  return <button type="button" className="dm-tile" aria-pressed={selected} onClick={onSelect}
    onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
    <MovementThumb move={id} active={hover} />
    <span className="dm-tile-name">{move.label}</span>
    <span className="dm-tile-meta">
      <span><Timer size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{duration(move.seconds)}</span>
      <span><SupportIcon size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{supportLabels[move.support]}</span>
    </span>
    {selected !== undefined && <span className="dm-tile-mark" aria-hidden="true">
      {selected ? <Check size={ICON.tag} strokeWidth={STROKE} /> : <Plus size={ICON.tag} strokeWidth={STROKE} />}
    </span>}
  </button>;
}

type Posture = 'all' | 'seated' | 'standing';

export function MovementCatalog({ eligible, selected, onSelect }: {
  eligible?: (move: DeskMove) => boolean;
  selected?: readonly DeskMove[];
  onSelect(move: DeskMove): void;
}) {
  const [regions, setRegions] = useState<DeskRegion[]>([]);
  const [posture, setPosture] = useState<Posture>('all');
  const [support, setSupport] = useState<DeskSupport | ''>('');
  const visible = deskMoveIds.filter(id => {
    const move = deskMoves[id];
    return (!eligible || eligible(id)) && (!regions.length || move.regions.some(part => regions.includes(part))) &&
      (posture === 'all' || (posture === 'seated') === move.seated) && (!support || move.support === support);
  });
  const toggleRegion = (region: DeskRegion) =>
    setRegions(current => current.includes(region) ? current.filter(item => item !== region) : [...current, region]);
  return <div className="dm-catalog">
    <div className="dm-filters">
      <Segmented<Posture> label="姿势" value={posture} onChange={setPosture}
        options={[['all', '全部'], ['seated', '坐姿'], ['standing', '站姿 / 步行']]} />
      <div className="dm-chip-row" role="group" aria-label="部位">
        {deskRegions.map(region => {
          const Icon = regionIcons[region];
          return <button type="button" key={region} className="dm-chip" aria-pressed={regions.includes(region)} onClick={() => toggleRegion(region)}>
            <Icon size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{region}
          </button>;
        })}
      </div>
      <div className="dm-chip-row" role="group" aria-label="场地">
        {supports.map(item => {
          const Icon = supportIcons[item];
          return <button type="button" key={item} className="dm-chip is-quiet" aria-pressed={support === item} onClick={() => setSupport(support === item ? '' : item)}>
            <Icon size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{supportLabels[item]}
          </button>;
        })}
      </div>
    </div>
    <div className="dm-grid">
      {visible.map(id => <MoveTile key={id} id={id} selected={selected ? selected.includes(id) : undefined} onSelect={() => onSelect(id)} />)}
    </div>
    {!visible.length && <p className="dm-empty">没有符合条件的动作</p>}
  </div>;
}
