import type { Result } from './contracts.js';

/** An acknowledgement belongs to the generation that was sent, not the next edit. */
export class DraftSession<T> {
  value: T;
  generation = 0;
  dirty = false;
  private pending = new Map<number, Promise<Result>>();
  constructor(value: T) {
    this.value = structuredClone(value);
  }
  edit(value: T) {
    this.generation++;
    this.value = structuredClone(value);
    this.dirty = true;
  }
  reset(value: T) {
    this.generation++;
    this.value = structuredClone(value);
    this.dirty = false;
  }
  restore(value: T) {
    if (this.dirty || this.pending.size) return false;
    this.value = structuredClone(value);
    return true;
  }
  async flush(
    submit: (value: T) => Promise<Result>,
    validate: (value: T) => Record<string, string>,
    report: (result: Result) => void,
  ): Promise<boolean> {
    if (!this.dirty) {
      await Promise.all(this.pending.values());
      return !this.dirty;
    }
    const generation = this.generation;
    let job = this.pending.get(generation);
    if (!job) {
      const candidate = structuredClone(this.value);
      const errors = validate(candidate);
      if (Object.keys(errors).length) {
        report({
          applied: false,
          persisted: false,
          errors,
          message: '输入尚未完成或无效，继续使用上次有效设置。',
        });
        return false;
      }
      job = Promise.resolve()
        .then(() => submit(candidate))
        .catch(() => ({
          applied: false,
          persisted: false,
          message: '无法连接本机保存服务，草稿保留，请重试。',
        }))
        .then((result) => {
          if (this.generation === generation) {
            if (result.applied) this.dirty = false;
            report(result);
          }
          return result;
        })
        .finally(() => {
          this.pending.delete(generation);
        });
      this.pending.set(generation, job);
    }
    await job;
    return !this.dirty;
  }
}
