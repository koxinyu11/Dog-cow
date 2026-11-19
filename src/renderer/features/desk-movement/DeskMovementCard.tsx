import { useEffect, useRef, useState } from 'react';
import { Footprints, List, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { SizeKey } from '../../../shared/board';
import {
  activeMovementMs, deskMoves, deskMoveSource, movementKcal, validMovementWeight, pauseDeskSession, prepareDeskSession, resumeDeskSession,
  seatedQuick, walkingBreak, type DeskMove, type DeskSession, type DeskMovementData, type DeskSegment,
} from '../../../shared/desk-movement';
import { Modal } from '../../components/Modal';
import { command } from '../../state';
import { Button } from '../../ui';
import { MovementCatalog } from './MovementCatalog';
import { MovementDiagram } from './MovementDiagram';
import { MovementHistory, MovementPlan } from './MovementPlan';
import './desk-movement.css';

type MovementEntry = 'seated' | 'walk' | 'moves' | 'plan' | 'history';
function launch(entry: MovementEntry) {
  window.dispatchEvent(new CustomEvent('dogcow:desk-movement', { detail: entry }));
}

export function DeskMovementCard({ size }: { size: SizeKey }) {
  const large = size === 'l' || size === 'tall';
  return <div className={`desk-movement-card layout-${size}`}>
    {large && <MovementDiagram move="march" elapsed={2000} />}
    <div className="desk-movement-actions">
      <Button size="sm" variant="primary" icon={<Play size={15} />} onClick={() => launch('seated')}>坐姿 1 分钟</Button>
      {size !== 's' && <Button size="sm" variant="ghost" icon={<Footprints size={15} />} onClick={() => launch('walk')}>步行 3 分钟</Button>}
      <Button size="sm" variant="ghost" icon={<List size={15} />} onClick={() => launch(large ? 'moves' : 'plan')}>{large ? '选动作' : '我的计划'}</Button>
      {large && <>
        <Button size="sm" variant="ghost" onClick={() => launch('plan')}>我的计划</Button>
        <Button size="sm" variant="ghost" onClick={() => launch('history')}>活动记录</Button>
      </>}
    </div>
  </div>;
}

export function DeskMovementLauncher() {
  const [page, setPage] = useState<MovementEntry | 'session' | 'edit' | 'weight' | null>(null);
  const [session, setSession] = useState<DeskSession | null>(null);
  const [data, setData] = useState<DeskMovementData>();
  const [now, setNow] = useState(0);
  const [guide, setGuide] = useState(false);
  const [previewStart, setPreviewStart] = useState<number>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const run = useRef<{ id: string; segments: DeskSegment[]; captured: WeakSet<DeskSession>; weightKg?: number }>({ id: '', segments: [], captured: new WeakSet() });
  const [weightKg, setWeightKg] = useState<number>();
  const [weightReady, setWeightReady] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  useEffect(() => {
    let alive = true;
    void command('deskMovement', { action: 'read' }).then(result => {
      if (alive) setWeightKg(result.deskMovement?.weightKg);
    }).catch(console.error).finally(() => { if (alive) setWeightReady(true); });
    return () => { alive = false; };
  }, []);

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

  const start = (moves: readonly DeskMove[]) => {
    run.current = { id: crypto.randomUUID(), segments: [], captured: new WeakSet(), weightKg };
    setSession(prepareDeskSession(moves));
    setGuide(false);
    setPreviewStart(undefined);
    setError('');
    setSaved(false);
    setPage('session');
  };
  const close = () => {
    if (saving) return;
    if (page === 'session' && session && session.phase !== 'finished') { finish(session); return; }
    setPage(null);
    setSession(null);
    setError('');
  };
  const openEntry = (entry: MovementEntry) => {
    if (entry === 'seated') start(seatedQuick);
    else if (entry === 'walk') start(walkingBreak);
    else setPage(entry);
  };

  useEffect(() => {
    const listener = (event: Event) => openEntry((event as CustomEvent<MovementEntry>).detail);
    window.addEventListener('dogcow:desk-movement', listener);
    return () => window.removeEventListener('dogcow:desk-movement', listener);
  }, [weightKg]);
  useEffect(() => window.dogcow.openDeskMovement(() => {
    setPage(current => current === 'session' ? current : 'plan');
  }), []);
  useEffect(() => {
    if (page !== 'plan' && page !== 'history') return;
    let cancelled = false;
    setError('');
    setData(undefined);
    void command('deskMovement', { action: 'read' }).then(result => {
      if (cancelled) return;
      if (result.deskMovement) setData(result.deskMovement);
      else setError(result.message || '活动数据暂不可读。');
    }, () => { if (!cancelled) setError('活动数据暂不可读。'); });
    return () => { cancelled = true; };
  }, [page]);
  const active = page === 'session' && session?.phase !== 'finished';
  useEffect(() => {
    if (!active) return;
    const report = (value: boolean) => void command('deskMovement', { action: 'active', active: value }).catch(console.error);
    report(true);
    return () => report(false);
  }, [active]);

  const running = session?.phase === 'running' ? session : null;
  useEffect(() => {
    if (!running || page !== 'session') return;
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
  }, [running, page]);

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

  const move = session?.moves[session.index];
  const next = session?.moves[session.index + 1];
  const detail = move ? deskMoves[move] : null;
  const remaining = session && session.phase !== 'finished'
    ? Math.max(0, session.phase === 'running' ? session.deadline - now : session.remaining) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const segments = run.current.segments;
  const recordedSeconds = Math.floor(segments.reduce((total, item) => total + item.milliseconds, 0) / 1000);
  const currentSegment = session && move ? [{ move, milliseconds: activeMovementMs(session, now) }] : [];
  const runWeight = run.current.weightKg;
  const expectedKcal = runWeight === undefined || !move || !detail ? undefined :
    movementKcal([{ move, milliseconds: detail.seconds * 1000 }], runWeight);
  const currentKcal = runWeight === undefined ? undefined : movementKcal(currentSegment, runWeight);
  const totalKcal = runWeight === undefined ? undefined : movementKcal([...segments, ...currentSegment], runWeight);
  const saveRun = async () => {
    if (!segments.length) return;
    setSaving(true);
    setError('');
    try {
      const result = await command('deskMovement', { action: 'record', id: run.current.id, segments, weightKg: runWeight });
      if (!result.persisted) throw Error('Activity save failed');
      setSaved(true);
    } catch { setError('本次活动未记入，请重试。'); }
    finally { setSaving(false); }
  };
  const finished = page === 'session' && session?.phase === 'finished';
  useEffect(() => {
    if (finished && segments.length) void saveRun();
  }, [finished]);

  const pause = () => {
    if (!running) return;
    const time = performance.now();
    if (running.deadline <= time) capture(running, time);
    setSession(pauseDeskSession(running, time));
  };
  const editWeight = () => {
    setError('');
    setWeightInput(weightKg === undefined ? '' : String(weightKg));
    setPage('weight');
  };
  const saveWeight = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await command('deskMovement', { action: 'weight', weightKg: weightInput.trim() === '' ? null : Number(weightInput) });
      if (!result.deskMovement) throw Error('Weight save failed');
      setWeightKg(result.deskMovement.weightKg);
      setPage('plan');
    } catch { setError('体重设置未保存，请重试。'); }
    finally { setSaving(false); }
  };
  const title = page === 'weight' ? '热量估算' : page === 'history' ? '活动记录' : page === 'edit' || page === 'plan' ? '我的计划' : '工位动一动';
  return <Modal open={page !== null} title={title} onClose={close} className="desk-movement-dialog">
    {page === 'moves' && <div className="desk-movement-session"><MovementCatalog onSelect={id => start([id])} /></div>}
    {page === 'weight' && <div className="desk-movement-session">
      <label>体重（kg，可留空） <input type="number" min="0.1" max="500" step="0.1" value={weightInput}
        onChange={event => setWeightInput(event.target.value)} /></label>
      <details><summary>估算口径</summary><p>活动净消耗按成人活动强度、体重和跟练计时估算。小动作会参考相近类别。</p></details>
      <Button variant="primary" disabled={saving || (weightInput !== '' && !validMovementWeight(Number(weightInput)))} onClick={() => void saveWeight()}>保存</Button>
      {error && <p role="alert">{error}</p>}
    </div>}
    {page === 'plan' && <div className="desk-movement-session">
      {data && <>
        <ol className="movement-plan-order">{data.plan.moves.map(id => <li key={id}>{deskMoves[id].label}</li>)}</ol>
        <div className="desk-movement-actions">
          <Button variant="primary" onClick={() => start(data.plan.moves)}>开始计划</Button>
          <Button variant="ghost" onClick={() => setPage('edit')}>编辑计划</Button>
        </div>
      </>}
      <div className="desk-movement-actions">
        <Button variant="ghost" onClick={() => setPage('moves')}>选单个动作</Button>
        <Button variant="ghost" onClick={() => start(walkingBreak)}>步行 3 分钟</Button>
        <Button variant="ghost" onClick={() => setPage('history')}>活动记录</Button>
        <Button variant="ghost" onClick={editWeight}>热量估算</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">正在读取计划…</p>}
    </div>}
    {page === 'edit' && data && <MovementPlan initial={data.plan} onSaved={value => { setData(value); setPage('plan'); }} />}
    {page === 'history' && (data ? <MovementHistory records={data.records} /> :
      <p className="desk-movement-session" role={error ? 'alert' : 'status'}>{error || '正在读取记录…'}</p>)}
    {finished && <div className="desk-movement-session">
      <p role="status">{saving ? '正在保存记录…' : saved ? `已记录 ${recordedSeconds} 秒` : '这次活动结束'}</p>
      {totalKcal !== undefined && <p>本次累计约 {totalKcal.toFixed(2)} kcal</p>}
      {error && <p role="alert">{error}</p>}
      <div className="desk-movement-actions">
        {error && <Button variant="primary" onClick={() => void saveRun()}>重试记录</Button>}
        <Button variant={error ? 'ghost' : 'primary'} disabled={saving} onClick={close}>返回</Button>
      </div>
    </div>}
    {page === 'session' && session && session.phase !== 'finished' && move && detail && (
      <div className="desk-movement-session">
        <div className="desk-movement-stage">
          <MovementDiagram key={move} move={move} elapsed={previewStart === undefined ? detail.seconds * 1000 - remaining : Math.max(0, now - previewStart)} playing />
          <div>
            <h3>{detail.label}</h3>
            <span className="desk-movement-time" aria-label={`剩余 ${seconds} 秒`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
            <div>第 {session.index + 1} / {session.moves.length} 项</div>
            {next && <div className="desk-movement-next">下一项 · {deskMoves[next].label}</div>}
          </div>
        </div>
        <progress className="movement-progress" aria-label="整组动作进度" value={session.index + (1 - remaining / (detail.seconds * 1000))} max={session.moves.length} />
        {expectedKcal !== undefined && currentKcal !== undefined && totalKcal !== undefined && (
          <dl className="movement-energy" aria-label="活动净消耗估算">
            <div><dt>本动作预计 · {detail.seconds} 秒</dt><dd>约 {expectedKcal.toFixed(2)} kcal</dd></div>
            {session.phase !== 'ready' && <div><dt>本动作已消耗</dt><dd>约 {currentKcal.toFixed(2)} kcal</dd></div>}
            <div><dt>本次累计</dt><dd>约 {totalKcal.toFixed(2)} kcal</dd></div>
          </dl>
        )}
        {session.phase === 'ready' && <Button variant="ghost" onClick={() => {
          const time = performance.now();
          setNow(time);
          setPreviewStart(previewStart === undefined ? time : undefined);
        }}>{previewStart === undefined ? '预览动作' : '停止预览'}</Button>}
        <p>{detail.cue}</p>
        <p className="desk-movement-safety">{detail.support === '稳固无轮椅' ? '请使用稳固的无轮椅。' : detail.support === '桌面' ? '请使用稳固桌面，坐稳后再开始。' : detail.support === '墙面' ? '请使用稳固墙面。' : detail.support === '空地' ? '请确认地面平坦、周围无障碍。' : ''}如有疼痛或不适，请停止。</p>
        {guide && <>
          <p className="desk-movement-dose">{detail.dose}</p>
          <Button variant="ghost" onClick={() => void command('openSource', { url: deskMoveSource(move) }).then(result => {
            if (result.message !== '已打开系统浏览器。') setError('暂时打不开来源，请重试。');
          }, () => setError('暂时打不开来源，请重试。'))}>动作来源</Button>
          {runWeight !== undefined && <Button variant="ghost" onClick={() => void command('openSource', { url: detail.met.source }).then(result => {
            if (result.message !== '已打开系统浏览器。') setError('暂时打不开来源，请重试。');
          }, () => setError('暂时打不开来源，请重试。'))}>热量依据 · {detail.met.label}</Button>}
        </>}
        <div className="desk-movement-controls">
          <Button variant="ghost" disabled={session.index === 0} icon={<SkipBack size={16} />} onClick={() => {
            capture(session, performance.now());
            setSession(prepareDeskSession(session.moves, session.index - 1)); setGuide(false); setPreviewStart(undefined);
          }}>上一项</Button>
          <Button variant="primary" disabled={!weightReady} icon={running ? <Pause size={16} /> : <Play size={16} />} onClick={() => {
            if (running) { pause(); return; }
            const time = performance.now();
            if (!run.current.segments.length && session.index === 0 && session.phase === 'ready') run.current.weightKg = weightKg;
            setNow(time);
            setGuide(false);
            setPreviewStart(undefined);
            setSession(current => current ? resumeDeskSession(current, time) : null);
          }}>{running ? '暂停' : session.phase === 'paused' ? '继续' : '开始'}</Button>
          <Button variant="ghost" disabled={!next} icon={<SkipForward size={16} />} onClick={() => {
            capture(session, performance.now());
            setSession(prepareDeskSession(session.moves, session.index + 1)); setGuide(false); setPreviewStart(undefined);
          }}>下一项</Button>
          <Button variant="ghost" onClick={() => { pause(); setGuide(!guide); setError(''); setPreviewStart(undefined); }}>{guide ? '收起讲解' : '看讲解'}</Button>
          <Button variant="ghost" onClick={() => finish(session)}>结束</Button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    )}
  </Modal>;
}
