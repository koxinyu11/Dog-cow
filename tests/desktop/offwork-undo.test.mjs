import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptIsCurrent } from '../../dist-electron/src/shared/offwork.js';
const income = clockOut => ({ attendance: { days: [{ date: '2026-11-09', clockOut }] } });
test('小票必须匹配当前下班事实，撤回或改时后立即失效', () => {
  const original = income({ at: 100, updatedAt: 200 });
  assert.equal(receiptIsCurrent(original, '2026-11-09', structuredClone(original)), true);
  assert.equal(receiptIsCurrent(original, '2026-11-09', income(null)), false);
  assert.equal(receiptIsCurrent(original, '2026-11-09', income({ at: 100, updatedAt: 201 })), false);
  assert.equal(receiptIsCurrent(original, '2026-11-08', original), false);
});
