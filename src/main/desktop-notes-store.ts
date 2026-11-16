import { randomUUID } from 'node:crypto';
import type { Fields, Task } from '../shared/contracts.js';
import { DESKTOP_NOTES_KEY, emptyDesktopNotes, parseDesktopNotes, type DesktopNote, type DesktopNotesState, type DesktopNotesSummary } from '../shared/desktop-notes.js';
interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
/** Note membership is business data; tasks themselves remain in the existing task domain. */
export class DesktopNotesStore {
  private state = emptyDesktopNotes();
  private error = '';
  constructor(private storage: Storage) {}
  load() {
    try { this.state = parseDesktopNotes(this.storage.getItem(DESKTOP_NOTES_KEY)); this.error = ''; }
    catch { this.state = emptyDesktopNotes(); this.error = '便签记录读取失败，编辑已锁定；原始数据未覆盖。'; }
  }
  view(pending = false): DesktopNotesSummary { return { ...structuredClone(this.state), error: this.error, pending }; }
  get(id: string) { return this.state.notes.find(note => note.id === id); }
  private save(next: DesktopNotesState) {
    next.revision++;
    const checked = parseDesktopNotes(JSON.stringify(next));
    this.storage.setItem(DESKTOP_NOTES_KEY, JSON.stringify(checked));
    this.state = checked;
  }
  execute(payload: Fields, tasks: Task[]): string | undefined {
    if (this.error) throw Error(this.error);
    if (payload.expectedNotesRevision !== this.state.revision) throw Error('便签内容已变化，请刷新后再操作。');
    const next = structuredClone(this.state);
    const action = String(payload.action);
    const ids = () => {
      const value = payload.taskIds;
      if (!Array.isArray(value) || !value.length || value.length > 200 || value.some(id => typeof id !== 'string' || !tasks.some(task => task.id === id)) || new Set(value).size !== value.length) throw Error('请选择仍存在的任务，每张最多 200 项。');
      return value as string[];
    };
    let note = next.notes.find(note => note.id === payload.id);
    if (action === 'pin' || action === 'create') {
      next.lineVisible = true;
      const taskIds = ids();
      const kind = action === 'pin' ? 'single' : 'list';
      if (kind === 'single' && taskIds.length !== 1) throw Error('单项纸签只能包含一项任务。');
      note = kind === 'single' ? next.notes.find(note => note.kind === 'single' && note.taskIds[0] === taskIds[0]) : undefined;
      if (note) note.visible = true;
      else {
        if (next.notes.length >= 32) throw Error('最多保留 32 张便签，请先移除不需要的便签。');
        const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '任务清单';
        note = { id: randomUUID(), kind, title, taskIds, visible: true }; next.notes.push(note);
      }
    } else if (action === 'line') {
      if (typeof payload.visible !== 'boolean') throw Error('晾衣线显示选项无效。');
      next.lineVisible = payload.visible;
    } else {
      if (!note) throw Error('这张便签已不存在。');
      if (action === 'remove') next.notes = next.notes.filter(item => item.id !== note!.id);
      else if (action === 'visible') {
        if (typeof payload.visible !== 'boolean') throw Error('便签显示选项无效。');
        note.visible = payload.visible;
      } else if (action === 'update') {
        if (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.length > 120) throw Error('请填写 1–120 字的便签名称。');
        if (note.kind !== 'list') throw Error('单项纸签标题跟随任务。');
        note.title = payload.title.trim();
        if (payload.taskIds !== undefined) {
          if (!Array.isArray(payload.taskIds) || payload.taskIds.length > 200 || payload.taskIds.some(id => typeof id !== 'string' || !tasks.some(task => task.id === id)) || new Set(payload.taskIds).size !== payload.taskIds.length) throw Error('任务清单包含无效或重复任务。');
          note.taskIds = payload.taskIds as string[];
        }
      } else throw Error('便签操作无效。');
    }
    this.save(next);
    return note?.id;
  }
  /** Called in the same transaction as task deletion, never while task data is unreadable. */
  prune(tasks: Task[]) {
    if (this.error) return;
    const existing = new Set(tasks.map(task => task.id));
    const next = structuredClone(this.state);
    next.notes = next.notes.flatMap(note => {
      note.taskIds = note.taskIds.filter(id => existing.has(id));
      return note.kind === 'single' && !note.taskIds.length ? [] : [note];
    });
    if (JSON.stringify(next.notes) !== JSON.stringify(this.state.notes)) this.save(next);
  }
}
