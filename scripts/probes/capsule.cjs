// F10 A only: isolated native-window capability probe; never loads business data.
const { app, BrowserWindow, screen, Menu } = require('electron');
const { mkdtempSync, writeFileSync, readFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const directory = mkdtempSync(path.join(tmpdir(), 'dogcow-capsule-probe-'));
app.setPath('userData', path.join(directory, 'profile'));
app.setName('Dogcow F10 Probe');
const preview = process.argv.includes('--preview');
const rows = [];
let win;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function record(test, detail) {
  rows.push({ test, detail });
  writeFileSync(path.join(directory, 'results.json'), JSON.stringify(rows, null, 2));
  console.log(JSON.stringify({ test, detail }));
}
function state() {
  return { id: win.id, webContentsId: win.webContents.id, bounds: win.getBounds(), content: win.getContentBounds(), resizable: win.isResizable(), topmost: win.isAlwaysOnTop(), fullscreen: win.isFullScreen(), maximized: win.isMaximized(), focused: win.isFocused() };
}
async function waitEvent(event, operation) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { win.removeListener(event, done); reject(Error(`${event} timeout`)); }, 5000);
    function done() { clearTimeout(timeout); resolve(); }
    win.once(event, done);
    operation();
  });
}
app.whenReady().then(async () => {
  console.log(`PROBE_DIRECTORY=${directory}`);
  record('environment', { electron: process.versions.electron, platform: process.platform, arch: process.arch, displays: screen.getAllDisplays().map(d => ({ workArea: d.workArea, scaleFactor: d.scaleFactor })) });
  win = new BrowserWindow({ x: 300, y: 200, width: 1000, height: 700, minWidth: 900, minHeight: 620, title: 'F10 可行性验证（隔离，无业务数据）', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 14 }, backgroundColor: preview ? '#e0f5e8' : '#ff00ff', webPreferences: { contextIsolation: true, sandbox: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>html,body{margin:0;background:transparent;color:#18352b;font:14px system-ui}body{height:100vh;display:grid;place-items:center}article{box-sizing:border-box;width:100%;height:100%;border-radius:16px;background:#e0f5e8;display:flex;align-items:center;justify-content:center;gap:8px;font-variant-numeric:tabular-nums}span{font-size:11px}b{font-size:12px;line-height:16px}button{width:24px;height:24px;padding:0;border:0;background:transparent;color:inherit;font-size:14px;line-height:24px;cursor:pointer;-webkit-app-region:no-drag}button:focus-visible{outline:2px solid #376c58;border-radius:6px}i{position:absolute;left:8px;top:8px;width:12px;height:16px;-webkit-app-region:drag}</style><article><i>⠿</i><span title="隔离预览，示例倒计时，不是考勤数据">下班</span><b id="clock"></b><button aria-label="展开验证窗口" onclick="document.title='__probe_expand__'">↗</button></article><script>let ticks=0;function update(){const s=Math.max(0,5025-ticks);document.getElementById('clock').textContent=[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');document.title='F10 隔离预览 '+(++ticks)}update();setInterval(update,1000)</script></html>`));
  record('expanded-before', state());
  const identity = win.webContents.id;
  const normal = win.getNormalBounds();
  function capsule() {
    win.setWindowButtonVisibility(false);
    win.setMinimumSize(1, 1);
    win.setResizable(false);
    win.setContentSize(240, preview ? 32 : 44);
    win.setPosition(300, 200);
  }
  function expanded() {
    win.setResizable(true);
    win.setMinimumSize(900, 620);
    win.setWindowButtonVisibility(true);
    win.setBounds(normal);
  }
  win.webContents.on('page-title-updated', (_event, title) => { if (title === '__probe_expand__') expanded(); });
  capsule(); await sleep(300);
  record(preview ? 'capsule-240x32' : 'capsule-240x44', state());
  if (!preview) {
  win.setAlwaysOnTop(true, 'floating'); record('topmost-on', state());
  win.setAlwaysOnTop(false); record('topmost-off', state());
  expanded(); await sleep(300); record('expanded-restored', state());
  win.setSize(1100, 740); await sleep(300); record('expanded-resize', state());
  win.maximize(); await sleep(500); record('maximize', state());
  win.unmaximize(); await sleep(500); record('unmaximize', state());
  try {
    await waitEvent('enter-full-screen', () => win.setFullScreen(true));
    record('fullscreen-enter', state());
    await waitEvent('leave-full-screen', () => win.setFullScreen(false));
    record('fullscreen-leave', state());
  } catch (error) { record('fullscreen-error', { message: error.message }); }
  }
  capsule(); await sleep(300);
  record('identity-preserved', { sameWebContents: identity === win.webContents.id, ...state() });
  win.setAlwaysOnTop(true, 'floating');
  record('ready-for-manual-check', state());
  win.on('focus', () => record('focus', { focused: true }));
  win.on('blur', () => record('blur', { focused: false }));
  win.on('move', () => record('move', { bounds: win.getBounds() }));
  const timer = setInterval(() => {
    const command = path.join(directory, 'command.json');
    if (!existsSync(command)) return;
    try {
      const value = JSON.parse(readFileSync(command, 'utf8'));
      if (value.id === timer.lastId) return;
      timer.lastId = value.id;
      if (value.action === 'status') record('manual-status', { ...state(), title: win.getTitle() });
      if (value.action === 'expanded') { expanded(); record('manual-expanded', state()); }
      if (value.action === 'capsule') { capsule(); record('manual-capsule', state()); }
      if (value.action === 'quit') app.quit();
    } catch(error) { record('command-error', { message: error.message }); }
  }, 200);
  app.on('will-quit', () => clearInterval(timer));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label:'F10 验证', submenu:[{label:'展开',click:expanded},{label:'胶囊',click:capsule},{role:'quit'}] }]));
}).catch(error => { record('fatal', { message: error.message }); app.quit(); process.exitCode=1; });
app.on('window-all-closed', () => app.quit());
