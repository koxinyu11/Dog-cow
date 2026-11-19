import type { GuestPhase, GuestVisit } from '../../../../../../shared/cafe/service';
import { cafeContent, item } from '../../../../../../shared/cafe/content';
import { along, door, pickup, queuePosition, seatPosition, type Point } from './layout';
export const phaseLabels: Record<GuestPhase, string> = {
  entering: '进店',
  queueing: '等候点单',
  brewing: '等待咖啡',
  'to-seat': '寻找座位',
  drinking: '喝咖啡',
  leaving: '离店',
};
const coats = ['#8a9b78', '#b28b70', '#7e929b', '#c3a262', '#aa7e7a', '#858698'];
const skin = ['#e8c5a3', '#bd9274', '#dbb18d', '#9e745c'];
export function guestPosition(guest: GuestVisit, phase: GuestPhase, now: number, rank: number): Point {
  const queue = queuePosition(rank);
  const seat = guest.seat === null ? pickup : seatPosition(guest.seat);
  if (phase === 'entering') return along([door, { x: 524, y: 490 }, queue], (now - guest.arrival + 3) / 3);
  if (phase === 'queueing') return queue;
  if (phase === 'brewing') return { x: 616, y: 254 + Math.min(rank, 3) * 18 };
  if (phase === 'to-seat') return along([pickup, { x: 538, y: seat.y + 30 }, seat], (now - guest.ready) / 3);
  if (phase === 'drinking') return seat;
  const origin = guest.outcome !== 'served' ? queue : guest.dineIn ? seat : pickup;
  const duration = guest.outcome !== 'served' ? 2 : 3;
  return along([origin, { x: 533, y: 482 }, door], (now - guest.leaves + duration) / duration);
}
export function Guest({
  guest,
  phase,
  now,
  rank,
  selected,
  select,
}: {
  guest: GuestVisit;
  phase: GuestPhase;
  now: number;
  rank: number;
  selected: boolean;
  select(): void;
}) {
  const point = guestPosition(guest, phase, now, rank);
  const hash = [...guest.id].reduce((n, c) => n * 31 + c.charCodeAt(0), 0) >>> 0;
  const drink = item(cafeContent.drinks, guest.drink);
  const walking = ['entering', 'to-seat', 'leaving'].includes(phase);
  const cup = guest.outcome === 'served' && now >= guest.ready;
  const failure = guest.outcome !== 'served' && phase === 'leaving';
  return (
    <g
      transform={`translate(${point.x} ${point.y})`}
      className={`cf-guest${walking ? ' is-walking' : ''}${phase === 'drinking' ? ' is-drinking' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${{ office: '通勤客', student: '学生', neighbor: '街坊' }[guest.segment]}，${drink.name}，${phaseLabels[phase]}`}
      onClick={(e) => {
        e.stopPropagation();
        select();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      }}
    >
      {selected && (
        <ellipse cy="16" rx="22" ry="12" fill="none" stroke="#53664b" strokeWidth="2" strokeDasharray="3 3" />
      )}
      <ellipse cy="16" rx="15" ry="6" fill="#60553b" opacity=".13" />
      <g className="cf-guest-body">
        <path
          className="cf-guest-foot cf-foot-left"
          d="M-6 10v9"
          stroke="#514c42"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          className="cf-guest-foot cf-foot-right"
          d="M6 10v9"
          stroke="#514c42"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <rect x="-12" y="-4" width="24" height="20" rx="8" fill={coats[hash % coats.length]} />
        <ellipse cy="-9" rx="10" ry="11" fill={skin[hash % skin.length]} />
        <path
          d={hash % 2 ? 'M-10-9q0-17 14-10l6 12-8-6-12 5' : 'M-10-9q-2-15 12-13 10 1 8 14l-5-6-15 5'}
          fill="#625144"
        />
        <circle cx="-3" cy="-7" r="1" fill="#4a3f35" />
        <circle cx="4" cy="-7" r="1" fill="#4a3f35" />
        {guest.segment === 'office' && (
          <path d="M-4 4l4 7 4-7" stroke="#e5dfcd" strokeWidth="2" fill="none" />
        )}
        {guest.segment === 'student' && <rect x="-16" y="1" width="7" height="13" rx="3" fill="#b59c6a" />}
        {cup && (
          <g className="cf-guest-cup">
            <path d="M8 1h10l-1 12h-8z" fill="#fff5dc" />
            <path d="M7 1h12" stroke="#6e5943" strokeWidth="2" />
            <path d="M10 6h6" stroke="#829067" strokeWidth="2" />
          </g>
        )}
      </g>
      {!cup && (
        <g transform="translate(0 -38)">
          <rect
            x="-13"
            y="-10"
            width="26"
            height="22"
            rx="8"
            fill={failure ? '#e8c5ae' : '#fff8e7'}
            stroke="#c9bea6"
          />
          <text y="5" textAnchor="middle" fill="#685e48" fontSize="11">
            {failure ? { queue: '久', stock: '缺', seats: '满', served: '' }[guest.outcome] : drink.short}
          </text>
        </g>
      )}
    </g>
  );
}
