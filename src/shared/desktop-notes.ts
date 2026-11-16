import type { Task } from './contracts.js';
import { validateDesktopNotes } from '../migration/desktop-notes.js';
export { DESKTOP_NOTES_KEY } from '../migration/desktop-notes.js';
export interface DesktopNote { id: string; kind: 'single' | 'list'; title: string; taskIds: string[]; visible: boolean }
export interface DesktopNotesState { version: 1; revision: number; lineVisible: boolean; notes: DesktopNote[] }
export interface DesktopNotesSummary extends DesktopNotesState { error: string; pending: boolean; alwaysOnTop?: boolean; layoutPending?: boolean; windowError?: string; layoutError?: string }
export const emptyDesktopNotes = (): DesktopNotesState => ({ version: 1, revision: 0, lineVisible: false, notes: [] });
export function parseDesktopNotes(raw: string | null): DesktopNotesState {
  return raw === null ? emptyDesktopNotes() : validateDesktopNotes(JSON.parse(raw)) as DesktopNotesState;
}
export function projectTasks(note: DesktopNote, tasks: Task[]) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  return note.taskIds.flatMap(id => {
    const task = byId.get(id);
    return task ? [{ id: task.id, title: task.title, done: task.done, progress: task.progress, date: task.date, dueDate: task.dueDate }] : [];
  });
}
