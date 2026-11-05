import { MoodCard } from './MoodCard';
import { HopesCard } from './HopesCard';
import { ConverterCard } from './ConverterCard';
import { LunchCard } from './LunchCard';
import { useState } from 'react';
import type { ModuleCtx } from '../../board/modules';
import { defaultFun } from '../../../shared/fun';
import { command } from '../../state';
import type { Fields } from '../../../shared/contracts';
import './fun.css';

type Kind = 'mood' | 'lunch' | 'hopes' | 'pasture' | 'converter';
export function FunModule({ kind, ...ctx }: ModuleCtx & { kind: Kind }) {
  const { state, notify } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (payload: Fields) => {
    if (busy) return null;
    setBusy(true); setError('');
    try {
      const result = await command('fun', payload, 'home');
      if (!result.applied || !result.persisted) { setError(result.message); return null; }
      if (result.code === 'wallpaper-unlocked') notify(result.message);
      return result;
    } catch { setError('暂时没能保存，请重试。'); return null; }
    finally { setBusy(false); }
  };
  const small = ctx.size === 's';
  const expanded = ctx.size === 'l' || ctx.size === 'tall' || ctx.size === 'wide';
  const count = fun.rewarded.length;
  const unlocks = [[5, '围栏'], [15, '树'], [30, '小牛配饰']] as const;
  return <div className={`fun-card fun-${kind}`} data-size={ctx.size}>
    {kind==='mood' && <MoodCard ctx={ctx} busy={busy} run={run} />}
    {kind==='lunch' && <LunchCard ctx={ctx} busy={busy} error={error} setError={setError} run={run} />}
    {kind==='hopes'&&<HopesCard ctx={ctx} busy={busy} run={run} />}
    {kind==='pasture'&&<>
      <div className="fun-main pasture-main"><span className="fun-symbol">{count>=30?'👑':'🌱'}</span><div><strong>{count} 丛草</strong><small>{unlocks.find(([goal])=>count<goal) ? `再完成 ${unlocks.find(([goal])=>count<goal)![0]-count} 件，解锁${unlocks.find(([goal])=>count<goal)![1]}`:'牧场装饰已集齐'}</small></div></div>
      {!small&&<div className="fun-secondary fun-pasture-scene"><span>{count>=30?'👑':''}🐮 {count>=15?'🌳':''}</span><div>{Array.from({length:Math.min(count,24)},(_,i)=><span key={i}>🌱</span>)}</div>{count>=5&&<span className="fun-fence">▥ ▥ ▥ ▥ ▥ ▥</span>}</div>}
      {expanded&&<div className="fun-detail fun-unlocks">{unlocks.map(([goal,name])=><div key={goal} className={count>=goal?'is-unlocked':''}><span>{count>=goal?'✓':`${goal} 件`} {name}</span><progress max={goal} value={Math.min(goal,count)} aria-label={`${name}解锁进度`} /></div>)}</div>}
    </>}
    {kind==='converter'&&<ConverterCard ctx={ctx} busy={busy} error={error} run={run} />}
    {kind !== 'converter' && kind !== 'lunch' && error && <p className="error" role="alert">{error}</p>}
  </div>;
}
