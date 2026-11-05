import { PaidToilet } from '../features/toilet/PaidToilet';
import { OwedModule } from '../features/owed/OwedModule';
import { FunModule } from '../features/fun/FunModules';
import { defaultFun, estimateMealCalories } from '../../shared/fun';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Fields, Snapshot, Task } from '../../shared/contracts';
import type { ModuleId, SizeKey } from '../../shared/board';
import { getAttendanceDay } from '../../../app/income/src/attendance.js';
import { addDays, localDate, matchesDate, weekDates } from '../../domain/tasks/model';
import { dateLabel, duration, labels, money, time, weekNames } from '../format';
import { command } from '../state';
import { fx } from '../motion/fx';
import {
  AlarmClock, ArrowLeft, ArrowRight, Bed, Briefcase, Building2, CalendarDays, CalendarRange, ChartColumn, Clock, Coffee,
  Check as CheckIcon, Drama, Flag, Flame, Hourglass, House, Landmark, ListTodo, LogIn, LogOut, Moon, Plus, Rabbit, Settings2, Sprout, Star, Sun,
  Target, TreePalm, Turtle, UtensilsCrossed, Wallet, Zap, ClipboardList, PencilLine, History, PiggyBank, Trophy, HandCoins, type LucideIcon,
} from 'lucide-react';
import { Button, Check, Chip, Emoji, LiveDot, Ring, Rolling, Stat } from '../ui';
import { ModuleDetails } from '../components/ModuleDetails';
import { TaskCard } from '../features/tasks/TaskCard';
import { Calendar } from '../features/calendar/Calendar';
import { TasksMedium, TasksSmall, TasksTall, TasksWide } from '../features/tasks/TaskViews';

export interface ModuleCtx {
  state: Snapshot;
  size: SizeKey;
  today: string;
  selected: string;
  select: (date: string) => void;
  celebrating: string;
  act: (action: string, id: string, extra?: Fields, anchor?: Element | null) => Promise<void>;
  patch: (id: string, fields: Fields) => Promise<void>;
  openNew: () => void;
  openWeekly: () => void;
  openClock: (action: string) => void;
  openSettings: (tab: string) => void;
  notify: (message: string) => void;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  icon: LucideIcon;
  /** Accent colour of the module badge and highlights. */
  accent: string;
  titleKey: string;
  blurb: string;
  defaultSize: SizeKey;
  render: (ctx: ModuleCtx) => ReactNode;
}

const isBig = (s: SizeKey) => s === 'l' || s === 'tall';
const priorityOrder = ['高', '中', '低'];
const byPriority = (a: Task, b: Task) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
const tone = (p: string) => (p === '高' ? 'high' : p === '低' ? 'low' : 'mid');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/* ---------------- 实时收入 ---------------- */
function IncomeModule({ state, size, openSettings }: ModuleCtx) {
  const s = state.income.snapshot;
  const today = num(s?.earnedToday);
  const month = num(s?.earnedMonth);
  const expected = num(s?.expectedMonthIncome);
  const host = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  useEffect(() => {
    const whole = Math.floor(today);
    if (last.current !== null && Math.floor(whole / 100) > Math.floor(last.current / 100))
      fx('coin-big', host.current?.querySelector('.income-amount'));
    last.current = whole;
  }, [Math.floor(today)]);
  if (!state.income.settings)
    return (
      <div className="m-empty">
        <PiggyBank size={36} strokeWidth={1.8} className="m-empty-icon" />
        <p>还没告诉我工资</p>
        <Button variant="primary" size="sm" onClick={() => openSettings('income')}>设置工资</Button>
      </div>
    );
  const jar = expected ? Math.min(1, month / expected) : 0;
  return (
    <div ref={host} className={`income-m size-${size}`}>
      <div className="income-main">
        <span className="m-label">{num(s?.earningPerSecond) > 0 && <LiveDot />}今日已赚</span>
        <span className="income-value" style={{ '--amount-scale': `${105 / (`¥${money(today)}`.length)}cqw` } as CSSProperties}>
          <Rolling className="income-amount" text={`¥${money(today)}`} />
        </span>
        <span className="m-sub income-rate">
          <Zap size={12} strokeWidth={2.4} /> 秒薪 {num(s?.perSecond).toFixed(4)} 元
        </span>
      </div>
      <div className="income-side">
          <Stat icon={Landmark} label="本月已赚" value={`¥${money(month)}`} />
          <Stat icon={Target} label="本月预计" value={`¥${money(expected)}`} />
          {isBig(size) && (
            <div className="coin-jar" style={{ '--fill': jar } as CSSProperties} title={`本月进度 ${Math.round(jar * 100)}%`}>
              <span className="coin-jar-fill" />
              <span className="coin-jar-face"><PiggyBank size={22} strokeWidth={2} /></span>
              <span className="coin-jar-pct">{Math.round(jar * 100)}%</span>
            </div>
          )}
        </div>
      {state.income.calculationError && <p className="m-notice">{state.income.calculationError.message}</p>}
    </div>
  );
}

/* ---------------- 下班倒计时 ---------------- */
const workIcon: Record<string, LucideIcon> = {
  working: Briefcase,
  paused: UtensilsCrossed,
  'before-work': Sun,
  'after-work': House,
  'rest-day': Bed,
  'paid-leave': TreePalm,
  'unpaid-leave': TreePalm,
  'leave-day': TreePalm,
  'pending-clock': LogIn,
};
function WorkTimeModule({ state, size }: ModuleCtx) {
  const s = state.income.snapshot;
  const status = String(s?.status || '');
  const remaining = num(s?.remainingSeconds);
  const elapsed = num(s?.elapsedSeconds);
  const ratio = elapsed + remaining ? elapsed / (elapsed + remaining) : 0;
  const hot = status === 'working' && remaining > 0 && remaining <= 600;
  const host = useRef<HTMLDivElement>(null);
  const warned = useRef(false);
  useEffect(() => {
    if (hot && !warned.current) fx('off-soon', host.current);
    warned.current = hot;
  }, [hot]);
  const StatusIcon = hot ? Flame : workIcon[status] || Hourglass;
  const big =
    status === 'rest-day' ? '今日休息' : s?.fullDayLeave ? '无需上班' : status === 'after-work' ? '已下班' : duration(remaining);
  const caption = labels[status] || '待设置';
  if (size === 'wide')
    return (
      <div ref={host} className={`work-wide ${hot ? 'is-hot' : ''}`}>
        <div className="commute" style={{ '--p': ratio } as CSSProperties}>
          <span className="commute-from"><Building2 size={20} /></span>
          <span className="commute-road"><span /></span>
          <span className="commute-runner"><Emoji motion={status === 'working' ? 'idle-walk' : 'none'}>🐂</Emoji></span>
          <span className="commute-to"><House size={20} /></span>
        </div>
        <div className="work-wide-copy">
          <span className="m-label">{status === 'working' && <LiveDot color="var(--accent)" />}{caption} · 距离下班</span>
          <b className="work-big">{big}</b>
        </div>
        <div className="work-summary">
          <Stat label="已工作" value={duration(elapsed)} />
          <Stat label="午休" value={duration(s?.actualBreakSeconds)} />
        </div>
      </div>
    );
  if (size === 's')
    return (
      <div ref={host} className={`work-s ${hot ? 'is-hot' : ''}`}>
        <span className="status-dot"><StatusIcon size={20} strokeWidth={2.2} /></span>
        <b className="work-big">{big}</b>
        <span className="m-label">{caption}</span>
        <div className="work-summary"><Stat label="已工作" value={duration(elapsed)} /><Stat label="午休" value={duration(s?.actualBreakSeconds)} /></div>
      </div>
    );
  const ringSize = isBig(size) ? 168 : 104;
  return (
    <div ref={host} className={`work-ring-wrap size-${size} ${hot ? 'is-hot' : ''}`}>
      <Ring value={ratio} size={ringSize} stroke={isBig(size) ? 14 : 10} color={hot ? 'var(--c-danger)' : undefined}>
        <StatusIcon size={isBig(size) ? 34 : 24} strokeWidth={2} className="ring-icon" />
      </Ring>
      <div className="work-copy">
        <span className="m-label">{status === 'working' && <LiveDot color="var(--accent)" />}{caption} · 距离下班</span>
        <b className="work-big">{big}</b>
        <div className="work-summary">
            <Stat icon={Briefcase} label="今日已工作" value={duration(elapsed)} />
            <Stat icon={UtensilsCrossed} label="实际午休" value={duration(s?.actualBreakSeconds)} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 本周任务概览 ---------------- */
function WeekModule({ state, size, selected, select, today }: ModuleCtx) {
  const dates = weekDates(selected);
  const days = dates.map((date) => {
    const list = state.tasks.tasks.filter((t) => matchesDate(t, date));
    return { date, total: list.length, done: list.filter((t) => t.done).length };
  });
  const total = days.reduce((a, d) => a + d.total, 0);
  const done = days.reduce((a, d) => a + d.done, 0);
  const weekItems = state.tasks.tasks.filter((t) => dates.some((d) => matchesDate(t, d)));
  const avg = weekItems.length ? Math.round(weekItems.reduce((a, t) => a + t.progress, 0) / weekItems.length) : 0;
  const max = Math.max(1, ...days.map((d) => d.total));
  const Mood = !total ? Sprout : done === total ? Trophy : done / total > 0.5 ? Rabbit : Turtle;
  const tags = new Map<string, { count: number; color: string }>();
  weekItems.forEach((t) => t.tags.forEach((g) => tags.set(g.label, { count: (tags.get(g.label)?.count || 0) + 1, color: g.color })));
  return (
    <div className={`week-m size-${size}`}>
      <div className="week-head">
        <span className="m-label week-range">{dateLabel(dates[0]).split(' ')[0]} – {dateLabel(dates[6]).split(' ')[0]}</span>
        <span className="week-score">
          <Mood size={14} strokeWidth={2.4} /> {done}/{total} · {total ? Math.round(done / total * 100) : 100}% 完成 · 平均进度 {avg}%
        </span>
      </div>
      <div className="week-bars">
        {days.map((d, i) => (
          <button
            key={d.date}
            className={`week-bar ${d.date === today ? 'is-today' : ''} ${d.date === selected ? 'is-selected' : ''}`}
            onClick={() => select(d.date)}
            aria-label={`${dateLabel(d.date)} 完成 ${d.done}/${d.total}`}
            style={{ '--h': d.total / max, '--done': d.total ? d.done / d.total : 0, '--i': i } as CSSProperties}
          >
            <span className="week-bar-col">
              <span className="week-bar-fill" />
              {d.total > 0 && d.done === d.total && <Star className="week-bar-star" size={12} fill="currentColor" />}
            </span>
            <small>{weekNames[new Date(`${d.date}T12:00:00`).getDay()].slice(1)}</small>
          </button>
        ))}
      </div>
      {(isBig(size) || size === 'wide') && tags.size > 0 && (
        <div className="week-tags">
          {[...tags].sort((a, b) => b[1].count - a[1].count).slice(0, size === 'tall' ? 4 : 6).map(([label, v]) => (
            <Chip key={label} color={v.color}>{label} · {v.count}</Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- 打卡 ---------------- */
function ClockModule({ state, size, openClock, openSettings, notify }: ModuleCtx) {
  const income = state.income;
  const date = localDate(new Date(income.now));
  const day = income.attendance.days.find((d) => d.date === date);
  const att = getAttendanceDay(income.attendance, date, new Date(income.now));
  const enabled = !!income.settings?.stealMode;
  const clockMode = enabled && !!income.settings?.clockMode;
  const unavailable = !income.settings || !income.snapshot || income.snapshot.status === 'rest-day' || !!income.snapshot.fullDayLeave;
  const pauseResume = (action: 'pause' | 'resume', el: Element) =>
    void command('clock', { action }, 'income').then((r) => {
      notify(r.message);
      fx(r.applied ? action : 'error', el);
    });
  let main: { label: string; icon: LucideIcon; tone: string; run: (el: Element) => void; disabled?: boolean };
  if (!income.settings) main = { label: '先设置排班', icon: Settings2, tone: 'idle', run: () => openSettings('income') };
  else if (!enabled) main = { label: '开启打卡', icon: AlarmClock, tone: 'idle', run: () => openSettings('income') };
  else if (att.state === 'paused') main = { label: '继续上班', icon: Coffee, tone: 'resume', run: (el) => pauseResume('resume', el) };
  else if (clockMode && !day?.clockIn) main = { label: '上班打卡', icon: LogIn, tone: 'in', run: () => openClock('start'), disabled: unavailable };
  else if (att.state === 'finished') main = { label: '已下班', icon: Moon, tone: 'done', run: () => openClock('finish') };
  else if (clockMode) main = { label: '下班打卡', icon: LogOut, tone: 'out', run: () => openClock('finish') };
  else main = { label: '去午休', icon: UtensilsCrossed, tone: 'pause', run: (el) => pauseResume('pause', el), disabled: unavailable };
  const canPause = enabled && att.state !== 'paused' && att.state !== 'finished' && !unavailable && (!clockMode || !!day?.clockIn);
  const status = !enabled ? '按规定排班计费' : att.state === 'paused' ? '午休中，好好吃饭' : att.state === 'finished' ? '今天辛苦啦' : clockMode && !day?.clockIn ? '还没上班打卡' : '牛马工作中';
  return (
    <div className={`clock-m size-${size} tone-${main.tone}`}>
      <button
        className="clock-main"
        disabled={main.disabled}
        onClick={(e) => main.run(e.currentTarget)}
      >
        <span className="clock-main-ripple" aria-hidden="true" />
        <main.icon className="clock-main-icon" size={size === 'l' || size === 'tall' ? 38 : 30} strokeWidth={2.2} aria-hidden="true" />
        <span className="clock-main-label">{main.label}</span>
      </button>
      <div className="clock-side">
          <span className="m-label">{status}</span>
          {day && (
            <span className="clock-times">
              <span><Sun size={14} /> {time(day.clockIn?.at).slice(0, 5) || '--:--'}</span>
              <span><Moon size={14} /> {time(day.clockOut?.at).slice(0, 5) || '--:--'}</span>
            </span>
          )}
          {day?.flex && <span className="m-label">{day.flex.mode==='shift'?'晚到晚走':'只免迟到'} · 下班 {time(day.flex.endAt)}</span>}
          <div className="clock-actions">
            {clockMode && income.settings?.flexEnabled && !day?.clockIn && <Button size="sm" disabled={unavailable} icon={<Clock size={14} />} onClick={()=>openClock('flex-start')}>弹性打卡</Button>}
            {canPause && main.tone !== 'pause' && (
              <Button size="sm" icon={<UtensilsCrossed size={14} />} onClick={(e) => pauseResume('pause', e.currentTarget)}>午休</Button>
            )}
            <details className="clock-more">
              <summary>更多</summary>
              <div>
                {clockMode && day?.clockIn && att.state !== 'finished' && <Button size="sm" variant="ghost" icon={<PencilLine size={14} />} onClick={() => openClock('start')}>改上班</Button>}
                {clockMode && <Button size="sm" variant="ghost" icon={<History size={14} />} onClick={() => openClock('edit')}>补录</Button>}
                <Button size="sm" variant="ghost" icon={<ClipboardList size={14} />} onClick={() => openSettings('records')}>记录</Button>
              </div>
            </details>
          </div>
          {Array.isArray(income.snapshot?.unfinishedDates) && income.snapshot.unfinishedDates.length > 0 && (
            <p className="m-notice">有 {income.snapshot.unfinishedDates.length} 天未结束，请核对下班时间。</p>
          )}
        </div>
    </div>
  );
}

/* ---------------- 今日完成度 ---------------- */
function ProgressModule({ state, size, today }: ModuleCtx) {
  const list = state.tasks.tasks.filter((t) => matchesDate(t, today));
  const done = list.filter((t) => t.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 100;
  const cow = pct === 100 ? '🐮' : '🐄';
  if (size === 'tall')
    return (
      <div className={`progress-v size-${size}`} style={{ '--p': pct / 100 } as CSSProperties}>
        <div className="progress-v-field">
          <span className="progress-v-grass" />
          <span className="progress-v-cow"><Emoji motion={pct === 100 ? 'idle-peek' : 'idle-chew'}>{cow}</Emoji></span>
        </div>
        <b className="m-big">{pct}%</b>
        <span className="m-label">{done}/{list.length} 项 · 剩余 {list.length - done}</span>
      </div>
    );
  if (size === 'l')
    return (
      <div className="progress-ring">
        <Ring value={pct / 100} size={170} stroke={16}>
          <Emoji motion={pct === 100 ? 'idle-peek' : 'idle-chew'} size={40}>{cow}</Emoji>
          <b>{pct}%</b>
        </Ring>
        <span className="m-label">今日完成 {done} / {list.length} · 剩余 {list.length - done}{pct === 100 && list.length ? ' · 吃饱啦' : ''}</span>
      </div>
    );
  return (
    <div className={`progress-h size-${size}`} style={{ '--p': pct / 100 } as CSSProperties}>
      <div className="progress-h-head">
        <b className="m-big">{pct}%</b>
        <span className="m-label">今日完成 {done} / {list.length} · 剩余 {list.length - done}</span>
      </div>
      <div className="pasture">
        <span className="pasture-eaten" />
        <span className="pasture-cow"><Emoji motion={pct === 100 ? 'idle-peek' : 'idle-chew'}>{cow}</Emoji></span>
        <span className="pasture-goal"><Flag size={16} strokeWidth={2.4} /></span>
      </div>
    </div>
  );
}

/* ---------------- 下一项任务 ---------------- */
function NextTaskModule({ state, size, today, act, patch, openNew }: ModuleCtx) {
  const open = state.tasks.tasks.filter((t) => matchesDate(t, today) && !t.done).sort(byPriority);
  const next = open[0];
  if (!next)
    return (
      <div className="m-empty">
        <Emoji size={34} motion="idle-peek">🐶</Emoji>
        <p>今天暂无待办，摸鱼合法</p>
        <Button size="sm" icon={<Plus size={14} />} onClick={openNew}>来一项</Button>
      </div>
    );
  return (
    <div className={`next-m size-${size}`}>
      <div className="next-main">
        <Check round checked={false} label={<span className="sr-only">完成 {next.title}</span>} onChange={() => void act('toggle', next.id, {}, document.querySelector(`[data-next="${next.id}"]`))} />
        <div data-next={next.id}>
          <b className="next-title">{next.title}</b>
            <span className="next-meta">
              <Chip tone={tone(next.priority)}>{next.priority}优先</Chip>
              {next.hasTime && <Chip><Clock size={11} /> {next.startTime}–{next.endTime}</Chip>}
              {next.dueDate && <Chip tone="warn">截止 {next.dueDate.slice(5)}</Chip>}
            </span>
        </div>
      </div>
      {(isBig(size) || size === 'wide') && open.length > 1 && (
        <ul className="next-queue">
          {open.slice(1, size === 'wide' ? 3 : 5).map((t) => (
            <li key={t.id}><Chip tone={tone(t.priority)}>{t.priority}</Chip> {t.title}</li>
          ))}
        </ul>
      )}
      <div className="next-footer"><span className="m-label">还剩 {open.length} 项</span>
        <ModuleDetails title="下一项任务">{() => <TaskCard task={next} library={state.tasks.tagLibrary} celebrating={false} act={act} patch={patch} />}</ModuleDetails>
      </div>
    </div>
  );
}

/* ---------------- 任务列表 ---------------- */
function TasksModule(ctx: ModuleCtx) {
  const { state, size, selected, select, today, act, patch, openNew, openWeekly, celebrating } = ctx;
  if (state.taskError) return <p className="m-notice">{state.taskError}</p>;
  const details = <ModuleDetails label="完整清单" title={`${dateLabel(selected)} · 任务清单`}>{() => (
    <div className="module-detail-list">
      <div className="tasks-add"><Button size="sm" onClick={openNew}>新增任务</Button><Button size="sm" onClick={openWeekly}>每周任务</Button></div>
      {state.tasks.tasks.filter((task) => matchesDate(task, selected)).sort(byPriority).map((task) => (
        <TaskCard key={task.id} task={task} library={state.tasks.tagLibrary} celebrating={celebrating === task.id} act={act} patch={patch} />
      ))}
      {!state.tasks.tasks.some((task) => matchesDate(task, selected)) && <p className="muted">这一天还没有任务。</p>}
    </div>
  )}</ModuleDetails>;
  const view = { tasks: state.tasks.tasks, selected, today, select, celebrating, act, openNew, openWeekly, details, locked: !!state.taskError };
  if (size === 's') return <TasksSmall {...view} />;
  if (size === 'm') return <TasksMedium {...view} />;
  if (size === 'wide') return <TasksWide {...view} />;
  if (size === 'tall') return <TasksTall {...view} />;
  const list = state.tasks.tasks
    .filter((t) => matchesDate(t, selected))
    .map((task, index) => ({ task, index }))
    .sort((a, b) => byPriority(a.task, b.task) || a.index - b.index)
    .map((x) => x.task);
  return (
    <div className="tasks-m size-l">
      <div className="tasks-bar">
        <div className="tasks-nav">
          <Button size="sm" variant="ghost" aria-label="前一天" icon={<ArrowLeft size={14} />} onClick={() => select(addDays(selected, -1))} />
          <span className="m-label">{dateLabel(selected)}</span>
          <Button size="sm" variant="ghost" aria-label="后一天" icon={<ArrowRight size={14} />} onClick={() => select(addDays(selected, 1))} />
          {selected !== today && <Button size="sm" variant="ghost" onClick={() => select(today)}>今天</Button>}
        </div>
        <div className="tasks-add">
          <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={openNew}>新增</Button>
          <Button size="sm" icon={<CalendarRange size={14} />} onClick={openWeekly}>每周</Button>
        </div>
      </div>
      <div className="week-tabs">
        {weekDates(selected).map((date) => {
          const left = state.tasks.tasks.filter((t) => matchesDate(t, date) && !t.done).length;
          return (
            <button key={date} aria-pressed={selected === date} className={date === today ? 'is-today' : ''} onClick={() => select(date)}>
              <b>{weekNames[new Date(`${date}T12:00:00`).getDay()]}</b>
              <small>{left ? `${left} 待办` : <CheckIcon size={12} strokeWidth={3} />}</small>
            </button>
          );
        })}
      </div>
      <div className="tasks-list">
        {!list.length ? (
          <div className="m-empty"><Sprout size={30} strokeWidth={1.8} className="m-empty-icon" /><p>这一天的草地空空的</p></div>
        ) : (
          list.map((task) => (
            <TaskCard key={task.id} task={task} library={state.tasks.tagLibrary} celebrating={celebrating === task.id} act={act} patch={patch} />
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- 月历 ---------------- */
function CalendarModule({ state, size, selected, select, today }: ModuleCtx) {
  const tasksOnDate = state.tasks.tasks.filter((task) => matchesDate(task, selected));
  const done = tasksOnDate.filter((task) => task.done).length;
  const monthDetails = <ModuleDetails label="完整月历" title="月历">{() => <Calendar tasks={state.tasks.tasks} selected={selected} select={select} />}</ModuleDetails>;
  if (size === 's') {
    const d = new Date(`${selected}T12:00:00`);
    return (
      <div className="cal-small">
      <button className="cal-tile" onClick={() => select(today)} aria-label="回到今天">
        <span className="cal-tile-month">{d.getMonth() + 1}月</span>
        <b>{d.getDate()}</b>
        <span className="m-label">{weekNames[d.getDay()]} · 待办 {tasksOnDate.length - done} / 已完成 {done}</span>
      </button>
      {monthDetails}
      </div>
    );
  }
  if (size === 'm' || size === 'wide') {
    const dates = weekDates(selected);
    return (
      <div className={`cal-week size-${size}`}>
      <div className="cal-strip">
        {dates.map((date) => {
          const tasks = state.tasks.tasks.filter((t) => matchesDate(t, date));
          const marks = [...new Set(tasks.filter((t) => t.calendarMark).map((t) => t.markerColor))].slice(0, 3);
          const d = new Date(`${date}T12:00:00`);
          return (
            <button key={date} aria-pressed={date === selected} className={date === today ? 'is-today' : ''} onClick={() => select(date)}>
              <small>{weekNames[d.getDay()].slice(1)}</small>
              <b>{d.getDate()}</b>
              <small>{tasks.filter((task) => !task.done).length} 待办</small>
              <span className="cal-dots">
                {marks.map((c) => <i key={c} style={{ background: c }} />)}
                {!marks.length && tasks.length > 0 && <i />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="cal-footer"><span className="m-label">已完成 {done} / {tasksOnDate.length}</span>{monthDetails}</div>
      </div>
    );
  }
  return <Calendar tasks={state.tasks.tasks} selected={selected} select={select} />;
}

/* ---------------- 偷出金额 ---------------- */
function StolenModule({ state, size, openSettings }: ModuleCtx) {
  const s = state.income.snapshot;
  const on = !!state.income.settings?.stealMode;
  if (!on)
    return (
      <div className="m-empty">
        <Drama size={34} strokeWidth={1.8} className="m-empty-icon" />
        <p>偷时间模式未开启</p>
        <Button size="sm" onClick={() => openSettings('income')}>去开启</Button>
      </div>
    );
  const parts: Array<[string, string, LucideIcon]> = [
    ['lunchStolenAmount', '午休', UtensilsCrossed],
    ['lateAmount', '上班晚', Turtle],
    ['earlyAmount', '下班早', Rabbit],
    ['toiletStolenAmount', '带薪拉屎', Briefcase],
  ];
  const compact = size === 's' || size === 'm';
  const amount = `¥${money(s?.stolenAmount)}`;
  const total = parts.reduce((sum, [key]) => sum + num(s?.[key]), 0) || 1;
  return (
    <div className={`stolen-m size-${size}`}>
      <div className="stolen-main">
        <div className="stolen-today" style={{ '--stolen-scale': `${65 / amount.length}cqw` } as CSSProperties}>
          <span className="m-label">今日偷出</span>
          <Rolling className="m-big" text={amount} />
        </div>
        <div className="stolen-month">
          <span className="m-label">本月合计</span>
          <strong><Rolling text={`¥${money(s?.stolenMonthAmount)}`} /></strong>
        </div>
      </div>
      {isBig(size) && (
        <div className="stolen-split" aria-hidden="true">
          {parts.map(([key, label, Icon]) => (
            <span key={key} style={{ flexGrow: Math.max(0.15, num(s?.[key]) / total) }} title={`${label} ¥${money(s?.[key])}`}>
              <Icon size={13} strokeWidth={2.4} />
            </span>
          ))}
        </div>
      )}
      <div className="stolen-stats">
        {parts.map(([key, label, Icon]) => <Stat key={key} icon={compact ? undefined : Icon} label={label} value={`¥${money(s?.[key])}`} />)}
      </div>
      {!compact && <span className="m-label stolen-hint">只拆分时间价值，不额外加到工资</span>}
    </div>
  );
}

/* ---------------- 热量爆表 ---------------- */
function CaloriesModule({ state, size, today }: ModuleCtx) {
  const lunch = (state.board.fun ?? defaultFun()).lunch;
  const chosen = lunch.date === today ? lunch.chosen : '';
  const servings = lunch.date === today ? lunch.servings ?? 1 : 1;
  const automatic = chosen ? Math.round(estimateMealCalories(chosen) * servings) : 0;
  const calories = lunch.calories ?? automatic;
  const [draft, setDraft] = useState(String(calories));
  useEffect(() => setDraft(String(calories)), [calories, chosen]);
  const saveCalories = async (value: number | null) => {
    const result = await command('fun', { action: 'lunch-details', servings, calories: value }, 'home');
    if (!result.applied || !result.persisted) return;
    setDraft(String(value ?? automatic));
  };
  if (!chosen)
    return (
      <div className="m-empty calories-empty">
        <Flame size={34} strokeWidth={1.8} className="m-empty-icon" />
        <p>先在「今天吃什么」里选定一餐</p>
        <span className="m-label">选完后，这里会自动计算</span>
      </div>
    );
  const ratio = Math.min(1, calories / 1200);
  return (
    <div className={`calories-m size-${size}`} style={{ '--calories': ratio } as CSSProperties}>
      <div className="calories-gauge" aria-label={`${chosen}估算热量 ${calories} 千卡`}>
        <span className="calories-fill" />
        <Flame size={size === 'l' ? 34 : 25} />
      </div>
      <div className="calories-copy">
        <span className="m-label">今日已选 · {chosen} · {servings} 份</span>
        <label className="calories-input">
          <input
            aria-label="调整今日热量"
            type="number"
            min="0"
            max="10000"
            step="10"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => { const value = Number(draft); if (Number.isInteger(value) && value >= 0 && value <= 10000) void saveCalories(value); else setDraft(String(calories)); }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          />
          <small>千卡</small>
        </label>
        <div className="calories-actions">
          <Button size="sm" variant="ghost" onClick={() => void saveCalories(Math.max(0, calories - 50))}>−50</Button>
          <Button size="sm" variant="ghost" onClick={() => void saveCalories(Math.min(10000, calories + 50))}>+50</Button>
          {lunch.calories !== undefined && <Button size="sm" variant="ghost" onClick={() => void saveCalories(null)}>恢复自动</Button>}
        </div>
        <span className="m-label">自动估算 {automatic} 千卡，可按实际分量修改</span>
      </div>
    </div>
  );
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  mood: { id: 'mood', name: '今日精神状态', icon: Coffee, accent: '#dd858a', titleKey: 'moodTitle', blurb: '今天是哪一种牛', defaultSize: 'm', render: c => <FunModule kind="mood" {...c} /> },
  lunch: { id: 'lunch', name: '今天吃什么', icon: UtensilsCrossed, accent: '#e28b47', titleKey: 'lunchTitle', blurb: '午餐选择困难救星', defaultSize: 'm', render: c => <FunModule kind="lunch" {...c} /> },
  calories: { id: 'calories', name: '热量爆表', icon: Flame, accent: '#ef6c3e', titleKey: 'caloriesTitle', blurb: '选完午餐自动估算热量', defaultSize: 'm', render: c => <CaloriesModule {...c} /> },
  hopes: { id: 'hopes', name: '盼头清单', icon: TreePalm, accent: '#46a898', titleKey: 'hopesTitle', blurb: '给生活留个盼头', defaultSize: 'm', render: c => <FunModule kind="hopes" {...c} /> },
  pasture: { id: 'pasture', name: '工位小牧场', icon: Sprout, accent: '#72a651', titleKey: 'pastureTitle', blurb: '一件事，一丛草', defaultSize: 'm', render: c => <FunModule kind="pasture" {...c} /> },
  converter: { id: 'converter', name: '工资能买啥', icon: Wallet, accent: '#bd84b9', titleKey: 'converterTitle', blurb: '今天赚了几份快乐', defaultSize: 'm', render: c => <FunModule kind="converter" {...c} /> },
  income: { id: 'income', name: '实时收入', icon: Wallet, accent: '#2f9e6b', titleKey: 'incomeTitle', blurb: '每秒都在涨的钱', defaultSize: 'm', render: (c) => <IncomeModule {...c} /> },
  'work-time': { id: 'work-time', name: '下班倒计时', icon: Hourglass, accent: '#5b6fe0', titleKey: 'workTimeTitle', blurb: '离自由还有多久', defaultSize: 'm', render: (c) => <WorkTimeModule {...c} /> },
  'week-summary': { id: 'week-summary', name: '本周任务概览', icon: ChartColumn, accent: '#f08a3e', titleKey: 'weekSummaryTitle', blurb: '七天的草吃了多少', defaultSize: 'l', render: (c) => <WeekModule {...c} /> },
  clock: { id: 'clock', name: '打卡', icon: AlarmClock, accent: '#e2735a', titleKey: 'clockTitle', blurb: '上班 · 午休 · 下班', defaultSize: 'l', render: (c) => <ClockModule {...c} /> },
  progress: { id: 'progress', name: '今日完成度', icon: Sprout, accent: '#6fae5f', titleKey: 'progressTitle', blurb: '牛吃草进度条', defaultSize: 'm', render: (c) => <ProgressModule {...c} /> },
  'next-task': { id: 'next-task', name: '下一项任务', icon: Target, accent: '#d2493a', titleKey: 'nextTaskTitle', blurb: '只看眼前这一件', defaultSize: 'm', render: (c) => <NextTaskModule {...c} /> },
  tasks: { id: 'tasks', name: '任务列表', icon: ListTodo, accent: '#3c8fd6', titleKey: 'tasksTitle', blurb: '完整编辑每项任务', defaultSize: 'wide', render: (c) => <TasksModule {...c} /> },
  calendar: { id: 'calendar', name: '月历', icon: CalendarDays, accent: '#c4569a', titleKey: 'calendarTitle', blurb: '周条 · 月格 · 今日签', defaultSize: 'l', render: (c) => <CalendarModule {...c} /> },
  'paid-toilet': { id: 'paid-toilet', name: '带薪拉屎', icon: Briefcase, accent: '#56865b', titleKey: 'toiletTitle', blurb: '换个工位，继续领薪', defaultSize: 'm', render: c => <PaidToilet {...c} /> },
  owed: { id: 'owed', name: '老板欠我钱', icon: HandCoins, accent: '#c0392b', titleKey: 'owedTitle', blurb: '早到晚走都记着账', defaultSize: 'm', render: (c) => <OwedModule {...c} /> },
  stolen: { id: 'stolen', name: '偷出金额', icon: Drama, accent: '#7a5bc4', titleKey: 'stolenTitle', blurb: '摸鱼的时间值多少', defaultSize: 'm', render: (c) => <StolenModule {...c} /> },
};
