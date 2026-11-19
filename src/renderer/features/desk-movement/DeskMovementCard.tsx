import { useState } from 'react';
import { Footprints, LayoutGrid, Play } from 'lucide-react';
import type { SizeKey } from '../../../shared/board';
import { localMovementDate, seatedQuick, type DeskMovementData } from '../../../shared/desk-movement';
import { Button, IconButton, Ring } from '../../ui';
import { launchDeskMovement } from './DeskMovementLauncher';
import { MovementThumb } from './MovementCatalog';
import { ICON, accentStyle } from './movement-icons';
import { DAILY_TARGET_SECONDS, dayLevel, dayTotals, duration, planSeconds } from './movement-stats';
import { useDeskMovement } from './use-desk-movement';
import './desk-movement.css';

function lastWeek(data?: DeskMovementData) {
  const totals = data ? dayTotals(data.records) : new Map<string, number>();
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = localMovementDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index));
    return { date, seconds: totals.get(date) ?? 0 };
  });
}

export function DeskMovementCard({ size }: { size: SizeKey }) {
  const { data } = useDeskMovement();
  const [hover, setHover] = useState(false);
  const week = lastWeek(data);
  const today = week[6].seconds;
  const plan = data?.plan.moves ?? [...seatedQuick];
  const large = size === 'l' || size === 'tall';
  const hoverable = { onPointerEnter: () => setHover(true), onPointerLeave: () => setHover(false) };
  return <div className={`desk-movement-card dm-card layout-${size}`} style={accentStyle}>
    {large && <div className="dm-card-hero" {...hoverable}>
      <MovementThumb move={plan[0]} active={hover} />
      {data?.due && <span className="dm-card-due">该动一动了</span>}
    </div>}
    <div className="dm-card-status">
      {size === 'm' ? <span className="dm-card-figure" {...hoverable}>
        <MovementThumb move={plan[0]} active={hover} />
        {data?.due && <span className="dm-card-due">该动了</span>}
      </span> : <Ring value={today / DAILY_TARGET_SECONDS} size={size === 's' ? 54 : 64} stroke={5} color="var(--dm)">
        <span className="dm-card-today"><b>{Math.floor(today / 60)}</b><small>分</small></span>
      </Ring>}
      <div className="dm-card-copy">
        <strong>今日 {duration(today)}</strong>
        {large ? <span className="dm-week" aria-label="最近 7 天">
          {week.map(day => <i key={day.date} className={`dm-day level-${dayLevel(day.seconds)}`} title={`${day.date} · ${duration(day.seconds)}`} />)}
        </span> : <small>{plan.length} 个动作 · {duration(planSeconds(plan))}</small>}
      </div>
    </div>
    <div className="dm-card-actions">
      <Button size="sm" variant="primary" icon={<Play size={ICON.tag} fill="currentColor" />} onClick={() => launchDeskMovement('start-plan')}>
        {size === 's' ? '开始' : `开始计划 · ${duration(planSeconds(plan))}`}
      </Button>
      {size !== 's' && <>
        <IconButton size="sm" variant="soft" label="步行 3 分钟" onClick={() => launchDeskMovement('walk')}><Footprints size={ICON.btn} /></IconButton>
        <IconButton size="sm" variant="soft" label="动作库" onClick={() => launchDeskMovement('moves')}><LayoutGrid size={ICON.btn} /></IconButton>
      </>}
    </div>
  </div>;
}
