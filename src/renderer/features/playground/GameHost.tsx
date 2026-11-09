import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '../../ui';
import { GameLoadError, createGameDiagnostics, type GameDiagnostics } from './game-diagnostics';
import type { LocalGame } from './registry';
class GameBoundary extends Component<{ diagnostics: GameDiagnostics; children: ReactNode; exit(): void }, { failed: boolean; correlationId: string }> {
  state = { failed: false, correlationId: '' };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    const correlationId = this.props.diagnostics.capture(error, error instanceof GameLoadError ? 'load' : 'render', info.componentStack ?? undefined);
    this.setState({ correlationId });
  }
  render() {
    return this.state.failed ? <div className="pg-feedback" role="alert"><h2>游戏暂时开小差了</h2><p>可以重新开始，或回大厅看看。</p><Button onClick={this.props.exit}>返回大厅</Button><small>问题编号：{this.state.correlationId}</small></div> : this.props.children;
  }
}
export function GameHost({ game, exit }: { game: LocalGame; exit(): void }) {
  const [paused, setPaused] = useState(!document.hasFocus());
  const [round, setRound] = useState(0);
  const diagnostics = useMemo(() => createGameDiagnostics(game.id), [game.id, round]);
  const stage = useRef<HTMLDivElement>(null);
  const Game = useMemo(() => lazy(() => Promise.resolve().then(() => game.load()).catch(error => { throw new GameLoadError(error); })), [game, round]);
  useEffect(() => {
    const pause = () => setPaused(true);
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    stage.current?.focus();
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); };
  }, [game]);
  return <section className="pg-game">
    <header className="pg-game-bar"><Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={exit}>大厅</Button><h2>{game.title}</h2>
      <Button icon={<RotateCcw size={15} />} onClick={() => { setRound(v => v + 1); setPaused(false); }}>重新开始</Button>
      <Button icon={<Pause size={15} />} onClick={() => setPaused(true)}>暂停</Button></header>
    <div className="pg-stage" ref={stage} tabIndex={-1}>
      <GameBoundary key={`${game.id}:${round}`} diagnostics={diagnostics} exit={exit}><Suspense fallback={<div className="pg-feedback" role="status">正在打开游戏…</div>}><Game paused={paused} diagnostics={diagnostics} /></Suspense></GameBoundary>
      {paused && <div className="pg-pause"><Button variant="primary" icon={<Play size={18} />} onClick={() => { setPaused(false); stage.current?.focus(); }}>继续游戏</Button></div>}
    </div>
  </section>;
}
