import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { installPlaygroundDiagnostics } from '../../src/renderer/features/playground/game-diagnostics';
import { DiagnosticsPanel } from '../../src/renderer/features/playground/DiagnosticsPanel';
import { GameHost } from '../../src/renderer/features/playground/GameHost';
import type { GameProps, LocalGame } from '../../src/renderer/features/playground/registry';

// Test-only games; never registered in the shipped catalog.
installPlaygroundDiagnostics();
const counters = { mounted: 0, unmounted: 0, ticks: 0, activeTimers: 0 };
Object.assign(window, { playgroundFixture: counters });
const cachedEventError = new TypeError('fixture event failure');
function FixtureGame({ paused, diagnostics }: GameProps) {
  useEffect(() => {
    counters.mounted++;
    return () => { counters.unmounted++; };
  }, []);
  useEffect(() => {
    if (paused) return;
    counters.activeTimers++;
    const timer = setInterval(() => counters.ticks++, 10);
    return () => { clearInterval(timer); counters.activeTimers--; };
  }, [paused]);
  return <div data-game-state={paused ? 'paused' : 'playing'}>测试游戏
    <button onClick={diagnostics.guard('event', () => { throw cachedEventError; })}>事件异常测试</button>
    <button onClick={() => { void diagnostics.guard('promise', () => Promise.reject(new Error('fixture promise failure')))(); }}>异步异常测试</button>
    <button onClick={() => { setTimeout(diagnostics.guard('timer', () => { throw new Error('fixture timer failure'); }), 0); }}>定时器异常测试</button>
    <button onClick={() => { setTimeout(diagnostics.guard('timer', () => { throw new Error('fixture old round failure'); }), 300); }}>延迟旧局异常</button>
  </div>;
}
function BrokenGame(): never { throw new TypeError('fixture render failure'); }
const games: LocalGame[] = [
  { id: 'fixture', title: '生命周期测试', description: '', category: '', icon: '', load: async () => ({ default: FixtureGame }) },
  { id: 'broken-load', title: '加载失败测试', description: '', category: '', icon: '', load: async () => { throw new Error('fixture load failure'); } },
  { id: 'broken-render', title: '渲染失败测试', description: '', category: '', icon: '', load: async () => ({ default: BrokenGame }) },
];
function Fixture() {
  const [game, setGame] = useState<LocalGame | null>(null);
  return <>{game ? <GameHost game={game} exit={() => setGame(null)} /> : <div>{games.map(item => <button key={item.id} onClick={() => setGame(item)}>{item.title}</button>)}</div>}<DiagnosticsPanel /></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
