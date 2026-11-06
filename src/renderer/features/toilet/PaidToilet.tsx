import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Briefcase, History, Square, Trash2 } from 'lucide-react';
import { shouldCelebrateToilet, toiletRecordOnDate } from '../../../shared/toilet';
import type { ActivityKind, Snapshot, ToiletRecord } from '../../../shared/contracts';
import type { ModuleCtx } from '../../board/modules';
import { command } from '../../state';
import { localDate } from '../../../domain/tasks/model';
import { duration, money, time } from '../../format';
import { Modal } from '../../components/Modal';
import { DatePicker } from '../../components/DatePicker';
import { TimePicker } from '../../components/TimePicker';
import { Button } from '../../ui';
import { Field } from '../../components/Modal';
import { ACTIVITIES } from './activities';
import './toilet.css';

type Detail = { id: string; date?: string; effectiveSeconds: number; addedSeconds: number; amount: number; effectiveAmount: number };
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const activeRecord = (state: Snapshot, kind?: ActivityKind) => state.income.toilet?.records.find(item => item.status !== 'completed' && (!kind || item.kind === kind));


type Mode = 'idle' | 'running' | 'review' | 'off';

/** Decoration only: derived from record state, never owns the business timer. */
function Stall({ mode, seconds, coinEvery, flushing, decor = false, mine = false, iconSign = false }: { mode: Mode; seconds: number; coinEvery: number; flushing: boolean; decor?: boolean; mine?: boolean; iconSign?: boolean }) {
  const roll = mode === 'running' ? Math.max(0, 1 - Math.floor(seconds / 300) / 3) : 1;
  const sign = iconSign ? mode === 'running' ? '💩' : mode === 'review' ? '🧻' : mode === 'off' ? '⏸' : '✓'
    : mode === 'running' ? '💩 使用中' : mode === 'review' ? '待核对' : mode === 'off' ? '暂停营业' : '空闲';
  return <svg className={`toilet-scene is-${mode} ${flushing ? 'is-flushing' : ''} ${decor ? 'is-decor' : ''}`} viewBox="0 0 150 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true"
    style={{ '--coin-every': `${coinEvery}s` } as CSSProperties}>
    <rect x="8" y="6" width="134" height="108" rx="14" fill="var(--toilet-room)" />
    {/* toilet behind the door */}
    <g className="toilet-bowl">
      <rect x="66" y="40" width="26" height="22" rx="5" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <path d="M56 64h46v6c0 12-9 19-20 19h-6c-11 0-20-7-20-19Z" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <path d="M70 89v10h18V89" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <text className="toilet-flush-poop" x="79" y="74" textAnchor="middle" fontSize="13">💩</text>
    </g>
    {/* toilet paper roll shrinks while the timer runs */}
    <g className="toilet-roll">
      <path d="M112 44h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="119" cy="54" r={4 + 6 * roll} fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <circle cx="119" cy="54" r="3" fill="var(--toilet-room)" stroke="currentColor" strokeWidth="1.5" />
    </g>
    {/* door swings closed when occupied */}
    <g className="toilet-door">
      <rect x="20" y="14" width="78" height="86" rx="7" fill="var(--toilet-door)" stroke="currentColor" strokeWidth="2" />
      <circle cx="88" cy="58" r="2.5" fill="currentColor" />
      {!decor && <g className="toilet-sign">
        <rect x="31" y="24" width="56" height="17" rx="8.5" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="1.5" />
        <text x="59" y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">{sign}</text>
      </g>}
      {mine && <g className="toilet-mine"><rect x="24" y="78" width="20" height="14" rx="4" fill="var(--accent, #56865b)" /><text x="34" y="88.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">你</text></g>}
    </g>
    {/* hooves peeking under the door */}
    <g className="toilet-hooves" fill="currentColor">
      <rect x="44" y="100" width="11" height="8" rx="3" /><rect x="62" y="100" width="11" height="8" rx="3" />
    </g>
    {mode === 'running' && !decor && <g className="toilet-coins">
      {[24, 93, 104].map((x, i) => <g key={x} className="toilet-coin" style={{ animationDelay: `calc(var(--coin-every) * ${i / 3})` }}>
        <circle cx={x} cy="6" r="4.5" fill="#f0bf45" stroke="#a87412" strokeWidth="1.2" />
        <text x={x} y="8.6" textAnchor="middle" fontSize="6" fontWeight="800" fill="#8a5a0e">¥</text>
      </g>)}
    </g>}
  </svg>;
}

function BreakScene({ kind, mode, settled }: { kind: 'smoking' | 'coffee'; mode: Mode; settled: boolean }) {
  return <svg className={`toilet-scene break-scene is-${mode} ${settled ? 'is-settled' : ''}`} viewBox="0 0 150 120" aria-hidden="true">
    <rect x="8" y="6" width="134" height="108" rx="14" fill="var(--toilet-room)" />
    <path d="M24 99h102" stroke="currentColor" opacity=".25" strokeWidth="2" strokeLinecap="round" />
    {kind === 'coffee' ? <>
      <ellipse cx="72" cy="97" rx="38" ry="5" fill="currentColor" opacity=".1" />
      <path d="M48 50h46l-5 40H53Z" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2.5" />
      <path d="M94 56h8c17 0 14 26-11 25" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M51 64h40l-2 15H53Z" fill="var(--activity-color)" opacity=".45" />
      <path d="M44 48h54" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <g className="break-vapor" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5">
        <path d="M60 39c-9-9 9-10 0-21" /><path d="M76 36c-9-9 9-10 0-21" /><path d="M91 39c-9-9 9-10 0-21" />
      </g>
    </> : <>
      <ellipse cx="77" cy="94" rx="36" ry="8" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <g className="break-cigarette">
        <path d="m36 68 67-18 4 14-67 18Z" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
        <path d="m36 68 20-5 4 14-20 5Z" fill="var(--activity-color)" />
        <path d="m101 51 4-1 4 14-4 1Z" fill="var(--activity-color)" className="break-ember" />
      </g>
      <path className="break-vapor" d="M108 44c-20-15 16-16-2-30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </>}
  </svg>;
}

export function PaidToilet({ state, size, openSettings, openClock, notify, activityKind = 'toilet' }: ModuleCtx) {
  const activity = ACTIVITIES[activityKind];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settled, setSettled] = useState('');
  const data = state.income.toilet;
  const active = activeRecord(state, activityKind) ?? (data?.pendingSave ? data.records.find(item => item.id === data.pendingRecordId && item.kind === activityKind) : undefined);
  const running = active?.status === 'running';
  const pending = !!data?.pendingSave;
  const snapshot = state.income.snapshot;
  const reason = data?.error || state.save.readError || (!state.income.settings ? '先设置薪资，再估算时间价值。'
    : state.income.calculationError?.message || String(snapshot?.toiletAvailableReason ?? '当前无法计算。'));
  const summary = (snapshot?.activitySummaries as Record<ActivityKind, { seconds: number; amount: number }> | undefined)?.[activityKind];
  const seconds = active ? Math.max(0, Math.floor(((active.endAt ?? state.income.now) - active.startAt) / 1000)) : number(summary?.seconds);
  const currentDetail = (snapshot?.toiletDetails as Detail[] | undefined)?.find(item => item.id === active?.id);
  const perform = async () => {
    if (active?.status === 'needs-review') { setOpen(true); return; }
    setBusy(true); setError('');
    try {
      const result = await command('toilet', { action: running ? 'end' : 'start', recordId: active?.id, kind: activityKind }, 'income');
      if (!result.applied || !result.persisted) setError(result.message);
      else {
        notify(running ? `${activity.label}已结束，记录已保存。` : `${activity.label}开始计时。`);
        setSettled(running && active && shouldCelebrateToilet(result, active.id) ? active.id : '');
      }
    } catch { setError('未收到操作结果，请核对当前状态后重试。'); }
    finally { setBusy(false); }
  };
  const mode: Mode = active?.status === 'needs-review' || pending ? 'review' : running ? 'running' : !active && reason ? 'off' : 'idle';
  const rate = currentDetail && currentDetail.addedSeconds > 0 ? currentDetail.amount / currentDetail.addedSeconds : 0;
  const coinEvery = rate > 0 ? Math.min(4, Math.max(0.8, 0.1 / rate)) : 2.4;
  const line = running ? activity.running : activity.idle;
  const settings = state.income.settings;
  // A blocked card turns its main action into the way out instead of adding a hint row.
  const fix = mode !== 'off' || data?.error || state.save.readError ? null
    : !settings || !settings.stealMode ? { label: '去设置', go: () => openSettings('income') }
    : settings.clockMode && reason.includes('上班打卡') ? { label: '先打卡', go: () => openClock('start') } : null;
  const today = localDate(new Date(state.income.now));
  const todayCount = data?.records.filter(item => item.kind === activityKind && item.status !== 'needs-review' && toiletRecordOnDate(item, today, state.income.now)).length ?? 0;
  const label = pending ? '记录尚未保存' : mode === 'review' ? '上次记录待核对' : running ? '本次用时' : '今日有效偷出';
  const main = mode === 'off'
    ? fix ? <Button size="sm" variant="primary" title={reason} onClick={fix.go}>{fix.label} →</Button> : <span className="toilet-reason" title={reason}>暂不可用</span>
    : <button type="button" className={`toilet-poop is-${mode}`} disabled={busy || pending} onClick={() => void perform()}
      aria-label={running ? activity.end : active ? '核对时间' : activity.start} title={running ? activity.end : active ? '核对时间' : activity.start}>
      <span aria-hidden="true">{busy ? '⏳' : running ? activity.runningEmoji : active ? '📝' : activity.emoji}</span>
    </button>;
  return <div id="paid-activity-panel" role="tabpanel" aria-label={activity.label} style={{ '--activity-color': activity.color } as CSSProperties} className={`paid-toilet activity-${activityKind} size-${size} is-${mode} ${settled ? 'has-settled' : ''}`} onAnimationEnd={event => { if (event.animationName === 'toilet-settled') setSettled(''); }}>
    {size !== 's' && <div className="toilet-stage">
      {size === 'tall' && <div className="toilet-lamp">{running ? `${activity.emoji} 计时中` : mode === 'off' ? '暂停营业' : '空闲'}</div>}
      {activityKind === 'toilet' && size === 'wide' && <><Stall mode="running" decor seconds={0} coinEvery={0} flushing={false} /><Stall mode="idle" decor seconds={0} coinEvery={0} flushing={false} /></>}
      {activityKind === 'toilet' ? <Stall mode={mode} seconds={seconds} coinEvery={coinEvery} flushing={!!settled} mine={size === 'wide'} iconSign={size === 'tall'} />
        : <BreakScene kind={activityKind} mode={mode} settled={!!settled} />}
    </div>}
    <div className="toilet-content">
      {size === 's' && <span className="toilet-chip">{running ? `${activity.emoji} 计时中` : mode === 'off' ? '暂停营业' : mode === 'review' ? '待核对' : '空闲'}</span>}
      <span className="m-label">{label}</span>
      <strong className="toilet-timer">{mode === 'review' ? '待核对' : duration(seconds)}</strong>
      {error ? <span className="toilet-error" role="status">{error}</span>
        : <span className="toilet-amount">{active ? `本次约 ¥${money(currentDetail?.effectiveAmount ?? 0)}` : `约 ¥${money(number(summary?.amount))}`}</span>}
      <span className="activity-total" title="三类活动重叠部分不重复计算">三项合计 {duration(number(snapshot?.toiletStolenSeconds))} · ¥{money(number(snapshot?.toiletStolenAmount))}</span>
      <span className="toilet-copy">{mode === 'off' ? reason : line}</span>
    </div>
    <div className="toilet-actions">
      {main}
      <Button size="sm" variant="ghost" aria-label={`${activity.label}记录详情`} title="记录详情" onClick={() => setOpen(true)}><History size={15} />{size === 'tall' || size === 'wide' ? '详情' : ''}</Button>
    </div>
    {size === 'l' && <button type="button" className="toilet-strip" onClick={() => setOpen(true)}>
      <span>今天</span><span className="toilet-strip-poops" aria-hidden="true">{todayCount ? activity.emoji.repeat(Math.min(todayCount, 8)) : '·'}</span>
      <span>{todayCount ? `${todayCount} 次${todayCount > 8 ? ' ↑' : ''}` : '暂无记录'}</span>
    </button>}
    {open && <ToiletDetails state={state} initialKind={activityKind} onClose={() => setOpen(false)} />}
  </div>;
}

export function ToiletStatus({ state }: { state: Snapshot }) {
  const [open, setOpen] = useState(false);
  const active = activeRecord(state);
  const pending = state.income.toilet?.pendingSave;
  if (!active && !pending) return null;
  return <>
    <Button className="toilet-status" size="sm" icon={<Briefcase size={15} />} onClick={() => setOpen(true)}>
      {pending ? '活动记录未保存' : state.income.toilet?.records.some(item => item.status === 'needs-review') ? '活动记录待核对' : `带薪活动 · ${state.income.toilet?.records.filter(item => item.status === 'running').length} 项计时中`}
    </Button>
    {open && <ToiletDetails state={state} onClose={() => setOpen(false)} />}
  </>;
}

function RecordEditor({ item, state, close }: { item: ToiletRecord; state: Snapshot; close: () => void }) {
  const [date, setDate] = useState(item.endAt ? localDate(new Date(item.endAt)) : '');
  const [end, setEnd] = useState(item.endAt ? new Date(item.endAt).toTimeString().slice(0, 8) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const save = async (endAt: number) => {
    setBusy(true); setError('');
    try {
      const result = await command('toilet', { action: item.status === 'needs-review' ? 'review' : 'editEnd', recordId: item.id, endAt }, 'income');
      if (result.applied && result.persisted) close();
      else { setError(result.message); form.current?.querySelector<HTMLInputElement>('input')?.focus(); }
    } catch { setError('未收到操作结果，请核对记录后重试。'); }
    finally { setBusy(false); }
  };
  return <form ref={form} className="toilet-editor" onSubmit={event => {
    event.preventDefault();
    const at = new Date(`${date}T${end}`).getTime();
    if (!date || !end || !Number.isFinite(at) || at < item.startAt || at > Date.now()) {
      setError('结束时间需在开始时间与现在之间。');
      form.current?.querySelector<HTMLInputElement>('input')?.focus(); return;
    }
    void save(at);
  }}>
    <div className="fields">
      <Field label="结束日期"><DatePicker required value={date} onChange={setDate} min={localDate(new Date(item.startAt))} max={localDate(new Date(state.income.now))} /></Field>
      <Field label="结束时间"><TimePicker required seconds value={end} onChange={setEnd} /></Field>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="toilet-actions">
      <Button variant="primary" size="sm" type="submit" disabled={busy || state.income.toilet?.pendingSave}>保存时间</Button>
      {item.status === 'needs-review' && <Button size="sm" disabled={busy || state.income.toilet?.pendingSave} onClick={() => void save(Date.now())}>按现在结束</Button>}
      <Button variant="ghost" size="sm" onClick={close}>收起</Button>
    </div>
  </form>;
}

function ToiletDetails({ state, onClose, initialKind }: { state: Snapshot; onClose: () => void; initialKind?: ActivityKind }) {
  const [kind, setKind] = useState<ActivityKind | 'all'>(initialKind ?? 'all');
  const active = activeRecord(state, kind === 'all' ? undefined : kind);
  const [date, setDate] = useState(active ? localDate(new Date(active.startAt)) : localDate(new Date(state.income.now)));
  const [editing, setEditing] = useState(active?.status === 'needs-review' ? active.id : '');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const data = state.income.toilet;
  const rows = data?.records.filter(item => (kind === 'all' || item.kind === kind) && toiletRecordOnDate(item, date, state.income.now)).slice().sort((a, b) => b.startAt - a.startAt) ?? [];
  const details = (state.income.snapshot?.toiletHistory ?? []) as Detail[];
  const unavailable = (state.income.snapshot?.toiletHistoryUnavailable as string[] | undefined)?.includes(date.slice(0, 7));
  const focusReturn = useRef<Element | null>(document.activeElement);
  useEffect(() => () => {
    const target = focusReturn.current?.isConnected ? focusReturn.current : document.querySelector('.toilet-status');
    if (target instanceof HTMLElement) target.focus();
  }, []);
  const act = async (action: string, recordId: string) => {
    setBusy(true); setMessage('');
    try {
      const result = await command('toilet', { action, recordId }, 'income');
      setMessage(result.message);
      if (result.applied && result.persisted) { setConfirm(''); setEditing(''); }
    } catch { setMessage('未收到操作结果，请核对记录后重试。'); }
    finally { setBusy(false); }
  };
  return <Modal open title="带薪活动 · 记录" onClose={onClose} className="toilet-details">
    <div className="toilet-detail-toolbar"><select aria-label="活动记录分类" value={kind} onChange={event => { setKind(event.target.value as ActivityKind | 'all'); setEditing(''); setConfirm(''); }}>
      <option value="all">全部活动</option>{Object.entries(ACTIVITIES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
      </select><DatePicker value={date} onChange={setDate} max={localDate(new Date(state.income.now))} />
      {active && <Button size="sm" variant="ghost" onClick={() => { setDate(localDate(new Date(active.startAt))); setEditing(active.status === 'needs-review' ? active.id : ''); }}>查看未完成记录</Button>}
    </div>
    {unavailable && <p role="status">该月计价暂不可用，原始记录仍保留。</p>}
    {data?.error && <p className="error" role="alert">{data.error}</p>}
    {data?.pendingSave && <div className="toilet-pending" role="status">修改尚未保存，请保留窗口。
      <Button size="sm" disabled={busy} onClick={() => { void command('retrySave').then(result => setMessage(result.message)); }}>重试保存</Button>
    </div>}
    {message && <p role="status">{message}</p>}
    {!rows.length && !data?.error && <p className="muted">这一天还没有记录。</p>}
    <div className="toilet-records">{rows.map(item => {
      const summary = details.find(detail => detail.id === item.id && detail.date === date);
      const total = Math.max(0, ((item.endAt ?? state.income.now) - item.startAt) / 1000);
      return <article className="toilet-record" key={item.id}>
        <div className="toilet-record-heading"><strong>{ACTIVITIES[item.kind].emoji} {ACTIVITIES[item.kind].label} · {time(item.startAt)} → {item.endAt === null ? item.status === 'running' ? '记录中' : '待核对' : `${localDate(new Date(item.endAt)) !== localDate(new Date(item.startAt)) ? localDate(new Date(item.endAt)) + ' ' : ''}${time(item.endAt)}`}</strong>
          <span>{item.endReason === 'lunch' ? '午休自动结束' : item.endReason === 'offwork' ? '下班自动结束' : item.endReason === 'schedule-end' ? '排班结束' : item.status === 'needs-review' ? '中断待核对' : ''}</span>
        </div>
        {item.status === 'needs-review' ? <p>上次记录尚未结束，请核对结束时间。核对前暂未计入。</p> : <div className="toilet-record-values">
          <span>本次用时 <b>{duration(total)}</b></span><span>当日有效 <b>{unavailable ? '待计算' : duration(summary?.effectiveSeconds ?? 0)}</b></span>
          <span>合计新增 <b>{unavailable ? '待计算' : duration(summary?.addedSeconds ?? 0)}</b></span><span>计入合计约 <b>{unavailable ? '待计算' : `¥${money(summary?.amount ?? 0)}`}</b></span>
        </div>}
        <div className="toilet-actions">
          {item.status === 'running' && <Button size="sm" disabled={busy || data?.pendingSave} icon={<Square size={12} />} onClick={() => void act('end', item.id)}>{ACTIVITIES[item.kind].end}</Button>}
          {item.status !== 'running' && <Button size="sm" disabled={busy || data?.pendingSave} onClick={() => setEditing(editing === item.id ? '' : item.id)}>{item.status === 'needs-review' ? '核对时间' : '修正结束时间'}</Button>}
          <Button variant="ghost" size="sm" disabled={busy || data?.pendingSave} icon={<Trash2 size={13} />} onClick={() => setConfirm(item.id)}>{item.status === 'completed' ? '删除' : '取消本次'}</Button>
        </div>
        {editing === item.id && <RecordEditor key={item.id} item={item} state={state} close={() => setEditing('')} />}
        {confirm === item.id && <div className="toilet-confirm"><span>{item.status === 'completed' ? '删除后将重算统计，无法撤销。' : '取消后本次不会计入统计。'}</span>
          <Button size="sm" disabled={busy || data?.pendingSave} onClick={() => void act(item.status === 'completed' ? 'remove' : 'cancel', item.id)}>确认{item.status === 'completed' ? '删除' : '取消'}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm('')}>保留记录</Button>
        </div>}
      </article>;
    })}</div>
    <details className="toilet-help"><summary>时间与金额怎么算</summary><p>三类活动可同时记录，分类显示各自有效时间价值，三项合计对重叠时间去重，因此分类金额不能直接相加。仅有效工作时段计入；与午休、请假及其他偷出区间重叠的部分不重复计算。对应金额是固定收入的时间价值，不增加工资，也不扣实际工时。金额分别舍入后可能有 0.01 元差异，以合计为准。</p></details>
  </Modal>;
}
