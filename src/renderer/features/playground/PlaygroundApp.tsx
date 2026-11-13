import { DiagnosticsPanel } from './DiagnosticsPanel';
import { captureFailure } from './game-diagnostics';
import { useEffect, useRef, useState } from 'react';
import { FerrisWheel } from 'lucide-react';
import { games, type LocalGame } from './registry';
import { readRecent, recordRecent } from './catalog';
import { GameHost } from './GameHost';
import { Lobby } from './Lobby';
import { Button } from '../../ui';
const storage = (() => { try { return window.localStorage; } catch { return undefined; } })();
export function PlaygroundApp() {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<LocalGame | null>(null);
  const [recent, setRecent] = useState(() => readRecent(storage, games));
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
    <div className="pg-titlebar"><span><FerrisWheel size={15} /> 狗牛游乐场</span><span className="pg-titlebar-end"><span className="pg-local">本地 · 离线</span><DiagnosticsPanel /></span></div>
    <main>
      {failure ? <div className="pg-feedback" role="alert"><h1>游乐场暂时无法打开</h1><Button onClick={() => { setFailure(false); setReady(false); setAttempt(v => v + 1); }}>重试</Button></div> : !ready ? <div className="pg-feedback" role="status">正在打开游乐场…</div> : active ? <GameHost game={active} exit={() => { setActive(null); requestAnimationFrame(() => launcher.current?.focus()); }} /> : <>
        <header className="pg-heading"><h1>班间，来点好玩的。</h1><p>歇一会儿，再去赚下一口草。</p></header>
        <Lobby games={games} recent={recent} open={(game, event) => { launcher.current = event.currentTarget; setRecent(recordRecent(storage, recent, game.id)); setActive(game); }} />
      </>}
    </main>
  </div>;
}
