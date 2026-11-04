import { useSyncExternalStore } from 'react';
import type { Domain, Fields, Method, Result, Snapshot } from '../shared/contracts';
let current: Snapshot | null = null;
const listeners = new Set<() => void>();
let pending: Promise<unknown> = Promise.resolve();
const queues: Record<Domain, Promise<unknown>> = {
  tasks: Promise.resolve(),
  income: Promise.resolve(),
  home: Promise.resolve(),
};
function receive(value: Snapshot) {
  if (!current || value.sequence > current.sequence) {
    current = value;
    for (const listener of listeners) listener();
  }
}
let installed = false;
export async function boot() {
  if (!installed) {
    installed = true;
    window.dogcow.subscribe(receive);
    window.dogcow.beforeQuit((nonce) => {
      void flushDrafts().then((ok) => window.dogcow.invoke('quit', { nonce, ready: ok }));
    });
  }
  const result = await window.dogcow.invoke('bootstrap');
  if (!result.snapshot) throw Error('本机服务未返回启动数据。');
  receive(result.snapshot);
}
export function useAppState() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => current,
  );
}
export function command(method: Method, payload: Fields = {}, domain?: Domain): Promise<Result> {
  const send = async () => {
    const result = await window.dogcow.invoke(method, {
      ...payload,
      requestId: crypto.randomUUID(),
      ...(domain && current ? { expectedRevision: current.revisions[domain] } : {}),
    });
    if (result.snapshot) receive(result.snapshot);
    return result;
  };
  if (domain) {
    const next = queues[domain].then(send, send);
    queues[domain] = next;
    return next;
  }
  const next = pending.then(send, send);
  pending = next;
  return next;
}
const flushers = new Set<() => Promise<unknown>>();
export function registerFlush(callback: () => Promise<unknown>) {
  flushers.add(callback);
  return () => {
    flushers.delete(callback);
  };
}
export async function flushDrafts() {
  window.dispatchEvent(new Event('dogcow:flush'));
  const outcomes = await Promise.all([...flushers].map((flush) => flush()));
  await Promise.all(Object.values(queues));
  return outcomes.every((value) => value !== false);
}
