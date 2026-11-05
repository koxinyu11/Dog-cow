import type { net as ElectronNet } from 'electron';

/** Keep Chromium's proxy support while exposing manual redirects like Node fetch.
 * Electron net.fetch cancels manual redirects; net.request exposes the redirect event.
 * The updater, not this adapter, decides whether the next host is trusted.
 */
export function createUpdateFetch(network: Pick<typeof ElectronNet, 'fetch' | 'request'>): typeof fetch {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (init.redirect !== 'manual') return network.fetch(url, init);
    if (init.method && init.method !== 'GET') throw Error('Update transport only accepts GET');
    return new Promise<Response>((resolve, reject) => {
      const request = network.request({ url, method: 'GET', redirect: 'manual' });
      let body: ReadableStreamDefaultController<Uint8Array> | undefined;
      let settled = false;
      let finished = false;
      const cleanup = () => init.signal?.removeEventListener('abort', aborted);
      const stop = (error?: unknown) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (error) {
          if (!settled) reject(error);
          else body?.error(error);
        }
        request.abort();
      };
      const aborted = () => stop(init.signal?.reason ?? Error('Update download aborted'));
      request.on('error', error => stop(error));
      // Chromium may emit close before delivering a manual redirect. Errors,
      // response aborts and the caller's signal define failure, not request close.
      request.on('abort', () => { if (!finished) stop(Error('Update request aborted')); });
      request.on('redirect', (status, _method, location) => {
        if (finished) return;
        settled = true;
        resolve(new Response(null, { status, headers: { location } }));
        // Do not follow here: ReleaseUpdater validates each hop before issuing another request.
        stop();
      });
      request.on('response', response => {
        if (finished) return;
        const headers = new Headers();
        for (const [name, values] of Object.entries(response.headers)) {
          for (const value of Array.isArray(values) ? values : [values]) headers.append(name, value);
        }
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            body = controller;
            response.on('end', () => {
              if (finished) return;
              finished = true;
              cleanup();
              controller.close();
            });
            response.on('error', error => stop(error));
            response.on('aborted', () => stop(Error('Update response interrupted')));
            response.on('data', chunk => {
              if (finished) return;
              // IncomingMessage has no public pause API. Bound disk-backlog memory explicitly.
              if ((controller.desiredSize ?? 0) < chunk.byteLength) { stop(Error('Update download buffer limit exceeded')); return; }
              controller.enqueue(new Uint8Array(chunk));
            });
          },
          cancel() { stop(); },
        }, { highWaterMark: 8 * 1024 * 1024, size: chunk => chunk.byteLength });
        settled = true;
        resolve(new Response(stream, { status: response.statusCode, headers }));
      });
      const headers = new Headers(init.headers);
      headers.forEach((value, name) => request.setHeader(name, value));
      init.signal?.addEventListener('abort', aborted, { once: true });
      if (init.signal?.aborted) aborted();
      else request.end();
    });
  };
}
