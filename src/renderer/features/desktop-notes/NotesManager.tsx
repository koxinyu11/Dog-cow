import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, StickyNote, Trash2, X } from 'lucide-react';
import type { Fields, Result, Snapshot } from '../../../shared/contracts';
import type { DesktopNote } from '../../../shared/desktop-notes';
import { command, registerFlush } from '../../state';
import { Modal } from '../../components/Modal';
import { Button, Check, IconButton } from '../../ui';
import './manager.css';

type NoteDestination = { kind: 'note'; id: string } | { kind: 'new' | 'list' | 'close' };

export function NotesManager({ state, open, focus, compose, onClose, onNewTask }: {
  state: Snapshot; open: boolean; focus?: string; compose: boolean; onClose(): void; onNewTask(): void;
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [title, setTitle] = useState('任务清单');
  const [ids, setIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const inFlight = useRef(false);
  const pendingDestination = useRef<NoteDestination | null>(null);
  const draft = useRef({ editing, title, ids });
  draft.current = { editing, title, ids };
  const notes = state.desktopNotes;
  const pending = !!notes?.pending || !!notes?.layoutPending;
  const locked = busy || pending || !!notes?.error || !!state.taskError;
  const dirtyRef = useRef(false);
  dirtyRef.current = open && dirty;
  useEffect(() => registerFlush(async () => !dirtyRef.current), []);
  const edit = (note?: DesktopNote) => {
    setEditing(note?.id ?? 'new'); setTitle(note?.title || '任务清单'); setIds(note?.taskIds ?? []);
    setQuery(''); setMessage(''); setDirty(false);
  };
  const applyDestination = (destination: NoteDestination) => {
    pendingDestination.current = null;
    if (destination.kind === 'close') { onClose(); return; }
    const note = destination.kind === 'note' ? notes?.notes.find(note => note.id === destination.id) : undefined;
    if (note?.kind === 'list') edit(note);
    else if (destination.kind === 'new') edit();
    else { setEditing(null); setDirty(false); setMessage(''); }
  };
  const navigate = (destination: NoteDestination) => {
    if (dirtyRef.current || inFlight.current) {
      pendingDestination.current = destination;
      setMessage(dirtyRef.current ? '当前清单有未保存修改，请先保存或点“放弃修改”。' : '当前操作正在保存，请稍候。');
      return;
    }
    applyDestination(destination);
  };
  useEffect(() => {
    if (!open) { pendingDestination.current = null; return; }
    navigate(focus ? { kind: 'note', id: focus } : { kind: compose ? 'new' : 'list' });
  }, [open, focus, compose]);
  useEffect(() => {
    if (open && !dirty && !busy && !inFlight.current && pendingDestination.current)
      applyDestination(pendingDestination.current);
  }, [open, dirty, busy]);
  const run = async (payload: Fields) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const result = await command('desktopNotes', { ...payload, expectedNotesRevision: notes?.revision });
      if (!result.applied || !result.persisted) setMessage(result.message);
      return result;
    } catch { setMessage('操作未完成，请重试。'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const settleDraft = (result: Result, id = draft.current.editing) => {
    const saved = result.snapshot?.desktopNotes?.notes.find(note => note.id === id);
    if (result.persisted && saved?.kind === 'list' && saved.title === draft.current.title.trim()
      && saved.taskIds.length === draft.current.ids.length && saved.taskIds.every((value, index) => value === draft.current.ids[index])) {
      setDirty(false); setEditing(null);
    }
  };
  const retry = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const result = await command('retrySave'); setMessage(result.message);
      settleDraft(result);
    } catch { setMessage('保存仍未完成，请保留窗口重试。'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const save = async () => {
    const result = await run(editing === 'new' ? { action: 'create', title, taskIds: ids } : { action: 'update', id: editing, title, taskIds: ids });
    if (result?.applied) {
      const id = editing === 'new'
        ? result.snapshot?.desktopNotes?.notes.find(note => !notes?.notes.some(before => before.id === note.id))?.id
        : editing;
      // A create may be applied in memory before disk persistence succeeds.
      // Continue editing that same note rather than creating a duplicate on retry.
      if (id) setEditing(id);
      settleDraft(result, id ?? editing);
    }
  };
  const move = (index: number, direction: number) => {
    const next = [...ids]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setIds(next); setDirty(true);
  };
  const toggle = (id: string) => { setIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]); setDirty(true); };
  const matches = state.tasks.tasks.filter(task => !query || `${task.title} ${task.date}`.toLowerCase().includes(query.toLowerCase()));
  return <Modal className="desktop-notes-manager" open={open} title="桌面便签" onClose={() => navigate({ kind: 'close' })}>
    <div className="dn-toolbar">
      <Button icon={<Plus size={14}/>} disabled={locked} onClick={() => navigate({ kind: 'new' })}>组合成便签</Button>
      <Button variant="ghost" disabled={locked} onClick={() => void run({ action: 'line', visible: !notes?.lineVisible })}>{notes?.lineVisible ? '隐藏晾衣线' : '显示晾衣线'}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => void run({ action: 'positions' })}>找回 / 重置位置</Button>
      <Check checked={notes?.alwaysOnTop ?? false} disabled={busy || pending} label="始终置顶" onChange={enabled => void run({ action: 'alwaysOnTop', enabled })}/>
    </div>
    {(notes?.error || notes?.windowError || notes?.layoutError || state.taskError || message) && <p className="dn-message" role="status">{message || notes?.error || notes?.windowError || notes?.layoutError || state.taskError}</p>}
    {pending && <div className="dn-pending"><span>修改尚未保存</span><Button size="sm" disabled={busy} onClick={() => void retry()}>重试保存</Button></div>}
    {editing ? <div className="dn-editor">
      <div className="dn-editor-title"><input aria-label="便签名称" maxLength={120} value={title} onChange={event => { setTitle(event.target.value); setDirty(true); }}/><span>{ids.length} 项</span></div>
      {!!ids.length && <ol className="dn-members">{ids.map((id, index) => {
        const task = state.tasks.tasks.find(task => task.id === id);
        return <li key={id}><span className={task?.done ? 'dn-done' : ''}>{task?.title ?? '任务已删除，请移出清单'}</span><div>
          <IconButton size="sm" variant="ghost" label="上移" disabled={index === 0 || locked} onClick={() => move(index, -1)}><ArrowUp size={13}/></IconButton>
          <IconButton size="sm" variant="ghost" label="下移" disabled={index === ids.length - 1 || locked} onClick={() => move(index, 1)}><ArrowDown size={13}/></IconButton>
          <IconButton size="sm" variant="ghost" label="移出清单，不删除任务" disabled={locked} onClick={() => toggle(id)}><X size={13}/></IconButton>
        </div></li>;
      })}</ol>}
      <Button size="sm" variant="ghost" disabled={locked} onClick={onNewTask}>新建待办</Button>
      <input className="dn-search" aria-label="搜索任务标题或日期" placeholder="搜索任务或日期" value={query} onChange={event => setQuery(event.target.value)}/>
      <div className="dn-picker">{matches.map(task => <div className="dn-pick-row" key={task.id}>
        <Check checked={ids.includes(task.id)} disabled={locked || ids.length >= 200 && !ids.includes(task.id)} label={<span className={task.done ? 'dn-done' : ''}>{task.title}</span>} onChange={() => toggle(task.id)}/><time>{task.date}</time>
      </div>)}{!matches.length && <p className="dn-empty">没有匹配的待办</p>}</div>
      <div className="dn-editor-foot"><Button disabled={busy} variant="ghost" onClick={() => { setDirty(false); setEditing(null); setMessage(''); }}>放弃修改</Button><Button disabled={locked || !title.trim() || editing === 'new' && !ids.length} variant="primary" onClick={() => void save()}>保存便签</Button></div>
    </div> : <div className="dn-list">
      {!notes?.notes.length && <div className="dn-empty"><StickyNote size={30}/><p>把一件事贴在眼前，或把一组待办装进清单。</p></div>}
      {notes?.notes.map(note => <div className="dn-row" key={note.id}>
        <StickyNote size={20}/><div className="dn-row-title"><strong>{note.kind === 'single' ? state.tasks.tasks.find(task => task.id === note.taskIds[0])?.title ?? '单项纸签' : note.title}</strong><span>{note.kind === 'single' ? '纸签' : `清单 · ${note.taskIds.length} 项`}{!note.visible && ' · 已隐藏'}</span></div>
        {note.kind === 'list' && <Button size="sm" variant="ghost" disabled={locked} onClick={() => navigate({ kind: 'note', id: note.id })}>编辑</Button>}
        <IconButton size="sm" variant="ghost" label={note.visible ? '隐藏便签' : '显示便签'} disabled={locked} onClick={() => void run({ action: 'visible', id: note.id, visible: !note.visible })}>{note.visible ? <EyeOff size={15}/> : <Eye size={15}/>}</IconButton>
        <IconButton size="sm" variant="ghost" label="移除便签，保留待办" disabled={locked} onClick={() => void run({ action: 'remove', id: note.id })}><Trash2 size={15}/></IconButton>
      </div>)}
    </div>}
  </Modal>;
}
