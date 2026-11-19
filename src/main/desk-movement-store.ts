import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { defaultDeskPlan, localMovementDate, movementKcal, validDeskPlan, validDeskRecord, validMovementWeight, type DeskMovementData, type DeskPlan, type DeskRecord, type DeskSegment } from '../shared/desk-movement.js';

export class DeskMovementStore {
  private plan = defaultDeskPlan;
  private weightKg?: number;
  private records: DeskRecord[] = [];
  private lastReminder = '';
  private retryAt = 0;
  private failedRead = false;
  due = false;

  constructor(private readonly file: string) {}

  async load() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (!validDeskPlan(data.plan) || !Array.isArray(data.records) || typeof data.lastReminder !== 'string' ||
        !data.records.every(validDeskRecord) || (data.weightKg !== undefined && !validMovementWeight(data.weightKg))) {
        throw Error('Invalid desk movement file');
      }
      this.plan = data.plan;
      this.weightKg = data.weightKg;
      this.records = data.records;
      this.lastReminder = data.lastReminder;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.failedRead = true;
        console.error('[desk-movement:load]', error instanceof Error ? error.name : 'unknown');
      }
    }
  }

  view(): DeskMovementData {
    if (this.failedRead) throw Error('活动数据暂不可读，原文件已保留。');
    return { plan: this.plan, records: this.records, due: this.due, weightKg: this.weightKg };
  }

  private async save(plan: DeskPlan, records: DeskRecord[], lastReminder: string, weightKg: number | undefined) {
    if (this.failedRead) throw Error('活动数据暂不可读，原文件已保留。');
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = this.file + '.tmp';
    await writeFile(temporary, JSON.stringify({ plan, records, lastReminder, weightKg }), 'utf8');
    await rename(temporary, this.file);
    this.plan = plan;
    this.records = records;
    this.lastReminder = lastReminder;
    this.weightKg = weightKg;
  }

  async setPlan(plan: DeskPlan) {
    const changedSchedule = plan.time !== this.plan.time || plan.reminder !== this.plan.reminder ||
      plan.days.join(',') !== this.plan.days.join(',');
    await this.save(plan, this.records, changedSchedule ? '' : this.lastReminder, this.weightKg);
    if (changedSchedule) { this.due = false; this.retryAt = 0; }
  }

  async setWeight(weightKg: number | undefined) {
    await this.save(this.plan, this.records, this.lastReminder, weightKg);
  }

  async record(id: string, segments: DeskSegment[], weightKg?: number) {
    if (this.records.some(record => record.id === id)) return;
    const seconds = Math.floor(segments.reduce((total, item) => total + item.milliseconds, 0) / 1000);
    const kcal = weightKg === undefined ? undefined : movementKcal(segments, weightKg);
    await this.save(this.plan, [...this.records, { id, seconds, date: localMovementDate(new Date()), segments, kcal }], this.lastReminder, this.weightKg);
  }

  async tick(now: Date) {
    if (this.failedRead || !this.plan.reminder || this.due) return false;
    const date = localMovementDate(now);
    if (this.retryAt) {
      if (now.getTime() < this.retryAt) return false;
      this.retryAt = 0;
    } else {
      const clock = [now.getHours(), now.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
      if (this.lastReminder === date || !this.plan.days.includes(now.getDay()) || this.plan.time !== clock) return false;
      await this.save(this.plan, this.records, date, this.weightKg);
    }
    this.due = true;
    return true;
  }

  dismiss(snooze: boolean) {
    if (!this.due) return;
    this.due = false;
    this.retryAt = snooze ? Date.now() + 600_000 : 0;
  }
}
