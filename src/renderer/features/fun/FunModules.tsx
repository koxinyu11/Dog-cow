import { MoodCard } from './MoodCard';
import { HopesCard } from './HopesCard';
import { ConverterCard } from './ConverterCard';
import { useState } from 'react';
import type { ModuleCtx } from '../../board/modules';
import { defaultFun, lunchOptions, weekKey } from '../../../shared/fun';
import { command } from '../../state';
import { Button, Emoji } from '../../ui';
import { Modal, Field } from '../../components/Modal';
import type { Fields } from '../../../shared/contracts';
import './fun.css';

type Kind = 'mood' | 'lunch' | 'hopes' | 'pasture' | 'converter';
export function FunModule({ kind, ...ctx }: ModuleCtx & { kind: Kind }) {
  const { state, today, notify } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const [editor, setEditor] = useState(false);
  const [draft, setDraft] = useState('');
  const [noRepeat, setNoRepeat] = useState(fun.noRepeat);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState('');
  const [lunchEditor, setLunchEditor] = useState(false);
  const [customMeal, setCustomMeal] = useState('');
  const [servings, setServings] = useState(1);
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
  const edit = () => {
    setError(''); setNoRepeat(fun.noRepeat);
    setDraft(fun.meals.join('\n'));
    setEditor(true);
  };
  const small = ctx.size === 's';
  const expanded = ctx.size === 'l' || ctx.size === 'tall' || ctx.size === 'wide';
  const options = lunchOptions(fun, today);
  const choice = draw && options.includes(draw) ? draw : '';
  const count = fun.rewarded.length;
  const unlocks = [[5, '围栏'], [15, '树'], [30, '小牛配饰']] as const;
  const drawMeal = () => { const pool = options.length > 1 ? options.filter(o=>o!==choice) : options; setDraw(pool[Math.floor(Math.random()*pool.length)] || ''); };
  const confirmMeal = async () => { if(choice && await run({action:'lunch',value:choice})) {setDraw('');notify('午饭有着落啦！');} };
  const editLunchRecord = () => {
    const current = fun.lunch.date === today ? fun.lunch : null;
    setError('');
    setCustomMeal(current?.chosen || '');
    setServings(current?.servings ?? 1);
    setLunchEditor(true);
  };
  const meal = choice || (fun.lunch.date===today ? fun.lunch.chosen : '今天吃什么？');
  const mealServings = fun.lunch.date === today ? fun.lunch.servings ?? 1 : 0;
  return <div className={`fun-card fun-${kind}`} data-size={ctx.size}>
    {kind==='mood' && <MoodCard ctx={ctx} busy={busy} run={run} />}
    {kind==='lunch' && <>
      <div className="fun-main"><span className="fun-symbol">🍜</span><div>{small && choice ? <button className="fun-result-button" disabled={busy} onClick={()=>void confirmMeal()} title="确认今天就吃它">{meal} ✓</button>:<strong>{meal}{mealServings > 0 && <small> · {mealServings} 份</small>}</strong>}{!small && <small>{!fun.meals.length?'先加几道菜':fun.noRepeat?`本周还可选 ${options.length} 道`:'随心抽，不设限'}</small>}</div></div>
      <div className="fun-actions"><Button size="sm" disabled={busy||!options.length} onClick={drawMeal}>{choice?'再抽一次':'帮我选'}</Button>{choice&&!small&&<Button size="sm" variant="primary" disabled={busy} onClick={()=>void confirmMeal()}>今天就吃它</Button>}<Button size="sm" variant="accent" onClick={editLunchRecord}>{fun.lunch.date===today?'修改记录':'自己填写'}</Button><Button variant="ghost" size="sm" onClick={edit}>菜单</Button>{!options.length&&fun.meals.length>0&&<Button size="sm" disabled={busy} onClick={()=>void run({action:'reset-lunch'})}>重置本周</Button>}</div>
      {expanded&&<div className="fun-detail"><h3>本周已选</h3><div className="fun-records">{(fun.lunch.week===weekKey(today)?fun.lunch.used:[]).map(item=><span key={item}>✓ {item}</span>)}{(fun.lunch.week!==weekKey(today)||!fun.lunch.used.length)&&<small>还没决定第一顿</small>}</div></div>}
    </>}
    {kind==='hopes'&&<HopesCard ctx={ctx} busy={busy} run={run} />}
    {kind==='pasture'&&<>
      <div className="fun-main pasture-main"><span className="fun-symbol">{count>=30?'👑':'🌱'}</span><div><strong>{count} 丛草</strong><small>{unlocks.find(([goal])=>count<goal) ? `再完成 ${unlocks.find(([goal])=>count<goal)![0]-count} 件，解锁${unlocks.find(([goal])=>count<goal)![1]}`:'牧场装饰已集齐'}</small></div></div>
      {!small&&<div className="fun-secondary fun-pasture-scene"><span>{count>=30?'👑':''}🐮 {count>=15?'🌳':''}</span><div>{Array.from({length:Math.min(count,24)},(_,i)=><span key={i}>🌱</span>)}</div>{count>=5&&<span className="fun-fence">▥ ▥ ▥ ▥ ▥ ▥</span>}</div>}
      {expanded&&<div className="fun-detail fun-unlocks">{unlocks.map(([goal,name])=><div key={goal} className={count>=goal?'is-unlocked':''}><span>{count>=goal?'✓':`${goal} 件`} {name}</span><progress max={goal} value={Math.min(goal,count)} aria-label={`${name}解锁进度`} /></div>)}</div>}
    </>}
    {kind==='converter'&&<ConverterCard ctx={ctx} busy={busy} error={error} run={run} />}
    {kind !== 'converter' && !editor && error && <p className="error" role="alert">{error}</p>}
    <Modal open={lunchEditor} title="记录今天吃了什么" onClose={() => { if (!busy) setLunchEditor(false); }}>
      <form onSubmit={async e => {
        e.preventDefault();
        if (await run({ action: 'custom-lunch', value: customMeal, servings })) {
          setDraw('');
          setLunchEditor(false);
          notify('今天这顿记下来啦！');
        }
      }}>
        <Field label="今天吃了什么"><input value={customMeal} maxLength={100} required placeholder="例如：牛肉面" onChange={e => setCustomMeal(e.target.value)} /></Field>
        <Field label="吃了多少份"><input type="number" min="0.1" max="20" step="0.1" required value={servings} onChange={e => setServings(Number(e.target.value))} /></Field>
        <p className="muted">可以填写 0.5 份、1 份、1.5 份等，热量爆表会按份量自动换算。</p>
        <p className="error" role="alert">{error}</p>
        <div className="dialog-actions"><Button disabled={busy} onClick={() => setLunchEditor(false)}>取消</Button><Button type="submit" variant="primary" disabled={busy}>保存这顿</Button></div>
      </form>
    </Modal>
    <Modal open={editor} title="午餐菜单" onClose={() => { if (!busy) setEditor(false); }}>
      <form onSubmit={async e => {
        e.preventDefault();
        if (await run({ action: 'meals', value: draft, noRepeat })) setEditor(false);
      }}>
        <Field label="每行一道，最多 50 道"><textarea rows={7} value={draft} onChange={e => setDraft(e.target.value)} /></Field>
        <label className="fun-checkbox"><input type="checkbox" checked={noRepeat} onChange={e => setNoRepeat(e.target.checked)} />本周不重复</label>
        <p className="error" role="alert">{error}</p><div className="dialog-actions"><Button disabled={busy} onClick={() => setEditor(false)}>取消</Button><Button type="submit" variant="primary" disabled={busy}>保存</Button></div>
      </form>
    </Modal>
  </div>;
}
