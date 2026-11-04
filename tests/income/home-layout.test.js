import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_MODULES, createHomeLayout } from '../../app/income/src/home-layout.js';

const KEY = 'dogcow.home.v1';
const IDS = ['progress', 'next-task', 'tasks', 'calendar', 'week-summary', 'income', 'work-time', 'clock', 'stolen'];
const DEFAULT = { version: 1, order: IDS, enabled: IDS.slice(0, 5) };

// Minimal DOM primitives: moving an existing node retains its identity, descendants and listeners.
class Element {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.ownerDocument = document;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.hidden = false;
    this.disabled = false;
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(type, callback) { (this.listeners[type] ??= []).push(callback); }
  dispatch(type) {
    for (const callback of this.listeners[type] ?? []) callback({ target: this, currentTarget: this });
  }
  click() { if (!this.disabled) this.dispatch('click'); }
  focus() { if (!this.disabled) this.ownerDocument.activeElement = this; }
}

function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

function storage(raw = null) {
  const values = new Map([['work-todolist-generic-v1', 'task snapshot'], ['niuma-calculator.settings.v4', 'wage snapshot']]);
  if (raw !== null) values.set(KEY, raw);
  return {
    values, writes: [], reads: [], denyRead: false, denyWrite: false,
    getItem(key) {
      this.reads.push(key);
      if (this.denyRead) throw new Error('Denied');
      return this.values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.denyWrite) throw new Error('QuotaExceeded');
      this.writes.push([key, value]);
      this.values.set(key, value);
    },
  };
}

function mount(target = storage(), useGlobalStorage = false) {
  const document = { createElement: (tag) => new Element(tag, document), activeElement: null };
  const grid = document.createElement('div');
  const settings = document.createElement('div');
  const nodes = new Map();
  for (const id of IDS) {
    const node = document.createElement('section');
    node.dataset.homeModule = id;
    const input = document.createElement('input');
    input.value = `${id} uncommitted draft`;
    node.append(input);
    nodes.set(id, node);
    grid.append(node);
  }
  const changes = [];
  const options = { document, grid, settingsContainer: settings, onChange: (value) => changes.push(value) };
  if (!useGlobalStorage) options.storage = target;
  const layout = createHomeLayout(options);
  return {
    document, grid, settings, nodes, changes, layout, storage: target,
    toggle(id, checked) {
      const input = find(settings, (node) => node.dataset.homeEnabled === id);
      input.checked = checked;
      input.dispatch('change');
    },
    move(id, direction) {
      return find(settings, (node) => node.dataset.homeModule === id && node.dataset.homeMove === direction);
    },
    status: () => find(settings, (node) => node.className === 'home-layout-status'),
  };
}

test('default shows the first five modules without writing any storage', () => {
  const instance = mount();
  assert.deepEqual(HOME_MODULES.map((module) => module.id), IDS);
  assert.equal(HOME_MODULES[8].title, '偷出金额');
  assert.deepEqual(instance.layout.getConfig(), DEFAULT);
  assert.deepEqual(instance.grid.children.map((node) => node.dataset.homeModule), IDS);
  for (const [index, node] of instance.grid.children.entries()) assert.equal(node.hidden, index >= 5);
  assert.deepEqual(instance.storage.reads, [KEY]);
  assert.equal(instance.storage.writes.length, 0);
  assert.equal(instance.changes.length, 1);
});

test('valid saved order and enabled set restore without rebuilding card contents', () => {
  const saved = { version: 1, order: [...IDS].reverse(), enabled: ['stolen', 'progress'] };
  const instance = mount(storage(JSON.stringify(saved)));
  assert.deepEqual(instance.layout.getConfig(), saved);
  assert.deepEqual(instance.grid.children.map((node) => node.dataset.homeModule), saved.order);
  for (const node of instance.grid.children) {
    assert.equal(node, instance.nodes.get(node.dataset.homeModule));
    assert.equal(node.children[0].value, `${node.dataset.homeModule} uncommitted draft`);
    assert.equal(node.hidden, !saved.enabled.includes(node.dataset.homeModule));
  }
  assert.equal(instance.storage.writes.length, 0);
});

const invalidRecords = [
  '{broken', 'null', JSON.stringify([]),
  JSON.stringify({ ...DEFAULT, version: 2 }),
  JSON.stringify({ ...DEFAULT, order: IDS.slice(0, 8) }),
  JSON.stringify({ ...DEFAULT, order: ['unknown', ...IDS.slice(1)] }),
  JSON.stringify({ ...DEFAULT, order: ['progress', ...IDS.slice(0, 8)] }),
  JSON.stringify({ ...DEFAULT, enabled: ['unknown'] }),
  JSON.stringify({ ...DEFAULT, enabled: ['income', 'income'] }),
  JSON.stringify({ ...DEFAULT, enabled: 'income' }),
];
for (const raw of invalidRecords) {
  test(`invalid layout is preserved and defaults are not written: ${raw.slice(0, 40)}`, () => {
    const target = storage(raw);
    const instance = mount(target);
    assert.deepEqual(instance.layout.getConfig(), DEFAULT);
    assert.equal(target.values.get(KEY), raw);
    assert.equal(target.writes.length, 0);
    assert.match(instance.status().textContent, /默认布局/);
    assert.equal(instance.layout.retrySave(), false);
    assert.equal(target.writes.length, 0);
    instance.toggle('progress', false);
    assert.equal(target.writes.length, 1);
    assert.ok(!JSON.parse(target.values.get(KEY)).enabled.includes('progress'));
  });
}

test('all modules may be disabled and reopening preserves the empty selection', () => {
  const instance = mount();
  for (const id of IDS.slice(0, 5)) instance.toggle(id, false);
  assert.deepEqual(instance.layout.getConfig().enabled, []);
  assert.ok(instance.grid.children.every((node) => node.hidden));
  assert.deepEqual(instance.changes.at(-1).enabled, []);
  const restarted = mount(instance.storage);
  assert.deepEqual(restarted.layout.getConfig().enabled, []);
  assert.ok(restarted.grid.children.every((node) => node.hidden));
});

test('moving a row moves whole existing cards and retains the clicked button focus at the edge', () => {
  const instance = mount();
  const card = instance.nodes.get('next-task');
  const draft = card.children[0];
  const button = instance.move('next-task', 'up');
  button.focus();
  button.click();
  assert.equal(instance.grid.children[0], card);
  assert.equal(card.children[0], draft);
  assert.equal(instance.document.activeElement, button);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(button.disabled, false);
  const writes = instance.storage.writes.length;
  button.click();
  assert.equal(instance.storage.writes.length, writes);
  assert.equal(instance.document.activeElement, button);
  const last = instance.move('clock', 'down');
  last.click();
  assert.equal(instance.grid.children.at(-1), instance.nodes.get('clock'));
  assert.equal(instance.document.activeElement, last);
  assert.equal(last.getAttribute('aria-disabled'), 'true');
});

test('saving touches only the home key and survives restart with reordered settings', () => {
  const instance = mount();
  instance.toggle('income', true);
  instance.move('income', 'up').click();
  const saved = instance.layout.getConfig();
  assert.ok(instance.storage.writes.every(([key]) => key === KEY));
  assert.equal(instance.storage.values.get('work-todolist-generic-v1'), 'task snapshot');
  assert.equal(instance.storage.values.get('niuma-calculator.settings.v4'), 'wage snapshot');
  const restarted = mount(instance.storage);
  assert.deepEqual(restarted.layout.getConfig(), saved);
  assert.deepEqual(restarted.grid.children.map((node) => node.dataset.homeModule), saved.order);
  const detached = restarted.layout.getConfig();
  detached.order.reverse();
  detached.enabled.length = 0;
  assert.deepEqual(restarted.layout.getConfig(), saved);
});

test('reset defaults is an explicit save action', () => {
  const instance = mount(storage(JSON.stringify({ version: 1, order: [...IDS].reverse(), enabled: [] })));
  assert.deepEqual(instance.layout.resetDefaults(), DEFAULT);
  assert.deepEqual(JSON.parse(instance.storage.values.get(KEY)), DEFAULT);
  assert.deepEqual(instance.grid.children.map((node) => node.dataset.homeModule), IDS);
});

test('write failure applies the in-memory layout, retains old data and retries the latest configuration', () => {
  const previous = JSON.stringify(DEFAULT);
  const target = storage(previous);
  target.denyWrite = true;
  const instance = mount(target);
  instance.toggle('income', true);
  instance.move('income', 'up').click();
  assert.equal(target.values.get(KEY), previous);
  assert.equal(instance.nodes.get('income').hidden, false);
  assert.match(instance.status().textContent, /未保存/);
  assert.equal(instance.changes.at(-1).saved, false);
  assert.equal(find(instance.settings, (node) => node.dataset.homeRetry === 'true').hidden, false);
  target.denyWrite = false;
  assert.equal(instance.layout.retrySave(), true);
  assert.deepEqual(JSON.parse(target.values.get(KEY)), instance.layout.getConfig());
  assert.equal(instance.changes.at(-1).saved, true);
  assert.equal(find(instance.settings, (node) => node.dataset.homeRetry === 'true').hidden, true);
});

test('read denial uses defaults without an automatic write and later user edits can save', () => {
  const target = storage(JSON.stringify({ version: 1, order: [...IDS].reverse(), enabled: [] }));
  target.denyRead = true;
  const instance = mount(target);
  assert.deepEqual(instance.layout.getConfig(), DEFAULT);
  assert.equal(target.writes.length, 0);
  assert.match(instance.status().textContent, /无法读取/);
  target.denyRead = false;
  instance.toggle('income', true);
  assert.ok(JSON.parse(target.values.get(KEY)).enabled.includes('income'));
});

test('denial of the global storage getter is contained inside layout initialization', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Denied getter'); } });
    const instance = mount(null, true);
    assert.deepEqual(instance.layout.getConfig(), DEFAULT);
    assert.match(instance.status().textContent, /无法读取/);
    instance.toggle('income', true);
    assert.equal(instance.nodes.get('income').hidden, false);
    assert.match(instance.status().textContent, /未保存/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
