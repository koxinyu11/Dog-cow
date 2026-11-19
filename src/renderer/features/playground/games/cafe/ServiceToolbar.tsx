import { Pause, Play, FastForward } from 'lucide-react';
import { serviceTime, serviceTotals, type ServiceTimeline } from '../../../../../shared/cafe/service';
import { yuan } from '../../../../../shared/cafe/finance';
export function ServiceToolbar({
  timeline,
  cursor,
  playing,
  speed,
  disabled,
  toggle,
  setSpeed,
  finish,
}: {
  timeline?: ServiceTimeline;
  cursor: number;
  playing: boolean;
  speed: number;
  disabled: boolean;
  toggle(): void;
  setSpeed(speed: number): void;
  finish(): void;
}) {
  if (!timeline) return null;
  const time = serviceTime(timeline, cursor),
    total = serviceTotals(timeline, time.absolute);
  const clock = `${time.hour.toString().padStart(2, '0')}:${Math.min(59, Math.floor(time.minute)).toString().padStart(2, '0')}`;
  return (
    <div className="cf-service-toolbar">
      <div className="cf-service-time">
        <span>周{['一', '二', '三', '四', '五', '六', '日'][time.day % 7]}</span>
        <strong>{clock}</strong>
        <span>{time.closing ? '打烊' : '营业'}</span>
      </div>
      <div className="cf-service-totals">
        <span>
          已出杯 <b>{total.served}</b>
        </span>
        <span>
          本周营业额 <b>{yuan(total.revenue)}</b>
        </span>
        <span>
          流失 <b>{total.lost}</b>
        </span>
      </div>
      <div className="cf-service-controls">
        <button disabled={disabled} onClick={toggle} aria-label={playing ? '暂停营业演出' : '继续营业演出'}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <div className="cf-speed" aria-label="营业速度">
          {[1, 4, 12].map((n) => (
            <button key={n} aria-pressed={speed === n} disabled={disabled} onClick={() => setSpeed(n)}>
              {n}×
            </button>
          ))}
        </div>
        <button disabled={disabled} onClick={finish}>
          <FastForward size={15} />
          完成本周
        </button>
      </div>
      <progress aria-label="本周营业进度" value={cursor} max={timeline.duration} />
    </div>
  );
}
