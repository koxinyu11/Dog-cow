import { useState } from 'react';
import { deskMoveIds, deskMoves, deskRegions, supports, type DeskMove } from '../../../shared/desk-movement';

export function MovementCatalog({ eligible, selected, onSelect }: {
  eligible?: (move: DeskMove) => boolean;
  selected?: readonly DeskMove[];
  onSelect(move: DeskMove): void;
}) {
  const [region, setRegion] = useState('');
  const [posture, setPosture] = useState('');
  const [support, setSupport] = useState('');
  const visible = deskMoveIds.filter(id => {
    const move = deskMoves[id];
    return (!eligible || eligible(id)) && (!region || move.regions.some(part => part === region)) &&
      (!posture || (posture === 'seated') === move.seated) && (!support || move.support === support);
  });
  return <div className="movement-catalog">
    <div className="desk-movement-actions">
      <select aria-label="部位" value={region} onChange={event => setRegion(event.target.value)}>
        <option value="">全部部位</option>
        {deskRegions.map(part => <option key={part}>{part}</option>)}
      </select>
      <select aria-label="姿势" value={posture} onChange={event => setPosture(event.target.value)}>
        <option value="">全部姿势</option><option value="seated">坐姿</option><option value="standing">站姿或步行</option>
      </select>
      <select aria-label="所需支撑" value={support} onChange={event => setSupport(event.target.value)}>
        <option value="">全部场地</option>{supports.map(item => <option key={item}>{item}</option>)}
      </select>
    </div>
    <div className="movement-catalog-results">
      {visible.map(id => <button type="button" key={id} aria-pressed={selected ? selected.includes(id) : undefined} onClick={() => onSelect(id)}>
        <span>{deskMoves[id].label}</span>
        <small>{deskMoves[id].support}{selected?.includes(id) ? ' · 已加入' : ''}</small>
      </button>)}
      {!visible.length && <p>没有符合条件的动作</p>}
    </div>
  </div>;
}
