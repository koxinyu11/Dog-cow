import { useState } from 'react';
import { guestPhase, serviceTime, type ServiceTimeline } from '../../../../../../shared/cafe/service';
import type { CafeState } from '../../../../../../shared/cafe/types';
import { cafeContent, item } from '../../../../../../shared/cafe/content';
import { Floor } from './Floor';
import { Guest, phaseLabels } from './Guest';
export function Interior({
  state,
  timeline,
  cursor,
  playing,
}: {
  state: CafeState;
  timeline?: ServiceTimeline;
  cursor: number;
  playing: boolean;
}) {
  const [selected, select] = useState<string | null>(null);
  const location = item(cafeContent.locations, state.setup!.location);
  const time = timeline ? serviceTime(timeline, cursor) : null;
  const now = time?.absolute ?? -Infinity;
  const present =
    timeline?.guests.flatMap((guest) => {
      const phase = guestPhase(guest, now);
      return phase ? [{ guest, phase }] : [];
    }) ?? [];
  const queued = present
    .filter((p) => p.phase === 'queueing')
    .sort((a, b) => a.guest.arrival - b.guest.arrival);
  const highlighted = present.find((p) => p.guest.id === selected);
  const shift = time ? (time.hour < 11 ? 'morning' : time.hour < 15 ? 'afternoon' : 'evening') : null;
  const plan = state.run?.plan;
  const staff =
    shift && plan && !time?.closing
      ? (plan.shifts[shift].owner ? 1 : 0) +
        Object.values(plan.shifts[shift].staff).reduce((n, c) => n + c, 0)
      : 0;
  return (
    <div className="cf-interior" data-playing={playing}>
      <svg
        viewBox="0 0 1000 660"
        className="cf-floor"
        aria-label="咖啡馆店内，客人按实际订单排队、取餐和入座"
        onClick={() => select(null)}
      >
        <Floor seats={state.setup!.seats} color={location.color} running={!!state.run} />
        {Array.from({ length: Math.min(4, staff) }, (_, i) => (
          <g
            key={i}
            transform={`translate(${716 + (i % 2) * 72} ${234 + Math.floor(i / 2) * 64})`}
            className={present.some((p) => p.phase === 'brewing') ? 'cf-barista is-working' : 'cf-barista'}
          >
            <ellipse cy="17" rx="16" ry="6" fill="#45513c" opacity=".12" />
            <path d="M-6 12v8m12-8v8" stroke="#536048" strokeWidth="5" />
            <rect x="-12" y="-2" width="24" height="22" rx="6" fill="#69805d" />
            <path d="M-7 2h14v16H-7z" fill="#d9c8a0" />
            <ellipse cy="-10" rx="11" ry="10" fill="#e9d9b8" />
            <path d="M-10-13l-8-9 1 14m27-5 8-9-1 14" fill="#a7825c" />
            <circle cx="-4" cy="-10" r="1.4" fill="#4c4636" />
            <circle cx="4" cy="-10" r="1.4" fill="#4c4636" />
            <ellipse cy="-4" rx="6" ry="4" fill="#c5a082" />
            <g className="cf-barista-arm">
              <path d="M-11 6l-7 6" stroke="#e1c3a1" strokeWidth="5" strokeLinecap="round" />
              <rect x="-23" y="9" width="10" height="10" rx="2" fill="#f7efd9" />
            </g>
          </g>
        ))}
        {[...present]
          .sort((a, b) => a.guest.arrival - b.guest.arrival)
          .map(({ guest, phase }) => (
            <Guest
              key={guest.id}
              guest={guest}
              phase={phase}
              now={now}
              rank={Math.max(
                0,
                queued.findIndex((p) => p.guest.id === guest.id),
              )}
              selected={selected === guest.id}
              select={() => select(guest.id)}
            />
          ))}
      </svg>
      <div className="cf-floor-status">
        <span className={state.run ? 'is-open' : ''}>
          {state.phase === 'closed'
            ? '已停业'
            : state.run
              ? time?.closing
                ? '打烊整理'
                : '正在营业'
              : '准备开门'}
        </span>
        <span>
          {present.filter((p) => p.phase === 'drinking').length} / {state.setup!.seats} 席 · {queued.length}{' '}
          位等候
        </span>
      </div>
      {highlighted && (
        <div className="cf-guest-detail" role="status">
          <b>{item(cafeContent.drinks, highlighted.guest.drink).name}</b>
          <span>
            {phaseLabels[highlighted.phase]}
            {highlighted.phase === 'leaving' && highlighted.guest.outcome !== 'served'
              ? ` · ${{ queue: '等待过久', stock: '原料不足', seats: '座位已满' }[highlighted.guest.outcome]}`
              : ''}
          </span>
          <button onClick={() => select(null)} aria-label="关闭顾客信息">
            ×
          </button>
        </div>
      )}
      {!state.run && state.phase !== 'closed' && (
        <div className="cf-floor-invitation">
          <span>
            {state.reports.length ? '下一周，继续把小店经营好。' : '小店准备好了，等第一位客人进门。'}
          </span>
        </div>
      )}
    </div>
  );
}
