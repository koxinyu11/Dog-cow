import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createUpdateFetch } from '../../dist-electron/src/main/update-transport.js';

function fixture(start) {
  const request = new EventEmitter();
  request.setHeader = () => {};
  request.abort = () => { request.aborted = true; request.emit('close'); };
  request.end = () => queueMicrotask(() => start(request));
  const network = { fetch: async () => { throw Error('Redirect was cancelled'); }, request: () => request };
  return { request, fetch: createUpdateFetch(network) };
}
test('Electron manual redirects become inspectable responses without following them', async () => {
  const f = fixture(request => { request.emit('close'); request.emit('redirect', 302, 'GET', 'https://release-assets.githubusercontent.com/file'); });
  const response = await f.fetch('https://github.com/file', { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://release-assets.githubusercontent.com/file');
  assert.equal(f.request.aborted, true);
});
test('native response events stream into a readable body and retain status', async () => {
  const f = fixture(request => {
    const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: { 'content-type': 'application/octet-stream' } });
    request.emit('response', response);
    response.emit('data', Buffer.from('first'));
    response.emit('data', Buffer.from('second'));
    response.emit('end');
    request.emit('close');
  });
  const response = await f.fetch('https://release-assets.githubusercontent.com/file', { redirect: 'manual' });
  assert.equal(await response.text(), 'firstsecond');
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
});
test('abort, cancellation and pre-response errors terminate the native request', async () => {
  const abort = new AbortController();
  const f = fixture(() => {});
  const response = f.fetch('https://github.com/file', { redirect: 'manual', signal: abort.signal });
  abort.abort(); await assert.rejects(response); assert.equal(f.request.aborted, true);
  const closed = fixture(request => request.emit('error', Error('connection failed')));
  await assert.rejects(closed.fetch('https://github.com/file', { redirect: 'manual' }), /connection failed/);
  const cancelled = fixture(request => request.emit('response', Object.assign(new EventEmitter(), { statusCode: 200, headers: {} })));
  await (await cancelled.fetch('https://github.com/file', { redirect: 'manual' })).body.cancel();
  assert.equal(cancelled.request.aborted, true);
});
test('native response errors propagate and buffered data stays bounded', async () => {
  for (const event of ['error', 'aborted', 'overflow']) {
    const f = fixture(request => {
      const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: {} });
      request.emit('response', response);
      if (event === 'overflow') response.emit('data', Buffer.alloc(9 * 1024 * 1024));
      else response.emit(event, Error('connection failed'));
    });
    const response = await f.fetch('https://github.com/file', { redirect: 'manual' });
    await assert.rejects(response.arrayBuffer());
    assert.equal(f.request.aborted, true);
  }
});
