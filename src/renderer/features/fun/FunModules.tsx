import { MoodCard } from './MoodCard';
import { useState } from 'react';
import type { ModuleCtx } from '../../board/modules';
import { defaultFun, daysUntil, lunchOptions, weekKey } from '../../../shared/fun';
import { command } from '../../state';
import { Button, Emoji } from '../../ui';
import { Modal, Field } from '../../components/Modal';
import { DatePicker } from '../../components/DatePicker';
import { money } from '../../format';
import type { Fields } from '../../../shared/contracts';
import './fun.css';

type Kind = 'mood' | 'lunch' | 'hopes' | 'pasture' | 'converter';
export function FunModule({ kind, ...ctx }: ModuleCtx & { kind: Kind }) {
  const { state, today, select, notify, openSettings } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const [editor, setEditor] = useState(false);
  const [draft, setDraft] = useState('');
  const [noRepeat, setNoRepeat] = useState(fun.noRepeat);
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState('');
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
    setError(''); setNoRepeat(fun.noRepeat); setDate(today);
    setDraft(kind === 'lunch' ? fun.meals.join('\n') : kind === 'converter' ? fun.products.map(p => `${p.name} | ${p.price}`).join('\n') : '');
    setEditor(true);
  };
  const small = ctx.size === 's';
  const expanded = ctx.size === 'l' || ctx.size === 'tall' || ctx.size === 'wide';
  const options = lunchOptions(fun, today);
  const choice = draw && options.includes(draw) ? draw : '';
  const hope = fun.hopes.find(h => h.id === fun.pinned);
  const product = fun.products[fun.product];
  const earned = state.income.snapshot?.earnedToday;
  const count = fun.rewarded.length;
  const unlocks = [[5, '围栏'], [15, '树'], [30, '小牛配饰']] as const;
  const drawMeal = () => { const pool = options.length > 1 ? options.filter(o=>o!==choice) : options; setDraw(pool[Math.floor(Math.random()*pool.length)] || ''); };
  const confirmMeal = async () => { if(choice && await run({action:'lunch',value:choice})) {setDraw('');notify('午饭有着落啦！');} };
  const meal = choice || (fun.lunch.date===today ? fun.lunch.chosen : '今天吃什么？');
  const hopeTime = hope ? daysUntil(today,hope.date) : 0;
  const hopeLabel = hopeTime>0 ? `还有 ${hopeTime} 天` : hopeTime===0 ? '就是今天！' : `已过去 ${-hopeTime} 天`;
  const amount = product && typeof earned==='number' && Number.isFinite(earned) ? `${(earned/product.price).toLocaleString('zh-CN',{maximumFractionDigits:1})} 份${product.name}` : '设置一个小目标';
  return <div className={`fun-card fun-${kind}`} data-size={ctx.size}>
    {kind==='mood' && <MoodCard ctx={ctx} busy={busy} run={run} />}
    {kind==='lunch' && <>
      <div className="fun-main"><span className="fun-symbol">🍜</span><div>{small && choice ? <button className="fun-result-button" disabled={busy} onClick={()=>void confirmMeal()} title="确认今天就吃它">{meal} ✓</button>:<strong>{meal}</strong>}{!small && <small>{!fun.meals.length?'先加几道菜':fun.noRepeat?`本周还可选 ${options.length} 道`:'随心抽，不设限'}</small>}</div></div>
      <div className="fun-actions"><Button size="sm" disabled={busy||!options.length} onClick={drawMeal}>{choice?'再抽一次':'帮我选'}</Button>{choice&&!small&&<Button size="sm" variant="primary" disabled={busy} onClick={()=>void confirmMeal()}>今天就吃它</Button>}<Button variant="ghost" size="sm" onClick={edit}>菜单</Button>{!options.length&&fun.meals.length>0&&<Button size="sm" disabled={busy} onClick={()=>void run({action:'reset-lunch'})}>重置本周</Button>}</div>
      {expanded&&<div className="fun-detail"><h3>本周已选</h3><div className="fun-records">{(fun.lunch.week===weekKey(today)?fun.lunch.used:[]).map(item=><span key={item}>✓ {item}</span>)}{(fun.lunch.week!==weekKey(today)||!fun.lunch.used.length)&&<small>还没决定第一顿</small>}</div></div>}
    </>}
    {kind==='hopes'&&<>
      <div className="fun-main"><span className="fun-symbol">🏝️</span><div><strong>{hope?.name||'给生活留个盼头'}</strong>{hope&&<b>{hopeLabel}</b>}{hope&&!small&&<button className="fun-date" onClick={()=>{select(hope.date);notify('已切换月历日期');}}>{hope.date} ↗ 月历</button>}</div></div>
      <div className="fun-actions">{!small&&fun.hopes.length>1&&<select aria-label="切换置顶盼头" disabled={busy} value={fun.pinned} onChange={e=>void run({action:'pin',id:e.target.value})}>{fun.hopes.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select>}<Button variant="ghost" size="sm" onClick={edit}>{small?'盼头清单':'管理盼头'}</Button></div>
      {expanded&&<div className="fun-detail fun-timeline"><h3>接下来</h3>{[...fun.hopes].sort((a,b)=>a.date.localeCompare(b.date)).map(h=><button key={h.id} onClick={()=>{select(h.date);notify('已切换月历日期');}}><span>{h.name}</span><small>{h.date}</small></button>)}{!fun.hopes.length&&<small>添加发薪日、旅行或假期</small>}</div>}
    </>}
    {kind==='pasture'&&<>
      <div className="fun-main pasture-main"><span className="fun-symbol">{count>=30?'👑':'🌱'}</span><div><strong>{count} 丛草</strong><small>{unlocks.find(([goal])=>count<goal) ? `再完成 ${unlocks.find(([goal])=>count<goal)![0]-count} 件，解锁${unlocks.find(([goal])=>count<goal)![1]}`:'牧场装饰已集齐'}</small></div></div>
      {!small&&<div className="fun-secondary fun-pasture-scene"><span>{count>=30?'👑':''}🐮 {count>=15?'🌳':''}</span><div>{Array.from({length:Math.min(count,24)},(_,i)=><span key={i}>🌱</span>)}</div>{count>=5&&<span className="fun-fence">▥ ▥ ▥ ▥ ▥ ▥</span>}</div>}
      {expanded&&<div className="fun-detail fun-unlocks">{unlocks.map(([goal,name])=><div key={goal} className={count>=goal?'is-unlocked':''}><span>{count>=goal?'✓':`${goal} 件`} {name}</span><progress max={goal} value={Math.min(goal,count)} aria-label={`${name}解锁进度`} /></div>)}</div>}
    </>}
    {kind==='converter'&&<>
      {!state.income.settings?<Button onClick={()=>openSettings('income')}>先设置工资</Button>:<>
        <div className="fun-main"><span className="fun-symbol">🧋</span><div><strong>{amount}</strong>{!small&&<small>今日已赚 ¥{money(earned)}</small>}</div></div>
        <div className="fun-actions">{fun.products.length>0&&<select aria-label="换算商品" disabled={busy} value={fun.product} onChange={e=>void run({action:'product',value:Number(e.target.value)})}>{fun.products.map((p,value)=><option key={value} value={value}>{p.name}</option>)}</select>}<Button size="sm" variant="ghost" onClick={edit}>{small?'设置':'商品与单价'}</Button></div>
        {expanded&&<div className="fun-detail fun-conversions"><h3>也相当于</h3>{fun.products.map((p,i)=><button key={i} aria-pressed={i===fun.product} disabled={busy} onClick={()=>void run({action:'product',value:i})}><span>{p.name}<small>¥{money(p.price)} / 份</small></span><b>{typeof earned==='number'&&Number.isFinite(earned)?(earned/p.price).toLocaleString('zh-CN',{maximumFractionDigits:1}):'—'} 份</b></button>)}</div>}
      </>}
    </>}
    {!editor && error && <p className="error" role="alert">{error}</p>}
    <Modal open={editor} title={kind === 'lunch' ? '午餐菜单' : kind === 'hopes' ? '盼头清单' : '商品与单价'} onClose={() => { if (!busy) setEditor(false); }}>
      <form onSubmit={async e => {
        e.preventDefault();
        const payload = kind === 'lunch' ? { action: 'meals', value: draft, noRepeat } : kind === 'hopes' ? { action: 'hope', name: draft, date, id: crypto.randomUUID() } : { action: 'products', value: draft.split('\n').filter(x => x.trim()).map(line => { const [name, price] = line.split('|'); return { name: name.trim(), price: Number(price?.trim()) }; }) };
        if (await run(payload)) setEditor(false);
      }}>
        <Field label={kind === 'lunch' ? '每行一道，最多 50 道' : kind === 'hopes' ? '盼头名称' : '每行：商品 | 单价（元）'}>{kind === 'hopes' ? <input value={draft} maxLength={60} required onChange={e => setDraft(e.target.value)} /> : <textarea rows={7} value={draft} onChange={e => setDraft(e.target.value)} />}</Field>
        {kind === 'lunch' && <label className="fun-checkbox"><input type="checkbox" checked={noRepeat} onChange={e => setNoRepeat(e.target.checked)} />本周不重复</label>}
        {kind === 'hopes' && <><Field label="期待日期"><DatePicker value={date} onChange={setDate} /></Field><div className="fun-hope-list">{fun.hopes.map(h => <div key={h.id}><span>{h.name} · {h.date}</span><Button size="sm" aria-pressed={h.id===fun.pinned} disabled={busy} onClick={()=>void run({action:'pin',id:h.id})}>置顶</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void run({ action: 'remove-hope', id: h.id })}>移除</Button></div>)}</div></>}
        <p className="error" role="alert">{error}</p><div className="dialog-actions"><Button disabled={busy} onClick={() => setEditor(false)}>取消</Button><Button type="submit" variant="primary" disabled={busy}>保存</Button></div>
      </form>
    </Modal>
  </div>;
}
