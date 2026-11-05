import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { methods } from '../../dist-electron/src/shared/contracts.js';
import { toiletRecordOnDate, shouldCelebrateToilet } from '../../dist-electron/src/shared/toilet.js';

test('sandbox preload forwards every registered command and rejects unknown IPC channels', async () => {
  const source = await readFile(new URL('../../dist-electron/src/preload/index.cjs', import.meta.url), 'utf8');
  let bridge;
  const sent = [];
  runInNewContext(source, {
    exports: {},
    require(name) {
      assert.equal(name, 'electron');
      return {
        contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'dogcow'); bridge = value; } },
        ipcRenderer: { invoke: async (channel, payload) => { sent.push([channel, payload]); return { applied: true, persisted: true }; } },
      };
    },
  });
  for (const method of methods) await bridge.invoke(method, { synthetic: true });
  assert.deepEqual(sent.map(([channel]) => channel), methods.map(method => `dogcow:${method}`));
  const payload = { action: 'start', requestId: 'synthetic', expectedRevision: 7 };
  await bridge.invoke('toilet', payload);
  assert.equal(sent.at(-1)[1], payload);
  await assert.rejects(bridge.invoke('arbitrary-shell'), /不允许/);
  assert.equal(sent.length, methods.length + 1);
});

test('midnight belongs to the next record, not to the preceding completed interval', () => {
  const midnight = +new Date(2026, 10, 5);
  const record = { id: 'synthetic', startAt: midnight - 60_000, endAt: midnight, status: 'completed' };
  assert.equal(toiletRecordOnDate(record, '2026-11-04', midnight), true);
  assert.equal(toiletRecordOnDate(record, '2026-11-05', midnight), false);
  assert.equal(toiletRecordOnDate({ ...record, startAt: midnight }, '2026-11-05', midnight), true);
  assert.equal(toiletRecordOnDate({ ...record, startAt: midnight, endAt: null, status: 'needs-review' }, '2026-11-05', midnight), true);
});

test('only a successfully saved manual end with positive attributed time celebrates', () => {
  const result = { applied: true, persisted: true, snapshot: { income: {
    toilet: { records: [{ id: 'a', status: 'completed', endReason: 'manual' }] },
    snapshot: { toiletDetails: [{ id: 'a', addedSeconds: 8 }] },
  } } };
  assert.equal(shouldCelebrateToilet(result, 'a'), true);
  assert.equal(shouldCelebrateToilet({ ...result, persisted: false }, 'a'), false);
  assert.equal(shouldCelebrateToilet(result, 'missing'), false);
  result.snapshot.income.snapshot.toiletDetails[0].addedSeconds = 0;
  assert.equal(shouldCelebrateToilet(result, 'a'), false);
  result.snapshot.income.snapshot.toiletDetails[0].addedSeconds = 8;
  for (const endReason of ['review', 'offwork', 'lunch', 'schedule-end']) {
    result.snapshot.income.toilet.records[0].endReason = endReason;
    assert.equal(shouldCelebrateToilet(result, 'a'), false);
  }
});
