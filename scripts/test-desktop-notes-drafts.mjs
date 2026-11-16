/** Bounded renderer regression: real React/NotesManager with only its command transport replaced. */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function scenario() {
  const { app, BrowserWindow } = require('electron');
  app.setPath('userData', path.join(process.env.DOGCOW_DRAFT_FIXTURE, 'profile'));
  await app.whenReady();
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', event => { if (event.level === 'error') console.error('DRAFT_RENDERER_ERROR', event.message); });
  await win.loadFile(path.join(process.env.DOGCOW_DRAFT_FIXTURE, 'index.html'));
  const js = code => win.webContents.executeJavaScript(code).catch(error => { console.error('DRAFT_SCRIPT_FAILED', code); throw error; });
  const until = async (code, label) => {
    for (let i = 0; i < 100; i++) { if (await js(code)) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw Error(`Draft regression timeout: ${label}`);
  };
  const type = value => js(`{const input=document.querySelector('[aria-label="便签名称"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));}`);
  const click = label => js(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
  const state = { desktopNotes: { revision: 1, notes: [], pending: false, lineVisible: true, error: '' }, tasks: { tasks: [{ id: 'a', title: '测试任务', date: '2026-11-16', done: false }] }, taskError: '' };
  const start = async () => {
    await js(`fixture.start(${JSON.stringify(state)})`);
    await until(`!!document.querySelector('[aria-label="便签名称"]')`, 'editor');
    await js(`document.querySelector('.dn-picker input[type="checkbox"]').click()`);
    await type('原草稿');
    await until(`document.querySelector('.dn-editor-title input').value==='原草稿' && document.querySelectorAll('.dn-members li').length===1`, 'draft changes');
  };
  await start();
  await js(`fixture.state.desktopNotes.layoutPending=true;fixture.render();fixture.reply={applied:true,persisted:true,snapshot:${JSON.stringify(state)}}`);
  await until(`!!document.querySelector('.dn-pending')`, 'layout save retry');
  await click('重试保存');
  await until(`fixture.calls.length===1 && !document.querySelector('.dn-pending')`, 'layout saved');
  assert.equal(await js(`document.querySelector('.dn-editor-title input')?.value`), '原草稿');
  assert.equal(await js(`fixture.canFlush()`), false);
  console.log('PASS unrelated preference save retry preserves the unsubmitted draft and quit guard');

  await start();
  const note = { id: 'created', kind: 'list', title: '原草稿', taskIds: ['a'], visible: true };
  const applied = structuredClone(state); applied.desktopNotes.notes = [note]; applied.desktopNotes.pending = true;
  await js(`fixture.reply={applied:true,persisted:false,snapshot:${JSON.stringify(applied)}}`);
  await click('保存便签');
  await until(`!!document.querySelector('.dn-pending') && fixture.calls.length===1`, 'applied but unsaved create');
  const saved = structuredClone(applied); saved.desktopNotes.pending = false;
  await js(`fixture.reply={applied:true,persisted:true,snapshot:${JSON.stringify(saved)}};fixture.defer=true`);
  await click('重试保存');
  await until(`fixture.calls.length===2`, 'in-flight retry');
  await type('后续修改');
  await until(`document.querySelector('.dn-editor-title input').value==='后续修改'`, 'edit during retry');
  await js(`fixture.release()`);
  await until(`!document.querySelector('.dn-pending')`, 'retry settled');
  assert.equal(await js(`document.querySelector('.dn-editor-title input')?.value`), '后续修改');
  assert.equal(await js(`fixture.canFlush()`), false);
  saved.desktopNotes.notes[0].title = '后续修改';
  await js(`fixture.reply={applied:true,persisted:true,snapshot:${JSON.stringify(saved)}}`);
  await click('保存便签');
  await until(`!document.querySelector('.dn-editor')`, 'updated draft persisted');
  assert.deepEqual(await js(`fixture.calls[2]`), { method: 'desktopNotes', payload: { action: 'update', id: 'created', title: '后续修改', taskIds: ['a'], expectedNotesRevision: 1 } });
  assert.equal(await js(`fixture.canFlush()`), true);
  console.log('PASS edits made during retry survive; a partially saved create continues as update without duplication');

  await start();
  await js(`fixture.reply={applied:true,persisted:false,snapshot:${JSON.stringify(applied)}}`);
  await click('保存便签');
  await until(`!!document.querySelector('.dn-pending')`, 'unchanged draft pending');
  const confirmed = structuredClone(applied); confirmed.desktopNotes.pending = false;
  await js(`fixture.reply={applied:true,persisted:true,snapshot:${JSON.stringify(confirmed)}}`);
  await click('重试保存');
  await until(`!document.querySelector('.dn-editor')`, 'confirmed draft closes');
  assert.equal(await js(`fixture.canFlush()`), true);
  console.log('PASS retry closes only the draft whose content was confirmed persisted');

  const target = { id: 'target', kind: 'list', title: '目标清单', taskIds: [], visible: true };
  await start();
  await js(`fixture.state.desktopNotes.notes.push(${JSON.stringify(target)});fixture.openTo('target')`);
  await until(`document.querySelector('.dn-message')?.textContent.includes('未保存修改')`, 'external navigation is guarded');
  assert.equal(await js(`document.querySelector('.dn-editor-title input').value`), '原草稿');
  assert.equal(await js(`fixture.canFlush()`), false);
  await click('放弃修改');
  await until(`document.querySelector('.dn-editor-title input')?.value==='目标清单'`, 'discard then navigate');
  assert.equal(await js(`fixture.canFlush()`), true);
  console.log('PASS external navigation preserves the draft until explicit discard, then opens the requested note');

  await start();
  await js(`fixture.state.desktopNotes.notes.push(${JSON.stringify(target)});fixture.openTo('target')`);
  await until(`document.querySelector('.dn-message')?.textContent.includes('未保存修改')`, 'save-before-navigation guard');
  const failed = structuredClone(state); failed.desktopNotes.notes = [target];
  await js(`fixture.reply={applied:false,persisted:false,message:'保存未完成',snapshot:${JSON.stringify(failed)}}`);
  await click('保存便签');
  await until(`fixture.calls.length===1 && document.querySelector('.dn-message')?.textContent==='保存未完成'`, 'failed save keeps draft');
  assert.equal(await js(`document.querySelector('.dn-editor-title input').value`), '原草稿');
  assert.equal(await js(`fixture.canFlush()`), false);
  const success = structuredClone(failed); success.desktopNotes.notes.push(note);
  await js(`fixture.reply={applied:true,persisted:true,snapshot:${JSON.stringify(success)}}`);
  await click('保存便签');
  await until(`document.querySelector('.dn-editor-title input')?.value==='目标清单'`, 'saved then navigate');
  assert.equal(await js(`fixture.state.desktopNotes.notes.find(note=>note.id==='created').title`), '原草稿');
  assert.equal(await js(`fixture.canFlush()`), true);
  console.log('PASS failed save keeps the draft and target; successful save completes the deferred navigation');

  const clean = structuredClone(state);
  clean.desktopNotes.notes = [{ ...note, id: 'origin', title: '已保存清单' }, target];
  await js(`fixture.start(${JSON.stringify(clean)});fixture.openTo('origin')`);
  await until(`document.querySelector('.dn-editor-title input')?.value==='已保存清单'`, 'clean editor');
  await js(`fixture.defer=true;fixture.reply={applied:true,persisted:true,snapshot:${JSON.stringify(clean)}};document.querySelector('.dn-toolbar input[type="checkbox"]').click()`);
  await until(`fixture.calls.length===1`, 'preference command in flight');
  await js(`fixture.openTo('target')`);
  await until(`document.querySelector('.dn-message')?.textContent.includes('正在保存')`, 'busy navigation waits');
  assert.equal(await js(`document.querySelector('.dn-editor-title input').value`), '已保存清单');
  await js(`fixture.release()`);
  await until(`document.querySelector('.dn-editor-title input')?.value==='目标清单'`, 'busy command then navigate');
  console.log('PASS navigation during an in-flight command waits for completion without replacing the editor');
  win.destroy(); app.quit();
}
async function driver() {
  const dir = await mkdtemp(path.join(tmpdir(), 'dogcow-draft-regression-'));
  try {
    const { build } = await import('esbuild');
    await build({ jsx: 'automatic', stdin: { contents: `
      import {createRoot} from 'react-dom/client';
      import {NotesManager} from './src/renderer/features/desktop-notes/NotesManager';
      const root=createRoot(document.getElementById('root'));let generation=0;let flush;
      const fixture=window.fixture={state:null,reply:null,calls:[],defer:false,compose:true,focus:undefined,
        register(callback){flush=callback;return()=>{flush=undefined}},canFlush(){return flush()},
        start(state){generation++;this.state=state;this.calls=[];this.defer=false;this.compose=true;this.focus=undefined;this.render()},
        openTo(id){this.focus=id;this.compose=false;this.render()},
        render(){root.render(<NotesManager key={generation} state={this.state} open compose={this.compose} focus={this.focus} onClose={()=>{}} onNewTask={()=>{}}/>)},
        async command(method,payload){this.calls.push({method,payload});if(this.defer){this.defer=false;await new Promise(resolve=>this.release=resolve)}const result=structuredClone(this.reply);if(result.snapshot){this.state=result.snapshot;this.render()}return result}
      };`, resolveDir: root, loader: 'tsx' }, outfile: path.join(dir, 'fixture.js'), bundle: true, format: 'iife', platform: 'browser', loader: { '.css': 'empty' }, plugins: [{ name: 'command-transport', setup(b) {
      b.onResolve({ filter: /^\.\.\/\.\.\/state$/ }, args => args.importer.endsWith('/NotesManager.tsx') ? { path: 'state', namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const command=(...args)=>window.fixture.command(...args);export const registerFlush=callback=>window.fixture.register(callback);' }));
    } }] });
    await writeFile(path.join(dir, 'index.html'), '<!doctype html><meta charset="utf-8"><div id="root"></div><script src="fixture.js"></script>');
    await new Promise((resolve, reject) => {
      const child = spawn(require('electron'), [fileURLToPath(import.meta.url)], { cwd: root, stdio: 'inherit', env: { ...process.env, DOGCOW_DRAFT_FIXTURE: dir } });
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Draft regression process timeout')); }, 25000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error(`Draft regression exit ${code}`)); });
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
}
if (process.versions.electron) void scenario().catch(error => { console.error(error); require('electron').app.exit(1); });
else await driver();
