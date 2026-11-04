import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { collectLegacy, createTransfer, parseTransfer, beginRestore, finishRestore, validateLegacy, RESTORE_KEY } from '../../src/migration/transfer.js';
const storage = () => {
  const map = new Map();
  let failAt = null;
  return { map, get length() { return map.size; }, key: i => [...map.keys()][i], getItem: key => map.get(key) ?? null, setItem(key, value) { if (key === failAt) throw new Error('disk full'); map.set(key, value); }, removeItem: key => map.delete(key), fail(key) { failAt = key; } };
};
test('export keeps raw extension fields and selects only known application keys', async () => {
  const s = storage();
  const raw = JSON.stringify({ tasks: [{ id: 'a', date: '2026-11-04', title: 'synthetic', extension: { x: 1 } }] });
  s.setItem('work-todolist-generic-v1', raw);
  s.setItem('unrelated-secret', 'excluded');
  const pack = await createTransfer(s, { engine: 'wkwebview', appVersion: '2.8.0' }, new Date('2026-11-04T00:00:00Z'), webcrypto);
  const result = await parseTransfer(JSON.stringify(pack), webcrypto);
  assert.equal(result.preview.counts.tasks, 1);
  assert.equal(result.pack.values['work-todolist-generic-v1'], raw);
  assert.equal(Object.hasOwn(result.pack.values, 'unrelated-secret'), false);
});
test('corrupted checksum and invalid high version never mutate source', async () => {
  const s = storage();
  const pack = await createTransfer(s, {}, new Date(), webcrypto);
  await assert.rejects(parseTransfer(JSON.stringify({ ...pack, exportedAt: 1 }), webcrypto), /校验失败/);
  s.setItem('niuma-calculator.settings.v4', '{');
  const bad = await createTransfer(s, {}, new Date(), webcrypto);
  await assert.rejects(parseTransfer(JSON.stringify(bad), webcrypto));
  assert.equal(s.getItem('niuma-calculator.settings.v4'), '{');
});
test('interrupted multikey restore retains journal and supports explicit rollback', () => {
  const target = storage();
  target.setItem('work-todolist-generic-v1', JSON.stringify({ tasks: [] }));
  const values = collectLegacy(storage());
  target.fail('dogcow.home.v1');
  // null writes remove rather than set; fail on the journal first to prove no mutation.
  target.fail(RESTORE_KEY);
  assert.throws(() => beginRestore(target, values));
  assert.equal(target.getItem('work-todolist-generic-v1'), '{"tasks":[]}');
  target.fail(null);
  const before = { ...values, 'work-todolist-generic-v1': '{"tasks":[]}' };
  target.setItem(RESTORE_KEY, JSON.stringify({ version: 1, before, target: values }));
  target.removeItem('work-todolist-generic-v1');
  finishRestore(target, 'before');
  assert.equal(target.getItem('work-todolist-generic-v1'), '{"tasks":[]}');
  assert.equal(target.getItem(RESTORE_KEY), null);
});

for (const date of ['0000-11-04', '0099-11-04', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01']) {
  test(`legacy-compatible date validation rejects ${date}`, () => {
    const values = collectLegacy(storage());
    values['work-todolist-generic-v1'] = JSON.stringify({ tasks: [{ id: 'synthetic', date, title: 'synthetic' }] });
    assert.throws(() => validateLegacy(values), /任务记录无效/);
  });
}
for (const date of ['2024-02-29', '2026-11-04']) {
  test(`legacy-compatible date validation accepts ${date}`, () => {
    const values = collectLegacy(storage());
    values['work-todolist-generic-v1'] = JSON.stringify({ tasks: [{ id: 'synthetic', date, title: 'synthetic' }] });
    assert.equal(validateLegacy(values).counts.tasks, 1);
  });
}
