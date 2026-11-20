import { useState } from 'react';
import { Armchair, Bell, BellOff, Footprints, Pencil, Play, Scale } from 'lucide-react';
import { deskMoves, seatedQuick, validMovementWeight, walkingBreak, type DeskMove, type DeskMovementData, type DeskPlan } from '../../../shared/desk-movement';
import { NumberField } from '../../components/NumberField';
import { Button } from '../../ui';
import { MovementThumb } from './MovementCatalog';
import { ICON, STROKE } from './movement-icons';
import { dayNames, duration, planSeconds } from './movement-stats';

function reminderText(plan: DeskPlan) {
  if (!plan.reminder) return '提醒已关闭';
  const sorted = [...plan.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const days = sorted.length === 7 ? '每天' : sorted.join() === '1,2,3,4,5' ? '工作日' : `周${sorted.map(day => dayNames[day]).join('、')}`;
  return `${days} ${plan.time}`;
}

export function PlanOverview({ data, onStart, onEdit, onWeight }: {
  data: DeskMovementData;
  onStart(moves: readonly DeskMove[]): void;
  onEdit(): void;
  /** Resolves true when the weight was saved. */
  onWeight(value: number | undefined): Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { plan, weightKg } = data;
  const invalid = input.trim() !== '' && !validMovementWeight(Number(input));
  const saveWeight = async () => {
    setBusy(true);
    setError('');
    if (await onWeight(input.trim() === '' ? undefined : Number(input))) setEditing(false);
    else setError('体重设置未保存，请重试。');
    setBusy(false);
  };
  const ReminderIcon = plan.reminder ? Bell : BellOff;
  return <div className="dm-page dm-overview">
    <section className="dm-plan-hero">
      <div className="dm-plan-strip" aria-label="计划动作">
        {plan.moves.map(id => <span key={id} title={deskMoves[id].label}><MovementThumb move={id} /></span>)}
      </div>
      <div className="dm-plan-summary">
        <strong>{plan.moves.length} 个动作 · {duration(planSeconds(plan.moves))}</strong>
        <span><ReminderIcon size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{reminderText(plan)}</span>
      </div>
      <div className="dm-plan-cta">
        <Button variant="primary" icon={<Play size={ICON.btn} fill="currentColor" />} onClick={() => onStart(plan.moves)}>开始计划</Button>
        <Button variant="soft" icon={<Pencil size={ICON.btn} />} onClick={onEdit}>编辑</Button>
      </div>
    </section>
    <div className="dm-quick">
      <button type="button" onClick={() => onStart(seatedQuick)}><Armchair size={ICON.hero} strokeWidth={STROKE} aria-hidden="true" /><b>坐姿 1 分钟</b><small>抬膝 + 扩胸</small></button>
      <button type="button" onClick={() => onStart(walkingBreak)}><Footprints size={ICON.hero} strokeWidth={STROKE} aria-hidden="true" /><b>步行 3 分钟</b><small>起身走一走</small></button>
    </div>
    <section className="dm-weight">
      <Scale size={ICON.btn} strokeWidth={STROKE} aria-hidden="true" />
      {editing ? <>
        <NumberField label="体重（kg，可留空）" value={input} onChange={setInput} error={invalid ? '请输入 0.1–500 之间的数' : undefined} />
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>取消</Button>
        <Button size="sm" variant="primary" disabled={busy || invalid} onClick={() => void saveWeight()}>保存</Button>
      </> : <>
        <span className="dm-weight-text">热量估算<small>{weightKg === undefined ? '未开启' : `${weightKg} kg`}</small></span>
        <Button size="sm" variant="ghost" onClick={() => { setInput(weightKg === undefined ? '' : String(weightKg)); setError(''); setEditing(true); }}>
          {weightKg === undefined ? '设置' : '修改'}
        </Button>
      </>}
    </section>
    {error && <p className="dm-error" role="alert">{error}</p>}
  </div>;
}
