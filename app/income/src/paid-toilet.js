/** Independent activity facts. Salary and attendance remain owned by the income engine. */
export const TOILET_KEY = 'dogcow.paid-toilet.v1';
export const ACTIVITY_KINDS = ['toilet', 'smoking', 'coffee'];
const timestamp = value => Number.isFinite(value) && Number.isFinite(new Date(value).getTime());
const reasons = ['manual', 'lunch', 'offwork', 'schedule-end', 'review'];
const interruptions = ['sleep', 'restart', 'cross-day', 'clock-change'];
export function validateToilet(value) {
  if (!value || ![1, 2].includes(value.version) || !Array.isArray(value.records)) throw new Error('带薪拉屎记录格式无效。');
  const ids = new Set();
  const active = new Set();
  for (const item of value.records) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)
      || (value.version === 2 && !ACTIVITY_KINDS.includes(item.kind))
      || !timestamp(item.startAt) || !['running', 'needs-review', 'completed'].includes(item.status)
      || (item.endReason !== undefined && !reasons.includes(item.endReason))
      || (item.interruption !== undefined && !interruptions.includes(item.interruption))) throw new Error('带薪拉屎记录无效或重复。');
    ids.add(item.id);
    if (item.status === 'completed') {
      if (!timestamp(item.endAt) || item.endAt < item.startAt) throw new Error('带薪拉屎结束时间无效。');
    } else {
      const kind = value.version === 1 ? 'toilet' : item.kind;
      if (item.endAt !== null || active.has(kind)) throw new Error('同类活动存在多个未完成记录。');
      active.add(kind);
    }
  }
  if (value.legacyBackup !== undefined && typeof value.legacyBackup !== 'string') throw new Error('活动备份格式无效。');
  return { version: 2, records: value.records.map(item => ({ ...structuredClone(item), kind: value.version === 1 ? 'toilet' : item.kind })),
    ...(value.version === 1 ? { legacyBackup: JSON.stringify(value) } : value.legacyBackup === undefined ? {} : { legacyBackup: value.legacyBackup }) };
}
export function loadToilet(storage) {
  try {
    const raw = storage?.getItem(TOILET_KEY);
    const data = raw == null ? { version: 2, records: [] } : validateToilet(JSON.parse(raw));
    if (raw != null && JSON.parse(raw).version === 1) data.legacyBackup = raw;
    const restored = reviewToilet(data, 'restart');
    return { ...restored, changed: restored.changed || (raw != null && JSON.parse(raw).version === 1), error: '' };
  } catch {
    return { data: { version: 2, records: [] }, changed: false, error: '带薪拉屎记录读取失败，请先导出备份；原数据未覆盖。' };
  }
}
export function reviewToilet(data, reason) {
  data = validateToilet(data);
  let changed = false;
  const records = data.records.map(item => {
    if (item.status !== 'running') return item;
    changed = true;
    return { ...item, status: 'needs-review', interruption: reason };
  });
  return { data: { ...data, version: 2, records }, changed };
}
export function endToilet(data, at, reason) {
  data = validateToilet(data);
  return { ...data, version: 2, records: data.records.map(item => item.status !== 'running' ? item
    : at <= item.startAt ? { ...item, status: 'needs-review', interruption: 'clock-change' }
      : { ...item, status: 'completed', endAt: at, endReason: reason }) };
}
export function changeToilet(data, input, at, available, makeId) {
  const fail = (errorCode, message) => ({ ok: false, errorCode, message });
  data = validateToilet(data);
  const kind = input.kind ?? 'toilet';
  if (!ACTIVITY_KINDS.includes(kind)) return fail('TOILET_KIND_INVALID', '活动类型无效，请重新选择。');
  const active = data.records.find(item => item.kind === kind && item.status !== 'completed');
  if (input.action === 'start') {
    if (active) return fail(active.status === 'needs-review' ? 'TOILET_REVIEW_REQUIRED' : 'TOILET_CONFLICT', '请先结束或核对上次记录。');
    if (available) return fail('TOILET_NOT_AVAILABLE', available);
    return { ok: true, data: { ...data, version: 2, records: [...data.records, { id: makeId(), kind, startAt: at, endAt: null, status: 'running' }] } };
  }
  const item = data.records.find(record => record.id === input.recordId);
  if (!item) return fail('TOILET_CONFLICT', '记录已变化，请重新核对。');
  if (['cancel', 'remove'].includes(input.action)) {
    if ((input.action === 'cancel') !== (item.status !== 'completed')) return fail('TOILET_CONFLICT', '记录状态已变化，请重新核对。');
    return { ok: true, data: { ...data, version: 2, records: data.records.filter(record => record.id !== item.id) } };
  }
  if (!['end', 'review', 'editEnd'].includes(input.action)
    || (input.action === 'end' && item.status !== 'running')
    || (input.action === 'review' && item.status !== 'needs-review')
    || (input.action === 'editEnd' && item.status !== 'completed')) return fail('TOILET_CONFLICT', '记录状态已变化，请重新核对。');
  const endAt = input.action === 'end' ? at : input.endAt;
  if (!timestamp(endAt) || endAt < item.startAt || endAt > at) return fail('TOILET_TIME_INVALID', '结束时间需在开始时间与现在之间。');
  return { ok: true, data: { ...data, version: 2, records: data.records.map(record => record.id === item.id
    ? { ...record, endAt, status: 'completed', endReason: input.action === 'end' ? 'manual' : 'review' } : record) } };
}
