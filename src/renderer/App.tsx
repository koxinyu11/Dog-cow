import { useEffect, useRef, useState } from 'react';
import { HOME_MODULES } from '../../app/income/src/home-layout.js';
import { localDate, matchesDate, weekDates } from '../domain/tasks/model';
import { type Fields, type Layout, type Result } from '../shared/contracts';
import { command, useAppState, flushDrafts } from './state';
import { dateLabel, weekNames } from './format';
import { Modal } from './components/Modal';
import { useReducedMotion } from './hooks/useReducedMotion';
import { Copy } from './features/personalization/Copy';
import { TaskCard } from './features/tasks/TaskCard';
import { NewTask, WeeklyDialog } from './features/tasks/TaskDialogs';
import { Calendar } from './features/calendar/Calendar';
import { WeeklySummary } from './features/dashboard/WeeklySummary';
import { Confetti } from './features/dashboard/Confetti';
import { DataPanel } from './features/settings/DataPanel';
import {
  IncomeSettingsPanel,
  RecordsPanel,
  ClockButtons,
  ClockEditor,
  IncomeWidgets,
} from './Income';

export function App() {
  const state = useAppState();
  useEffect(() => {
    if (state) document.title = state.tasks.settings.appTitle;
  }, [state?.tasks.settings.appTitle]);
  const [selected, select] = useState(localDate());
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState('home');
  const [newTask, setNew] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [toast, setToast] = useState('');
  const [celebrating, setCelebrating] = useState('');
  const [confetti, setConfetti] = useState(0);
  const [clock, setClock] = useState<{
    action: string;
    date?: string;
    token: string;
    at: number;
  } | null>(null);
  const reduced = useReducedMotion();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  };
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(celebrateTimer.current);
      clearTimeout(confettiTimer.current);
    },
    [],
  );
  const handle = async (result: Result) => {
    notify(result.message);
    if (result.completion) {
      if (!reduced) {
        setCelebrating(result.completion.taskId);
        clearTimeout(celebrateTimer.current);
        celebrateTimer.current = setTimeout(() => setCelebrating(''), 1800);
        if (result.completion.allDone) {
          setConfetti((v) => v + 1);
          clearTimeout(confettiTimer.current);
          confettiTimer.current = setTimeout(() => setConfetti(0), 4700);
        }
      }
      notify(result.completion.allDone ? '全部完成！太棒了 🎉' : '🐄 吃完啦！');
    }
    return result;
  };
  const runTask = (payload: Fields) => command('task', payload, 'tasks').then(handle);
  const act = async (action: string, id: string, extra: Fields = {}) => {
    const result = await runTask({ action, id, ...extra });
    if (action === 'move' && result.applied && result.snapshot) {
      const t = result.snapshot.tasks.tasks.find((task) => task.id === id);
      if (t) select(t.date);
    }
  };
  const patch = async (id: string, fields: Fields) => {
    await runTask({ action: 'update', id, patch: fields });
  };
  const openClock = async (action: string, date?: string) => {
    const result = await command('prepareClock', { action });
    if (result.code)
      setClock({
        action,
        date,
        token: result.code,
        at: Number(result.errors?.at),
      });
    else notify(result.message);
  };
  if (!state)
    return (
      <main className="app-shell">
        <h1>狗牛</h1>
        <p role="status">正在读取本机数据…</p>
      </main>
    );
  const today = localDate(new Date(state.income.now));
  const todayTasks = state.tasks.tasks.filter((t) => matchesDate(t, today));
  const next = [...todayTasks]
    .filter((t) => !t.done)
    .sort(
      (a, b) => ['高', '中', '低'].indexOf(a.priority) - ['高', '中', '低'].indexOf(b.priority),
    )[0];
  const selectedTasks = state.tasks.tasks
    .filter((t) => matchesDate(t, selected))
    .map((task, index) => ({ task, index }))
    .sort(
      (a, b) =>
        ['高', '中', '低'].indexOf(a.task.priority) - ['高', '中', '低'].indexOf(b.task.priority) ||
        a.index - b.index,
    )
    .map((item) => item.task);
  const copy = (key: string, value: string) =>
    void command('copy', { key, value }, 'tasks').then(handle);
  const title = (key: string, fallback = '') => (
    <Copy value={state.tasks.settings[key] || ''} name={key} fallback={fallback} commit={copy} />
  );
  const home = async (next: Layout) => {
    await command('layout', { layout: next }, 'home').then(handle);
  };
  const display = (id: string) => {
    if (id === 'progress')
      return (
        <>
          <h2>
            <Copy value={state.tasks.settings.progressTitle} name="progressTitle" commit={copy} />
          </h2>
          <p className="big-number">
            {todayTasks.length
              ? Math.round((todayTasks.filter((t) => t.done).length / todayTasks.length) * 100)
              : 100}
            %
          </p>
          <p>
            今日完成 {todayTasks.filter((t) => t.done).length} / {todayTasks.length}
          </p>
        </>
      );
    if (id === 'next-task')
      return (
        <>
          <h2>{title('nextTaskTitle')}</h2>
          <p className="big-number">{next?.title || '今天暂无待办'}</p>
          {next && (
            <p>
              {next.priority}优先级 {next.startTime}
            </p>
          )}
        </>
      );
    if (id === 'tasks')
      return (
        <>
          <div className="toolbar">
            <h2>{title('tasksTitle', dateLabel(selected))}</h2>
            <div className="actions">
              <button disabled={!!state.taskError} onClick={() => setNew(true)}>
                新增任务
              </button>
              <button disabled={!!state.taskError} onClick={() => setWeekly(true)}>
                每周任务
              </button>
              <button onClick={() => select(today)}>回到本周</button>
            </div>
          </div>
          <div className="week-tabs">
            {weekDates(selected).map((date) => (
              <button key={date} aria-pressed={selected === date} onClick={() => select(date)}>
                {dateLabel(date)} ·{' '}
                {state.tasks.tasks.filter((t) => matchesDate(t, date) && !t.done).length}
              </button>
            ))}
          </div>
          {state.taskError ? (
            <p className="notice">{state.taskError}</p>
          ) : selectedTasks.length ? (
            selectedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                library={state.tasks.tagLibrary}
                celebrating={celebrating === task.id && !reduced}
                act={act}
                patch={patch}
              />
            ))
          ) : (
            <p className="empty">这一天暂无任务。</p>
          )}
        </>
      );
    if (id === 'calendar')
      return <Calendar title={title('calendarTitle', '月历')} tasks={state.tasks.tasks} selected={selected} select={select} />;
    if (id === 'week-summary')
      return <WeeklySummary title={title('weekSummaryTitle')} tasks={state.tasks.tasks} selected={selected} />;
    if (id === 'clock')
      return (
        <>
          <h2>{title('clockTitle')}</h2>
          <ClockButtons income={state.income} open={openClock} notify={notify} />
          <button
            onClick={() => {
              setTab('records');
              setSettings(true);
            }}
          >
            请假与打卡记录
          </button>
        </>
      );
    return (
      <IncomeWidgets
        title={title(id === 'income' ? 'incomeTitle' : id === 'work-time' ? 'workTimeTitle' : 'stolenTitle')}
        kind={id}
        income={state.income}
        openSettings={() => {
          setTab('income');
          setSettings(true);
        }}
      />
    );
  };
  return (
    <>
      <div hidden={!state.compact} className="compact-bar">
        <span>狗牛</span>
        <button onClick={() => void command('compact')}>展开</button>
      </div>
      <main hidden={state.compact} className="app-shell">
        <header className="toolbar">
          <div>
            <p>
              <Copy value={state.tasks.settings.headerKicker} name="headerKicker" commit={copy} />
            </p>
            <h1>
              <Copy value={state.tasks.settings.appTitle} name="appTitle" commit={copy} />
            </h1>
            <p>
              <Copy
                value={state.tasks.settings.dateLine}
                fallback={`${today} · ${weekNames[new Date(state.income.now).getDay()]}`}
                name="dateLine"
                commit={copy}
              />
            </p>
          </div>
          <div className="actions">
            <div className="actions">
              <button disabled={!!state.taskError} onClick={() => setNew(true)}>
                {state.tasks.settings.addButtonLabel || '新增任务'}
              </button>
              <span className="button-copy-editor">{title('addButtonLabel')}</span>
            </div>
            <button
              onClick={() => {
                setTab('home');
                setSettings(true);
              }}
            >
              设置
            </button>
          </div>
        </header>
        {(state.save.error || state.save.readError) && (
          <div className="notice" role="alert">
            {state.save.error || state.save.readError}
            <button onClick={() => void command('retrySave').then(handle)}>重试保存</button>
          </div>
        )}
        <div className="dashboard-grid">
          {state.layout.order
            .filter((id) => state.layout.enabled.includes(id))
            .map((id) => (
              <section key={id} className={`module ${id}`} data-home-module={id}>
                {display(id)}
              </section>
            ))}
        </div>
        {!state.layout.enabled.length && (
          <div className="empty">
            首页模块全部隐藏。
            <button onClick={() => setSettings(true)}>打开设置</button>
          </div>
        )}
        <Modal
          open={settings}
          title="设置"
          onClose={() => {
            void flushDrafts();
            setSettings(false);
          }}
        >
          <nav className="actions">
            {[
              ['home', '首页模块'],
              ['copy', '标题与文案'],
              ['income', '工资与排班'],
              ['records', '请假与打卡'],
              ['data', '迁移与备份'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => {
                  void flushDrafts();
                  setTab(id);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div hidden={tab !== 'home'}>
            <p>显示和排序只改变首页，不改变工资、模式或记录。</p>
            {state.layoutWarning && <p className="notice">{state.layoutWarning}</p>}
            {state.layout.order.map((id, index) => (
              <div className="layout-row" key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={state.layout.enabled.includes(id)}
                    onChange={(e) =>
                      void home({
                        ...state.layout,
                        enabled: e.target.checked
                          ? [...state.layout.enabled, id]
                          : state.layout.enabled.filter((value) => value !== id),
                      })
                    }
                  />
                  {HOME_MODULES.find((m) => m.id === id)?.title}
                </label>
                {[-1, 1].map((delta) => (
                  <button
                    key={delta}
                    disabled={index + delta < 0 || index + delta >= state.layout.order.length}
                    aria-label={`${delta < 0 ? '上移' : '下移'}${id}`}
                    onClick={() => {
                      const order = [...state.layout.order];
                      [order[index], order[index + delta]] = [order[index + delta], order[index]];
                      void home({ ...state.layout, order });
                    }}
                  >
                    {delta < 0 ? '上移' : '下移'}
                  </button>
                ))}
              </div>
            ))}
            <button
              onClick={() =>
                void home({
                  version: 1,
                  order: HOME_MODULES.map((m) => m.id),
                  enabled: HOME_MODULES.filter((m) => m.defaultEnabled).map((m) => m.id),
                })
              }
            >
              恢复默认
            </button>
          </div>
          <div hidden={tab !== 'copy'} className="copy-settings">
            <p>点击铅笔修改，回车或离开输入框保存，Esc 取消。日期与月历标题留空时自动显示日期。</p>
            {Object.entries({ headerKicker: '顶部第一行', appTitle: '应用标题', dateLine: '顶部日期行', addButtonLabel: '新增任务按钮', progressTitle: '完成度标题', nextTaskTitle: '下一项任务标题', tasksTitle: '任务列表标题（默认显示日期）', calendarTitle: '月历标题', weekSummaryTitle: '本周概览标题', incomeTitle: '收入标题', workTimeTitle: '工时标题', clockTitle: '打卡标题', stolenTitle: '偷出金额标题' }).map(([key, label]) => (
              <div className="layout-row" key={key}><span>{label}</span><Copy value={state.tasks.settings[key] || ''} name={key} label={label} fallback="自动" commit={copy} /></div>
            ))}
          </div>
          <div hidden={tab !== 'income'}>
            <IncomeSettingsPanel income={state.income} notify={notify} />
          </div>
          <div hidden={tab !== 'records'}>
            <RecordsPanel income={state.income} open={openClock} notify={notify} />
          </div>
          <div hidden={tab !== 'data'}>
            <DataPanel notify={notify} />
          </div>
          <p className="muted">
            狗牛 {state.version} · 数据保存在本机 ·{' '}
            {state.save.dirty ? '未保存 / 保存中' : '已保存'}
          </p>
        </Modal>
        <NewTask open={newTask} date={selected} onClose={() => setNew(false)} run={runTask} />
        <WeeklyDialog
          open={weekly}
          date={selected}
          onClose={() => setWeekly(false)}
          run={runTask}
        />
        {clock && (
          <ClockEditor
            draft={clock}
            income={state.income}
            onClose={() => setClock(null)}
            notify={notify}
          />
        )}
        {confetti > 0 && !reduced && <Confetti key={confetti} />}
        <div role="status" className={toast ? 'app-toast' : ''}>
          {toast}
        </div>
      </main>
    </>
  );
}
