import { useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Flame, Timer, Trophy } from 'lucide-react';
import { localMovementDate, type DeskMovementData } from '../../../shared/desk-movement';
import { IconButton, Stat } from '../../ui';
import { ICON } from './movement-icons';
import { dayLevel, dayNames, dayTotals, duration, streak, weekOrder } from './movement-stats';

const weekdays = weekOrder.map(day => dayNames[day]);

export function MovementHistory({ records }: { records: DeskMovementData['records'] }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const start = (first.getDay() + 6) % 7;
  const totals = dayTotals(records);
  const month = localMovementDate(first).slice(0, 7);
  const today = localMovementDate(now);
  const monthRecords = records.filter(record => record.date.startsWith(month));
  const monthDays = new Set(monthRecords.map(record => record.date)).size;
  const monthSeconds = monthRecords.reduce((sum, record) => sum + record.seconds, 0);
  const measured = monthRecords.filter(record => record.kcal !== undefined);
  const monthKcal = measured.length ? `${measured.reduce((sum, record) => sum + (record.kcal ?? 0), 0).toFixed(1)} kcal` : '—';
  const days = streak(totals, now);
  return <div className="dm-page dm-history">
    <div className="dm-stats">
      <Stat icon={Trophy} label="连续" value={`${days} 天`} />
      <Stat icon={CalendarCheck} label="本月" value={`${monthDays} 天`} />
      <Stat icon={Timer} label="本月时长" value={duration(monthSeconds)} />
      <Stat icon={Flame} label="本月热量" value={monthKcal} />
    </div>
    <div className="dm-month">
      <IconButton size="sm" variant="ghost" label="上个月" onClick={() => setOffset(offset - 1)}><ChevronLeft size={ICON.btn} /></IconButton>
      <strong>{first.getFullYear()} 年 {first.getMonth() + 1} 月</strong>
      <IconButton size="sm" variant="ghost" label="下个月" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}><ChevronRight size={ICON.btn} /></IconButton>
    </div>
    <div className="dm-calendar">
      {weekdays.map(day => <span key={day} className="dm-weekday">{day}</span>)}
      {Array.from({ length: start }, (_, index) => <span key={`pad-${index}`} />)}
      {Array.from({ length: count }, (_, index) => {
        const date = localMovementDate(new Date(first.getFullYear(), first.getMonth(), index + 1));
        const seconds = totals.get(date);
        const label = seconds ? `${date} · ${duration(seconds)}` : date;
        return <span key={date} className={`dm-day level-${dayLevel(seconds)}${date === today ? ' is-today' : ''}`} title={label} aria-label={label}>{index + 1}</span>;
      })}
    </div>
    <div className="dm-legend" aria-hidden="true">少{[0, 1, 2, 3].map(level => <i key={level} className={`dm-day level-${level}`} />)}多</div>
  </div>;
}
