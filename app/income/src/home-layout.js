export const HOME_MODULES = Object.freeze([
  { id: 'progress', title: '今日完成度', defaultEnabled: true },
  { id: 'next-task', title: '下一项任务', defaultEnabled: true },
  { id: 'tasks', title: '任务列表', defaultEnabled: true },
  { id: 'calendar', title: '月历', defaultEnabled: true },
  { id: 'week-summary', title: '本周概览', defaultEnabled: true },
  { id: 'income', title: '实时收入', defaultEnabled: false },
  { id: 'work-time', title: '工时与下班倒计时', defaultEnabled: false },
  { id: 'clock', title: '打卡操作', defaultEnabled: false },
  { id: 'stolen', title: '偷出金额', defaultEnabled: false },
].map((module) => Object.freeze(module)));

const STORAGE_KEY = 'dogcow.home.v1';
const MODULE_IDS = HOME_MODULES.map((module) => module.id);
const KNOWN_IDS = new Set(MODULE_IDS);

function defaults() {
  return {
    version: 1,
    order: [...MODULE_IDS],
    enabled: HOME_MODULES.filter((module) => module.defaultEnabled).map((module) => module.id),
  };
}

function validConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return false;
  if (Object.keys(value).length !== 3 || !Object.hasOwn(value, 'order') || !Object.hasOwn(value, 'enabled')) return false;
  if (!Array.isArray(value.order) || value.order.length !== MODULE_IDS.length || !Array.isArray(value.enabled)) return false;
  const validIds = (ids) => ids.every((id) => typeof id === 'string' && KNOWN_IDS.has(id))
    && new Set(ids).size === ids.length;
  return validIds(value.order) && validIds(value.enabled);
}

function copyConfig(config) {
  return { version: 1, order: [...config.order], enabled: [...config.enabled] };
}

// Only layout preferences are owned here. Widget contents and feature controllers stay intact.
export function createHomeLayout({ document, grid, settingsContainer, storage, onChange = () => {} }) {
  let config = defaults();
  let storageStatus = 'empty';
  let source = 'default';
  let pendingSave = false;
  const targetStorage = () => storage === undefined ? globalThis.localStorage : storage;
  try {
    const raw = targetStorage()?.getItem(STORAGE_KEY);
    if (raw === undefined) storageStatus = 'unavailable';
    else if (raw !== null) {
      let saved;
      try { saved = JSON.parse(raw); } catch { storageStatus = 'invalid'; }
      if (validConfig(saved)) {
        config = copyConfig(saved);
        storageStatus = 'loaded';
        source = 'storage';
      } else storageStatus = 'invalid';
    }
  } catch {
    // Preserve unreadable or malformed storage until the user explicitly changes the layout.
    storageStatus = 'unavailable';
  }

  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const list = element('ol', undefined, 'home-module-settings-list');
  const controls = new Map();
  const status = element('p', '', 'home-layout-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const actions = element('div', undefined, 'home-layout-actions');
  const reset = element('button', '恢复默认', 'btn ghost');
  reset.type = 'button';
  reset.dataset.homeReset = 'true';
  const retry = element('button', '重试保存', 'btn');
  retry.type = 'button';
  retry.dataset.homeRetry = 'true';
  retry.hidden = true;
  actions.append(reset, retry);
  settingsContainer.replaceChildren(
    element('p', '勾选显示模块，用上移、下移调整首页顺序。这里只改变显示布局，不改变工资、打卡或任务功能的设置。', 'help'),
    list, actions, status,
  );

  function notify() {
    onChange({
      ...copyConfig(config), source, storageStatus,
      saved: storageStatus === 'loaded' || storageStatus === 'saved',
    });
  }

  function renderStatus() {
    const messages = {
      empty: '模块设置将在修改后保存在本机。',
      loaded: '已恢复本机保存的首页模块设置。',
      invalid: '已保存的首页布局格式无效，暂用默认布局；原始数据未覆盖。调整模块或恢复默认后才会保存。',
      unavailable: '首页布局暂时无法读取，先使用默认布局；原始数据未覆盖。调整后可尝试保存。',
      saved: '首页模块设置已保存。',
      unsaved: '未保存：本机存储写入失败。当前布局已在窗口中生效，请勿关闭应用，可重试保存。',
    };
    status.textContent = messages[storageStatus];
    status.dataset.state = storageStatus;
    retry.hidden = !pendingSave;
  }

  function applyLayout() {
    const enabled = new Set(config.enabled);
    const nodes = new Map([...grid.children].map((node) => [node.dataset.homeModule, node]));
    for (const [index, id] of config.order.entries()) {
      const node = nodes.get(id);
      if (node) {
        node.hidden = !enabled.has(id);
        grid.append(node);
      }
      const row = controls.get(id);
      row.checkbox.checked = enabled.has(id);
      row.up.setAttribute('aria-disabled', String(index === 0));
      row.down.setAttribute('aria-disabled', String(index === config.order.length - 1));
      list.append(row.element);
    }
  }

  function saveCurrent() {
    if (!pendingSave) return storageStatus === 'loaded' || storageStatus === 'saved';
    try {
      const target = targetStorage();
      if (!target || typeof target.setItem !== 'function') throw new Error('Storage unavailable');
      target.setItem(STORAGE_KEY, JSON.stringify(copyConfig(config)));
      storageStatus = 'saved';
      pendingSave = false;
    } catch {
      storageStatus = 'unsaved';
    }
    renderStatus();
    notify();
    return !pendingSave;
  }

  function change(next, focusTarget) {
    config = next;
    source = 'change';
    pendingSave = true;
    applyLayout();
    saveCurrent();
    focusTarget?.focus();
  }

  for (const module of HOME_MODULES) {
    const row = element('li', undefined, 'home-module-option');
    row.dataset.homeSetting = module.id;
    const label = element('label', undefined, 'home-module-toggle');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.homeEnabled = module.id;
    checkbox.setAttribute('aria-label', `显示${module.title}`);
    label.append(checkbox, element('span', module.title));
    checkbox.addEventListener('change', () => {
      const enabled = new Set(config.enabled);
      if (checkbox.checked) enabled.add(module.id);
      else enabled.delete(module.id);
      change({ ...copyConfig(config), enabled: config.order.filter((id) => enabled.has(id)) }, checkbox);
    });
    const moves = element('div', undefined, 'home-module-moves');
    const buttons = {};
    for (const [direction, title, step] of [['up', '上移', -1], ['down', '下移', 1]]) {
      const button = element('button', title, 'btn ghost home-module-move');
      button.type = 'button';
      button.dataset.homeMove = direction;
      button.dataset.homeModule = module.id;
      button.setAttribute('aria-label', `${title}${module.title}`);
      button.addEventListener('click', () => {
        const index = config.order.indexOf(module.id);
        const nextIndex = index + step;
        if (nextIndex < 0 || nextIndex >= config.order.length) return;
        const order = [...config.order];
        [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
        // aria-disabled keeps the clicked control focusable even when its row reaches an edge.
        change({ ...copyConfig(config), order }, button);
      });
      moves.append(button);
      buttons[direction] = button;
    }
    row.append(label, moves);
    controls.set(module.id, { element: row, checkbox, ...buttons });
  }

  const resetDefaults = () => {
    change(defaults(), reset);
    return copyConfig(config);
  };
  reset.addEventListener('click', resetDefaults);
  retry.addEventListener('click', saveCurrent);
  applyLayout();
  renderStatus();
  notify();

  return {
    getConfig: () => copyConfig(config),
    resetDefaults,
    retrySave: saveCurrent,
  };
}
