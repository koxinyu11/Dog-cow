import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  ArrowLeft, BookOpen, CalendarCheck, Eye, EyeOff, ExternalLink, Flame, Layers, Pause, PartyPopper, Play, RotateCcw, ShieldCheck, SkipBack, SkipForward, Timer,
} from 'lucide-react';
import {
  activeMovementMs, deskMoves, deskMoveSource, movementKcal, pauseDeskSession, prepareDeskSession, resumeDeskSession,
  type DeskMove, type DeskMovementData, type DeskSegment, type DeskSession,
} from '../../../shared/desk-movement';
import { fx } from '../../motion/fx';
import { command } from '../../state';
import { Button, IconButton, Ring, Stat } from '../../ui';
import { MovementThumb } from './MovementCatalog';
import { MovementDiagram } from './MovementDiagram';
import { ICON, STROKE, regionIcons, safetyNote, supportIcons, supportLabels } from './movement-icons';
import { clock, dayTotals, duration, streak } from './movement-stats';

const openSource = (url: string, onError: () => void) => void command('openSource', { url }).then(result => {
  if (result.message !== '已打开系统浏览器。') onError();
}, onError);

export interface MovementSessionHandle {
  /** Ends a running session (showing the summary) or blocks while saving. Returns false when the caller may close. */
  requestExit(): boolean;
}

export function MovementSession({ moves, weightKg, weightReady, ref, onClose, onSaved }: {
  moves: readonly DeskMove[];
  weightKg?: number;
  weightReady: boolean;
  ref?: Ref<MovementSessionHandle>;
  onClose(): void;
  onSaved(data: DeskMovementData): void;
}) {
  const [session, setSession] = useState<DeskSession>(() => prepareDeskSession(moves));
  const [now, setNow] = useState(0);
  const [guide, setGuide] = useState(false);
  const [previewStart, setPreviewStart] = useState<number>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<DeskMovementData>();
  const run = useRef({ id: crypto.randomUUID(), segments: [] as DeskSegment[], captured: new WeakSet<DeskSession>(), weightKg });
  const badge = useRef<HTMLDivElement>(null);

  const capture = (current: DeskSession, time: number) => {
    const milliseconds = activeMovementMs(current, time);
    if (milliseconds <= 0 || run.current.captured.has(current)) return;
    run.current.captured.add(current);
    run.current.segments.push({ move: current.moves[current.index], milliseconds });
  };
  const finish = (current: DeskSession) => {
    capture(current, performance.now());
    setPreviewStart(undefined);
    setSession({ ...current, phase: 'finished' });
  };
  useImperativeHandle(ref, () => ({
    requestExit() {
      if (saving) return true;
      if (session.phase !== 'finished') { finish(session); return true; }
      return false;
    },
  }));

  const finished = session.phase === 'finished';
  useEffect(() => {
    if (finished) return;
    const report = (value: boolean) => void command('deskMovement', { action: 'active', active: value }).catch(console.error);
    report(true);
    return () => report(false);
  }, [finished]);

  const running = session.phase === 'running' ? session : null;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const time = performance.now();
      setNow(time);
      if (time >= running.deadline) {
        clearInterval(timer);
        capture(running, time);
        setSession(current => current === running ? prepareDeskSession(running.moves, running.index + 1) : current);
      }
    }, 40);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (previewStart === undefined) return;
    const timer = setInterval(() => setNow(performance.now()), 40);
    return () => clearInterval(timer);
  }, [previewStart]);
  useEffect(() => window.dogcow.deskMovementInterrupt(() => {
    setPreviewStart(undefined);
    if (!running) return;
    const time = performance.now();
    if (running.deadline <= time) capture(running, time);
    setSession(current => current === running ? pauseDeskSession(running, time) : current);
  }), [running]);

  const segments = run.current.segments;
  const saveRun = async () => {
    if (!segments.length) return;
    setSaving(true);
    setError('');
    try {
      const result = await command('deskMovement', { action: 'record', id: run.current.id, segments, weightKg: run.current.weightKg });
      if (!result.persisted || !result.deskMovement) throw Error('Activity save failed');
      setSaved(result.deskMovement);
      onSaved(result.deskMovement);
      requestAnimationFrame(() => fx('check', badge.current));
    } catch { setError('本次活动未记入，请重试。'); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    if (finished && segments.length) void saveRun();
  }, [finished]);

  const pause = () => {
    if (!running) return;
    const time = performance.now();
    if (running.deadline <= time) capture(running, time);
    setSession(pauseDeskSession(running, time));
  };
  const toggle = () => {
    if (running) { pause(); return; }
    if (!weightReady) return;
    const time = performance.now();
    if (!segments.length && session.index === 0 && session.phase === 'ready') run.current.weightKg = weightKg;
    setNow(time);
    setGuide(false);
    setPreviewStart(undefined);
    setSession(current => resumeDeskSession(current, time));
  };
  const jump = (step: number) => {
    const index = session.index + step;
    if (finished || index < 0 || index >= session.moves.length) return;
    capture(session, performance.now());
    setSession(prepareDeskSession(session.moves, index));
    setGuide(false);
    setPreviewStart(undefined);
  };

  const keys = useRef({ toggle, jump });
  keys.current = { toggle, jump };
  useEffect(() => {
    if (finished) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === ' ' && !target?.closest('button, a')) { event.preventDefault(); keys.current.toggle(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); keys.current.jump(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); keys.current.jump(1); }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [finished]);

  const recordedSeconds = Math.floor(segments.reduce((total, item) => total + item.milliseconds, 0) / 1000);
  const runWeight = run.current.weightKg;

  if (finished) {
    const totalKcal = runWeight === undefined ? undefined : movementKcal(segments, runWeight);
    const days = saved ? streak(dayTotals(saved.records)) : undefined;
    return <div className="dm-page dm-done">
      <div ref={badge} className={`dm-done-badge${saved ? ' is-saved' : ''}`} aria-hidden="true"><PartyPopper size={ICON.badge} strokeWidth={STROKE} /></div>
      <h3 role="status">{!segments.length ? '这次没有计时' : saving ? '正在保存记录…' : saved ? '活动已记录' : '这次活动结束'}</h3>
      {segments.length > 0 && <div className="dm-stats">
        <Stat icon={Timer} label="时长" value={duration(recordedSeconds)} />
        <Stat icon={Layers} label="动作" value={`${new Set(segments.map(item => item.move)).size} 个`} />
        {totalKcal !== undefined && <Stat icon={Flame} label="热量" value={`约 ${totalKcal.toFixed(1)} kcal`} />}
        {days !== undefined && <Stat icon={CalendarCheck} label="连续" value={`${days} 天`} />}
      </div>}
      {error && <p className="dm-error" role="alert">{error}</p>}
      <div className="dm-done-actions">
        {error && <Button variant="primary" icon={<RotateCcw size={ICON.btn} />} disabled={saving} onClick={() => void saveRun()}>重试记录</Button>}
        <Button variant={error ? 'ghost' : 'primary'} disabled={saving} onClick={onClose}>完成</Button>
      </div>
    </div>;
  }

  const move = session.moves[session.index];
  const next = session.moves[session.index + 1];
  const detail = deskMoves[move];
  const total = detail.seconds * 1000;
  const remaining = Math.max(0, session.phase === 'running' ? session.deadline - now : session.remaining);
  const seconds = Math.ceil(remaining / 1000);
  const currentSegment = [{ move, milliseconds: activeMovementMs(session, now) }];
  const expectedKcal = runWeight === undefined ? undefined : movementKcal([{ move, milliseconds: total }], runWeight);
  const sessionKcal = runWeight === undefined ? undefined : movementKcal([...segments, ...currentSegment], runWeight);
  const SupportIcon = supportIcons[detail.support];
  const sourceError = () => setError('暂时打不开来源，请重试。');
  const previewing = previewStart !== undefined;
  return <div className={`dm-page dm-session is-${session.phase}`}>
    <div className="dm-session-top">
      <Button size="sm" variant="ghost" icon={<ArrowLeft size={ICON.btn} />} onClick={() => finish(session)}>结束</Button>
      {session.moves.length > 1 && <ol className="dm-steps" aria-label={`第 ${session.index + 1} / ${session.moves.length} 项`}>
        {session.moves.map((id, index) => <li key={`${id}-${index}`} className={index < session.index ? 'is-done' : index === session.index ? 'is-current' : ''} title={deskMoves[id].label} />)}
      </ol>}
      <span className="dm-step-count">{session.index + 1} / {session.moves.length}</span>
    </div>

    <div className="dm-stage">
      <Ring value={1 - remaining / total} size={208} stroke={7} color="var(--dm)">
        <MovementDiagram key={move} move={move} elapsed={previewing ? Math.max(0, now - previewStart) : total - remaining} playing />
      </Ring>
      <span className="dm-time" aria-label={`剩余 ${seconds} 秒`}>{clock(seconds)}</span>
    </div>

    <div className="dm-move-head">
      <h3>{detail.label}</h3>
      <div className="dm-tags">
        {detail.regions.map(region => {
          const Icon = regionIcons[region];
          return <span key={region} className="dm-tag"><Icon size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{region}</span>;
        })}
        <span className="dm-tag is-quiet"><SupportIcon size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{supportLabels[detail.support]}</span>
      </div>
      <p className="dm-cue">{detail.cue}</p>
    </div>

    <div className="dm-controls">
      <IconButton variant="soft" label="上一项" disabled={session.index === 0} onClick={() => jump(-1)}><SkipBack size={ICON.btn} /></IconButton>
      <Button variant="primary" size="lg" className="dm-play" disabled={!weightReady} aria-label={running ? '暂停' : session.phase === 'paused' ? '继续' : '开始'}
        icon={running ? <Pause size={ICON.hero} fill="currentColor" /> : <Play size={ICON.hero} fill="currentColor" />} onClick={toggle} />
      <IconButton variant="soft" label="下一项" disabled={!next} onClick={() => jump(1)}><SkipForward size={ICON.btn} /></IconButton>
    </div>
    <div className="dm-secondary">
      {session.phase === 'ready' && <Button size="sm" variant="ghost" icon={previewing ? <EyeOff size={ICON.btn} /> : <Eye size={ICON.btn} />} onClick={() => {
        const time = performance.now();
        setNow(time);
        setPreviewStart(previewing ? undefined : time);
      }}>{previewing ? '停止预览' : '预览'}</Button>}
      <Button size="sm" variant="ghost" icon={<BookOpen size={ICON.btn} />} aria-expanded={guide}
        onClick={() => { pause(); setGuide(!guide); setError(''); setPreviewStart(undefined); }}>{guide ? '收起讲解' : '讲解'}</Button>
    </div>

    {guide && <div className="dm-guide">
      <p>{detail.dose}</p>
      <div className="dm-guide-links">
        <Button size="sm" variant="soft" icon={<ExternalLink size={ICON.tag} />} onClick={() => openSource(deskMoveSource(move), sourceError)}>动作来源</Button>
        {runWeight !== undefined && <Button size="sm" variant="soft" icon={<ExternalLink size={ICON.tag} />} onClick={() => openSource(detail.met.source, sourceError)}>热量依据 · {detail.met.label}</Button>}
      </div>
    </div>}

    {next && <div className="dm-next">
      <MovementThumb move={next} />
      <span><small>下一项</small>{deskMoves[next].label}</span>
    </div>}

    <p className="dm-safety"><ShieldCheck size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />{safetyNote[detail.support]}如有疼痛或不适，请停止。</p>
    {expectedKcal !== undefined && sessionKcal !== undefined && <p className="dm-energy" aria-label="活动净消耗估算">
      <Flame size={ICON.tag} strokeWidth={STROKE} aria-hidden="true" />
      本动作约 <b>{expectedKcal.toFixed(2)}</b> · 本次累计约 <b>{sessionKcal.toFixed(2)}</b> kcal
    </p>}
    {error && <p className="dm-error" role="alert">{error}</p>}
  </div>;
}
