import { traySummary } from '../shared/tray-summary.js';
import { TrayPanelController } from './tray-panel-controller.js';
import { TrayController } from './tray-controller.js';
import { trayView, isTrayDisplay, TRAY_ERRORS, trustedPanelCommand, type TrayPanelData, type TrayDisplay } from '../shared/tray.js';
import { TOILET_KEY, changeToilet, reviewToilet, endToilet } from '../../app/income/src/paid-toilet.js';
import { TOILET_ERRORS } from '../shared/toilet-command.js';
import { createUpdateFetch } from './update-transport.js';
import { WindowStateStore } from './window-state.js';
import { WindowController } from './window-controller.js';
import { buildFlexDay } from '../../app/income/src/flex.js';
import { OWED_KEY, changeOwed, emptyOwed, owedSummary, parseOwed } from '../../app/income/src/owed.js';
import { moodData, MOOD_REWARDS } from '../shared/mood.js';
import { defaultFun, holidayStarts, rewardTask, seedHopes, updateFun, type HolidayStart } from '../shared/fun.js';
import { isWallpaperUnlocked } from '../shared/wallpapers.js';
import { ReleaseUpdater } from './release-updates.js';
import { boundedCalendarFetch } from './calendar-network.js';
import { loadHolidayYear } from '../../app/income/src/calendar.js';
import { clockCommandError } from '../shared/clock-command.js';
import {
  app,
  clipboard,
  BrowserWindow,
  nativeTheme,
  nativeImage,
  dialog,
  ipcMain,
  Menu,
  net,
  powerMonitor,
  protocol,
  shell,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Repository } from './repository.js';
import { Titles } from './titles.js';
import {
  addDays,
  copyDefaults,
  emptyTasks,
  localDate,
  normalizeTask,
  parseTasks,
  record,
  validDate,
} from '../domain/tasks/model.js';
import {
  methods,
  type Fields,
  type IncomeState,
  type Layout,
  type Result,
  type Snapshot,
  type OwedView,
  type TaskState,
} from '../shared/contracts.js';
import { createController, type IncomeController } from './legacy-adapter.js';
import { applyAttendanceAction, setAttendanceTimes } from '../../app/income/src/attendance.js';
import { HOME_MODULES } from '../../app/income/src/home-layout.js';
import { BOARD_KEY, defaultBoard, validBoard, retireReceiptModule, type Board } from '../shared/board.js';
import {
  createTransfer,
  parseTransfer,
  digest,
  validateLegacy,
  collectLegacy,
  MAX_TRANSFER_BYTES,
} from '../migration/transfer.js';

const require = createRequire(import.meta.url);
if (process.platform === 'win32' && require('electron-squirrel-startup')) app.quit();
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'dogcow',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
app.setName('狗牛');
const devUrl = !app.isPackaged ? process.env.DOGCOW_DEV_URL : undefined;
if (devUrl && devUrl !== 'http://127.0.0.1:5180') throw Error('开发地址不受信任。');
const profile =
  process.env.NODE_ENV === 'test' && process.env.DOGCOW_TEST_PROFILE
    ? process.env.DOGCOW_TEST_PROFILE
    : path.join(app.getPath('appData'), app.isPackaged ? 'DogCow' : 'DogCow-dev');
app.setPath('userData', profile);
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  void start();
}
let win: BrowserWindow | null = null;
let repo: Repository;
let sequence = 0;
let tasks: TaskState = emptyTasks();
let taskError = '';
let layoutWarning = '';
const moduleIds = HOME_MODULES.map((item) => item.id);
let layout: Layout = {
  version: 1,
  order: [...moduleIds],
  enabled: HOME_MODULES.filter((item) => item.defaultEnabled).map((item) => item.id),
};
let board: Board = defaultBoard();
let revisions = { tasks: 0, income: 0, home: 0 };
let trayController: TrayController | undefined;
let trayPanel: TrayPanelController | undefined;
let panelSequence = 0;
let panelError: { errorCode: string; correlationId: string } | undefined;
let windows: WindowController;
let windowStore: WindowStateStore;
let quitting = false;
let quitPending: Promise<void> | null = null;
let quitNonce = '';
let acknowledgeFlush: ((ok: boolean) => void) | null = null;
let commands: Promise<unknown> = Promise.resolve();
let incomeBatch = false;
let toiletPendingSave = false;
let toiletPendingRecordId = '';
let pendingToiletOffwork: { date: string } | null = null;
let lastToiletWall = Date.now();
let lastToiletMono = performance.now();
let lastToiletZone = new Date().getTimezoneOffset();
let importDraft: {
  token: string;
  digest: string;
  values: Record<string, string | null>;
  counts: Fields;
  revision: number;
} | null = null;
const prepared = new Map<string, { at: number; revision: number; action: string }>();
let controller: IncomeController;
let unsubscribe: (() => void) | null = null;
let income: IncomeState;
let titles: Titles;
let owedData = emptyOwed();
let owedError = '';
let stealDay = '';
let releaseUpdater: ReleaseUpdater | null = null;
const taskKey = 'work-todolist-generic-v1';
const layoutKey = 'dogcow.home.v1';
const official = 'https://github.com/koxinyu11/Dog-cow/releases';
const windowBackground = (dark: boolean) => dark ? '#141c19' : '#f6f5ef';
const toastResult = (message: string): Result => ({
  applied: false,
  persisted: false,
  message,
});
let holidayCache: { raw: string; list: HolidayStart[] } = { raw: '', list: [] };
/** Hope countdowns read official holidays for this year and next; parsed only when the stored files change. */
function hopeHolidays() {
  const year = new Date().getFullYear();
  const raws = [year, year + 1].map(y => repo.storage.getItem(`niuma-calculator.holidays.v1.${y}`) ?? '');
  const raw = raws.join('\n');
  if (raw !== holidayCache.raw) holidayCache = { raw, list: holidayStarts(raws.filter(Boolean)) };
  return holidayCache.list;
}
function snapshot(): Snapshot {
  const windowState = windows?.snapshot() ?? { ...windowStore.value, phase: 'idle' as const, dirty: windowStore.dirty, warning: windowStore.warning };
  return {
    tray: trayController ? { ...trayController.state, ...panelError } : undefined,
    compact: windowState.mode === 'capsule',
    window: windowState,
    sequence: ++sequence,
    revisions: { ...revisions },
    tasks: structuredClone(tasks),
    taskError,
    layout: structuredClone(layout),
    layoutWarning,
    board: structuredClone(board),
    hopeHolidays: hopeHolidays(),
    titles: titles?.view(),
    owed: income ? owedView() : undefined,
    income: { ...structuredClone(income), ...(income.toilet ? { toilet: { ...structuredClone(income.toilet), pendingSave: toiletPendingSave, pendingRecordId: toiletPendingRecordId } } : {}) },
    save: { dirty: repo.dirty, error: repo.error, readError: repo.readError },
    version: app.getVersion(),
    updates: releaseUpdater ? { ...releaseUpdater.state } : undefined,
  };
}
function panelData(): TrayPanelData {
  return { sequence: ++panelSequence, view: trayView({ income, tasks, taskError }, windowStore.value.tray?.display ?? 'icon'),
    summary: traySummary({ income, tasks, taskError, board, hopeHolidays: hopeHolidays() }),
    configured: !!income.settings, calculationError: !!income.calculationError,
    revision: windowStore.value.revision, dirty: windowStore.dirty, warning: windowStore.warning,
    correlationId: windowStore.correlationId, canSwitch: windows.phase === 'idle' && !quitPending && !quitting,
    tray: trayController ? { ...trayController.state, ...panelError } : undefined,
    theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' };
}
function broadcast() {
  if (trayController && income) trayController.update(trayView({ income, tasks, taskError }, windowStore.value.tray?.display ?? 'icon'));
  trayPanel?.publish();
  if (win && !win.isDestroyed()) win.webContents.send('dogcow:state', snapshot());
}
function revealWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
async function setTrayDisplay(display: unknown, expectedRevision?: unknown): Promise<Result> {
  const errorCode = !isTrayDisplay(display) ? 'TRAY_INVALID_INPUT' : expectedRevision !== undefined && expectedRevision !== windowStore.value.revision ? 'TRAY_REVISION_CONFLICT' : undefined;
  if (errorCode) {
    const correlationId = randomUUID();
    console.warn(JSON.stringify({ operation: 'tray', stage: 'preferences', errorCode, correlationId, revision: windowStore.value.revision }));
    return { ...toastResult(TRAY_ERRORS[errorCode]), errorCode, correlationId, snapshot: snapshot() };
  }
  windowStore.update({ tray: { display: display as TrayDisplay } });
  broadcast();
  // Explicit selection also retries a previous failed write, preserving corrupt originals.
  if (windowStore.warning) windowStore.dirty = true;
  const persisted = await windowStore.flush(true);
  broadcast();
  return { applied: true, persisted, message: persisted ? '' : TRAY_ERRORS.TRAY_SAVE_FAILED,
    ...(!persisted ? { errorCode: 'TRAY_SAVE_FAILED', correlationId: windowStore.correlationId } : {}), snapshot: snapshot() };
}
function restoreModels() {
  taskError = '';
  try {
    tasks = parseTasks(repo.storage.getItem(taskKey), randomUUID);
  } catch {
    tasks = emptyTasks();
    taskError = '任务数据读取失败，任务编辑已锁定；原数据未被覆盖。';
  }
  layout = {
    version: 1,
    order: [...moduleIds],
    enabled: HOME_MODULES.filter((item) => item.defaultEnabled).map((item) => item.id),
  };
  layoutWarning = '';
  try {
    const raw = repo.storage.getItem(layoutKey);
    if (raw !== null) {
      const candidate: unknown = JSON.parse(raw);
      if (!validLayout(candidate)) throw Error();
      layout = candidate;
    }
  } catch {
    layoutWarning = '旧首页布局无效，暂用默认；调整后才保存，原始内容保留于备份。';
  }
  board = defaultBoard();
  try {
    const raw = repo.storage.getItem(BOARD_KEY);
    if (raw !== null) {
      const candidate: unknown = retireReceiptModule(JSON.parse(raw));
      if (!validBoard(candidate, Object.keys(copyDefaults))) throw Error();
      board = candidate;
    }
  } catch {
    layoutWarning = '首页看板数据无效，暂用默认看板；调整后才保存，原始内容保留于备份。';
  }
  // Built-in hopes live in memory until the next board write persists them.
  board = { ...board, fun: seedHopes(board.fun ?? defaultFun(), localDate(new Date())) };
  unsubscribe?.();
  controller?.destroy();
  const store = {
    getItem: repo.storage.getItem,
    setItem: (key: string, value: string) => {
      const prior = repo.storage.getItem(key);
      repo.storage.setItem(key, value);
      if (['niuma-calculator.settings.v4', TOILET_KEY].includes(key) && prior !== value) revisions.income++;
    },
  };
  controller = createController({ storage: store,
    setIntervalImpl: (tick, ms) => setInterval(() => {
      const job = commands.then(async () => {
        incomeBatch = true;
        try { await maintainToilet(); tick(); } finally { incomeBatch = false; }
      }).catch(error => console.error('[toilet:tick]', error instanceof Error ? error.name : 'unknown'));
      commands = job;
    }, ms),
    calendarLoader:(year,options)=>loadHolidayYear(year,{...options,fetchImpl:boundedCalendarFetch()}) });
  titles = new Titles(repo.storage, (date) => controller.dayFacts(date));
  titles.load();
  try {
    owedData = parseOwed(repo.storage.getItem(OWED_KEY));
    owedError = '';
  } catch {
    // Keep the unreadable bytes untouched; edits stay blocked until the data is repaired or restored.
    console.warn('[owed:load] 欠款记录格式无效，已暂停编辑。');
    owedData = emptyOwed();
    owedError = '欠款记录无法读取，暂不能编辑；原始数据已保留。';
  }
  unsubscribe = controller.subscribe((raw) => {
    const data = raw as unknown as Omit<IncomeState, 'now'> & { now: Date };
    income = { ...data, now: data.now.getTime() };
    recordSteal();
    recordOwed();
    broadcast();
    if (repo.dirty && !incomeBatch && !toiletPendingSave) void repo.flush().then(() => broadcast());
  });
}
/** Today's stolen estimate feeds the money titles only on days it is meaningful. */
function recordSteal(force = false) {
  const today = localDate(new Date(income.now));
  if (stealDay && stealDay !== today) titles.settle();
  stealDay = today;
  const s = income.snapshot;
  if (!income.settings?.stealMode || income.calculationError || !s || s.status === 'rest-day' || s.fullDayLeave) return;
  titles.record({ kind: 'steal', amount: s.stolenAmount }, force);
}
function owedView(): OwedView {
  const summary = owedSummary({ settings: income?.settings, snapshot: income?.calculationError ? null : income?.snapshot, data: owedData, now: income?.now ?? Date.now() });
  return { ...summary, error: owedError, clockReady: !!(income?.settings?.stealMode && income.settings.clockMode) };
}
/** Feeds this month's per-day amounts to the titles ledger; the "owed" series unlocks silently. */
function recordOwed() {
  if (owedError || !income?.settings || income.calculationError || !income.snapshot) return;
  const view = owedView();
  if (view.ready) titles.record({ kind: 'owed', days: view.days });
}
function recordOpen() {
  titles.record({ kind: 'open' });
}
function validLayout(value: unknown): value is Layout {
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.order) ||
    !Array.isArray(value.enabled) ||
    value.order.length !== moduleIds.length
  )
    return false;
  return [value.order, value.enabled].every(
    (list) =>
      new Set(list).size === list.length &&
      list.every((id) => typeof id === 'string' && moduleIds.includes(id)),
  );
}
function expected(payload: Fields, domain: keyof typeof revisions) {
  if (payload.expectedRevision !== revisions[domain])
    throw Error('内容已变化，请保留草稿并重新提交。');
}
function persistTask() {
  repo.storage.setItem(taskKey, JSON.stringify(tasks));
  revisions.tasks++;
}
function toiletFailure(errorCode: keyof typeof TOILET_ERRORS, message: string = TOILET_ERRORS[errorCode]): Result {
  const correlationId = randomUUID();
  console.error(JSON.stringify({ operation: 'toilet', stage: 'command', errorCode, correlationId }));
  return { applied: false, persisted: false, message, errorCode, correlationId };
}

async function maintainToilet(interruption?: 'sleep' | 'clock-change') {
  const wall = Date.now();
  const mono = performance.now();
  const zone = new Date().getTimezoneOffset();
  const clockChanged = Math.abs((wall - lastToiletWall) - (mono - lastToiletMono)) > 5000 || zone !== lastToiletZone;
  lastToiletWall = wall; lastToiletMono = mono; lastToiletZone = zone;
  const data = income.toilet;
  const active = data?.records.find(item => item.status === 'running');
  if (!data || data.error || !active || toiletPendingSave) return;
  let candidate;
  if (interruption || clockChanged) candidate = reviewToilet(data, interruption ?? 'clock-change').data;
  else if (localDate(new Date(active.startAt)) !== localDate(new Date(wall))) candidate = reviewToilet(data, 'cross-day').data;
  else {
    const endAt = Number(income.snapshot?.scheduledEndAt);
    if (Number.isFinite(endAt) && wall >= endAt && endAt > active.startAt) candidate = endToilet(data, endAt, 'schedule-end');
  }
  if (!candidate) return;
  toiletPendingSave = true;
  toiletPendingRecordId = active.id;
  controller.commitToilet(candidate);
  await finish({ applied: true, persisted: false, message: '记录状态已更新。' });
}

async function finish(result: Result): Promise<Result> {
  result.persisted = result.applied ? await repo.flush() : false;
  if (result.persisted && toiletPendingSave) { toiletPendingSave = false; toiletPendingRecordId = ''; }
  if (result.applied && !result.persisted && (toiletPendingSave || income.toilet?.records.some(item => item.status !== 'completed'))) {
    toiletPendingSave = true;
    const failure = toiletFailure('TOILET_SAVE_FAILED');
    result.errorCode = failure.errorCode;
    result.correlationId = failure.correlationId;
  }
  if (result.persisted && pendingToiletOffwork) {
    result.offwork = { date: pendingToiletOffwork.date, income: structuredClone(income) };
    pendingToiletOffwork = null;
  }
  broadcast();
  return {
    ...result,
    message: result.applied && !result.persisted ? repo.error : result.message,
    snapshot: snapshot(),
  };
}
function validPayload(payload: unknown): payload is Fields {
  return record(payload) && JSON.stringify(payload).length <= 20 * 1024 * 1024;
}
async function invoke(method: string, p: Fields): Promise<Result> {
  if (method === 'receiptImage') {
    if (!win || typeof p.png !== 'string' || p.png.length > 4_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.png)) throw Error('小票图片无效，请重试。');
    const image = nativeImage.createFromDataURL(p.png);
    if (image.isEmpty() || image.getSize().width > 2000 || image.getSize().height > 4000) throw Error('小票图片尺寸无效。');
    const picked = await dialog.showSaveDialog(win, { defaultPath: `狗牛-收工小票-${localDate()}.png`, filters: [{ name: 'PNG 图片', extensions: ['png'] }] });
    if (picked.canceled || !picked.filePath) return toastResult('已取消保存。');
    await writeFile(picked.filePath, image.toPNG());
    return { applied: true, persisted: true, message: '小票图片已保存。' };
  }
  if (method === 'iouImage') {
    if (!win || typeof p.png !== 'string' || p.png.length > 4_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.png)) throw Error('欠条图片无效，请重试。');
    const image = nativeImage.createFromDataURL(p.png);
    if (image.isEmpty() || image.getSize().width > 2000 || image.getSize().height > 4000) throw Error('欠条图片尺寸无效。');
    const picked = await dialog.showSaveDialog(win, { defaultPath: `狗牛-老板欠条-${localDate()}.png`, filters: [{ name: 'PNG 图片', extensions: ['png'] }] });
    if (picked.canceled || !picked.filePath) return toastResult('未保存：已取消。');
    try { await writeFile(picked.filePath, image.toPNG()); }
    catch (error) {
      console.error(JSON.stringify({ operation: 'iouImage', stage: 'write', cause: error instanceof Error ? error.name : 'unknown' }));
      return toastResult('未保存：欠条写入失败，请换个位置重试。');
    }
    return { applied: true, persisted: true, message: '欠条已保存，债主请收好。' };
  }
  if (method === 'appearance') {
    if (!['light', 'dark', 'auto'].includes(String(p.mode)) || !['light', 'dark'].includes(String(p.resolved)))
      return toastResult('显示模式无效。');
    nativeTheme.themeSource = p.mode === 'auto' ? 'system' : p.mode as 'light' | 'dark';
    win?.setBackgroundColor(windowBackground(p.resolved === 'dark'));
    return toastResult('');
  }
  if (method === 'bootstrap') return { ...toastResult(''), snapshot: snapshot() };
  if (method === 'trayPreferences') {
    if (Object.keys(p).some(key => !['display', 'expectedWindowRevision', 'requestId'].includes(key)) || !Number.isSafeInteger(p.expectedWindowRevision)) return toastResult(TRAY_ERRORS.TRAY_INVALID_INPUT);
    return setTrayDisplay(p.display, p.expectedWindowRevision);
  }
  if (method === 'retryTray') { panelError = undefined; trayController?.initialize(); broadcast(); return { ...toastResult(''), snapshot: snapshot() }; }
  if (method === 'copyTrayDiagnostics') {
    clipboard.writeText(JSON.stringify({ version: app.getVersion(), platform: process.platform, arch: process.arch,
      tray: { ...trayController?.state, ...panelError }, display: windowStore.value.tray?.display ?? 'icon', visible: win?.isVisible(),
      revision: windowStore.value.revision, dirty: windowStore.dirty, warning: windowStore.warning,
      storageCorrelationId: windowStore.correlationId }, null, 2));
    return toastResult('已复制诊断信息。');
  }
  if (method === 'capsulePreferences') return windows.preferences(p);
  if (method === 'resetCapsulePosition') return windows.resetPosition();
  if (method === 'capsuleMenu') { windows.menu(); return toastResult(''); }
  if (method === 'quit') {
    setTimeout(() => void requestQuit(), 0);
    return toastResult('');
  }
  if (method === 'openSource') {
    const url = String(p.url || official);
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      ![
        'github.com',
        'rlsbt.zj.gov.cn',
        'gjj.hangzhou.gov.cn',
        'zfgb.hangzhou.gov.cn',
        'zhejiang.chinatax.gov.cn',
        'fgk.chinatax.gov.cn',
      ].includes(parsed.hostname)
    )
      throw Error('链接来源不受信任。');
    await shell.openExternal(url);
    return toastResult('已打开系统浏览器。');
  }
  if (method === 'checkUpdates') return checkUpdates();
  if (method === 'copyUpdateDiagnostics') {
    const state = releaseUpdater?.state;
    if (!state?.errorCode) return toastResult('暂无更新错误信息。');
    clipboard.writeText(`狗牛 ${app.getVersion()} · ${process.platform}/${process.arch}\n${state.errorCode}\n${state.correlationId ?? ''}\n${state.message}`);
    return toastResult('已复制更新诊断信息。');
  }
  if (method === 'openUpdate') {
    if (!releaseUpdater || releaseUpdater.state.status !== 'ready') return toastResult('请先下载最新安装包。');
    await releaseUpdater.openInstaller(file => shell.openPath(file));
    return toastResult('安装包已打开，请手动完成安装。');
  }
  if (method === 'exportBackup') {
    const pack = await createTransfer(
      {
        getItem: repo.storage.getItem,
        get length() {
          return repo.values.size;
        },
        key: (i: number) => [...repo.values.keys()][i],
      },
      { engine: 'electron', appVersion: app.getVersion() },
    );
    const selection = await dialog.showSaveDialog(win!, {
      defaultPath: 'dogcow-backup.json',
      filters: [{ name: '狗牛备份', extensions: ['json'] }],
    });
    if (selection.canceled || !selection.filePath) return toastResult('已取消导出。');
    await writeFile(selection.filePath, JSON.stringify(pack, null, 2), {
      mode: 0o600,
    });
    return toastResult('备份已保存。');
  }
  if (method === 'chooseImport') {
    const selected = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: '狗牛迁移包', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return toastResult('已取消选择。');
    if ((await stat(selected.filePaths[0])).size > MAX_TRANSFER_BYTES)
      throw Error('迁移文件超过20MiB，未读取。');
    const raw = await readFile(selected.filePaths[0], 'utf8');
    const parsed = await parseTransfer(raw);
    if (repo.migration?.digest === parsed.pack.digest && repo.migration?.phase === 'verified')
      return toastResult('这份迁移包已经导入，不会重复追加。');
    importDraft = {
      token: randomUUID(),
      digest: parsed.pack.digest,
      values: parsed.pack.values,
      counts: parsed.preview.counts,
      revision: repo.revision,
    };
    return {
      ...toastResult(
        `任务 ${parsed.preview.counts.tasks} 项，请假 ${parsed.preview.counts.leaves} 项，考勤 ${parsed.preview.counts.attendanceDays} 天。${parsed.preview.layoutWarning ? '首页布局无效，将暂用默认。' : ''}`,
      ),
      code: importDraft.token,
    };
  }
  if (method === 'commitImport') {
    if (!importDraft || p.token !== importDraft.token || repo.revision !== importDraft.revision)
      throw Error('导入预览已过期，请重新选择文件。');
    if (repo.dirty) throw Error('请先保存当前修改，再重新选择迁移包。');
    const confirmation = await dialog.showMessageBox(win!, {
      type: 'question',
      buttons: ['取消', '备份并导入'],
      defaultId: 0,
      cancelId: 0,
      message: '导入会替换当前任务、首页和收入记录',
      detail: '原文件和导入前备份都会保留，不自动合并。',
    });
    if (confirmation.response !== 1) return toastResult('已取消导入。');
    const pending = importDraft;
    importDraft = null;
    const backup = await repo.backup('before-import');
    repo.values = new Map(
      Object.entries(pending.values).filter(
        (pair): pair is [string, string] => typeof pair[1] === 'string',
      ),
    );
    repo.readError = '';
    repo.revision++;
    repo.migration = {
      phase: 'pending',
      digest: pending.digest,
      valuesDigest: await digest(Object.fromEntries(repo.values)),
      backup,
    };
    repo.dirty = true;
    if (!(await repo.flush())) throw Error('候选导入保存失败，备份保留，请重试读取。');
    repo.migration.phase = 'verified';
    repo.dirty = true;
    if (!(await repo.flush())) {
      repo.migration.phase = 'pending';
      throw Error('导入验证未完成，重启后将恢复校验。');
    }
    revisions = {
      tasks: revisions.tasks + 1,
      home: revisions.home + 1,
      income: revisions.income + 1,
    };
    restoreModels();
    return finish({
      applied: true,
      persisted: true,
      message: '迁移完成；原始包和导入前备份已保留。',
    });
  }
  if (repo.migration?.phase === 'pending')
    throw Error('导入尚未完成校验，业务写入暂停，请重新打开应用。');
  if (method === 'retrySave') {
    const result = await finish({ applied: true, persisted: false, message: '当前修改已保存。' });
    return result;
  }
  if (toiletPendingSave && ['toilet', 'clock', 'settings', 'leave', 'removeLeave'].includes(method))
    return { ...toiletFailure('TOILET_SAVE_FAILED'), snapshot: snapshot() };
  const requestId = typeof p.requestId === 'string' ? p.requestId : '';
  if (!requestId) throw Error('操作编号缺失，请重新提交。');
  if (repo.receipts.includes(requestId))
    return { applied: true, persisted: !repo.dirty && !repo.readError, message: repo.dirty ? '操作已处理，请重试保存。' : '操作已处理。', snapshot: snapshot() };
  let result: Result = { applied: true, persisted: false, message: '已保存。' };
  if (method === 'task') {
    expected(p, 'tasks');
    if (taskError) throw Error(taskError);
    const before = structuredClone(tasks);
    const action = String(p.action);
    const id = String(p.id || '');
    const task = tasks.tasks.find((item) => item.id === id);
    try {
      if (action === 'create') {
        if (!record(p.task) || typeof p.task.title !== 'string' || !p.task.title.trim()) throw Error('请填写任务标题。');
        tasks.tasks.push(normalizeTask({ ...p.task, title:p.task.title.trim(), startTime:p.task.hasTime?p.task.startTime:'', endTime:p.task.hasTime?p.task.endTime:'', id: randomUUID() }, randomUUID));
      } else if (action === 'weekly') {
        if (
          !Array.isArray(p.titles) ||
          p.titles.length < 1 ||
          p.titles.length > 50 ||
          !p.titles.every((item) => typeof item === 'string' && item.trim()) ||
          !validDate(p.week)
        )
          throw Error('请输入 1–50 项任务和有效周日期。');
        const dates = Array.from({ length: p.weekends ? 7 : 5 }, (_, i) =>
          addDays(String(p.week), i),
        );
        const duration = Number(p.duration);
        if (
          ![30, 60, 90, 120].includes(duration) ||
          typeof p.startTime !== 'string' ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime)
        )
          throw Error('批量时段无效。');
        const [hour, minute] = p.startTime.split(':').map(Number);
        const start = hour * 60 + minute;
        p.titles.forEach((title, i) => {
          const minutes = start + Math.floor(i / dates.length) * (duration + 30);
          const clock = (value: number) =>
            `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
          tasks.tasks.push(
            normalizeTask(
              {
                id: randomUUID(),
                title: String(title).trim(),
                date: dates[i % dates.length],
                priority: p.priority || '中',
                category: p.tag || '工作',
                hasTime: true,
                startTime: clock(minutes),
                endTime: clock(minutes + duration),
              },
              randomUUID,
            ),
          );
        });
      } else if (!task) throw Error('原任务已不存在。');
      else if (action === 'delete') tasks.tasks = tasks.tasks.filter((item) => item.id !== id);
      else if (action === 'move') {
        if (task.done) throw Error('已完成任务无需顺延。');
        task.date = addDays(task.date, 1);
      } else if (action === 'toggle' || action === 'progress') {
        const wasDone = task.done;
        if (action === 'toggle') {
          task.done = !task.done;
          task.progress = task.done ? 100 : task.progress === 100 ? 90 : task.progress;
        } else {
          const value = Number(p.progress);
          if (!Number.isInteger(value) || value < 0 || value > 100) throw Error('任务进度无效。');
          task.progress = value;
          task.done = value === 100;
        }
        if (!wasDone && task.done)
          result.completion = {
            taskId: task.id,
            date: task.date,
            allDone: tasks.tasks
              .filter((item) => item.date === task.date)
              .every((item) => item.done),
          };
      } else if (action === 'update') {
        if (!record(p.patch)) throw Error('任务修改无效。');
        const allowed = [
          'title',
          'note',
          'priority',
          'tags',
          'hasTime',
          'startTime',
          'endTime',
          'dueDate',
        ];
        if (Object.keys(p.patch).some((key) => !allowed.includes(key)))
          throw Error('任务字段不允许。');
        Object.assign(task, normalizeTask({ ...task, ...p.patch }, randomUUID));
      } else throw Error('任务操作无效。');
      tasks = parseTasks(JSON.stringify(tasks), randomUUID);
      persistTask();
      if (result.completion) {
        board = { ...board, fun: rewardTask(board.fun ?? defaultFun(), result.completion.taskId) };
        repo.storage.setItem(BOARD_KEY, JSON.stringify(board));
        revisions.home++;
        titles.record({ kind: 'task-done', task: { id: result.completion.taskId, date: result.completion.date } });
      }
    } catch (error) {
      tasks = before;
      throw error;
    }
  } else if (method === 'copy') {
    expected(p, 'tasks');
    if (
      taskError ||
      typeof p.key !== 'string' ||
      !Object.hasOwn(copyDefaults, p.key) ||
      typeof p.value !== 'string'
    )
      throw Error('文案修改无效。');
    tasks.settings[p.key] = p.value;
    persistTask();
  } else if (method === 'layout') {
    expected(p, 'home');
    if (!validLayout(p.layout)) throw Error('模块配置无效。');
    layout = p.layout;
    layoutWarning = '';
    repo.storage.setItem(layoutKey, JSON.stringify(layout));
    revisions.home++;
  } else if (method === 'fun') {
    expected(p, 'home');
    const previous = board.fun ?? defaultFun();
    const next = updateFun(previous, p, new Date());
    const unlocked = MOOD_REWARDS.filter(r => !moodData(previous).wallpapers.includes(r.id) && moodData(next).wallpapers.includes(r.id));
    if (unlocked.length) {
      result.code = 'wallpaper-unlocked';
      result.message = `🎉 解锁隐藏壁纸「${unlocked.map(r=>r.name).join('、')}」！去设置 → 背景看看。`;
    }
    board = { ...board, fun: next };
    repo.storage.setItem(BOARD_KEY, JSON.stringify(board));
    revisions.home++;
    titles.record({ kind: 'fun', action: p.action, after: next });
  } else if (method === 'titles') {
    const action = String(p.action);
    const ids = Array.isArray(p.ids) && p.ids.every((id) => typeof id === 'string') ? (p.ids as string[]) : null;
    if (action === 'wear' && typeof p.id === 'string') titles.change({ action, id: p.id });
    else if (action === 'unwear') titles.change({ action });
    else if ((action === 'seen' || action === 'toast-shown') && ids) titles.change({ action, ids });
    else if (action === 'show' && typeof p.value === 'boolean') titles.change({ action, value: p.value });
    else throw Error('职称操作无效。');
    result.message = '';
  } else if (method === 'board') {
    expected(p, 'home');
    if (!validBoard(p.board, Object.keys(copyDefaults))) throw Error('看板配置无效。');
    const requested = p.board.background;
    if (requested.kind === 'preset' && !isWallpaperUnlocked(requested.value, board.fun ?? defaultFun(), titles.view().items.map(t => t.id))) throw Error('这张壁纸还未解锁。');
    board = { ...structuredClone(p.board), fun: board.fun };
    layoutWarning = '';
    repo.storage.setItem(BOARD_KEY, JSON.stringify(board));
    revisions.home++;
  } else if (method === 'toilet') {
    if (p.expectedRevision !== revisions.income) return { ...toiletFailure('TOILET_CONFLICT'), snapshot: snapshot() };
    const data = income.toilet;
    if (!data || data.error || repo.readError) return { ...toiletFailure('TOILET_DATA_INVALID'), snapshot: snapshot() };
    const reason = !income.settings ? '先设置薪资，再估算时间价值。'
      : income.calculationError ? income.calculationError.message
      : String(income.snapshot?.toiletAvailableReason ?? '当前无法计算。');
    const changed = changeToilet(data, p, Date.now(), reason, randomUUID);
    if ('errorCode' in changed) return { ...toiletFailure(changed.errorCode as keyof typeof TOILET_ERRORS, changed.message), snapshot: snapshot() };
    toiletPendingSave = true;
    toiletPendingRecordId = String(p.recordId || changed.data.records.find((item: { status: string }) => item.status === 'running')?.id || '');
    result = controller.commitToilet(changed.data);
  } else if (method === 'owed') {
    expected(p, 'income');
    if (owedError) return { applied: false, persisted: false, message: owedError, snapshot: snapshot() };
    const changed = changeOwed(owedData, p, Date.now(), randomUUID);
    if (!changed.data) return { applied: false, persisted: false, message: changed.message ?? '欠款操作无效。', errors: changed.errors, snapshot: snapshot() };
    owedData = changed.data;
    repo.storage.setItem(OWED_KEY, JSON.stringify(owedData));
    recordOwed();
    revisions.income++;
    result.message = p.action === 'remove' ? '已删除。' : '已记账。';
  } else if (method === 'settings') {
    expected(p, 'income');
    result = controller.updateSettings(p.settings) as Result;
  } else if (method === 'leave') {
    expected(p, 'income');
    result = controller.saveLeave(
      p.leave,
      typeof p.editingId === 'string' ? p.editingId : null,
    ) as Result;
  } else if (method === 'removeLeave') {
    expected(p, 'income');
    result = controller.removeLeave(p.id) as Result;
  } else if (method === 'refreshCalendar') {
    await controller.refreshCalendar(true);
    return { ...toastResult('调休日历已检查。'), snapshot: snapshot() };
  } else if (method === 'prepareClock') {
    const token = randomUUID();
    const action = String(p.action);
    if (!['start', 'flex-start', 'finish', 'edit'].includes(action)) throw Error('打卡操作无效。');
    const at = Date.now();
    prepared.set(token, { at, revision: revisions.income, action });
    return { ...toastResult(''), code: token, errors: { at: String(at) } };
  } else if (method === 'clock') {
    expected(p, 'income');
    const attendanceBefore = structuredClone(income.attendance);
    const action =
      p.action === 'pause' || p.action === 'resume'
        ? p.action
        : prepared.get(String(p.token))?.action;
    const validation = clockCommandError({ ...p, action }, income.settings);
    if (validation) throw Error(validation);
    const now = new Date();
    let change;
    if (p.action === 'pause' || p.action === 'resume')
      change = applyAttendanceAction(income.attendance, p.action, now);
    else {
      const token = String(p.token);
      const draft = prepared.get(token);
      if (
        !draft ||
        draft.revision !== revisions.income ||
        Date.now() - draft.at > 30 * 60_000 ||
        localDate(new Date(draft.at)) !== localDate()
      )
        throw Error('打卡确认已过期，请重新打开。');
      if (!validDate(p.date) || !['recorded', 'backfill'].includes(String(p.method)))
        throw Error('打卡日期或方式无效。');
      const original = income.attendance.days.find((day) => day.date === p.date);
      const parse = (
        value: unknown,
        previous: typeof original extends never ? never : { at: number } | null | undefined,
      ) => {
        if (value === '') return null;
        if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value))
          throw Error('请输入有效实际时间。');
        if (previous && new Date(previous.at).toTimeString().slice(0, 8) === value)
          return previous.at;
        return new Date(`${p.date}T${value}`).getTime();
      };
      let startAt = parse(p.startTime, original?.clockIn);
      let endAt = parse(p.endTime, original?.clockOut);
      if (p.method === 'recorded') {
        if (p.date !== localDate(new Date(draft.at)) || draft.action === 'edit')
          throw Error('现在打卡日期不匹配。');
        if (['start','flex-start'].includes(draft.action)) startAt = draft.at;
        if (draft.action === 'finish') endAt = draft.at;
      }
      if (['start','flex-start'].includes(draft.action)) endAt = original?.clockOut?.at ?? null;
      let flex;
      if (draft.action === 'flex-start') {
        if (original?.clockIn || p.date!==localDate(now) || !income.snapshot || income.snapshot.status==='rest-day' || income.snapshot.fullDayLeave) throw Error('弹性打卡仅适用于今天尚未上班的工作日。');
        const preview = buildFlexDay(income.settings,p.date,startAt);
        if (!preview.flex) throw Error(preview.message);
        flex = preview.flex;
      }
      change = setAttendanceTimes(
        income.attendance,
        {
          date: p.date,
          startAt,
          endAt,
          ...(flex ? {flex} : {}),
          source: p.method,
          startSource:
            p.method === 'recorded' && ['start','flex-start'].includes(draft.action) ? 'recorded' : 'backfill',
          endSource: p.method === 'recorded' && draft.action === 'finish' ? 'recorded' : 'backfill',
        },
        now,
      );
      if (change.ok) prepared.delete(token);
    }
    if (!change.ok || !('attendance' in change))
      throw Error('message' in change ? String(change.message) : '实际时间无效。');
    const active = income.toilet?.records.find(item => item.status === 'running');
    let toilet = null;
    if (active && !income.toilet?.error) {
      if (p.action === 'pause') toilet = endToilet(income.toilet, now.getTime(), 'lunch');
      else {
        const day = change.attendance.days.find((item: { date: string }) => item.date === p.date);
        if (p.date === localDate(new Date(active.startAt)) && day?.clockOut) toilet = endToilet(income.toilet, day.clockOut.at, 'offwork');
      }
    }
    if (toilet) { toiletPendingSave = true; toiletPendingRecordId = active!.id; }
    result = controller.commitAttendance(change.attendance, toilet) as Result;
    if (result.applied) {
      titles.record({ kind: 'clock', before: attendanceBefore, after: income.attendance });
      if (action === 'finish') recordSteal(true);
    }

  } else throw Error('不允许的操作。');
  if (result.applied) {
    repo.receipts = [...repo.receipts, requestId].slice(-128);
    repo.dirty = true;
  }
  const completed = await finish(result);
  if (!completed.persisted && result.applied && method === 'clock' && p.action === 'finish'
    && p.method === 'recorded' && p.date === localDate() && toiletPendingSave)
    pendingToiletOffwork = { date: String(p.date) };
  return completed;
}
function requestQuit(): Promise<void> {
  if (quitPending) return quitPending;
  quitPending = doQuit().finally(() => {
    quitPending = null;
  });
  return quitPending;
}
async function doQuit() {
  if (!win) return;
  windows.cancel();
  quitNonce = randomUUID();
  const flushed = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      acknowledgeFlush = null;
      resolve(false);
    }, 5000);
    acknowledgeFlush = (ok) => {
      clearTimeout(timeout);
      acknowledgeFlush = null;
      resolve(ok);
    };
    win!.webContents.send('dogcow:before-quit', quitNonce);
  });
  await commands;
  if (!repo.readError) titles.settle();
  const saved = (!repo.dirty || (await repo.flush())) && await windows.flush();
  if (!flushed || !saved) {
    revealWindow();
    const answer = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['取消退出', '重试保存', '放弃未保存修改并退出'],
      defaultId: 0,
      cancelId: 0,
      message: '还有未提交草稿或未保存修改。',
      detail: '取消可继续编辑；放弃后尚未保存的内容或窗口偏好可能丢失。',
    });
    if (answer.response === 0) return;
    if (answer.response === 1) return doQuit();
  }
  quitting = true;
  controller.destroy();
  trayPanel?.dispose();
  trayController?.dispose();
  app.quit();
}
async function checkUpdates(): Promise<Result> {
  if (!app.isPackaged || !releaseUpdater) return toastResult('开发模式不下载更新，请在已安装的应用中检查。');
  void releaseUpdater.check();
  return toastResult('正在检查最新正式版，下载状态可在设置中查看。');
}

async function start() {
  await app.whenReady();
  let runtimeIcon: Electron.NativeImage | undefined;
  try {
    const image = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', '狗牛.png'));
    if (image.isEmpty()) throw Error('狗牛运行时图标无法读取。');
    runtimeIcon = image;
    if (process.platform === 'darwin') app.dock?.setIcon(image);
  } catch (error) {
    console.warn('[app:icon]', error instanceof Error ? error.message : '运行时图标加载失败。');
  }
  repo = new Repository(path.join(profile, 'data'));
  await repo.load();
  if (repo.migration?.phase === 'pending' && !repo.readError) {
    try {
      validateLegacy(
        collectLegacy({
          getItem: repo.storage.getItem,
          get length() {
            return repo.values.size;
          },
          key: (i: number) => [...repo.values.keys()][i],
        }),
      );
      if ((await digest(Object.fromEntries(repo.values))) !== repo.migration.valuesDigest)
        throw Error();
      repo.migration.phase = 'verified';
      repo.dirty = true;
      if (!(await repo.flush())) repo.migration.phase = 'pending';
    } catch {
      repo.readError = '迁移候选校验失败，原始候选和导入前备份保留，请从备份重新导入。';
    }
  }
  restoreModels();
  if (!repo.readError && repo.migration?.phase !== 'pending') recordOpen();
  await repo.flush();
  windowStore = new WindowStateStore(profile);
  await windowStore.load();
  const root = path.join(app.getAppPath(), 'dist-renderer');
  protocol.handle('dogcow', (request) => {
    const url = new URL(request.url);
    const requested = path.resolve(
      root,
      `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
    );
    if (url.hostname !== 'app' || !requested.startsWith(`${root}${path.sep}`))
      return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(requested).href);
  });
  const bounds = windowStore.value.expanded.bounds;
  win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 620,
    title: '狗牛',
    ...(runtimeIcon ? { icon: runtimeIcon } : {}),
    show: false,
    backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 14 } }
      : {}),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron/src/preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  windows = new WindowController(win, windowStore, {
    broadcast, saveData: async () => !repo.readError && await repo.flush(),
    enqueue: <T>(work: () => Promise<T>) => { const job = commands.then(work); commands = job.catch(() => {}); return job; },
    quitting: () => quitting || !!quitPending,
  });
  await windows.initialize();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  for (const method of methods)
    ipcMain.handle(`dogcow:${method}`, async (event, payload: unknown) => {
      const url = event.senderFrame?.url ?? '';
      if (trayPanel?.owns(event.sender)) {
        if (event.senderFrame !== event.sender.mainFrame || !trustedPanelCommand(method, url, devUrl) || !validPayload(payload ?? {})) return toastResult('操作来源或参数无效。');
        const p = (payload ?? {}) as Fields;
        if (method === 'bootstrap') return { ...toastResult(''), trayPanel: panelData() };
        if (method === 'trayPanelAction') {
          if (p.action === 'ready') { trayPanel.acknowledgeReady(); return toastResult(''); }
          if (p.action === 'resize') { trayPanel.resize(p.height); return toastResult(''); }
          if (p.action === 'hide') { trayPanel.hide(); return toastResult(''); }
          if (p.action === 'quit') { trayPanel.hide(true); setImmediate(() => void requestQuit()); return toastResult(''); }
          if (p.action === 'open' || p.action === 'settings' || p.action === 'hopes') {
            revealWindow();
            const result = await windows.request('expanded');
            if (p.action === 'hopes' && result.applied) win?.webContents.send('dogcow:open-hopes');
            if (p.action === 'settings' && result.applied) win?.webContents.send('dogcow:open-income-settings');
            if (result.message) void dialog.showMessageBox(win!, { message: result.message });
            return { ...result, snapshot: undefined };
          }
          return toastResult('操作无效。');
        }
        const job = commands.then(async () => {
          const result = await invoke(method, p);
          const { snapshot: _snapshot, ...safe } = result;
          return { ...safe, trayPanel: panelData() };
        }).catch(error => {
          const correlationId = randomUUID();
          console.error(JSON.stringify({ operation: 'trayPanel', stage: 'command', errorCode: 'TRAY_PANEL_FAILED', correlationId, cause: error instanceof Error ? error.name : 'unknown' }));
          return { ...toastResult(TRAY_ERRORS.TRAY_PANEL_FAILED), errorCode: 'TRAY_PANEL_FAILED', correlationId, trayPanel: panelData() };
        });
        commands = job;
        return job;
      }
      if (
        event.sender !== win?.webContents ||
        event.senderFrame !== event.sender.mainFrame ||
        !(devUrl ? url.startsWith(`${devUrl}/`) : url.startsWith('dogcow://app/')) ||
        !validPayload(payload ?? {})
      )
        return toastResult('操作来源或参数无效。');
      if (method === 'windowTransitionReady') return windows.acknowledgeTransition((payload ?? {}) as Fields);
      if (method === 'windowModeReady') return windows.acknowledge((payload ?? {}) as Fields);
      if (method === 'windowMode') return windows.request(record(payload) ? payload.target : undefined).then(result => ({ ...result, snapshot: snapshot() }));
      if (method === 'quit' && record(payload) && payload.nonce === quitNonce && acknowledgeFlush) {
        acknowledgeFlush(payload.ready === true);
        return toastResult('');
      }
      if (windows.phase === 'applying' || windows.phase === 'restoring') return toastResult('窗口正在切换，请稍后重试。');
      const job = commands
        .then(async () => {
          incomeBatch = true;
          try { return await invoke(method, (payload ?? {}) as Fields); }
          finally { incomeBatch = false; }
        })
        .catch((error) => {
          const correlationId = randomUUID();
          const errorCode = method === 'toilet' ? 'TOILET_INTERNAL' : undefined;
          console.error(JSON.stringify({ operation: method, stage: 'command', errorCode,
            cause: error instanceof Error ? error.name : 'unknown', correlationId }));
          return {
            ...toastResult(method === 'toilet' ? TOILET_ERRORS.TOILET_INTERNAL : error instanceof Error ? error.message : '操作失败，请重试。'),
            ...(errorCode ? { errorCode, correlationId } : {}),
            snapshot: snapshot(),
          };
        });
      commands = job;
      return job;
    });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '狗牛',
        submenu: [
          {
            label: '检查更新',
            click: () =>
              void checkUpdates().then((result) =>
                dialog.showMessageBox(win!, { message: result.message }),
              ),
          },
          { label: '收成胶囊 / 展开', click: () => void windows.request(windows.snapshot().mode === 'capsule' ? 'expanded' : 'capsule') },
          {
            label: '退出狗牛',
            accelerator: 'CmdOrCtrl+Q',
            click: () => void requestQuit(),
          },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
    ]),
  );
  win.on('focus', () => {
    controller.tick();
    if (repo.readError || repo.migration?.phase === 'pending') return;
    commands = commands.then(async () => {
      recordOpen();
      if (repo.dirty) await repo.flush();
      broadcast();
    }).catch(() => console.error('[titles:open] 记录失败。'));
  });
  const interruptToilet = () => {
    const job = commands.then(async () => {
      incomeBatch = true;
      try { await maintainToilet('sleep'); controller.tick(); } finally { incomeBatch = false; }
    }).catch(() => console.error('[toilet:resume] 状态恢复失败。'));
    commands = job;
  };
  powerMonitor.on('suspend', interruptToilet);
  powerMonitor.on('resume', interruptToilet);
  trayPanel = new TrayPanelController({
    preload: path.join(app.getAppPath(), 'dist-electron/src/preload/index.cjs'),
    url: devUrl ? `${devUrl}/?surface=tray` : 'dogcow://app/index.html?surface=tray',
    data: panelData,
    environment: () => ({ dockVisible: app.dock?.isVisible(), mainVisible: win?.isVisible(),
      mainFocused: win?.isFocused(), mainAlwaysOnTop: win?.isAlwaysOnTop() }),
    failed: (errorCode, correlationId) => { panelError = { errorCode, correlationId }; revealWindow(); broadcast(); },
  });
  trayController = new TrayController({
    iconPath: path.join(app.getAppPath(), 'assets', 'trayTemplate.png'),
    togglePanel: bounds => { panelError = undefined; void trayPanel?.toggle(bounds); },
    changed: broadcast,
    failed: revealWindow,
  });
  trayController.initialize();
  app.once('will-quit', () => { trayPanel?.dispose(); trayController?.dispose(); });
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      if (process.platform === 'darwin' && trayController?.state.available) {
        if (windows.phase !== 'idle' || quitPending) return;
        win?.hide();
      } else void requestQuit();
    }
  });
  win.on('closed', () => {
    win = null;
  });
  app.on('before-quit', (event) => {
    if (!quitting) {
      event.preventDefault();
      void requestQuit();
    }
  });
  app.on('activate', revealWindow);
  win.once('ready-to-show', () => {
    win?.show();
    broadcast();
  });
  if (devUrl) await win.loadURL(devUrl);
  else await win.loadURL('dogcow://app/index.html');
  if (app.isPackaged) {
    releaseUpdater = new ReleaseUpdater({ current: app.getVersion(), platform: process.platform, arch: process.arch,
      directory: path.join(app.getPath('userData'), 'updates'), fetch: createUpdateFetch(net), changed: broadcast });
    const startup = setTimeout(() => void releaseUpdater?.check(), 10000);
    const interval = setInterval(() => void releaseUpdater?.check(), 4 * 60 * 60 * 1000);
    startup.unref(); interval.unref();
    app.once('will-quit', () => { clearTimeout(startup); clearInterval(interval); });
    broadcast();
  }
}
