import { boundedCalendarFetch } from './calendar-network.js';
import { loadHolidayYear } from '../../app/income/src/calendar.js';
import { clockCommandError } from '../shared/clock-command.js';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  powerMonitor,
  protocol,
  screen,
  shell,
  autoUpdater,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Repository } from './repository.js';
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
  type TaskState,
} from '../shared/contracts.js';
import { createController, type IncomeController } from './legacy-adapter.js';
import { applyAttendanceAction, setAttendanceTimes } from '../../app/income/src/attendance.js';
import { HOME_MODULES } from '../../app/income/src/home-layout.js';
import { BOARD_KEY, defaultBoard, validBoard, type Board } from '../shared/board.js';
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
let compact = false;
let expanded: Electron.Rectangle | null = null;
let quitting = false;
let quitPending: Promise<void> | null = null;
let quitNonce = '';
let acknowledgeFlush: ((ok: boolean) => void) | null = null;
let commands: Promise<unknown> = Promise.resolve();
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
const taskKey = 'work-todolist-generic-v1';
const layoutKey = 'dogcow.home.v1';
const official = 'https://github.com/koxinyu11/Dog-cow/releases';
const toastResult = (message: string): Result => ({
  applied: false,
  persisted: false,
  message,
});
function snapshot(): Snapshot {
  return {
    compact,
    sequence: ++sequence,
    revisions: { ...revisions },
    tasks: structuredClone(tasks),
    taskError,
    layout: structuredClone(layout),
    layoutWarning,
    board: structuredClone(board),
    income: structuredClone(income),
    save: { dirty: repo.dirty, error: repo.error, readError: repo.readError },
    version: app.getVersion(),
  };
}
function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('dogcow:state', snapshot());
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
      const candidate: unknown = JSON.parse(raw);
      if (!validBoard(candidate, Object.keys(copyDefaults))) throw Error();
      board = candidate;
    }
  } catch {
    layoutWarning = '首页看板数据无效，暂用默认看板；调整后才保存，原始内容保留于备份。';
  }
  unsubscribe?.();
  controller?.destroy();
  const store = {
    getItem: repo.storage.getItem,
    setItem: (key: string, value: string) => {
      const prior = repo.storage.getItem(key);
      repo.storage.setItem(key, value);
      if (key === 'niuma-calculator.settings.v4' && prior !== value) revisions.income++;
    },
  };
  controller = createController({ storage: store, calendarLoader:(year,options)=>loadHolidayYear(year,{...options,fetchImpl:boundedCalendarFetch()}) });
  unsubscribe = controller.subscribe((raw) => {
    const data = raw as unknown as Omit<IncomeState, 'now'> & { now: Date };
    income = { ...data, now: data.now.getTime() };
    broadcast();
    if (repo.dirty) void repo.flush().then(() => broadcast());
  });
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
async function finish(result: Result): Promise<Result> {
  result.persisted = result.applied ? await repo.flush() : false;
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
  if (method === 'bootstrap') return { ...toastResult(''), snapshot: snapshot() };
  if (method === 'compact') {
    toggleCompact();
    return toastResult('窗口已切换。');
  }
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
  if (method === 'retrySave')
    return finish({
      applied: true,
      persisted: false,
      message: '当前修改已保存。',
    });
  const requestId = typeof p.requestId === 'string' ? p.requestId : '';
  if (!requestId) throw Error('操作编号缺失，请重新提交。');
  if (repo.receipts.includes(requestId))
    return { ...toastResult('操作已处理。'), snapshot: snapshot() };
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
  } else if (method === 'board') {
    expected(p, 'home');
    if (!validBoard(p.board, Object.keys(copyDefaults))) throw Error('看板配置无效。');
    board = structuredClone(p.board);
    layoutWarning = '';
    repo.storage.setItem(BOARD_KEY, JSON.stringify(board));
    revisions.home++;
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
    if (!['start', 'finish', 'edit'].includes(action)) throw Error('打卡操作无效。');
    const at = Date.now();
    prepared.set(token, { at, revision: revisions.income, action });
    return { ...toastResult(''), code: token, errors: { at: String(at) } };
  } else if (method === 'clock') {
    expected(p, 'income');
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
        if (draft.action === 'start') startAt = draft.at;
        if (draft.action === 'finish') endAt = draft.at;
      }
      if (draft.action === 'start') endAt = original?.clockOut?.at ?? null;
      change = setAttendanceTimes(
        income.attendance,
        {
          date: p.date,
          startAt,
          endAt,
          source: p.method,
          startSource:
            p.method === 'recorded' && draft.action === 'start' ? 'recorded' : 'backfill',
          endSource: p.method === 'recorded' && draft.action === 'finish' ? 'recorded' : 'backfill',
        },
        now,
      );
      if (change.ok) prepared.delete(token);
    }
    if (!change.ok || !('attendance' in change))
      throw Error('message' in change ? String(change.message) : '实际时间无效。');
    result = controller.commitAttendance(change.attendance) as Result;
  } else throw Error('不允许的操作。');
  if (result.applied) {
    repo.receipts = [...repo.receipts, requestId].slice(-128);
    repo.dirty = true;
  }
  return finish(result);
}
function toggleCompact() {
  if (!win) return;
  if (!compact) {
    expanded = win.getBounds();
    win.setMinimumSize(320, 64);
    win.setResizable(false);
    win.setBounds({ ...expanded, height: 64 });
    compact = true;
  } else {
    win.setResizable(true);
    win.setMinimumSize(900, 620);
    if (expanded) win.setBounds(expanded);
    compact = false;
  }
  broadcast();
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
  const saved = !repo.dirty || (await repo.flush());
  if (!flushed || !saved) {
    const answer = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['取消退出', '重试保存', '放弃未保存修改并退出'],
      defaultId: 0,
      cancelId: 0,
      message: '还有未提交草稿或未保存修改。',
      detail: '取消可继续编辑；放弃后这些修改可能丢失。',
    });
    if (answer.response === 0) return;
    if (answer.response === 1) return doQuit();
  }
  if (!compact)
    try {
      await writeFile(path.join(profile, 'window-state.json'), JSON.stringify(win.getBounds()));
    } catch {
      console.warn('[window:save] 窗口位置未能保存。');
    }
  quitting = true;
  controller.destroy();
  app.quit();
}
async function checkUpdates(): Promise<Result> {
  if (!app.isPackaged || !process.env.DOGCOW_UPDATE_FEED)
    return toastResult('当前构建未配置自动安装更新，可打开官方下载页。');
  const url = new URL(process.env.DOGCOW_UPDATE_FEED);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'koxinyu11.github.io' ||
    !url.pathname.startsWith('/Dog-cow/electron/')
  )
    throw Error('更新来源未通过校验。');
  // Signed release-to-release updates are enabled only by the release build.
  if (process.env.DOGCOW_SIGNED_RELEASE !== '1')
    return toastResult('当前构建未验证自动更新签名，请使用官方下载页。');
  autoUpdater.setFeedURL({ url: url.href });
  autoUpdater.checkForUpdates();
  return toastResult('正在检查更新。');
}
async function start() {
  await app.whenReady();
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
  await repo.flush();
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
  let bounds: Electron.Rectangle = { x: 0, y: 0, width: 1280, height: 820 };
  let restore = false;
  try {
    const parsed: unknown = JSON.parse(
      await readFile(path.join(profile, 'window-state.json'), 'utf8'),
    );
    if (
      record(parsed) &&
      ['x', 'y', 'width', 'height'].every(
        (key) => typeof parsed[key] === 'number' && Number.isFinite(parsed[key]),
      )
    ) {
      const candidate = parsed as unknown as Electron.Rectangle;
      if (
        candidate.width >= 900 &&
        candidate.height >= 620 &&
        screen
          .getAllDisplays()
          .some(
            (display) =>
              candidate.x < display.workArea.x + display.workArea.width &&
              candidate.x + candidate.width > display.workArea.x &&
              candidate.y < display.workArea.y + display.workArea.height &&
              candidate.y + candidate.height > display.workArea.y,
          )
      ) {
        bounds = candidate;
        restore = true;
      }
    }
  } catch {}
  win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 620,
    title: '狗牛',
    show: false,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 14 }, backgroundColor: '#f6f5ef' }
      : {}),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron/src/preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  if (!restore) win.center();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  for (const method of methods)
    ipcMain.handle(`dogcow:${method}`, (event, payload: unknown) => {
      const url = event.senderFrame?.url ?? '';
      if (
        event.sender !== win?.webContents ||
        event.senderFrame !== event.sender.mainFrame ||
        !(devUrl ? url.startsWith(`${devUrl}/`) : url.startsWith('dogcow://app/')) ||
        !validPayload(payload ?? {})
      )
        return toastResult('操作来源或参数无效。');
      if (method === 'quit' && record(payload) && payload.nonce === quitNonce && acknowledgeFlush) {
        acknowledgeFlush(payload.ready === true);
        return toastResult('');
      }
      const job = commands
        .then(() => invoke(method, (payload ?? {}) as Fields))
        .catch((error) => {
          console.error(
            JSON.stringify({
              operation: method,
              stage: 'command',
              cause: error instanceof Error ? error.name : 'unknown',
              correlationId: randomUUID(),
            }),
          );
          return {
            ...toastResult(error instanceof Error ? error.message : '操作失败，请重试。'),
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
          { label: '收成横条 / 展开', click: toggleCompact },
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
  let boundsTimer: ReturnType<typeof setTimeout> | undefined;
  const saveBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (win && !compact)
        void writeFile(
          path.join(profile, 'window-state.json'),
          JSON.stringify(win.getBounds()),
        ).catch(() => {});
    }, 300);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('focus', () => controller.tick());
  powerMonitor.on('resume', () => controller.tick());
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      void requestQuit();
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
  app.on('activate', () => {
    win?.show();
    win?.focus();
  });
  win.once('ready-to-show', () => {
    win?.show();
    broadcast();
  });
  if (devUrl) await win.loadURL(devUrl);
  else await win.loadURL('dogcow://app/index.html');
}
