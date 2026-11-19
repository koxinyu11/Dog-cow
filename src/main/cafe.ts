import { serviceTimeline } from '../shared/cafe/service.js';
import { CAFE_KEY } from '../shared/cafe/content.js';
import { applyCafeAction } from '../shared/cafe/commands.js';
import { CafeError, parseCafe, refuse } from '../shared/cafe/state.js';
import type { CafeRequest } from '../shared/cafe/types.js';
export { CafeError } from '../shared/cafe/state.js';

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
/** Mutations are called only from the host's serialized command queue. */
export class Cafe {
  private pending = false;
  constructor(
    private store: Store,
    private seed: number,
  ) {}
  private read() {
    return parseCafe(this.store.getItem(CAFE_KEY), this.seed);
  }
  view() {
    const state = this.read();
    return { state, pending: this.pending, timeline: serviceTimeline(state) };
  }
  confirmSaved() {
    this.pending = false;
  }
  execute(request: CafeRequest) {
    if (!request || typeof request !== 'object' || typeof request.action !== 'string')
      refuse('操作参数无效。');
    if (request.action === 'view') return;
    if (this.pending) throw new CafeError('CAFE_SAVE_FAILED', '上次操作尚未保存，请先重试保存。');
    if (typeof request.requestId !== 'string' || !request.requestId || request.requestId.length > 100)
      refuse('操作编号无效。');
    const previous = this.read();
    if (previous.requests.includes(request.requestId)) return;
    if (request.revision !== previous.revision)
      throw new CafeError('CAFE_STALE', '店铺记录已更新，请重新载入后操作。');
    const next = applyCafeAction(previous, request);
    next.revision++;
    next.requests = [...previous.requests, request.requestId].slice(-128);
    const raw = JSON.stringify(next);
    parseCafe(raw); // Never commit a state that cannot be reloaded.
    this.store.setItem(CAFE_KEY, raw);
    this.pending = true;
  }
}
