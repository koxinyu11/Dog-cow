import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createUpdateFetch } from '../../dist-electron/src/main/update-transport.js';

function fixture(start, finalFetch = async () => { throw Error('Redirect was cancelled'); }) {
  const request = new EventEmitter();
  request.setHeader = () => {};
  request.abort = () => { request.aborted = true; request.emit('close'); };
  request.end = () => queueMicrotask(() => start(request));
  const network = { fetch: finalFetch, request: () => request };
  return { request, fetch: createUpdateFetch(network) };
}
test('Electron manual redirects become inspectable responses without following them', async () => {
  const f = fixture(request => { request.emit('close'); request.emit('redirect', 302, 'GET', 'https://release-assets.githubusercontent.com/file'); });
  const response = await f.fetch('https://github.com/file', { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://release-assets.githubusercontent.com/file');
  assert.equal(f.request.aborted, true);
});
test('final response is read by Chromium fetch with redirects forbidden, including slow consumers', async () => {
  let finalInit;
  const content = Buffer.alloc(9 * 1024 * 1024, 7);
  const f = fixture(request => {
    request.emit('response', Object.assign(new EventEmitter(), { statusCode: 200, headers: {} }));
  }, async (url, init) => { finalInit = init; return new Response(content); });
  const response = await f.fetch('https://release-assets.githubusercontent.com/file', { redirect: 'manual' });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
  assert.equal(finalInit.redirect, 'error');
  assert.equal(f.request.aborted, true);
});
test('abort and pre-response errors terminate the native probe', async () => {
  const abort = new AbortController();
  const f = fixture(() => {});
  const response = f.fetch('https://github.com/file', { redirect: 'manual', signal: abort.signal });
  abort.abort(); await assert.rejects(response); assert.equal(f.request.aborted, true);
  const failed = fixture(request => request.emit('error', Error('connection failed')));
  await assert.rejects(failed.fetch('https://github.com/file', { redirect: 'manual' }), /connection failed/);
});
test('final fetch keeps caller cancellation and propagates body errors', async () => {
  const abort = new AbortController();
  const f = fixture(request => request.emit('response', new EventEmitter()), async (_url, init) => {
    assert.equal(init.signal, abort.signal);
    return new Response(new ReadableStream({ start(controller) {
      init.signal.addEventListener('abort', () => controller.error(init.signal.reason));
    } }));
  });
  const response = await f.fetch('https://github.com/file', { redirect: 'manual', signal: abort.signal });
  abort.abort();
  await assert.rejects(response.arrayBuffer());
});
