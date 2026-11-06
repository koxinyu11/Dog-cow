import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Briefcase, History, PencilLine, Square, Trash2 } from 'lucide-react';
import { shouldCelebrateToilet, toiletRecordOnDate } from '../../../shared/toilet';
import type { ActivityKind, Snapshot, ToiletRecord } from '../../../shared/contracts';
import type { ModuleCtx } from '../../board/modules';
import { command } from '../../state';
import { localDate } from '../../../domain/tasks/model';
import { duration, money, time } from '../../format';
import { Modal } from '../../components/Modal';
import { DatePicker } from '../../components/DatePicker';
import { TimePicker } from '../../components/TimePicker';
import { Button, Segmented } from '../../ui';
import { Field } from '../../components/Modal';
import { ACTIVITY_KEYS, currentActivity, getActivity } from './activities';
import { CustomActivityEditor } from './CustomActivityEditor';
import { ActivityBadge, ActivityScene } from './scenes';
import { useMotionPaused, useScenePhase, type SceneMode } from './useActivityMotion';
import { fx } from '../../motion/fx';
import type { SizeKey } from '../../../shared/board';
import './toilet.css';

type Detail = { id: string; date?: string; effectiveSeconds: number; addedSeconds: number; amount: number; effectiveAmount: number };
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const activeRecord = (state: Snapshot, kind?: ActivityKind) => state.income.toilet?.records.find(item => item.status !== 'completed' && (!kind || item.kind === kind));

const STATUS: Record<SceneMode, string> = { idle: '空闲', running: '计时中', review: '待核对', off: '暂停营业' };
/** Sizes with room for a worded action button; smaller cards keep the round icon button. */
const LABELED: ReadonlySet<SizeKey> = new Set(['l', 'wide', 'tall']);
const STRIP_MARKS = 6;
type Gain = { id: string; seconds: number; amount: number };

export function PaidToilet({ state, size, openSettings, openClock, notify, activityKind = 'toilet' }: ModuleCtx) {
  const activity = currentActivity(activityKind, state.income.toilet);
  const [customEditor, setCustomEditor] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gain, setGain] = useState<Gain | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const totalLine = useRef<HTMLSpanElement>(null);
  const paused = useMotionPaused(root);
  useEffect(() => setGain(null), [activityKind]);
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
  const mode: SceneMode = active?.status === 'needs-review' || pending ? 'review' : running ? 'running' : !active && reason ? 'off' : 'idle';
  const phase = useScenePhase(activityKind, mode);
  const perform = async () => {
    if (active?.status === 'needs-review') { setOpen(true); return; }
    setBusy(true); setError('');
    try {
      const result = await command('toilet', { action: running ? 'end' : 'start', recordId: active?.id, kind: activityKind }, 'income');
      if (!result.applied || !result.persisted) { setError(result.message); return; }
      notify(running ? `${activity.label}已结束，记录已保存。` : `${activity.label}开始计时。`);
      if (!running) fx('activity-start', actionButton.current);
      else if (active && shouldCelebrateToilet(result, active.id)) {
        const detail = (result.snapshot?.income.snapshot?.toiletDetails as Detail[] | undefined)?.find(item => item.id === active.id);
        setGain({ id: active.id, seconds: number(detail?.addedSeconds), amount: number(detail?.amount) });
        // Coins rise from the total when it is visible, otherwise from the button that was pressed.
        fx('activity-gain', totalLine.current?.offsetParent ? totalLine.current : actionButton.current);
      }
    } catch { setError('未收到操作结果，请核对当前状态后重试。'); }
    finally { setBusy(false); }
  };
  const settings = state.income.settings;
  // A blocked card turns its main action into the way out instead of adding a hint row.
  const fix = mode !== 'off' || data?.error || state.save.readError ? null
    : !settings || !settings.stealMode ? { label: '去设置', go: () => openSettings('income') }
    : settings.clockMode && reason.includes('上班打卡') ? { label: '先打卡', go: () => openClock('start') } : null;
  const today = localDate(new Date(state.income.now));
  const todayCount = data?.records.filter(item => item.kind === activityKind && item.status !== 'needs-review' && toiletRecordOnDate(item, today, state.income.now)).length ?? 0;
  const label = pending ? '记录尚未保存' : mode === 'review' ? '上次记录待核对' : running ? '本次用时' : '今日有效偷出';
  const locked = pending || !!data?.error || !!state.save.readError;
  const needsCustom = activityKind === 'custom' && !data?.customActivity && !active;
  const labeled = LABELED.has(size);
  const actionText = busy ? '保存中…' : running ? activity.end : active ? '核对时间' : activity.start;
  const main = needsCustom ? <Button size="sm" variant="primary" disabled={locked} onClick={() => setCustomEditor(true)}>设置活动</Button> : mode === 'off'
    ? fix ? <Button size="sm" variant="primary" title={reason} onClick={fix.go}>{fix.label} →</Button> : <span className="toilet-reason" title={reason}>暂不可用</span>
    : <button ref={actionButton} type="button" className={`activity-action is-${mode} ${labeled ? 'is-labeled' : ''}`} disabled={busy || pending} onClick={() => void perform()}
      aria-label={labeled ? undefined : actionText} title={actionText}>
      <span className="activity-action-icon" aria-hidden="true">{busy ? '⏳' : running ? activity.runningEmoji : active ? '📝' : activity.emoji}</span>
      {labeled && <span className="activity-action-label">{actionText}</span>}
    </button>;
  // Small cards have no scene, so the status chip carries the state; custom activities add their name.
  const statusRow = size === 's' || activityKind === 'custom' ? <div className="activity-status-row">
    {size === 's' && <span className={`toilet-chip is-${mode}`}>{activityKind === 'custom' ? '' : `${activity.emoji} `}{STATUS[mode]}</span>}
    {activityKind === 'custom' && <>
      <span className="activity-custom-name">{size === 's' ? `${activity.emoji} ` : ''}{activity.label}</span>
      <button type="button" className="activity-custom-edit" aria-label="编辑自定义活动" title="编辑自定义活动" disabled={locked} onClick={() => setCustomEditor(true)}><PencilLine size={12} /></button>
    </>}
  </div> : null;
  return <div ref={root} id="paid-activity-panel" role="tabpanel" aria-label={activity.label} style={{ '--activity-color': activity.color } as CSSProperties}
    className={`paid-toilet activity-${activityKind} size-${size} is-${mode} ${paused ? 'is-paused' : ''}`}
    onAnimationEnd={event => { if (event.animationName.startsWith('am-gain')) setGain(null); }}>
    {size !== 's' && <div className="toilet-stage am-swap" key={activityKind}>
      {size === 'm' ? <ActivityBadge activity={activity} mode={mode} phase={phase} />
        : <ActivityScene kind={activityKind} activity={activity} mode={mode} phase={phase} gained={!!gain} mine={size === 'wide'} />}
    </div>}
    <div className="toilet-content">
      {statusRow}
      <span className="m-label">{label}</span>
      <strong className="toilet-timer">{mode === 'review' ? '待核对' : duration(seconds)}</strong>
      {gain ? <span className="toilet-amount activity-gain" role="status">+{duration(gain.seconds)} · ¥{money(gain.amount)} 计入合计</span>
        : error ? <span className="toilet-error" role="status">{error}</span>
        : <span className="toilet-amount">{active ? `本次约 ¥${money(currentDetail?.effectiveAmount ?? 0)}` : `约 ¥${money(number(summary?.amount))}`}</span>}
      <span ref={totalLine} className={`activity-total ${gain ? 'is-gained' : ''}`} title="活动重叠部分不重复计算"><span>活动合计 {duration(number(snapshot?.toiletStolenSeconds))}</span><span>¥{money(number(snapshot?.toiletStolenAmount))}</span></span>
      <span className="toilet-copy">{mode === 'off' ? reason : running ? activity.running : activity.idle}</span>
    </div>
    <div className="toilet-actions">
      {main}
      <Button size="sm" variant="ghost" aria-label={`${activity.label}记录详情`} title="记录详情" onClick={() => setOpen(true)}><History size={15} />{labeled ? '详情' : ''}</Button>
    </div>
    {size === 'l' && <button type="button" className="toilet-strip" onClick={() => setOpen(true)}>
      <span>今天</span>
      <span className="toilet-strip-marks" aria-hidden="true">{todayCount ? activity.emoji.repeat(Math.min(todayCount, STRIP_MARKS)) : '·'}{todayCount > STRIP_MARKS && <small>+{todayCount - STRIP_MARKS}</small>}</span>
      <span>{todayCount ? `${todayCount} 次` : '暂无记录'}</span>
    </button>}
    {open && <ToiletDetails state={state} initialKind={activityKind} onClose={() => setOpen(false)} />}
    {customEditor && <CustomActivityEditor state={state} onClose={() => setCustomEditor(false)} />}
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

function EmptyRecords({ kind, data }: { kind: ActivityKind | 'all'; data?: Snapshot['income']['toilet'] }) {
  const Icon = kind === 'all' ? History : currentActivity(kind, data).Icon;
  return <div className="toilet-empty" role="status"><Icon size={20} aria-hidden="true" /><span>这一天还没有记录。</span></div>;
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
    <Segmented label="活动记录分类" value={kind} onChange={next => { setKind(next); setEditing(''); setConfirm(''); }}
      options={[['all', '全部'], ...ACTIVITY_KEYS.map(key => { const item = currentActivity(key, data); return [key, <><item.Icon size={14} aria-hidden="true" /><span className="toilet-segment-label">{item.label}</span></>] as [ActivityKind, ReactNode]; })]} />
    <div className="toilet-detail-toolbar">
      <div className="toilet-detail-date"><DatePicker aria-label="记录日期" value={date} onChange={setDate} max={localDate(new Date(state.income.now))} /></div>
      {active && <Button size="sm" variant="ghost" onClick={() => { setDate(localDate(new Date(active.startAt))); setEditing(active.status === 'needs-review' ? active.id : ''); }}>查看未完成记录</Button>}
    </div>
    {unavailable && <p role="status">该月计价暂不可用，原始记录仍保留。</p>}
    {data?.error && <p className="error" role="alert">{data.error}</p>}
    {data?.pendingSave && <div className="toilet-pending" role="status">修改尚未保存，请保留窗口。
      <Button size="sm" disabled={busy} onClick={() => { void command('retrySave').then(result => setMessage(result.message)); }}>重试保存</Button>
    </div>}
    {message && <p role="status">{message}</p>}
    {!rows.length && !data?.error && <EmptyRecords kind={kind} data={data} />}
    <div className="toilet-records">{rows.map(item => {
      const summary = details.find(detail => detail.id === item.id && detail.date === date);
      const activity = getActivity(item.kind, item.customActivity);
      const total = Math.max(0, ((item.endAt ?? state.income.now) - item.startAt) / 1000);
      return <article className="toilet-record" key={item.id}>
        <div className="toilet-record-heading"><strong>{activity.emoji} {activity.label} · {time(item.startAt)} → {item.endAt === null ? item.status === 'running' ? '记录中' : '待核对' : `${localDate(new Date(item.endAt)) !== localDate(new Date(item.startAt)) ? localDate(new Date(item.endAt)) + ' ' : ''}${time(item.endAt)}`}</strong>
          <span>{item.endReason === 'lunch' ? '午休自动结束' : item.endReason === 'offwork' ? '下班自动结束' : item.endReason === 'schedule-end' ? '排班结束' : item.status === 'needs-review' ? '中断待核对' : ''}</span>
        </div>
        {item.status === 'needs-review' ? <p>上次记录尚未结束，请核对结束时间。核对前暂未计入。</p> : <div className="toilet-record-values">
          <span>本次用时 <b>{duration(total)}</b></span><span>当日有效 <b>{unavailable ? '待计算' : duration(summary?.effectiveSeconds ?? 0)}</b></span>
          <span>合计新增 <b>{unavailable ? '待计算' : duration(summary?.addedSeconds ?? 0)}</b></span><span>计入合计约 <b>{unavailable ? '待计算' : `¥${money(summary?.amount ?? 0)}`}</b></span>
        </div>}
        <div className="toilet-actions">
          {item.status === 'running' && <Button size="sm" disabled={busy || data?.pendingSave} icon={<Square size={12} />} onClick={() => void act('end', item.id)}>{activity.end}</Button>}
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
    <details className="toilet-help"><summary>时间与金额怎么算</summary><p>四类活动可同时记录，分类显示各自有效时间价值，活动合计对重叠时间去重，因此分类金额不能直接相加。仅有效工作时段计入；与午休、请假及其他偷出区间重叠的部分不重复计算。对应金额是固定收入的时间价值，不增加工资，也不扣实际工时。金额分别舍入后可能有 0.01 元差异，以合计为准。</p></details>
  </Modal>;
}
