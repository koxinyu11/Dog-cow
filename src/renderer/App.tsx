import { HopeManagerLauncher } from './features/fun/HopeManagerLauncher';
import { TraySettings } from './features/tray/TraySettings';
import { ToiletStatus } from './features/toilet/PaidToilet';
import { TitleChip } from './features/titles/TitleBadge';
import { TitlesPane } from './features/titles/TitlesPane';
import { capsuleTheme } from './features/capsule/capsule-theme';
import { useTheme } from './theme';
import { installWindowTransition } from './features/capsule/window-transition';
import { WINDOW_ERRORS } from '../shared/capsule';
import { Capsule, CapsuleSettings } from './features/capsule/Capsule';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { localDate, matchesDate } from '../domain/tasks/model';
import { type Fields, type Result } from '../shared/contracts';
import { defaultBoard, type Board as BoardModel, type BoardItem, type MetricId } from '../shared/board';
import { command, useAppState, flushDrafts } from './state';
import { weekNames } from './format';
import { Modal } from './components/Modal';
import { LoadingScreen } from './components/LoadingScreen';
import { useReducedMotion } from './hooks/useReducedMotion';
import { Copy } from './features/personalization/Copy';
import { NewTask, WeeklyDialog } from './features/tasks/TaskDialogs';
import { Confetti } from './features/dashboard/Confetti';
import { DataPanel } from './features/settings/DataPanel';
import { IncomeSettingsPanel, RecordsPanel, ClockEditor } from './Income';
import { Board } from './board/Board';
import { Appearance, backgroundIsDark, backgroundStyle } from './board/Appearance';
import { Scene } from './board/Scene';
import { BoardContext, computeMetrics } from './board/metrics';
import { fx } from './motion/fx';
import { OffworkNotice, OffworkReceipt } from './features/attendance/Offwork';
import type { IncomeState } from '../shared/contracts';
import { BadgeCheck, CircleAlert, ClipboardList, LayoutGrid, Package, Palette, PanelTopClose, PanelTopOpen, Plus, Settings, Wallet, Wand2 } from 'lucide-react';
import { Button, Emoji, IconButton, MenuProvider, Segmented, Toast } from './ui';

const COPY_LABELS: Record<string, string> = {
  headerKicker: '顶部第一行',
  appTitle: '应用标题',
  dateLine: '顶部日期行',
  addButtonLabel: '新增任务按钮',
  progressTitle: '今日完成度',
  nextTaskTitle: '下一项任务',
  tasksTitle: '任务列表（默认显示“任务列表”）',
  calendarTitle: '月历',
  weekSummaryTitle: '本周概览',
  incomeTitle: '实时收入',
  workTimeTitle: '下班倒计时',
  clockTitle: '打卡',
  stolenTitle: '偷出金额',
  toiletTitle: '带薪拉屎',
  moodTitle: '今日精神状态', receiptTitle: '下班小票', lunchTitle: '今天吃什么',
  caloriesTitle: '热量爆表',
  hopesTitle: '盼头清单', pastureTitle: '工位小牧场', converterTitle: '工资能买啥',
};
type Tab = 'look' | 'income' | 'records' | 'data' | 'titles';
const taskNode = (id: string) => document.querySelector(`[data-task-id="${CSS.escape(id)}"]`);

export function App() {
  const state = useAppState();
  const { resolved } = useTheme();
  const capsuleSurface = state ? capsuleTheme(state.board.background, resolved).surface : '';
  // The application owns this color across both modes; capsule unmount cannot clear it.
  useLayoutEffect(() => {
    if (!capsuleSurface) return;
    document.body.style.setProperty('--capsule-window-surface', capsuleSurface);
    return () => { document.body.style.removeProperty('--capsule-window-surface'); };
  }, [capsuleSurface]);
  useEffect(installWindowTransition, []);
  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    if (state) document.title = state.tasks.settings.appTitle;
  }, [state?.tasks.settings.appTitle]);
  const [selected, select] = useState(localDate());
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState<Tab>('look');
  const [shelf, setShelf] = useState(false);
  const [arrangeTick, setArrangeTick] = useState(0);
  const [newTask, setNew] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone?: 'ok' | 'error' }>({ text: '' });
  const [celebrating, setCelebrating] = useState('');
  const [confetti, setConfetti] = useState(0);
  const [clock, setClock] = useState<{ action: string; date?: string; token: string; at: number } | null>(null);
  const [receipt, setReceipt] = useState<{ income: IncomeState; date: string; completedTasks: number } | null>(null);
  const [titleToast, setTitleToast] = useState<{ text: string; ids: string[] } | null>(null);
  const [titleFocus, setTitleFocus] = useState('');
  useEffect(() => {
    document.body.classList.toggle('capsule-mode', !!state?.compact);
    if (state?.compact) setSettings(false);
    return () => document.body.classList.remove('capsule-mode');
  }, [state?.compact]);
  useEffect(() => {
    const prepare = (event: Event) => {
      if (newTask || weekly || clock || receipt || document.querySelector('dialog[open]:not(.settings-dialog)')) event.preventDefault();
    };
    window.addEventListener('dogcow:prepare-capsule', prepare);
    return () => window.removeEventListener('dogcow:prepare-capsule', prepare);
  }, [newTask, weekly, clock, receipt]);
  useEffect(() => {
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<NonNullable<Result['offwork']>>).detail;
      setClock(null);
      setReceipt({ ...detail, completedTasks: state?.tasks.tasks.filter(task => task.done && matchesDate(task, detail.date)).length ?? 0 });
    };
    window.addEventListener('dogcow:offwork-saved', saved);
    return () => window.removeEventListener('dogcow:offwork-saved', saved);
  }, [state?.tasks.tasks]);
  useEffect(() => window.dogcow.openHopes(() => setSettings(false)), []);
  useEffect(() => window.dogcow.openIncomeSettings(() => {
    setSettings(true); setTab('income');
  }), []);
  useEffect(() => window.dogcow.openCapsuleSettings(() => {
    setSettings(true); setTab('look');
    requestAnimationFrame(() => document.getElementById('capsule-settings')?.focus());
  }), []);
  const switchMode = async (target: 'expanded' | 'capsule') => {
    const result = await command('windowMode', { target });
    if (result.message) notify(result.message, result.applied ? 'ok' : 'error');
    if (result.applied && target === 'capsule') setSettings(false);
  };
  const reduced = useReducedMotion();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const later = (key: string, ms: number, run: () => void) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(run, ms);
  };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const notify = (text: string, tone?: 'ok' | 'error') => {
    setToast({ text, tone });
    later('toast', 4000, () => setToast({ text: '' }));
  };
  // Unlock notice waits behind business toasts and the offwork receipt; shown once per title.
  const pendingTitles = state?.titles?.pendingToast ?? [];
  useEffect(() => {
    if (!pendingTitles.length || receipt || toast.text || titleToast || state?.compact) return;
    const names = pendingTitles.map((id) => state?.titles?.items.find((card) => card.id === id)?.name).filter(Boolean);
    if (!names.length) return;
    setTitleToast({ text: `解锁了新职称：${names[0]}${names.length > 1 ? ' 等' : ''}`, ids: pendingTitles });
    void command('titles', { action: 'toast-shown', ids: pendingTitles });
    later('title-toast', 4000, () => setTitleToast(null));
  }, [pendingTitles.join(','), receipt, toast.text, titleToast, state?.compact]);
  useEffect(() => {
    if (state?.window.warning && !state.compact) notify(WINDOW_ERRORS[state.window.warning as keyof typeof WINDOW_ERRORS] ?? '窗口操作未完成，请重试。', 'error');
  }, [state?.window.warning, state?.compact]);
  const handle = async (result: Result) => {
    notify(result.message, result.applied ? 'ok' : 'error');
    if (result.completion) {
      fx('task-done', taskNode(result.completion.taskId));
      if (!reduced) {
        setCelebrating(result.completion.taskId);
        later('celebrate', 1800, () => setCelebrating(''));
        if (result.completion.allDone) {
          fx('all-done');
          setConfetti((v) => v + 1);
          later('confetti', 4700, () => setConfetti(0));
        }
      }
      notify(result.completion.allDone ? '全部完成！太棒了 🎉' : '🐄 吃完啦！', 'ok');
    }
    return result;
  };
  const runTask = async (payload: Fields) => {
    const result = await command('task', payload, 'tasks').then(handle);
    if (result.applied && (payload.action === 'create' || payload.action === 'weekly'))
      setTimeout(() => fx('task-create', document.querySelector('.mod-tasks, .mod-next-task, .header-add')), 60);
    return result;
  };
  const act = async (action: string, id: string, extra: Fields = {}, anchor?: Element | null) => {
    const el = anchor ?? taskNode(id);
    const task = state?.tasks.tasks.find((t) => t.id === id);
    if (action === 'delete') fx('task-delete', el);
    if (action === 'move') fx('task-move', el);
    if (action === 'toggle' && task?.done) fx('task-undo', el);
    if (action === 'progress') fx('task-progress', el?.querySelector('.cow-runner') ?? el);
    const result = await runTask({ action, id, ...extra });
    if (!result.applied) fx('error', el);
    if (action === 'move' && result.applied && result.snapshot) {
      const moved = result.snapshot.tasks.tasks.find((t) => t.id === id);
      if (moved) select(moved.date);
    }
  };
  const patch = async (id: string, fields: Fields) => {
    await runTask({ action: 'update', id, patch: fields });
  };
  const openClock = async (action: string, date?: string) => {
    const result = await command('prepareClock', { action });
    if (result.code) setClock({ action, date, token: result.code, at: Number(result.errors?.at) });
    else notify(result.message, 'error');
  };
  const openSettings = (next: Tab | string) => {
    void flushDrafts();
    setTab(next as Tab);
    setSettings(true);
  };
  const openTitles = (id = '') => {
    setTitleFocus(id);
    setTitleToast(null);
    openSettings('titles');
  };
  const saveBoard = async (next: BoardModel) => {
    const result = await command('board', { board: next }, 'home');
    if (!result.applied) {
      notify(result.message, 'error');
      fx('error', document.querySelector('.board'));
    }
  };
  const metrics = useMemo(() => (state ? computeMetrics(state) : null), [state]);

  if (!state || !metrics || (!bootDone && !state.compact))
    return <LoadingScreen ready={!!state && !!metrics} onComplete={setBootDone} />;
  const board = state.board ?? defaultBoard();
  const today = localDate(new Date(state.income.now));
  const copy = (key: string, value: string) => void command('copy', { key, value }, 'tasks').then(handle);
  const title = (key: string, fallback = '') => (
    <Copy value={state.tasks.settings[key] || ''} name={key} fallback={fallback} label={COPY_LABELS[key]} commit={copy} />
  );
  const bind = (key: string, metric: MetricId | null, anchor?: Element | null) => {
    const bindings = { ...board.bindings };
    if (metric) bindings[key] = metric;
    else delete bindings[key];
    void saveBoard({ ...board, bindings }).then(() => fx(metric ? 'bind' : 'title', anchor));
  };
  const bg = backgroundStyle(board.background);
  return (
    <MenuProvider>
      <BoardContext.Provider value={{ metrics, bindings: board.bindings, bind }}>
        <HopeManagerLauncher state={state} notify={notify} />
        <div className={`app-bg ${bg.className}`} style={bg.style} aria-hidden="true">
          {!state.compact && board.background.kind === 'preset' && <Scene preset={board.background.value} />}
        </div>
        <div className="app-drag" aria-hidden="true" />
        <IconButton
          hidden={state.compact}
          className="window-compact-toggle"
          label="收成胶囊"
          variant="ghost"
          onClick={() => void switchMode('capsule')}
        >
          <PanelTopClose size={17} />
        </IconButton>
        {state.compact && <Capsule state={state} expand={() => void switchMode('expanded')} />}
        <main
          hidden={state.compact}
          inert={state.window.phase !== 'idle'}
          className={`app-shell ${shelf ? 'shelf-open' : ''} ${backgroundIsDark(board.background) ? 'on-dark' : ''} ${board.background.kind === 'image' ? 'on-image' : ''}`}
        >
          <header className="app-header">
            <div className="brand">
              <span className="brand-mascots">
                <Emoji motion="idle-peek" label="摸摸狗" onClick={(el) => fx('pet-dog', el)}>🐶</Emoji>
                <Emoji motion="idle-peek" label="摸摸牛" onClick={(el) => fx('pet-cow', el)}>🐮</Emoji>
              </span>
              <div>
                <p className="kicker">{title('headerKicker')}</p>
                <div className="brand-title-row">
                  <h1>{title('appTitle')}</h1>
                  {(() => {
                    const worn = state.titles?.showInHeader && state.titles.items.find((card) => card.id === state.titles?.worn);
                    return worn ? <TitleChip key={worn.id} card={worn} onClick={() => openTitles(worn.id)} /> : null;
                  })()}
                </div>
                <p className="date-line">
                  <Copy
                    value={state.tasks.settings.dateLine}
                    fallback={`${today} · ${weekNames[new Date(state.income.now).getDay()]}`}
                    name="dateLine"
                    label={COPY_LABELS.dateLine}
                    commit={copy}
                  />
                </p>
              </div>
            </div>
            <div className="header-actions">
              <ToiletStatus state={state} />
              <span className="header-add-wrap">
                <Button className="header-add" variant="primary" icon={<Plus size={16} strokeWidth={2.4} />} disabled={!!state.taskError} onClick={() => setNew(true)}>
                  {state.tasks.settings.addButtonLabel || '新增任务'}
                </Button>
                <span className="button-copy-editor">{title('addButtonLabel')}</span>
              </span>
              <Button icon={<Wand2 size={16} />} title="自动把主屏模块摆整齐，可撤销" onClick={() => setArrangeTick((v) => v + 1)}>
                智能摆放
              </Button>
              <Button icon={<LayoutGrid size={16} />} aria-pressed={shelf} onClick={() => setShelf((v) => !v)}>
                模块库
              </Button>
              <IconButton label="设置" onClick={() => openSettings('look')}><Settings size={17} /></IconButton>
            </div>
          </header>
          <OffworkNotice income={state.income} openClock={() => void openClock('finish')} />
          {(state.save.error || state.save.readError) && (
            <div className="banner is-error" role="alert">
              <span><CircleAlert size={16} /> {state.save.error || state.save.readError}</span>
              <Button size="sm" onClick={() => void command('retrySave').then(handle)}>重试保存</Button>
            </div>
          )}
          {state.layoutWarning && <div className="banner">{state.layoutWarning}</div>}
          <Board
            items={board.items}
            save={(items: BoardItem[]) => saveBoard({ ...board, items })}
            colors={board.colors ?? {}}
            saveColors={(colors) => saveBoard({ ...board, colors })}
            arrangeTick={arrangeTick}
            title={title}
            shelfOpen={shelf}
            closeShelf={() => setShelf(false)}
            ctx={{
              state,
              today,
              selected,
              select,
              celebrating: reduced ? '' : celebrating,
              act,
              patch,
              openNew: () => setNew(true),
              openWeekly: () => setWeekly(true),
              openClock: (action) => void openClock(action),
              openSettings,
              notify,
            }}
          />
          <Modal
            className="settings-dialog"
            open={settings}
            title="设置"
            onClose={() => {
              void flushDrafts();
              setSettings(false);
            }}
          >
            <Segmented<Tab>
              label="设置分类"
              value={tab}
              onChange={(next) => {
                void flushDrafts();
                setTab(next);
              }}
              options={[
                ['look', <><Palette size={14} /> 外观</>],
                ['income', <><Wallet size={14} /> 工资排班</>],
                ['records', <><ClipboardList size={14} /> 请假打卡</>],
                ['data', <><Package size={14} /> 迁移备份</>],
                ['titles', <><BadgeCheck size={14} /> 职称</>],
              ]}
            />
            <div className="settings-pane" hidden={tab !== 'look'}>
              <TraySettings state={state} notify={notify} />
              <CapsuleSettings state={state} notify={notify} />
              <Appearance
                background={board.background}
                fun={board.fun}
                setBackground={(background) => saveBoard({ ...board, background })}
                resetBoard={() => void saveBoard({ ...board, items: defaultBoard().items }).then(() => fx('module-add', document.querySelector('.board')))}
                notify={notify}
              />
            </div>
            <div className="settings-pane" hidden={tab !== 'income'}>
              <IncomeSettingsPanel income={state.income} notify={notify} />
            </div>
            <div className="settings-pane" hidden={tab !== 'records'}>
              <RecordsPanel income={state.income} open={openClock} notify={notify} />
            </div>
            <div className="settings-pane" hidden={tab !== 'data'}>
              <DataPanel notify={notify} />
            </div>
            <div className="settings-pane" hidden={tab !== 'titles'}>
              <TitlesPane titles={state.titles} visible={settings && tab === 'titles'} focusId={titleFocus} notify={notify} />
            </div>
            <p className="muted settings-foot">
              狗牛 {state.version} · 数据保存在本机 · {state.save.dirty ? '未保存 / 保存中' : '已保存'}
            </p>
          </Modal>
          <NewTask open={newTask} date={selected} onClose={() => setNew(false)} run={runTask} />
          <WeeklyDialog open={weekly} date={selected} onClose={() => setWeekly(false)} run={runTask} />
          {clock && <ClockEditor draft={clock} income={state.income} onClose={() => setClock(null)} notify={notify} onFinished={(income, date, completedTasks) => setReceipt({ income, date, completedTasks })} />}
          {receipt && <OffworkReceipt income={receipt.income} date={receipt.date} completedTasks={receipt.completedTasks} onClose={() => {
            setReceipt(null);
            requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.clock-main')?.focus());
          }} />}
          {confetti > 0 && !reduced && <Confetti key={confetti} />}
          {toast.text || !titleToast
            ? <Toast message={toast.text} tone={toast.tone} />
            : <Toast message={titleToast.text} action={{ label: '去看看', onClick: () => openTitles(titleToast.ids[0]) }} />}
        </main>
      </BoardContext.Provider>
    </MenuProvider>
  );
}
