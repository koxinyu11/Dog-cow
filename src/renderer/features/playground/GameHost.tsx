import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '../../ui';
import { GameLoadError, createGameDiagnostics, type GameDiagnostics } from './game-diagnostics';
import type { LocalGame } from './registry';
import { GAME_POLICIES, isGameId, type GameActivity } from '../../../shared/game-progress';
import { useGameProgress } from './useGameProgress';
class GameBoundary extends Component<{ diagnostics: GameDiagnostics; children: ReactNode; exit(): void; failed(): void }, { failed: boolean; correlationId: string }> {
  state = { failed: false, correlationId: '' };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.failed();
    const correlationId = this.props.diagnostics.capture(error, error instanceof GameLoadError ? 'load' : 'render', info.componentStack ?? undefined);
    this.setState({ correlationId });
  }
  render() {
    return this.state.failed ? <div className="pg-feedback" role="alert"><h2>游戏暂时开小差了</h2><p>可以重新开始，或回大厅看看。</p><Button onClick={this.props.exit}>返回大厅</Button><small>问题编号：{this.state.correlationId}</small></div> : this.props.children;
  }
}
/** Every game fills the window below one title bar that carries the host controls. */
export function GameHost({ game, exit, status }: { game: LocalGame; exit(): void; status?: ReactNode }) {
  const [paused, setPaused] = useState(!document.hasFocus());
  const [round, setRound] = useState(0);
  const diagnostics = useMemo(() => createGameDiagnostics(game.id), [game.id, round]);
  const stage = useRef<HTMLDivElement>(null);
  const [activity, setActivity] = useState<GameActivity>('blocked');
  const onActivity = useCallback((next: GameActivity) => setActivity(next), []);
  const failed = useCallback(() => setActivity('blocked'), []);
  const progress = useGameProgress(game.id, diagnostics.runId, activity, paused);
  const Game = useMemo(() => lazy(() => Promise.resolve().then(() => game.load()).catch(error => { throw new GameLoadError(error); })), [game, round]);
  useEffect(() => {
    const pause = () => { if (!isGameId(game.id) || GAME_POLICIES[game.id].background === 'pause') setPaused(true); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    const unsubscribe = window.playground.onInterrupt(() => setPaused(true));
    stage.current?.focus();
    return () => { unsubscribe(); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); };
  }, [game]);
  return <section className="pg-game">
    <header className="pg-titlebar pg-game-bar">
      <span className="pg-game-nav"><Button size="sm" variant="ghost" icon={<ArrowLeft size={15} />} onClick={exit}>大厅</Button><h2>{game.title}</h2></span>
      <span className="pg-game-actions">
        {!game.persistent && <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => { setActivity('blocked'); setRound(v => v + 1); setPaused(false); }}>重新开始</Button>}
        <Button size="sm" variant="ghost" icon={<Pause size={14} />} onClick={() => setPaused(true)}>暂停</Button>
        {status}
      </span>
    </header>
    <div className="pg-stage" ref={stage} tabIndex={-1} onPointerDownCapture={progress.input} onKeyDownCapture={progress.input} onWheelCapture={progress.input}>
      <GameBoundary key={`${game.id}:${round}`} diagnostics={diagnostics} exit={exit} failed={failed}><Suspense fallback={<div className="pg-feedback" role="status">正在打开游戏…</div>}><Game paused={paused} diagnostics={diagnostics} onActivity={onActivity} /></Suspense></GameBoundary>
      {paused && <div className="pg-pause"><Button variant="primary" icon={<Play size={18} />} onClick={() => { progress.input(); setPaused(false); stage.current?.focus(); }}>继续游戏</Button></div>}
    </div>
    {progress.error && <div className="pg-progress-error" role="alert"><span>{progress.error}</span><Button size="sm" onClick={progress.retry}>重试保存</Button></div>}
    {progress.notice && <div className="pg-achievement" role="status"><strong>获聘新职称</strong><b>{progress.notice}</b></div>}
  </section>;
}
