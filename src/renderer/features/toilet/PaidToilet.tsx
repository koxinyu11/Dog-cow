import { useEffect, useRef, useState } from 'react';
import { Briefcase, History, Square, Trash2 } from 'lucide-react';
import { shouldCelebrateToilet, toiletRecordOnDate } from '../../../shared/toilet';
import type { Snapshot, ToiletRecord } from '../../../shared/contracts';
import type { ModuleCtx } from '../../board/modules';
import { command } from '../../state';
import { localDate } from '../../../domain/tasks/model';
import { duration, money, time } from '../../format';
import { Modal } from '../../components/Modal';
import { DatePicker } from '../../components/DatePicker';
import { TimePicker } from '../../components/TimePicker';
import { Button } from '../../ui';
import { Field } from '../../components/Modal';
import './toilet.css';

type Detail = { id: string; date?: string; effectiveSeconds: number; addedSeconds: number; amount: number };
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const activeRecord = (state: Snapshot) => state.income.toilet?.records.find(item => item.status !== 'completed');

/** State drives the scene. Its decoration never owns the business timer. */
function Workstation({ occupied }: { occupied: boolean }) {
  return <svg className={`toilet-scene ${occupied ? 'is-occupied' : ''}`} viewBox="0 0 150 116" aria-hidden="true">
    <rect x="25" y="10" width="100" height="100" rx="12" fill="var(--toilet-room)" />
    <path d="M58 58h38v17c0 13-9 20-21 20H65V80c-9-2-14-8-14-15v-7h7Z" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
    <rect x="83" y="30" width="20" height="31" rx="5" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
    <g className="toilet-cow">
      <path d="M51 36 44 25 56 29M78 36l7-11-12 4" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="64" cy="44" rx="20" ry="17" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="64" cy="51" rx="14" ry="8" fill="var(--toilet-room)" />
      <path d="M55 41h1m15 0h1m-13 10h1m8 0h1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </g>
    <g className="toilet-door"><rect x="32" y="15" width="86" height="91" rx="8" fill="var(--toilet-door)" stroke="currentColor" strokeWidth="2" /><path d="M101 64h5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></g>
    <rect x="46" y="77" width="53" height="19" rx="6" fill="var(--toilet-porcelain)" />
    <text x="72" y="90" textAnchor="middle" fontSize="10" fill="currentColor">{occupied ? '使用中' : '空闲'}</text>
  </svg>;
}

export function PaidToilet({ state, size, openSettings, openClock, notify }: ModuleCtx) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settled, setSettled] = useState('');
  const data = state.income.toilet;
  const active = activeRecord(state) ?? (data?.pendingSave ? data.records.find(item => item.id === data.pendingRecordId) : undefined);
  const running = active?.status === 'running';
  const pending = !!data?.pendingSave;
  const snapshot = state.income.snapshot;
  const reason = data?.error || state.save.readError || (!state.income.settings ? '先设置薪资，再估算时间价值。'
    : state.income.calculationError?.message || String(snapshot?.toiletAvailableReason ?? '当前无法计算。'));
  const seconds = active ? Math.max(0, Math.floor(((active.endAt ?? state.income.now) - active.startAt) / 1000)) : number(snapshot?.toiletStolenSeconds);
  const currentDetail = (snapshot?.toiletDetails as Detail[] | undefined)?.find(item => item.id === active?.id);
  const perform = async () => {
    if (active?.status === 'needs-review') { setOpen(true); return; }
    setBusy(true); setError('');
    try {
      const result = await command('toilet', { action: running ? 'end' : 'start', recordId: active?.id }, 'income');
      if (!result.applied || !result.persisted) setError(result.message);
      else {
        notify(running ? '工位切回，轻装上阵。' : '临时工位，入座成功。');
        setSettled(running && active && shouldCelebrateToilet(result, active.id) ? active.id : '');
      }
    } catch { setError('未收到操作结果，请核对当前状态后重试。'); }
    finally { setBusy(false); }
  };
  return <div className={`paid-toilet size-${size} ${settled ? 'has-settled' : ''}`} onAnimationEnd={() => setSettled('')}>
    <Workstation occupied={!!running} />
    <div className="toilet-content">
      <span className="m-label">{pending ? '记录尚未保存' : active?.status === 'needs-review' ? '上次记录待核对' : running ? '本次用时' : '今日有效偷出'}</span>
      <strong className="toilet-timer">{active?.status === 'needs-review' ? '待核对' : duration(seconds)}</strong>
      <span className="toilet-amount">{active ? `本次有效 ${duration(currentDetail?.addedSeconds ?? 0)} · 约 ¥${money(currentDetail?.amount ?? 0)}` : `对应约 ¥${money(number(snapshot?.toiletStolenAmount))}`}</span>
      {running && <span className="toilet-today">今日累计 {duration(number(snapshot?.toiletStolenSeconds))} · 约 ¥{money(number(snapshot?.toiletStolenAmount))}</span>}
      <span className="toilet-copy">{running ? '人在隔间，薪在工位。' : '换个工位，继续领薪。'}</span>
    </div>
    <div className="toilet-actions">
      <Button variant="primary" size="sm" disabled={busy || pending || (!active && !!reason)} onClick={() => void perform()}>
        {busy ? '保存中…' : running ? '拉完了' : active ? '核对时间' : '拉屎'}
      </Button>
      <Button size="sm" variant="ghost" aria-label="带薪拉屎记录详情" onClick={() => setOpen(true)}><History size={15} />详情</Button>
    </div>
    {(error || reason && !active) && <div className="toilet-error" role="status">{error || reason}
      {!error && !data?.error && !state.save.readError && (!state.income.settings || !state.income.settings.stealMode)
        && <Button size="sm" variant="ghost" onClick={() => openSettings('income')}>去设置</Button>}
      {!error && state.income.settings?.clockMode && reason.includes('上班打卡') && <Button size="sm" variant="ghost" onClick={() => openClock('start')}>去打卡</Button>}
    </div>}
    {open && <ToiletDetails state={state} onClose={() => setOpen(false)} />}
  </div>;
}

export function ToiletStatus({ state }: { state: Snapshot }) {
  const [open, setOpen] = useState(false);
  const active = activeRecord(state);
  const pending = state.income.toilet?.pendingSave;
  if (!active && !pending) return null;
  return <>
    <Button className="toilet-status" size="sm" icon={<Briefcase size={15} />} onClick={() => setOpen(true)}>
      {pending ? '蹲班记录未保存' : active?.status === 'needs-review' ? '蹲班记录待核对' : `蹲班中 · ${duration(Math.max(0, (state.income.now - active!.startAt) / 1000))}`}
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

function ToiletDetails({ state, onClose }: { state: Snapshot; onClose: () => void }) {
  const active = activeRecord(state);
  const [date, setDate] = useState(active ? localDate(new Date(active.startAt)) : localDate(new Date(state.income.now)));
  const [editing, setEditing] = useState(active?.status === 'needs-review' ? active.id : '');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const data = state.income.toilet;
  const rows = data?.records.filter(item => toiletRecordOnDate(item, date, state.income.now)).slice().sort((a, b) => b.startAt - a.startAt) ?? [];
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
  return <Modal open title="带薪拉屎 · 记录" onClose={onClose} className="toilet-details">
    <div className="toilet-detail-toolbar"><DatePicker value={date} onChange={setDate} max={localDate(new Date(state.income.now))} />
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
        <div className="toilet-record-heading"><strong>{time(item.startAt)} → {item.endAt === null ? item.status === 'running' ? '记录中' : '待核对' : `${localDate(new Date(item.endAt)) !== localDate(new Date(item.startAt)) ? localDate(new Date(item.endAt)) + ' ' : ''}${time(item.endAt)}`}</strong>
          <span>{item.endReason === 'lunch' ? '午休自动结束' : item.endReason === 'offwork' ? '下班自动结束' : item.endReason === 'schedule-end' ? '排班结束' : item.status === 'needs-review' ? '中断待核对' : ''}</span>
        </div>
        {item.status === 'needs-review' ? <p>上次记录尚未结束，请核对结束时间。核对前暂未计入。</p> : <div className="toilet-record-values">
          <span>本次用时 <b>{duration(total)}</b></span><span>当日有效 <b>{unavailable ? '待计算' : duration(summary?.effectiveSeconds ?? 0)}</b></span>
          <span>合计新增 <b>{unavailable ? '待计算' : duration(summary?.addedSeconds ?? 0)}</b></span><span>对应约 <b>{unavailable ? '待计算' : `¥${money(summary?.amount ?? 0)}`}</b></span>
        </div>}
        <div className="toilet-actions">
          {item.status === 'running' && <Button size="sm" disabled={busy || data?.pendingSave} icon={<Square size={12} />} onClick={() => void act('end', item.id)}>拉完了</Button>}
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
    <details className="toilet-help"><summary>时间与金额怎么算</summary><p>仅有效工作时段计入；与午休、请假及其他偷出区间重叠的部分不重复计算。对应金额是固定收入的时间价值，不增加工资，也不扣实际工时。金额分别舍入后可能有 0.01 元差异，以合计为准。</p></details>
  </Modal>;
}
