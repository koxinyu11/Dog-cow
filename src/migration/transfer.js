import { loadSettings } from '../../app/income/src/storage.js';
import { HOME_MODULES } from '../../app/income/src/home-layout.js';

export const RESTORE_KEY = 'dogcow.migration.restore.v1';
export const MAX_TRANSFER_BYTES = 20 * 1024 * 1024;
const fixedKeys = ['work-todolist-generic-v1', 'dogcow.home.v1', ...[1, 2, 3, 4].map(v => `niuma-calculator.settings.v${v}`)];
export const allowedKey = key => fixedKeys.includes(key) || /^niuma-calculator\.holidays\.v1\.[1-9]\d{3}$/.test(key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  const pad = number => String(number).padStart(2, '0');
  return !Number.isNaN(parsed.getTime())
    && `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` === value;
};

export function collectLegacy(storage) {
  const values = Object.fromEntries(fixedKeys.map(key => [key, storage.getItem(key)]));
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (allowedKey(key) && !fixedKeys.includes(key)) values[key] = storage.getItem(key);
  }
  return values;
}

export function validateLegacy(values, now = new Date()) {
  if (!record(values) || Object.keys(values).some(key => !allowedKey(key) || (values[key] !== null && typeof values[key] !== 'string'))) fail('迁移键值格式无效。');
  for (const key of fixedKeys) if (!Object.hasOwn(values, key)) fail('迁移包缺少必要键。');
  const tasks = values[fixedKeys[0]] === null ? null : JSON.parse(values[fixedKeys[0]]);
  if (tasks !== null) {
    if (!record(tasks) || !Array.isArray(tasks.tasks)) fail('任务格式无效。');
    const ids = new Set();
    for (const task of tasks.tasks) {
      if (!record(task) || typeof task.id !== 'string' || !task.id || ids.has(task.id) || !validDate(task.date) || typeof task.title !== 'string' || (task.tags !== undefined && (!Array.isArray(task.tags) || task.tags.some(tag => !record(tag) || typeof tag.label !== 'string' || (tag.id !== undefined && typeof tag.id !== 'string'))))) fail('任务记录无效或重复。');
      ids.add(task.id);
    }
    if (tasks.seededWeeks !== undefined && (!Array.isArray(tasks.seededWeeks) || !tasks.seededWeeks.every(validDate))) fail('周记录无效。');
  }
  const income = loadSettings({ getItem: key => values[key] ?? null }, now);
  if (['invalid', 'unavailable'].includes(income.status)) fail('收入数据无效；没有退回较低版本。');
  let home = null;
  let layoutWarning = false;
  if (values[fixedKeys[1]] !== null) {
    try {
      home = JSON.parse(values[fixedKeys[1]]);
      const ids = HOME_MODULES.map(item => item.id);
      const uniqueKnown = list => Array.isArray(list) && new Set(list).size === list.length && list.every(id => ids.includes(id));
      if (!record(home) || home.version !== 1 || Object.keys(home).length !== 3 || !uniqueKnown(home.order) || home.order.length !== ids.length || !uniqueKnown(home.enabled)) throw new Error();
    } catch { home = null; layoutWarning = true; }
  }
  return { tasks, income, home, layoutWarning, counts: { tasks: tasks?.tasks.length ?? 0, leaves: income.leaves?.length ?? 0, attendanceDays: income.attendance?.days.length ?? 0 } };
}

const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
export async function digest(value, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) fail('当前环境无法生成完整性校验，请在原应用的受支持环境中重试。');
  const bytes = new TextEncoder().encode(canonical(value));
  return [...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function createTransfer(storage, source, now = new Date(), cryptoImpl) {
  const values = collectLegacy(storage);
  const content = { format: 'dogcow-transfer', version: 1, exportedAt: now.getTime(), source, values };
  return { ...content, digest: await digest(content, cryptoImpl) };
}
export async function parseTransfer(text, cryptoImpl, now = new Date()) {
  if (new TextEncoder().encode(text).byteLength > MAX_TRANSFER_BYTES) fail('迁移文件超过 20 MiB，未导入。');
  const pack = JSON.parse(text);
  if (!record(pack) || pack.format !== 'dogcow-transfer' || pack.version !== 1 || !Number.isFinite(pack.exportedAt) || !record(pack.source) || typeof pack.digest !== 'string') fail('迁移格式或版本无效。');
  const { digest: checksum, ...content } = pack;
  if (await digest(content, cryptoImpl) !== checksum) fail('迁移包完整性校验失败。');
  return { pack, preview: validateLegacy(pack.values, now) };
}

// The journal is written before the first target key; never resume ordinary writers
// until every target key has been checked and the journal removed.
export function beginRestore(storage, values) {
  validateLegacy(values);
  if (storage.getItem(RESTORE_KEY) !== null) fail('存在未完成恢复，请先处理。');
  const before = Object.fromEntries(Object.keys(values).map(key => [key, storage.getItem(key)]));
  storage.setItem(RESTORE_KEY, JSON.stringify({ version: 1, before, target: values }));
  finishRestore(storage, 'target');
}
export function finishRestore(storage, direction) {
  if (!['before', 'target'].includes(direction)) fail('恢复方向无效。');
  const journal = JSON.parse(storage.getItem(RESTORE_KEY) ?? 'null');
  if (!record(journal) || journal.version !== 1 || !record(journal.before) || !record(journal.target)) fail('恢复记录无效，请保留原始数据。');
  if (direction === 'target') validateLegacy(journal.target);
  const values = journal[direction];
  if (Object.keys(values).some(key => !allowedKey(key) || (values[key] !== null && typeof values[key] !== 'string'))) fail('恢复记录包含非法键值。');
  for (const [key, value] of Object.entries(values)) value === null ? storage.removeItem(key) : storage.setItem(key, value);
  for (const [key, value] of Object.entries(values)) if (storage.getItem(key) !== value) fail('恢复读回不匹配，恢复记录已保留。');
  storage.removeItem(RESTORE_KEY);
}
