import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Check, RotateCcw, X } from 'lucide-react';
import type { NotesBridge, SurfaceView } from '../shared/desktop-note-window';
import { isNoteDrag, ropePoint, paperBounds } from '../shared/desktop-note-window';
import './features/desktop-notes/notes.css';

declare global { interface Window { notesSample?: NotesBridge; desktopNotes?: NotesBridge } }
const bridge = (window.desktopNotes ?? window.notesSample)!;
function NotesSurface() {
  const [view, setView] = useState<SurfaceView>();
  const active = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const remove = bridge.onView(setView);
    bridge.send({ action: 'ready' });
    return remove;
  }, []);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        active.current = false; setDragging(false);
        bridge.send({ action: 'cancel' });
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);
  const begin = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.screenX, y: event.screenY };
    active.current = true; setDragging(false);
    bridge.send({ action: 'begin', x: event.screenX, y: event.screenY });
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    if (active.current && isNoteDrag(origin.current, { x: event.screenX, y: event.screenY })) setDragging(true);
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    if (!active.current) return;
    active.current = false; setDragging(false);
    bridge.send({ action: 'end', x: event.screenX, y: event.screenY });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const cancel = () => {
    if (!active.current) return;
    active.current = false; setDragging(false);
    bridge.send({ action: 'cancel' });
  };
  if (!view) return null;
  if (view.role === 'line') return <main className={`sample-line ${view.target ? 'is-target' : ''} ${view.lineDragging ? 'is-dragging' : ''} ${view.lineAdjusting ? 'is-adjusting' : ''}`}>
    <div className="line-heading" aria-hidden={!view.lineAdjusting}><span className="line-name">晒一会儿</span>{view.simulated && <span className="sample-badge">交互样机 · 模拟任务</span>}</div>
    <div className="line-tools" aria-hidden={!view.lineAdjusting} inert={!view.lineAdjusting}
      onFocusCapture={event => bridge.send({ action: 'lineControlsFocus', focused: event.target.matches(':focus-visible') })}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) bridge.send({ action: 'lineControlsFocus', focused: false }); }}>
      <button title="重置便签位置" aria-label="重置位置" onClick={() => bridge.send({ action: 'reset' })}><RotateCcw size={13} /></button>
      <button title={view.simulated ? "关闭样机" : "隐藏晾衣线"} aria-label={view.simulated ? "关闭样机" : "隐藏晾衣线"} onClick={() => bridge.send({ action: 'quit' })}><X size={14} /></button>
    </div>
    <svg className="clothesline" viewBox={`0 0 ${view.lineWidth} 65`} preserveAspectRatio="none" aria-hidden="true"><path className="rope-shadow" d={`M 22 31 Q ${view.lineWidth / 2} 73 ${view.lineWidth - 22} 31`}/><path className="rope" d={`M 22 30 Q ${view.lineWidth / 2} 72 ${view.lineWidth - 22} 30`}/><circle cx="22" cy="30" r="3"/><circle cx={view.lineWidth - 22} cy="30" r="3"/>
      {view.target && view.targetX !== undefined && <circle className="landing-mark" cx={view.targetX} cy={ropePoint({ x: 0, y: -3, width: view.lineWidth, height: 96 }, view.targetX).y} r="5"/>}
    </svg>
    {(['left', 'right'] as const).map(side => <button key={side} className={`line-endpoint endpoint-${side}`} aria-label={`拖动晾衣线${side === 'left' ? '左' : '右'}端点`} title="按住拖动整根线；↑↓ 调整高度"
      onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); bridge.send({ action: 'lineNudge', dy: (event.key === 'ArrowUp' ? -1 : 1) * (event.shiftKey ? 30 : 10) }); } }}><span/></button>)}
    {view.target && <div className="drop-label" style={{ left: view.targetX }}>松手，夹在这里</div>}
    {view.message && <span className="native-warning" role="status">{view.message}</span>}
  </main>;
  const note = view.notes.find(note => note.id === view.role);
  if (!note) return null;
  const folded = note.hanging && !note.expanded;
  const done = note.tasks.filter(task => task.done).length;
  const allDone = note.tasks.length > 0 && done === note.tasks.length;
  const fullPaper = paperBounds(note.kind, true);
  const foldedPaper = paperBounds(note.kind, false);
  const paperStyle = {
    '--fold-x': foldedPaper.width / fullPaper.width,
    '--fold-y': foldedPaper.height / fullPaper.height,
    '--fold-width': `${foldedPaper.width}px`,
    '--fold-height': `${foldedPaper.height}px`,
  } as CSSProperties;
  const keyboardPreview = (event: MouseEvent<HTMLElement>) => {
    if (event.detail === 0) bridge.send({ action: 'preview' });
  };
  return <main style={paperStyle} className={`sample-note type-${note.kind} ${folded ? 'is-folded' : ''} ${note.hanging ? 'is-hanging' : ''} ${dragging ? 'is-dragging' : ''} ${allDone ? 'is-complete' : ''}`}>
    <button type="button" className="note-grip" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={keyboardPreview} title={note.hanging ? '点击展开或收回；按住拖动' : '按住拖动；Esc 取消'} aria-label={note.hanging ? '展开或收回便签，也可拖动' : '拖动便签'} aria-expanded={note.hanging ? !folded : undefined}>
      {note.hanging ? <span className="peg"><i /></span> : note.kind === 'single' ? <span className="tape"/> : <span className="binding"><i/><i/><i/><i/><i/></span>}
    </button>
    <article className="sample-paper">
      <div className="paper-shape"/>
      <button type="button" className="note-dismiss" aria-label="隐藏便签，保留待办" title="隐藏便签" disabled={view.pending} onClick={() => bridge.send({ action: 'hide' })}><X size={13}/></button>
      <div className="note-content" aria-hidden={folded} inert={folded}>
      <div className="paper-tools">
        <span className="paper-kicker">{note.kind === 'single' ? '一件小事' : '一页清单'}</span>
        <button aria-label={note.hanging ? '拿到桌面' : '挂到线上'} title={note.hanging ? '拿到桌面' : '挂到线上'} onClick={() => bridge.send({ action: note.hanging ? 'take' : 'hang' })}>
          {note.hanging ? <ArrowDownToLine size={14}/> : <ArrowUpToLine size={14}/>}</button>
      </div>
        {note.kind === 'list' && <header className="list-heading"><h1>{note.title}</h1><span className="page-count">{done}<small> / {note.tasks.length}</small></span></header>}
        <div className="sample-tasks">
          {!note.tasks.length && <p className="empty-note">这一页还空着</p>}
          {note.tasks.map(task => <label className={`sample-task ${task.done ? 'is-done' : ''}`} key={task.id}>
            <input type="checkbox" disabled={view.pending} checked={task.done} onChange={() => bridge.send({ action: 'toggle', id: task.id, revision: view.revision, requestId: crypto.randomUUID() })}/>
            <span className="drawn-check" aria-hidden="true">{task.done && <Check size={note.kind === 'single' ? 15 : 12} strokeWidth={2.5}/>}</span>
            <span className="task-words">{task.title}</span>
          </label>)}
        </div>
        <footer className="paper-footer">{note.kind === 'single' ? <><span className="date-dot"/>{view.simulated ? '今天下班前' : (note.tasks[0]?.dueDate ? `截止 ${note.tasks[0].dueDate}` : note.tasks[0]?.date ?? '')}</> : <><span>{allDone ? '这一页，做完啦' : '一件一件，慢慢来'}</span><span className="page-number">01</span></>}</footer>
        {!view.simulated && <div className="note-actions"><button onClick={() => bridge.send({ action: 'manage' })}>管理便签</button>{view.pending && <span>未保存</span>}{view.message && <button className="note-error" title={view.message} onClick={() => bridge.send({ action: 'retry' })}>重试保存</button>}</div>}
      </div>
      <button type="button" className="folded-summary" aria-label={`展开${note.kind === 'single' ? (note.tasks[0]?.title ?? "任务已移除") : note.title}`} aria-hidden={!folded} tabIndex={folded ? 0 : -1}
        onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={keyboardPreview}>
        {note.kind === 'single' ? <><span className="folded-check">{allDone ? <Check size={13}/> : <i/>}</span><span className="folded-title">{(note.tasks[0]?.title ?? "任务已移除")}</span></> : <><strong>{note.title}</strong><span className="folded-progress"><span className="tiny-pages">≡</span>{done}<span> / {note.tasks.length}</span>{allDone && <Check size={12}/>}</span></>}
      </button>
    </article>
    {note.kind === 'list' && <><div className="paper-under under-one"/><div className="paper-under under-two"/></>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<NotesSurface/>);
