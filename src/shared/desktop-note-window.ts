/** Shared desktop-window geometry and restricted surface contract. */
export interface NoteRect { x: number; y: number; width: number; height: number }
export type NoteKind = 'single' | 'list';
export interface SurfaceTask { id: string; title: string; done: boolean; date?: string; dueDate?: string; progress?: number }
export interface SurfaceNote {
  id: string;
  kind: NoteKind;
  title: string;
  tasks: SurfaceTask[];
  hanging: boolean;
  expanded: boolean;
}
export interface SurfaceView {
  role: string;
  lineWidth: number;
  simulated: boolean;
  revision: number;
  pending: boolean;
  lineDragging?: boolean;
  lineAdjusting?: boolean;
  notes: SurfaceNote[];
  target: boolean;
  targetX?: number;
  message?: string;
}
export type SurfaceCommand =
  | { action: 'ready' | 'reset' | 'quit' | 'cancel' }
  | { action: 'begin' | 'end'; x: number; y: number }
  | { action: 'toggle'; id: string; revision?: number; requestId?: string }
  | { action: 'lineNudge'; dy: number }
  | { action: 'lineControlsFocus'; focused: boolean }
  | { action: 'hide' | 'hang' | 'take' | 'preview' | 'manage' | 'retry' };
export interface NotesBridge {
  send(command: SurfaceCommand): void;
  onView(callback: (view: SurfaceView) => void): () => void;
}
export const noteSize = (id: NoteKind, expanded: boolean) => expanded
  ? { width: id === 'single' ? 284 : 324, height: id === 'single' ? 184 : 354 }
  : { width: id === 'single' ? 156 : 182, height: 110 };
/** Native windows stay full-sized. Folded paper is centered inside their transparent area. */
export function paperBounds(id: NoteKind, expanded: boolean): NoteRect {
  const native = noteSize(id, true);
  const visual = noteSize(id, expanded);
  return { x: (native.width - visual.width) / 2 + 14, y: 25, width: visual.width - 28, height: visual.height - 45 };
}
export function ropePoint(line: NoteRect, center: number) {
  const x = Math.max(line.x + 50, Math.min(center, line.x + line.width - 50));
  const t = (x - line.x - 22) / (line.width - 44);
  return { x, y: line.y + 3 + 30 + 84 * t * (1 - t) };
}
export function hangingNoteBounds(id: NoteKind, line: NoteRect, center: number): NoteRect {
  const size = noteSize(id, true);
  const point = ropePoint(line, center);
  return { x: Math.round(point.x - size.width / 2), y: Math.round(point.y - 17), ...size };
}
/** Keep the line and room for an expanded hanging sheet inside the selected display. */
export function fitLine(workArea: NoteRect, top: number, sheetHeight = 0): NoteRect {
  const reserve = Math.max(96, sheetHeight + 54);
  return { x: workArea.x, y: Math.round(Math.max(workArea.y, Math.min(top, workArea.y + Math.max(0, workArea.height - reserve)))), width: workArea.width, height: 96 };
}
export function lineEndpoints(line: NoteRect): NoteRect[] {
  return [line.x + 22, line.x + line.width - 22].map(center => ({ x: center - 14, y: line.y + 19, width: 28, height: 28 }));
}
export function isNoteDrag(origin: { x: number; y: number }, point: { x: number; y: number }) {
  return Math.hypot(point.x - origin.x, point.y - origin.y) > 5;
}
export function toggleSurfacePreview(notes: SurfaceNote[], id: string) {
  const selected = notes.find(note => note.id === id);
  if (!selected?.hanging) return;
  const expanded = !selected.expanded;
  for (const note of notes) if (note.hanging) note.expanded = note.id === id && expanded;
}
export function containsPoint(rect: NoteRect, point: { x: number; y: number }) {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}
export function clampNote(rect: NoteRect, workArea: NoteRect): NoteRect {
  return { ...rect,
    x: Math.round(Math.max(workArea.x, Math.min(rect.x, workArea.x + Math.max(0, workArea.width - rect.width)))),
    y: Math.round(Math.max(workArea.y, Math.min(rect.y, workArea.y + Math.max(0, workArea.height - rect.height)))) };
}
