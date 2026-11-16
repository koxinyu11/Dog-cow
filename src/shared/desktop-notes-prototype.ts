export { noteSize as sampleSize, paperBounds as samplePaperBounds, isNoteDrag as isSampleDrag, toggleSurfacePreview as toggleSamplePreview, containsPoint, clampNote, ropePoint, hangingNoteBounds } from './desktop-note-window.js';
export type { NoteKind as SampleId, SurfaceTask as SampleTask, SurfaceNote as SampleNote, SurfaceView as SampleView, SurfaceCommand as SampleCommand, NotesBridge as SampleBridge } from './desktop-note-window.js';
import type { SurfaceNote as SampleNote } from './desktop-note-window.js';
export function sampleNotes(): SampleNote[] {
  return [
    { id: 'single', kind: 'single', title: '别忘了这件事', hanging: false, expanded: true,
      tasks: [{ id: 'contract', title: '把改好的合同发给小林', done: false }] },
    { id: 'list', kind: 'list', title: '下班前，慢慢收个尾', hanging: false, expanded: true, tasks: [
      { id: 'reply', title: '回复今天剩下的消息', done: true },
      { id: 'design', title: '把便签的想法画下来', done: false },
      { id: 'desk', title: '收拾桌面，留一小块空地', done: false },
      { id: 'tomorrow', title: '写下明天第一件要做的事', done: false },
      { id: 'home', title: '带上耳机，准点回家', done: false },
    ] },
  ];
}
