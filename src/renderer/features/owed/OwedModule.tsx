import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { CalendarDays, FileSignature, HandCoins, History, MessageSquareMore, Moon, Plus, Sunrise, Trash2 } from 'lucide-react';
import type { OwedMessage, OwedView, Result } from '../../../shared/contracts';
import type { ModuleCtx } from '../../board/modules';
import { command } from '../../state';
import { localDate } from '../../../domain/tasks/model';
import { money } from '../../format';
import { Modal, Field } from '../../components/Modal';
import { DatePicker } from '../../components/DatePicker';
import { Button, Chip, Rolling } from '../../ui';
import { iouPng } from './iou-image';
import './owed.css';

const PARTS = [
  ['early', '早到', Sunrise],
  ['late', '晚走', Moon],
  ['rest', '周末', CalendarDays],
  ['message', '消息', MessageSquareMore],
] as const;
const QUICK = [5, 15, 30];
const title = (owed: OwedView) => owed.enabled ? '应付加班费' : '精神欠款';

function useOwedCommand(notify: (m: string) => void) {
  return async (payload: Record<string, unknown>) => {
    const result: Result = await command('owed', payload, 'income');
    if (result.message) notify(result.message);
    return result;
  };
}

export function OwedModule({ state, size, openSettings, notify }: ModuleCtx) {
  const owed = state.owed;
  const [history, setHistory] = useState(false);
  if (!state.income.settings || !owed)
    return (
      <div className="m-empty">
        <HandCoins size={34} strokeWidth={1.8} className="m-empty-icon" />
        <p>先填工资，才知道老板欠多少</p>
        <Button size="sm" onClick={() => openSettings('income')}>去设置</Button>
      </div>
    );
  const quickAdd = async (minutes: number) => {
    const before = owed.total;
    const result = await command('owed', { action: 'add', date: localDate(), minutes, note: '' }, 'income');
    const after = result.snapshot?.owed?.total;
    notify(result.applied && typeof after === 'number' ? `+¥${money(after - before)} 已记账` : result.message);
  };
  const exportIou = async () => {
    try {
      const rows = PARTS.map(([key, label]) => [label, `¥${money(owed.parts[key])}`]);
      const png = iouPng({ date: localDate(), amount: `¥${money(owed.total)}`, rows, rank: state.titles?.items.filter((item) => item.series === 'owed').at(-1)?.name ?? '欠款已记', title: `${owed.month} ${title(owed)}` });
      const result = await command('iouImage', { png });
      notify(result.message);
    } catch (error) {
      notify(error instanceof Error ? error.message : '未保存：欠条生成失败。');
    }
  };
  const amount = `¥${money(owed.total)}`;
  const rich = size === 'l' || size === 'tall' || size === 'wide';
  const quick = (list: number[]) => list.map((minutes) => (
    <Button key={minutes} size="sm" disabled={!!owed.error} effect="coin" onClick={() => void quickAdd(minutes)}>+{minutes}分</Button>
  ));
  const tools = (
    <>
      <IconButtonish label="记录" onClick={() => setHistory(true)}><History size={14} /></IconButtonish>
      <IconButtonish label="欠条" disabled={!owed.ready} onClick={() => void exportIou()}><FileSignature size={14} /></IconButtonish>
    </>
  );
  const main = (
    <div className="owed-main" style={{ '--owed-scale': `${70 / amount.length}cqw` } as CSSProperties}>
      {size !== 's' && <span className="m-label">本月老板欠我</span>}
      <Rolling className="m-big" text={amount} />
      {size !== 's' && <span className="owed-today">今日 +¥{money(owed.today)}</span>}
    </div>
  );
  const stats = (
    <div className="owed-stats">
      {PARTS.map(([key, label, Icon]) => (
        <div key={key} className="owed-stat">
          {rich && <Icon size={14} aria-hidden="true" />}
          <span>{label}</span>
          <strong>¥{money(owed.parts[key])}</strong>
        </div>
      ))}
    </div>
  );
  const notice = owed.error ? <p className="m-notice">{owed.error}</p>
    : !owed.clockReady && <p className="m-notice">开启上下班打卡，自动记早到晚走 <button type="button" className="owed-link" onClick={() => openSettings('income')}>去开启</button></p>;
  const label = (text: string) => size === 's' || size === 'm' ? <span className="m-label">{text}</span>
    : <Chip tone={owed.enabled ? 'ok' : undefined}>{text}</Chip>;
  const actions = <div className="owed-actions">{quick(size === 's' ? [15] : QUICK)}{tools}</div>;
  return (
    <div className={`owed-m size-${size}`}>
      {size === 'wide' ? <>
        <div className="owed-col">
          <div className="owed-wide-top">{label(title(owed))}<span className="m-label">本月老板欠我</span></div>
          <div className="owed-wide-amount" style={{ '--owed-scale': `${40 / amount.length}cqw` } as CSSProperties}><Rolling className="m-big" text={amount} /><span className="owed-today">今日 +¥{money(owed.today)}</span></div>
        </div>
        <div className="owed-col">{stats}{notice}</div>
        <div className="owed-col owed-col-end">{actions}</div>
      </> : <>
        <div className="owed-head">{label(title(owed))}</div>
        <div className="owed-body">
          {size === 's' ? main : size === 'm' ? <>
            <div className="owed-inline" style={{ '--owed-scale': `${60 / amount.length}cqw` } as CSSProperties}>
              <Rolling className="m-big" text={amount} /><span className="owed-today">今日 +¥{money(owed.today)}</span>
            </div>
            {stats}
          </> : <>{main}<div className="owed-ledger">{stats}{notice}</div></>}
        </div>
        {actions}
      </>}
      <Modal open={history} title={`${owed.month} 欠款记录`} onClose={() => setHistory(false)} className="owed-dialog">
        <OwedHistory owed={owed} notify={notify} />
      </Modal>
    </div>
  );
}

function IconButtonish({ label, children, ...rest }: { label: string; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return <Button size="sm" variant="ghost" aria-label={label} title={label} icon={children} {...rest} />;
}

function OwedHistory({ owed, notify }: { owed: OwedView; notify: (m: string) => void }) {
  return (
    <div className="owed-history">
      <MessageRow key="new" item={null} disabled={!!owed.error} notify={notify} />
      {owed.messages.length === 0 ? <p className="owed-empty">本月还没有记录消息</p>
        : owed.messages.map((item) => <MessageRow key={`${item.id}-${item.updatedAt}`} item={item} disabled={!!owed.error} notify={notify} />)}
    </div>
  );
}

function MessageRow({ item, disabled, notify }: { item: OwedMessage | null; disabled: boolean; notify: (m: string) => void }) {
  const initial = { date: item?.date ?? localDate(), minutes: String(item?.minutes ?? 10), note: item?.note ?? '' };
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const run = useOwedCommand(notify);
  useEffect(() => setErrors({}), [draft]);
  const dirty = !item || draft.date !== initial.date || draft.minutes !== initial.minutes || draft.note !== initial.note;
  const save = async () => {
    setBusy(true);
    const result = await run({ action: item ? 'edit' : 'add', id: item?.id, ...draft, minutes: Number(draft.minutes) });
    setBusy(false);
    // Keep the draft on failure so nothing typed is lost.
    if (!result.applied) setErrors(result.errors ?? {});
    else if (!item) setDraft({ ...initial, note: '' });
  };
  return (
    <div className={`owed-row ${item ? '' : 'is-new'}`}>
      <Field label="日期" error={errors.date}><DatePicker value={draft.date} max={localDate()} onChange={(date) => setDraft({ ...draft, date })} /></Field>
      <Field label="分钟" error={errors.minutes}>
        <input type="number" min="1" max="720" step="1" inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} />
      </Field>
      <Field label="备注" error={errors.note}>
        <input maxLength={40} value={draft.note} placeholder="谁在下班后找我" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </Field>
      <span className="owed-row-amount">{item ? `¥${money(item.amount)}` : ''}</span>
      <span className="owed-row-actions">
        <Button size="sm" disabled={disabled || busy || !dirty} icon={item ? undefined : <Plus size={14} />} onClick={() => void save()}>{item ? '保存' : '记一条'}</Button>
        {item && <Button size="sm" variant="ghost" disabled={disabled || busy} aria-label="删除" icon={<Trash2 size={14} />}
          onClick={() => void run({ action: 'remove', id: item.id })} />}
      </span>
    </div>
  );
}
