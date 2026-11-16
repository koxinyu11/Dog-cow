// Explicit Electron integration suite; run via npm run test:playground.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const path = require('node:path');
const repo = process.env.DOGCOW_REPO;
app.setAppPath(repo);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (read, name) => {
  for (let i = 0; i < 150; i++) { const value = await read(); if (value) return value; await sleep(50); }
  throw Error(`timeout: ${name}`);
};
const click = (win, label) => win.webContents.executeJavaScript(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button) throw Error('Missing test button'); button.click(); })()`);
(async () => {
  const { PlaygroundController } = await import(pathToFileURL(`${repo}/dist-electron/src/main/playground-controller.js`).href);
  const open = PlaygroundController.prototype.open;
  let release;
  // Hold readiness indefinitely while checking actual business IPC is still responsive.
  PlaygroundController.prototype.open = function () { return new Promise(resolve => { release = () => resolve(open.call(this)); }); };
  await import(pathToFileURL(`${repo}/dist-electron/src/main/main.js`).href);
  const main = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === 'dogcow://app/index.html'), 'main');
  await until(() => main.webContents.executeJavaScript("!!document.querySelector('button[aria-label=\"狗牛游乐场\"]')"), 'launcher');
  await main.webContents.executeJavaScript("window.testOpening = window.dogcow.invoke('openPlayground'); undefined");
  await until(() => !!release, 'open request');
  const business = await Promise.race([
    main.webContents.executeJavaScript("window.dogcow.invoke('bootstrap').then(r => !!r.snapshot)"),
    sleep(1000).then(() => false),
  ]);
  assert.equal(business, true, 'business IPC must settle before the held playground open');
  release();
  assert.equal(await main.webContents.executeJavaScript('window.testOpening.then(r => r.applied)'), true);
  PlaygroundController.prototype.open = open;
  let park = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/playground.html'));
  const id = park.id;
  assert.equal(park.isVisible(), true);
  assert.equal(await park.webContents.executeJavaScript('typeof window.dogcow'), 'undefined');
  await main.webContents.executeJavaScript("window.dogcow.invoke('openPlayground')");
  assert.equal(BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().endsWith('/playground.html')).length, 1);
  park.close();
  await until(() => park.isDestroyed(), 'close');
  assert.equal(await main.webContents.executeJavaScript("window.dogcow.invoke('openPlayground').then(r => r.applied)"), true);
  park = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/playground.html'));
  assert.notEqual(park.id, id);
  park.webContents.forcefullyCrashRenderer();
  await until(() => park.isDestroyed(), 'crash cleanup');
  assert.equal(await main.webContents.executeJavaScript("window.dogcow.invoke('openPlayground').then(r => r.applied)"), true);
  console.log('PASS: independent business queue, real window reuse, close/reopen, crash recovery');

  const currentPark = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/playground.html'));
  currentPark.close();
  await until(() => currentPark.isDestroyed(), 'production park close');
  const fixtureUrl = pathToFileURL(process.env.DOGCOW_PLAYGROUND_FIXTURE).href;
  PlaygroundController.prototype.open = function () { this.deps.url = fixtureUrl; return open.call(this); };
  // The fixture runs in the actual owned window with its real limited preload and disk service.
  // It acknowledges native readiness after its own React root has mounted.
  await main.webContents.executeJavaScript("window.testFixtureOpening = window.dogcow.invoke('openPlayground'); undefined");
  let fixture = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === fixtureUrl), 'fixture window');
  await until(() => fixture.webContents.executeJavaScript('!!window.playgroundFixture'), 'fixture script');
  await fixture.webContents.executeJavaScript("window.playground.invoke('ready')");
  await main.webContents.executeJavaScript('window.testFixtureOpening');
  app.focus({ steal: true }); fixture.focus();
  const diagnostics = [];
  const readDiagnostics = () => fixture.webContents.executeJavaScript('window.playground.diagnostics()');
  const readEntry = async gameId => { const data = await readDiagnostics(); return data.entries.findLast(e => e.gameId === gameId); };
  await until(() => fixture.webContents.executeJavaScript('!!window.playgroundFixture'), 'fixture');
  await click(fixture, '生命周期测试');
  const playing = () => fixture.webContents.executeJavaScript("document.querySelector('[data-game-state]')?.dataset.gameState === 'playing'");
  await until(() => fixture.webContents.executeJavaScript("!!document.querySelector('[data-game-state]')"), 'game mount');
  if (!await playing()) await click(fixture, '继续游戏');
  await until(playing, 'initial continue');
  await until(() => fixture.webContents.executeJavaScript('window.playgroundFixture.ticks > 2'), 'game ticks');
  await click(fixture, '暂停');
  await until(() => fixture.webContents.executeJavaScript('window.playgroundFixture.activeTimers === 0'), 'pause stops timer');
  const ticks = await fixture.webContents.executeJavaScript('window.playgroundFixture.ticks');
  await sleep(100);
  assert.equal(await fixture.webContents.executeJavaScript('window.playgroundFixture.ticks'), ticks);
  await click(fixture, '继续游戏');
  await until(playing, 'continue');
  const mounts = await fixture.webContents.executeJavaScript('window.playgroundFixture.mounted');
  await click(fixture, '重新开始');
  await until(() => fixture.webContents.executeJavaScript(`window.playgroundFixture.mounted > ${mounts}`), 'restart');
  await click(fixture, '大厅');
  await until(() => fixture.webContents.executeJavaScript('window.playgroundFixture.activeTimers === 0 && window.playgroundFixture.unmounted === window.playgroundFixture.mounted'), 'unmount cleanup');
  await click(fixture, '生命周期测试');
  await until(() => fixture.webContents.executeJavaScript("!!document.querySelector('[data-game-state]')"), 'reenter');
  if (!await playing()) await click(fixture, '继续游戏');
  fixture.minimize();
  await until(() => fixture.webContents.executeJavaScript("document.querySelector('[data-game-state]')?.dataset.gameState === 'paused'"), 'minimize pauses');
  fixture.restore(); fixture.focus();
  await sleep(100);
  assert.equal(await playing(), false, 'focus must not automatically resume');
  await click(fixture, '继续游戏');
  await until(playing, 'resume after restore');
  await click(fixture, '大厅');
  for (const [label, stage, gameId] of [['加载失败测试', 'load', 'broken-load'], ['渲染失败测试', 'render', 'broken-render']]) {
    await click(fixture, label);
    await until(() => fixture.webContents.executeJavaScript("!!document.querySelector('[role=alert]')"), `${stage} error`);
    const diagnostic = await until(() => readEntry(gameId), `${stage} diagnostic`);
    diagnostics.push(diagnostic);
    assert.equal(diagnostic.stage, stage);
    assert.match(diagnostic.correlationId, /^[a-f0-9-]{36}$/);
    assert.match(diagnostic.errors.at(-1).message, /fixture/);
    assert.ok(diagnostic.componentStack); assert.ok(diagnostic.buildId);
    assert.equal(await fixture.webContents.executeJavaScript(`document.body.innerText.includes(${JSON.stringify(diagnostic.correlationId)})`), true);
    await click(fixture, '返回大厅');
  }
  await click(fixture, '生命周期测试');
  await until(() => fixture.webContents.executeJavaScript("!!document.querySelector('[data-game-state]')"), 'async fixture');
  if (!await playing()) await click(fixture, '继续游戏');
  for (const [label, stage] of [['事件异常测试', 'event'], ['异步异常测试', 'promise'], ['定时器异常测试', 'timer']]) {
    await click(fixture, label);
    const found = await until(async () => (await readDiagnostics()).entries.find(e => e.stage === stage && e.gameId === 'fixture'), stage);
    assert.match(found.errors.at(-1).message, /fixture/);
    assert.equal((await readDiagnostics()).entries.filter(e => e.correlationId === found.correlationId).length, 1);
  }
  await click(fixture, '延迟旧局异常');
  await click(fixture, '重新开始');
  const oldRound = await until(async () => (await readDiagnostics()).entries.find(e => e.errors.some(c => c.message === 'fixture old round failure')), 'old async owner');
  await click(fixture, '事件异常测试');
  const newRound = await until(async () => (await readDiagnostics()).entries.findLast(e => e.stage === 'event' && e.runId !== oldRound.runId), 'new round');
  assert.notEqual(oldRound.runId, newRound.runId);
  // Query, UI details and clipboard use the same authoritative stored record.
  const target = diagnostics[0];
  await fixture.webContents.executeJavaScript("document.querySelector('.pg-diagnostics > details').open = true");
  await until(() => fixture.webContents.executeJavaScript(`document.body.innerText.includes(${JSON.stringify(target.correlationId)})`), 'diagnostic panel');
  const { clipboard } = require('electron');
  const previousClipboard = await clipboard.readText();
  try {
    await fixture.webContents.executeJavaScript(`window.playground.copyDiagnostics(${JSON.stringify(target.correlationId)})`);
    assert.equal(JSON.parse(await clipboard.readText()).entries[0].correlationId, target.correlationId);
  } finally { await clipboard.writeText(previousClipboard); }
  const originalWrite = clipboard.writeText;
  try {
    clipboard.writeText = async () => { throw Object.assign(new Error('fixture clipboard failure'), { code: 'EACCES' }); };
    const failedCopy = await main.webContents.executeJavaScript("window.dogcow.invoke('copyPlaygroundDiagnostics')");
    assert.equal(failedCopy.errorCode, 'PLAYGROUND_CLIPBOARD_FAILED');
    const failure = await fixture.webContents.executeJavaScript(`window.playground.diagnostics(${JSON.stringify(failedCopy.correlationId)})`);
    assert.equal(failure.entries[0].stage, 'clipboard');
    assert.equal(failure.entries[0].errors[0].code, 'EACCES');
  } finally { clipboard.writeText = originalWrite; }
  fixture.close(); await until(() => fixture.isDestroyed(), 'fixture close');
  await main.webContents.executeJavaScript("window.testFixtureOpening = window.dogcow.invoke('openPlayground'); undefined");
  fixture = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === fixtureUrl), 'reopened fixture');
  await until(() => fixture.webContents.executeJavaScript('!!window.playgroundFixture'), 'reopened script');
  await fixture.webContents.executeJavaScript("window.playground.invoke('ready')");
  await main.webContents.executeJavaScript('window.testFixtureOpening');
  const retained = await fixture.webContents.executeJavaScript(`window.playground.diagnostics(${JSON.stringify(target.correlationId)})`);
  assert.equal(retained.entries[0].correlationId, target.correlationId);
  const persisted = await fs.readFile(path.join(process.env.DOGCOW_TEST_PROFILE, 'diagnostics/playground-diagnostics.jsonl'), 'utf8');
  assert.ok(persisted.includes(target.correlationId));
  assert.equal(await fixture.webContents.executeJavaScript("window.playground.report({}).then(() => false, () => true)"), true);
  fixture.close();
  console.log('PASS: pause/continue/restart/unmount, load/render/event/promise/timer diagnostics, old-run attribution, deduplication, query/copy and disk retention across close/reopen');
  app.exit(0);
})().catch(error => { console.error(error); app.exit(1); });
