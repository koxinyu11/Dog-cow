import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Bell, ListOrdered, Plus, SlidersHorizontal, X } from 'lucide-react';
import { deskMoves, deskRegions, eligibleDeskMove, validDeskPlan, type DeskMovementData, type DeskPlan } from '../../../shared/desk-movement';
import { TimePicker } from '../../components/TimePicker';
import { command } from '../../state';
import { Button, IconButton, Switch } from '../../ui';
import { MovementCatalog, MovementThumb } from './MovementCatalog';
import { ICON, STROKE, regionIcons } from './movement-icons';
import { dayNames, duration, planSeconds, weekOrder } from './movement-stats';


export function MovementPlan({ initial, onSaved, onCancel }: { initial: DeskPlan; onSaved(data: DeskMovementData): void; onCancel(): void }) {
  const avoidLabel = useId();
  const [plan, setPlan] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const filter = (patch: Partial<DeskPlan>) => setPlan(current => {
    const next = { ...current, ...patch };
    return { ...next, moves: next.moves.filter(move => eligibleDeskMove(move, next)) };
  });
  const swap = (index: number, step: number) => setPlan(current => {
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
  const seconds = planSeconds(plan.moves);
  return <div className="dm-page dm-editor">
    <section className="dm-section">
      <h3><ListOrdered size={ICON.btn} strokeWidth={STROKE} aria-hidden="true" />动作顺序</h3>
      <ol className="dm-plan-list">
        {plan.moves.map((id, index) => <li key={id}>
          <span className="dm-plan-index">{index + 1}</span>
          <MovementThumb move={id} />
          <span className="dm-plan-name">{deskMoves[id].label}<small>{duration(deskMoves[id].seconds)}</small></span>
          <span className="dm-plan-tools">
            <IconButton size="sm" variant="ghost" label={`上移${deskMoves[id].label}`} disabled={index === 0} onClick={() => swap(index, -1)}><ArrowUp size={ICON.btn} /></IconButton>
            <IconButton size="sm" variant="ghost" label={`下移${deskMoves[id].label}`} disabled={index === plan.moves.length - 1} onClick={() => swap(index, 1)}><ArrowDown size={ICON.btn} /></IconButton>
            <IconButton size="sm" variant="ghost" label={`移除${deskMoves[id].label}`}
              onClick={() => setPlan(current => ({ ...current, moves: current.moves.filter(item => item !== id) }))}><X size={ICON.btn} /></IconButton>
          </span>
        </li>)}
      </ol>
      {!plan.moves.length && <p className="dm-empty">至少加入一个动作</p>}
      <Button size="sm" variant="soft" icon={adding ? <X size={ICON.btn} /> : <Plus size={ICON.btn} />} aria-expanded={adding} onClick={() => setAdding(!adding)}>
        {adding ? '收起动作库' : '添加动作'}
      </Button>
      {adding && <MovementCatalog eligible={id => eligibleDeskMove(id, plan)} selected={plan.moves}
        onSelect={id => setPlan(current => ({ ...current, moves: current.moves.includes(id) ? current.moves.filter(item => item !== id) : [...current.moves, id] }))} />}
    </section>

    <section className="dm-section">
      <h3><SlidersHorizontal size={ICON.btn} strokeWidth={STROKE} aria-hidden="true" />偏好</h3>
      <Switch label="仅坐姿" checked={plan.seatedOnly} onChange={value => filter({ seatedOnly: value })} />
      <div className="dm-field-label" id={avoidLabel}>避开部位</div>
      <div className="dm-chip-row" role="group" aria-labelledby={avoidLabel}>
        {deskRegions.map(region => {
          const Icon = regionIcons[region];
          const on = plan.excluded.includes(region);
          return <button type="button" key={region} className="dm-chip is-avoid" aria-pressed={on}
            onClick={() => filter({ excluded: on ? plan.excluded.filter(item => item !== region) : [...plan.excluded, region] })}>
            <Icon size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{region}
          </button>;
        })}
      </div>
    </section>

    <section className="dm-section">
      <h3><Bell size={ICON.btn} strokeWidth={STROKE} aria-hidden="true" />提醒</h3>
      <Switch label="定时提醒" checked={plan.reminder} onChange={value => setPlan({ ...plan, reminder: value })} />
      {plan.reminder && <div className="dm-reminder">
        <div className="dm-days" role="group" aria-label="提醒日">
          {weekOrder.map(day => <button type="button" key={day} aria-pressed={plan.days.includes(day)} aria-label={`周${dayNames[day]}`}
            onClick={() => setPlan({ ...plan, days: plan.days.includes(day) ? plan.days.filter(item => item !== day) : [...plan.days, day] })}>{dayNames[day]}</button>)}
        </div>
        <TimePicker aria-label="提醒时间" value={plan.time} onChange={time => setPlan({ ...plan, time })} />
      </div>}
    </section>

    <footer className="dm-footer">
      <span className="dm-footer-total">{seconds ? <>共 <b>{duration(seconds)}</b> · {plan.moves.length} 个动作</> : '请选择动作'}</span>
      <Button variant="ghost" disabled={busy} onClick={onCancel}>取消</Button>
      <Button variant="primary" disabled={busy || !validDeskPlan(plan)} onClick={() => void save()}>{busy ? '保存中…' : '保存计划'}</Button>
    </footer>
    {message && <p className="dm-error" role="alert">{message}</p>}
  </div>;
}
