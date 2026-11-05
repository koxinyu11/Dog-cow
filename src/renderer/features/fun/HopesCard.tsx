import { useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { ModuleCtx } from '../../board/modules';
import type { Fields, Result } from '../../../shared/contracts';
import { defaultFun, hopeDate, presetDate, HOPE_PRESETS, HOPE_TEMPLATES, type Hope, type HopeRepeat } from '../../../shared/fun';
import { Button } from '../../ui';
import { Modal, Field } from '../../components/Modal';
import { DatePicker } from '../../components/DatePicker';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const REPEAT_LABEL: Record<HopeRepeat, string> = { week: '每周', month: '每月', year: '每年', holiday: '法定假期', spring: '春节' };
const weekday = (date: string) => `周${WEEK[new Date(`${date}T12:00:00`).getDay()]}`;
const quip = (days: number) => days > 30 ? '熬着吧' : days > 7 ? '快了快了' : days > 1 ? '已经闻到味了' : days === 1 ? '明天！' : days === 0 ? '就是今天！' : '已经过去啦';

type Item = { hope: Hope; at: ReturnType<typeof hopeDate> };
/** Upcoming first (nearest on top), then dates waiting for holiday data, then past one-off hopes. */
const rank = (item: Item) => !item.at ? 1e6 : item.at.days < 0 ? 2e6 - item.at.days : item.at.days;

const dayText = (at: Item['at']) => !at ? '待定' : at.days === 0 ? '今天' : at.days < 0 ? `过 ${-at.days} 天` : `${at.days} 天`;
const icon = (hope: Hope) => hope.emoji ?? '✨';

type View = { items: Item[]; current: Item; index: number; busy: boolean; pin: (id: string) => void; step: (dir: number) => void; manage: () => void; goto: (date: string) => void };

export function HopesCard({ ctx, busy, run }: { ctx: ModuleCtx; busy: boolean; run: (p: Fields) => Promise<Result | null> }) {
  const { state, today, size, select, notify } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const holidays = state.hopeHolidays ?? [];
  const [open, setOpen] = useState(false);
  const items: Item[] = fun.hopes.map(hope => ({ hope, at: hopeDate(hope, today, holidays) })).sort((a, b) => rank(a) - rank(b));
  const index = Math.max(0, items.findIndex(item => item.hope.id === fun.pinned));
  const pin = (id: string) => { if (!busy && id !== fun.pinned) void run({ action: 'pin', id }); };
  const view: View = {
    items, current: items[index], index, busy, pin,
    step: dir => { const next = items[(index + dir + items.length) % items.length]; if (next) pin(next.hope.id); },
    manage: () => setOpen(true),
    goto: date => { select(date); notify('已切换月历日期'); },
  };
  const Layout = { s: HopeSticky, m: HopeTear, wide: HopeBoard, tall: HopeStack, l: HopeRoad }[size];
  return <div className={`hope-card hope-${size}`}>
    {items.length ? <Layout {...view} today={today} /> : <div className="hope-empty">
      <span>还没有盼头</span>
      <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>加一个</Button>
    </div>}
    {open && <HopeManager ctx={ctx} busy={busy} run={run} onClose={() => setOpen(false)} />}
  </div>;
}

const AddButton = ({ manage }: { manage: () => void }) => <button type="button" className="hope-add" aria-label="管理盼头" title="管理盼头" onClick={manage}><Plus size={14} /></button>;
function Nav({ items, index, busy, step, manage }: View) {
  return <div className="hope-nav">
    {items.length > 1 && <><button type="button" aria-label="上一个盼头" disabled={busy} onClick={() => step(-1)}><ChevronLeft size={15} /></button>
      <span>{index + 1}/{items.length}</span>
      <button type="button" aria-label="下一个盼头" disabled={busy} onClick={() => step(1)}><ChevronRight size={15} /></button></>}
    <AddButton manage={manage} />
  </div>;
}
function Info({ item }: { item: Item }) {
  const { hope, at } = item;
  return <>
    <strong className="hope-name">{icon(hope)} {hope.name}{at?.label ? <small> · {at.label}</small> : null}</strong>
    <span className="hope-quip">{at ? quip(at.days) : '等节假日数据更新'}</span>
    {at && <span className="hope-date">{at.date} {weekday(at.date)}{hope.repeat ? ` · ${REPEAT_LABEL[hope.repeat]}` : ''}</span>}
  </>;
}

/** 小 · a sticky note. Tapping it peels to the next hope. */
function HopeSticky({ current, items, step, manage, busy }: View & { today: string }) {
  const [flip, setFlip] = useState(0);
  return <>
    <button type="button" key={flip} className={`hope-sticky ${current.at?.days === 0 ? 'is-today' : ''} ${current.at && current.at.days < 0 ? 'is-past' : ''}`} disabled={busy}
      aria-label={`${current.hope.name} ${dayText(current.at)}${items.length > 1 ? '，点击看下一个' : ''}`}
      onClick={() => { if (items.length > 1) { setFlip(f => f + 1); step(1); } else manage(); }}>
      <b>{!current.at ? '…' : current.at.days === 0 ? '今天' : Math.abs(current.at.days)}<small>{current.at && current.at.days !== 0 ? '天' : ''}</small></b>
      <span>{icon(current.hope)} {current.hope.name}</span>
    </button>
    <AddButton manage={manage} />
  </>;
}

/** 中 · tear-off calendar plus a progress strip for the last stretch. */
function HopeTear(view: View & { today: string }) {
  const { current, goto, today } = view;
  const dow = new Date(`${today}T12:00:00`).getDay() || 7;
  return <>
    <HopeTile item={current} onClick={() => current.at && goto(current.at.date)} />
    <div className="hope-side"><Info item={current} /><Nav {...view} /></div>
    {current.hope.repeat === 'week' ? <div className="hope-week" aria-hidden="true">
      {WEEK.slice(1, 6).map((d, i) => <span key={d} className={i + 1 < dow ? 'is-done' : i + 1 === dow ? 'is-now' : ''}>{d}</span>)}
    </div> : <div className="hope-progress" aria-hidden="true"><i style={{ width: `${current.at ? Math.max(0, Math.min(100, (30 - current.at.days) / 30 * 100)) : 0}%` }} /></div>}
  </>;
}

/** 长 · station departure board. */
function HopeBoard({ items, current, pin, manage }: View & { today: string }) {
  const next = items.find(item => item.at && item.at.days >= 0);
  const status = (at: Item['at']) => !at ? '待定' : at.days === 0 ? '正在检票' : at.days < 0 ? '已发车' : at.days === 1 ? '明天发车' : `还有 ${at.days} 天`;
  return <div className="hope-board">
    <div className="hope-board-head"><span>盼头 · 发车时刻</span><span>日期</span><span>状态</span><AddButton manage={manage} /></div>
    {items.slice(0, 3).map(item => <button type="button" key={item.hope.id} aria-pressed={item === current}
      className={`${item === next ? 'is-next' : ''} ${item.at && item.at.days < 0 ? 'is-past' : ''} ${item.at?.days === 0 ? 'is-today' : ''}`} onClick={() => pin(item.hope.id)}>
      <span>{icon(item.hope)} {item.hope.name}</span>
      <span>{item.at ? `${item.at.date.slice(5)} ${weekday(item.at.date)}` : '--'}</span>
      <b>{status(item.at)}</b>
    </button>)}
  </div>;
}

/** 竖 · a pad of calendar pages; tearing the top one shows the next. */
function HopeStack(view: View & { today: string }) {
  const { items, index, current, step, busy } = view;
  const [tearing, setTearing] = useState(false);
  const behind = [1, 2, 3].map(n => items[(index + n) % items.length]).filter((item, n) => items.length > n + 1 && item !== current);
  return <>
    <div className="hope-pad">
      {behind.reverse().map((item, n) => <span key={item.hope.id} className="hope-pad-page" style={{ '--n': behind.length - n } as CSSProperties} aria-hidden="true">{icon(item.hope)}</span>)}
      <div className={`hope-pad-top ${tearing ? 'is-tearing' : ''}`} onAnimationEnd={() => { if (tearing) { setTearing(false); step(1); } }}>
        <HopeTile item={current} onClick={() => current.at && view.goto(current.at.date)} />
      </div>
    </div>
    <div className="hope-side"><Info item={current} /></div>
    <div className="hope-stack-actions">
      {items.length > 1 && <Button size="sm" disabled={busy || tearing} onClick={() => setTearing(true)}>撕掉这页 →</Button>}
      <AddButton manage={view.manage} />
    </div>
  </>;
}

/** 大 · a road from today, hopes as signposts spaced by distance. */
function HopeRoad(view: View & { today: string }) {
  const { items, current, pin } = view;
  const ahead = items.filter(item => item.at && item.at.days >= 0).slice(0, 6);
  const far = Math.sqrt(Math.max(1, ...ahead.map(item => item.at!.days)));
  return <>
    <div className="hope-feature">
      <HopeTile item={current} onClick={() => current.at && view.goto(current.at.date)} />
      <div className="hope-side"><Info item={current} /><Nav {...view} /></div>
    </div>
    <div className="hope-road">
      <span className="hope-road-start">🐮<small>今天</small></span>
      {ahead.map((item, i) => {
        const near = 1 - Math.sqrt(item.at!.days) / far;
        return <button type="button" key={item.hope.id} aria-pressed={item === current} className={i % 2 ? 'is-low' : ''} onClick={() => pin(item.hope.id)}
          style={{ left: `${12 + 84 * Math.sqrt(item.at!.days) / far}%`, '--near': near.toFixed(2) } as CSSProperties}>
          <span>{icon(item.hope)}</span><small>{item.hope.name} · {dayText(item.at)}</small>
        </button>;
      })}
    </div>
  </>;
}

function HopeTile({ item, onClick }: { item: Item; onClick: () => void }) {
  const { at } = item;
  const past = !!at && at.days < 0;
  return <button type="button" className={`hope-tile ${at?.days === 0 ? 'is-today' : ''} ${past ? 'is-past' : ''}`} onClick={onClick}
    aria-label={at ? `${item.hope.name} ${at.days === 0 ? '就是今天' : past ? `已过 ${-at.days} 天` : `还有 ${at.days} 天`}` : `${item.hope.name} 日期待更新`}>
    <span className="hope-tile-top">{past ? '已过' : at?.days === 0 ? '🎉' : '还有'}</span>
    <span className="hope-tile-num">{!at ? '…' : at.days === 0 ? '今天' : Math.abs(at.days)}</span>
    <span className="hope-tile-unit">{at && at.days !== 0 ? '天' : '\u00a0'}</span>
  </button>;
}

const REPEAT_CHOICES: [HopeRepeat | '', string][] = [['', '不重复'], ['week', '每周'], ['month', '每月'], ['year', '每年']];

function HopeManager({ ctx, busy, run, onClose }: { ctx: ModuleCtx; busy: boolean; run: (p: Fields) => Promise<Result | null>; onClose: () => void }) {
  const { state, today } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const holidays = state.hopeHolidays ?? [];
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [date, setDate] = useState(today);
  const [repeat, setRepeat] = useState<HopeRepeat | ''>('');
  const missing = HOPE_PRESETS.filter(p => !fun.hopes.some(h => h.id === p.id));
  const add = (payload: Fields) => run({ action: 'hope', ...payload });
  return <Modal open title="盼头清单" onClose={() => { if (!busy) onClose(); }} className="hope-manager">
    <div className="hope-chips">
      {missing.map(p => <button type="button" key={p.id} disabled={busy} onClick={() => void add({ ...p, date: presetDate(p.id, today) })}>{p.emoji} {p.name}</button>)}
      {HOPE_TEMPLATES.map(t => <button type="button" key={t.name} disabled={busy} aria-pressed={name === t.name}
        onClick={() => { setName(t.name); setEmoji(t.emoji ?? '✨'); setRepeat(t.repeat ?? ''); }}>{t.emoji} {t.name}</button>)}
    </div>
    <form onSubmit={async event => {
      event.preventDefault();
      if (await add({ id: crypto.randomUUID(), name, date, emoji, ...(repeat ? { repeat } : {}) })) { setName(''); setEmoji('✨'); setRepeat(''); }
    }}>
      <div className="fields">
        <Field label="盼头"><input value={name} maxLength={60} required placeholder="比如：发薪日" onChange={e => setName(e.target.value)} /></Field>
        <Field label={repeat === 'month' ? '每月这一天' : repeat === 'week' ? '每周这一天' : '日期'}><DatePicker value={date} onChange={setDate} /></Field>
      </div>
      <div className="hope-repeat" role="group" aria-label="重复">
        {REPEAT_CHOICES.map(([value, label]) => <button type="button" key={label} aria-pressed={repeat === value} onClick={() => setRepeat(value)}>{label}</button>)}
      </div>
      <div className="dialog-actions"><Button variant="ghost" disabled={busy} onClick={onClose}>完成</Button><Button type="submit" variant="primary" disabled={busy}>添加</Button></div>
    </form>
    <div className="hope-rows">{fun.hopes.map(h => {
      const at = hopeDate(h, today, holidays);
      return <div key={h.id}>
        <span>{h.emoji ?? '✨'} {h.name}<small>{h.repeat ? REPEAT_LABEL[h.repeat] + ' · ' : ''}{at ? `${at.date}${at.label ? ' ' + at.label : ''}` : '等节假日数据'}</small></span>
        <Button size="sm" variant="ghost" aria-pressed={h.id === fun.pinned} disabled={busy || h.id === fun.pinned} onClick={() => void run({ action: 'pin', id: h.id })}>{h.id === fun.pinned ? '置顶中' : '置顶'}</Button>
        <Button size="sm" variant="ghost" aria-label={`移除 ${h.name}`} disabled={busy} icon={<Trash2 size={13} />} onClick={() => void run({ action: 'remove-hope', id: h.id })} />
      </div>;
    })}</div>
  </Modal>;
}
