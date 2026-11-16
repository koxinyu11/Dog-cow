import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { errorDetails, diagnosticText, parseDiagnosticReport } from '../../dist-electron/src/shared/playground-diagnostics.js';
import { PlaygroundDiagnostics } from '../../dist-electron/src/main/playground-diagnostics.js';
const context = { sessionId: randomUUID(), version: 'fixture', buildId: 'build-fixture' };
const report = (error = Error('fixture')) => ({ correlationId: randomUUID(), runId: randomUUID(), gameId: 'fixture', stage: 'render', errors: errorDetails(error) });
const temporary = async callback => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dogcow-diagnostic-unit-'));
  try { await callback(directory); } finally { await rm(directory, { recursive: true, force: true }); }
};
test('error chains, primitive throws, cycles and throwing getters are bounded without losing root cause', () => {
  assert.deepEqual(errorDetails(new Error('outer', { cause: new Error('root') })).map(e => e.message), ['outer', 'root']);
  assert.equal(errorDetails('literal failure')[0].message, 'literal failure');
  const cycle = Error('cycle'); cycle.cause = cycle; assert.equal(errorDetails(cycle).length, 1);
  const hostile = { get message() { throw Error('getter'); }, get cause() { return hostile; } };
  assert.equal(errorDetails(hostile).length, 1);
  let chain = Error('end'); for (let i = 0; i < 10; i++) chain = new Error('wrapper', { cause: chain });
  assert.equal(errorDetails(chain).length, 5);
});
test('diagnostics redact user paths, URL credentials/queries and tokens; retain filename and source offsets', () => {
  const clean = diagnosticText('at /Users/jason/private/app.ts:12:3 https://user:pass@example.com/a.js?token=secret#x token=abcd password=abcd');
  for (const secret of ['jason', 'user:pass', '?token', 'secret', 'abcd']) assert.equal(clean.includes(secret), false);
  assert.match(clean, /app.ts:12:3/);
  assert.equal(parseDiagnosticReport({ ...report(), gameId: '../outside' }), undefined);
  assert.equal(parseDiagnosticReport({ ...report(), stage: 'arbitrary' }), undefined);
});
test('same ID is persisted once and can be retrieved by a new service after window/process recreation', async () => temporary(async directory => {
  const store = new PlaygroundDiagnostics(directory); await store.load();
  const value = report(new Error('wrapper', { cause: Error('specific root') }));
  const receipts = await Promise.all([store.record(value, context), store.record(value, context)]);
  assert.equal(receipts.every(r => r.persisted), true);
  const file = path.join(directory, 'playground-diagnostics.jsonl');
  assert.equal((await readFile(file, 'utf8')).trim().split('\n').length, 1);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const restarted = new PlaygroundDiagnostics(directory); await restarted.load();
  const found = (await restarted.read(value.correlationId)).entries[0];
  assert.equal(found.errors.at(-1).message, 'specific root');
  assert.equal(found.buildId, context.buildId); assert.equal(found.sessionId, context.sessionId);
}));
test('disk failure retains memory evidence, warns, and can recover on a later record', async () => temporary(async directory => {
  const target = path.join(directory, 'blocked'); await writeFile(target, 'not a directory');
  const store = new PlaygroundDiagnostics(target); const first = report();
  const receipt = await store.record(first, context);
  assert.equal(receipt.persisted, false); assert.ok(receipt.warning);
  assert.ok(receipt.storageError?.[0].code);
  assert.ok((await store.read()).storageError?.[0].code);
  assert.equal((await store.read(first.correlationId)).entries.length, 1);
  await rm(target); await mkdir(target);
  assert.equal((await store.record(first, context)).persisted, true);
  const restored = new PlaygroundDiagnostics(target); await restored.load();
  assert.equal((await restored.read(first.correlationId)).entries.length, 1);
}));
test('logs rotate, retain bounded memory and can query older disk records by exact ID', async () => temporary(async directory => {
  const store = new PlaygroundDiagnostics(directory); const ids = [];
  for (let i = 0; i < 130; i++) {
    const value = report(Error('fixture')); value.errors[0].stack = 'x'.repeat(2400);
    ids.push(value.correlationId); await store.record(value, context);
  }
  assert.equal((await store.read()).entries.length, 50);
  assert.equal((await store.read(ids[0])).entries.length, 1);
  assert.ok((await readdir(directory)).includes('playground-diagnostics.jsonl.1'));
  const next = new PlaygroundDiagnostics(directory); await next.load();
  assert.equal((await next.read(ids[0])).entries.length, 1);
}));
