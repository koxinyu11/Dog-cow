import { DiagnosticsPanel } from './DiagnosticsPanel';
import { captureFailure } from './game-diagnostics';
import { useEffect, useRef, useState } from 'react';
import { FerrisWheel, ArrowUpRight, Gamepad2 } from 'lucide-react';
import { games, type LocalGame } from './registry';
import { GameHost } from './GameHost';
import { ParkScene } from './ParkScene';
import { Button } from '../../ui';
export function PlaygroundApp() {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<LocalGame | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    let alive = true;
    const apply = (theme: 'light' | 'dark') => { document.documentElement.dataset.theme = theme; };
    const unsubscribe = window.playground.onTheme(apply);
    void window.playground.invoke('bootstrap').then(value => {
      if (alive) { apply(value.theme); setReady(true); }
    }).catch(error => { captureFailure(error, 'bootstrap'); if (alive) setFailure(true); });
    return () => { alive = false; unsubscribe(); };
  }, [attempt]);
  useEffect(() => { if (ready) void window.playground.invoke('ready').catch(error => { captureFailure(error, 'ready'); setFailure(true); }); }, [ready]);
  return <div className="pg-app">
    <div className="pg-titlebar"><span><FerrisWheel size={15} /> 狗牛游乐场</span><span className="pg-local">本地 · 离线</span></div>
    <main>
      {failure ? <div className="pg-feedback" role="alert"><h1>游乐场暂时无法打开</h1><Button onClick={() => { setFailure(false); setReady(false); setAttempt(v => v + 1); }}>重试</Button></div> : !ready ? <div className="pg-feedback" role="status">正在打开游乐场…</div> : active ? <GameHost game={active} exit={() => { setActive(null); requestAnimationFrame(() => launcher.current?.focus()); }} /> : <>
        <header className="pg-heading"><div className="pg-eyebrow"><span /> 工位外的小世界</div><h1>班间，来点好玩的。</h1><p>歇一会儿，再去赚下一口草。</p></header>
        {games.length === 0 ? <section className="pg-empty"><ParkScene /><div className="pg-empty-copy"><span className="pg-ticket"><Gamepad2 size={15} /> 游乐场已就位</span><h2>第一场快乐，即将开场</h2><p>这里会慢慢装满好玩的小游戏。</p></div></section> : <section className="pg-catalog" aria-label="本地游戏">{games.map(game => <button className="pg-game-card" key={game.id} onClick={event => { launcher.current = event.currentTarget; setActive(game); }}><span className="pg-game-icon" aria-hidden="true">{game.icon}</span><small>{game.category}</small><h2>{game.title}</h2><p>{game.description}</p><span className="pg-play">开始玩 <ArrowUpRight size={17} /></span></button>)}</section>}
        <footer className="pg-footer"><FerrisWheel size={16} /><span>狗牛继续陪你上班，快乐在这里单独开窗。</span></footer>
      </>}
      <DiagnosticsPanel />
    </main>
  </div>;
}
