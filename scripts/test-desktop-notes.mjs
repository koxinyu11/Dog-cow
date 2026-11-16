/** Business IPC smoke test; uses disposable data and one Electron process at a time. */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  const end = Date.now() + 18000;
  while (Date.now() < end) { if (await check()) return; await wait(60); }
  throw Error(`Timeout: ${label}`);
}
async function scenario() {
  const { app, BrowserWindow, screen } = createRequire(import.meta.url)('electron');
  app.on('browser-window-created', (_event, win) => {
    for (const stage of ['did-start-loading', 'dom-ready', 'did-finish-load'])
      win.webContents.on(stage, () => console.log('SMOKE_PAGE_STAGE', JSON.stringify({ windowId: win.id, stage })));
    win.webContents.on('did-fail-load', (_event, code, description, url) => console.error('SMOKE_LOAD_FAILED', code, description, url));
    win.webContents.on('preload-error', (_event, _path, error) => console.error('SMOKE_PRELOAD_FAILED', error.message));
    win.webContents.on('console-message', event => { if (event.level === 'error') console.error('SMOKE_RENDERER_ERROR', event.message); });
  });
  app.setAppPath(root);
  console.log('SMOKE_APP_IMPORT', JSON.stringify({ appReady: app.isReady() }));
  await import(pathToFileURL(path.join(root, 'dist-electron/src/main/main.js')).href);
  let main;
  try {
    await until(async () => {
      main = BrowserWindow.getAllWindows().find(win => win.webContents.getURL() === 'dogcow://app/index.html');
      return !!main && await main.webContents.executeJavaScript('!!window.dogcow').catch(() => false);
    }, 'main bridge');
  } catch (error) {
    console.error('SMOKE_STARTUP_STATE', JSON.stringify(BrowserWindow.getAllWindows().map(win => ({ windowId: win.id, page: new URL(win.webContents.getURL() || 'about:blank').pathname, loading: win.webContents.isLoadingMainFrame() }))));
    throw error;
  }
  const invoke = (method, payload = {}) => main.webContents.executeJavaScript(`window.dogcow.invoke(${JSON.stringify(method)}, ${JSON.stringify({ ...payload, requestId: payload.requestId ?? randomUUID() })})`);
  const snapshot = async () => (await invoke('bootstrap')).snapshot;
  const profile = process.env.DOGCOW_TEST_PROFILE;
  if (process.argv.includes('--restore')) {
    const saved = JSON.parse(await readFile(path.join(profile, 'smoke-manifest.json'), 'utf8'));
    const state = await snapshot();
    assert.deepEqual(state.desktopNotes.notes.map(note => note.id), saved.noteIds);
    assert.equal(state.tasks.tasks.find(task => task.id === saved.taskId).done, false);
    await until(() => BrowserWindow.getAllWindows().filter(win => win.webContents.getURL().startsWith('dogcow://app/desktop-notes.html')).length === 3, 'restored windows');
    const prefs = JSON.parse(await readFile(path.join(profile, 'desktop-notes-preferences.json'), 'utf8'));
    assert.equal(prefs.notes[saved.noteIds[0]].hanging, true);
    console.log('PASS restart restores real note IDs, task state and hanging placement');
  } else {
    const createTask = async title => {
      const state = await snapshot();
      const result = await invoke('task', { action: 'create', task: { title, date: '2026-11-16' }, expectedRevision: state.revisions.tasks });
      assert.equal(result.persisted, true);
      return result.snapshot.tasks.tasks.find(task => task.title === title).id;
    };
    const a = await createTask('便签 IPC 测试 A'); const b = await createTask('便签 IPC 测试 B');
    const notes = async payload => {
      const state = await snapshot();
      const result = await invoke('desktopNotes', { ...payload, expectedNotesRevision: state.desktopNotes.revision });
      assert.equal(result.persisted, true, result.message); return result.snapshot;
    };
    let state = await notes({ action: 'pin', taskIds: [a] }); const single = state.desktopNotes.notes[0].id;
    await notes({ action: 'pin', taskIds: [a] });
    state = await notes({ action: 'create', title: '联调清单', taskIds: [a, b] }); const list = state.desktopNotes.notes[1].id;
    assert.equal(state.desktopNotes.notes.length, 2);
    await until(() => BrowserWindow.getAllWindows().filter(win => win.webContents.getURL().startsWith('dogcow://app/desktop-notes.html')).length === 3, 'note windows');
    const surface = id => BrowserWindow.getAllWindows().find(win => new URL(win.webContents.getURL() || 'about:blank').searchParams.get('role') === id);
    const singleWindow = surface(single), listWindow = surface(list), line = surface('line');
    await until(async () => !!singleWindow && await singleWindow.webContents.executeJavaScript('!!window.desktopNotes').catch(() => false), 'surface bridge');
    for (const win of [singleWindow, listWindow]) await win.webContents.executeJavaScript("window.desktopNotes.onView(view => window.__notesTestView = view); window.desktopNotes.send({action:'ready'});");
    await until(async () => !!await listWindow.webContents.executeJavaScript('window.__notesTestView'), 'surface projection');
    const view = await singleWindow.webContents.executeJavaScript('window.__notesTestView');
    assert.equal(view.notes.length, 1); assert.deepEqual(view.notes[0].tasks.map(task => task.id), [a]);
    assert.equal(line.getBounds().width, screen.getPrimaryDisplay().workArea.width);
    state = await snapshot();
    const nativeRequest = randomUUID();
    const send = (win, command) => win.webContents.executeJavaScript(`window.desktopNotes.send(${JSON.stringify(command)})`);
    await send(singleWindow, { action: 'toggle', id: a, revision: state.revisions.tasks, requestId: nativeRequest });
    await until(async () => (await snapshot()).tasks.tasks.find(task => task.id === a).done, 'native task completion');
    await until(async () => (await listWindow.webContents.executeJavaScript('window.__notesTestView')).notes[0].tasks[0].done, 'other note update');
    await wait(100);
    await send(singleWindow, { action: 'toggle', id: a, revision: state.revisions.tasks, requestId: nativeRequest });
    await wait(100); assert.equal((await snapshot()).tasks.tasks.find(task => task.id === a).done, true);
    console.log('PASS real IPC: pin deduplication, grouped notes, scoped projection, shared completion and idempotent retry');
    const file = path.join(profile, 'data', 'snapshot.json');
    await rename(file, `${file}.smoke-before`); await mkdir(file);
    state = await snapshot();
    const failed = await invoke('task', { action: 'toggle', id: a, expectedRevision: state.revisions.tasks });
    assert.equal(failed.applied, true); assert.equal(failed.persisted, false);
    assert.equal(failed.snapshot.tasks.tasks.find(task => task.id === a).done, false);
    await rm(file, { recursive: true });
    assert.equal((await invoke('retrySave')).persisted, true);
    assert.equal((await snapshot()).tasks.tasks.find(task => task.id === a).done, false);
    await send(singleWindow, { action: 'hang' }); await wait(260);
    assert.equal((await invoke('retrySave')).persisted, true);
    const prefs = JSON.parse(await readFile(path.join(profile, 'desktop-notes-preferences.json'), 'utf8'));
    assert.equal(prefs.notes[single].hanging, true);
    await writeFile(path.join(profile, 'smoke-manifest.json'), JSON.stringify({ noteIds: [single, list], taskId: a }));
    console.log('PASS failed persistence retains applied task state; save retry does not toggle again');
  }
  console.log('PASS phase assertions; requesting application save-and-quit');
  await invoke('quit');
}
async function driver() {
  const profile = await mkdtemp(path.join(tmpdir(), 'dogcow-notes-ipc-'));
  const electron = createRequire(import.meta.url)('electron');
  try {
    for (const phase of ['', '--restore']) await new Promise((resolve, reject) => {
      console.log('SMOKE_PHASE', phase || 'create');
      const env = { ...process.env, NODE_ENV: 'test', DOGCOW_TEST_PROFILE: profile }; delete env.DOGCOW_DEV_URL;
      const child = spawn(electron, [fileURLToPath(import.meta.url), ...(phase ? [phase] : [])], { cwd: root, env, stdio: 'inherit' });
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Electron smoke timeout')); }, 45000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error(`Electron smoke exit ${code}`)); });
    });
    console.log('PASS desktop notes IPC smoke completed with isolated data');
  } finally { await rm(profile, { recursive: true, force: true }); }
}
if (process.versions.electron) void scenario().catch(error => { console.error(error); createRequire(import.meta.url)('electron').app.exit(1); });
else await driver();
