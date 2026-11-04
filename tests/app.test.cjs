const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const key = 'work-todolist-generic-v1';

function app(raw = null, options = {}) {
  const elements = new Map();
  const controls = [{ disabled: false }];
  const globalControls = [{ disabled: false }];
  const values = new Map(raw === null ? [] : [[key, raw]]);
  const writes = [];
  const errors = [];
  let failWrite = Boolean(options.failWrite);
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', innerHTML: '', hidden: false, value: '', style: {},
      classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: true }), location: { reload() {} } },
    document: { getElementById: element, querySelectorAll: selector => selector.startsWith('[data-task-module] button') ? controls : selector.startsWith('main button') ? [...controls, ...globalControls] : [] },
    localStorage: {
      getItem: name => { if (options.failRead) throw new Error('Denied'); return values.get(name) ?? null; },
      setItem: (name, value) => {
        if (failWrite) throw new Error('QuotaExceeded');
        writes.push(value); values.set(name, value);
      }
    },
    console: { error: (...args) => errors.push(args) },
    setInterval() {}, setTimeout() {}
  });
  vm.runInContext(source, context);
  return { run: code => vm.runInContext(code, context), element, values, writes, errors, controls, globalControls,
    allowWrite: () => { failWrite = false; } };
}
const task = (overrides = {}) => ({ id: 'one', date: '2026-11-04', title: '任务', done: false, progress: 0, tags: [], ...overrides });
const saved = tasks => JSON.stringify({ tasks, seededWeeks: [], settings: {} });

test('first launch saves normally and valid tasks survive restart', () => {
  const first = app();
  assert.ok(first.writes.length);
  first.run(`state.tasks.push(normalizeTask(${JSON.stringify(task())})); save()`);
  const restarted = app(first.values.get(key));
  assert.equal(restarted.run('state.tasks[0].title'), '任务');
  assert.equal(restarted.element('storageStatus').hidden, true);
});

for (const raw of ['{broken', saved([task(), null]), JSON.stringify({ tasks: 'bad' }), saved([task({ tags: [null] })]), 'null']) {
  test(`invalid storage is retained without writes: ${raw.slice(0, 35)}`, () => {
    const instance = app(raw);
    assert.equal(instance.values.get(key), raw);
    assert.equal(instance.writes.length, 0);
    assert.equal(instance.run('save()'), false);
    assert.equal(instance.element('storageStatus').hidden, false);
    assert.equal(instance.controls[0].disabled, true);
    assert.equal(instance.globalControls[0].disabled, false);
    assert.match(instance.element('storageMessage').textContent, /停止编辑/);
    assert.equal(instance.errors[0][0], 'TASK_STORAGE_READ_FAILED');
  });
}

test('unreadable storage does not become a writable blank state', () => {
  const instance = app(null, { failRead: true });
  assert.equal(instance.writes.length, 0);
  assert.equal(instance.run('storageReadFailed'), true);
});

test('failed save preserves memory and retry persists latest edits', () => {
  const instance = app(saved([task()]), { failWrite: true });
  instance.run("state.tasks[0].title = '尚未保存'; save(); render()");
  assert.match(instance.element('storageMessage').textContent, /未保存/);
  assert.equal(instance.element('storageStatus').hidden, false);
  assert.equal(JSON.parse(instance.values.get(key)).tasks[0].title, '任务');
  instance.allowWrite();
  instance.element('storageRetry').onclick();
  assert.equal(JSON.parse(instance.values.get(key)).tasks[0].title, '尚未保存');
  assert.equal(instance.element('storageStatus').hidden, true);
});

test('moving a task preserves its deadline and overdue display', () => {
  const instance = app(saved([task({ dueDate: '2026-11-04' })]));
  assert.equal(instance.run('moveTaskToNextDay(state.tasks[0])'), '2026-11-05');
  assert.equal(instance.run('state.tasks[0].dueDate'), '2026-11-04');
  assert.equal(instance.run("deadlineHtml(state.tasks[0]).includes('min=')"), false);
  instance.run('save()');
  const restarted = app(instance.values.get(key));
  assert.equal(restarted.run('state.tasks[0].dueDate'), '2026-11-04');
  assert.equal(restarted.run('state.tasks[0].date'), '2026-11-05');
});

test('deadline-only task is visible, editable, and counted once on selected day', () => {
  const instance = app(saved([task({ date: '2026-11-02', dueDate: '2026-11-04' })]));
  instance.run("selected = '2026-11-04'; render()");
  assert.match(instance.element('taskList').innerHTML, /任务/);
  assert.match(instance.element('taskList').innerHTML, /安排于 2026-11-02 · 当日截止/);
  assert.equal(instance.element('taskCount').textContent, '1 项待完成');
  assert.match(instance.element('tabs').innerHTML, /11月4日 · 1 项/);
  instance.run("state.tasks[0].date = '2026-11-04'; render()");
  assert.equal((instance.element('taskList').innerHTML.match(/data-task-title=/g) || []).length, 1);
  assert.equal(instance.element('cnCount').textContent, 1);
});

test('today summary includes tasks due today with a different scheduled date', () => {
  const instance = app();
  instance.run("state.tasks = [normalizeTask({id:'today',title:'今天截止',date:addDaysISO(toISO(new Date()),-2),dueDate:toISO(new Date()),done:false})]; render()");
  assert.equal(instance.element('todaySummary').textContent, '今天完成 0 / 1 项');
  assert.equal(instance.element('focusTitle').textContent, '今天截止');
});
