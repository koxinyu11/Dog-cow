import { useState } from 'react';
import { deskMoves, deskRegions, eligibleDeskMove, localMovementDate, validDeskPlan, type DeskMovementData, type DeskPlan } from '../../../shared/desk-movement';
import { Button } from '../../ui';
import { command } from '../../state';

import { MovementCatalog } from './MovementCatalog';
const days = [1, 2, 3, 4, 5, 6, 0];

export function MovementPlan({ initial, onSaved }: { initial: DeskPlan; onSaved(data: DeskMovementData): void }) {
  const [plan, setPlan] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const filter = (patch: Partial<DeskPlan>) => setPlan(current => {
    const next = { ...current, ...patch };
    return { ...next, moves: next.moves.filter(move => eligibleDeskMove(move, next)) };
  });
  const move = (index: number, step: number) => setPlan(current => {
    const moves = [...current.moves];
    [moves[index], moves[index + step]] = [moves[index + step], moves[index]];
    return { ...current, moves };
  });
  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await command('deskMovement', { action: 'plan', plan });
      if (!result.deskMovement) throw Error('Plan save failed');
      onSaved(result.deskMovement);
    } catch { setMessage('计划未保存，请重试。'); }
    finally { setBusy(false); }
  };
  const seconds = plan.moves.reduce((total, id) => total + deskMoves[id].seconds, 0);
  return <div className="desk-movement-session">
    <label><input type="checkbox" checked={plan.seatedOnly} onChange={e => filter({ seatedOnly: e.target.checked })} /> 仅坐姿</label>
    <fieldset><legend>避开部位</legend><div className="desk-movement-actions">
      {deskRegions.map(region => <label key={region}><input type="checkbox" checked={plan.excluded.includes(region)}
        onChange={e => filter({ excluded: e.target.checked ? [...plan.excluded, region] : plan.excluded.filter(item => item !== region) })} /> {region}</label>)}
    </div></fieldset>
    <fieldset><legend>可选动作</legend>
      <MovementCatalog eligible={id => eligibleDeskMove(id, plan)} selected={plan.moves}
        onSelect={id => setPlan(current => ({ ...current, moves: current.moves.includes(id) ? current.moves.filter(item => item !== id) : [...current.moves, id] }))} />
    </fieldset>
    <ol className="movement-plan-order">
      {plan.moves.map((id, index) => <li key={id}>{deskMoves[id].label}
        <button type="button" disabled={index === 0} aria-label={`上移${deskMoves[id].label}`} onClick={() => move(index, -1)}>↑</button>
        <button type="button" disabled={index === plan.moves.length - 1} aria-label={`下移${deskMoves[id].label}`} onClick={() => move(index, 1)}>↓</button>
      </li>)}
    </ol>
    <label><input type="checkbox" checked={plan.reminder} onChange={e => setPlan({ ...plan, reminder: e.target.checked })} /> 定时提醒</label>
    {plan.reminder && <fieldset><legend>提醒日和时间</legend><div className="desk-movement-actions">
      {days.map(day => <label key={day}><input type="checkbox" checked={plan.days.includes(day)}
        onChange={e => setPlan({ ...plan, days: e.target.checked ? [...plan.days, day] : plan.days.filter(item => item !== day) })} />{['日', '一', '二', '三', '四', '五', '六'][day]}</label>)}
      <input type="time" aria-label="提醒时间" value={plan.time} onChange={e => setPlan({ ...plan, time: e.target.value })} />
    </div></fieldset>}
    <div className="desk-movement-actions">
      <Button variant="primary" disabled={busy || !validDeskPlan(plan)} onClick={() => void save()}>保存计划</Button>
      <span>{seconds ? `共 ${seconds} 秒` : '请选择至少一个动作'}</span>
    </div>
    {message && <p role="alert">{message}</p>}
  </div>;
}

export function MovementHistory({ records }: { records: DeskMovementData['records'] }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const start = (first.getDay() + 6) % 7;
  const totals = new Map<string, number>();
  for (const record of records) totals.set(record.date, (totals.get(record.date) ?? 0) + record.seconds);
  const month = localMovementDate(first).slice(0, 7);
  const today = localMovementDate(now);
  const calories = (prefix: string) => {
    const measured = records.filter(record => record.date.startsWith(prefix) && record.kcal !== undefined);
    return measured.length ? `约 ${measured.reduce((sum, record) => sum + (record.kcal ?? 0), 0).toFixed(1)} kcal` : '—';
  };
  const time = records.reduce((sum, record) => sum + record.seconds, 0);
  return <div className="desk-movement-session">
    <p>累计 {totals.size} 天 · {Math.floor(time / 60)} 分 {time % 60} 秒</p>
    <div className="desk-movement-actions">
      <button type="button" aria-label="上个月" onClick={() => setOffset(offset - 1)}>‹</button>
      <strong>{first.getFullYear()} 年 {first.getMonth() + 1} 月</strong>
      <button type="button" aria-label="下个月" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>›</button>
    </div>
    <dl className="movement-energy">
      <div><dt>今天</dt><dd>{calories(today)}</dd></div>
      <div><dt>所选月</dt><dd>{calories(month)}</dd></div>
      <div><dt>累计热量</dt><dd>{calories('')}</dd></div>
    </dl>
    <div className="movement-calendar">
      {['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day}>{day}</span>)}
      {Array.from({ length: start }, (_, index) => <span key={`pad-${index}`} />)}
      {Array.from({ length: count }, (_, index) => {
        const date = localMovementDate(new Date(first.getFullYear(), first.getMonth(), index + 1));
        const seconds = totals.get(date);
        return <span key={date} className={seconds ? 'movement-day-complete' : undefined} title={seconds ? `${date} · ${seconds} 秒` : date}
          aria-label={seconds ? `${date} · ${seconds} 秒` : date}>{index + 1}</span>;
      })}
    </div>
  </div>;
}
