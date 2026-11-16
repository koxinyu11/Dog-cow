import { useEffect, useRef, useState } from 'react';
import { BookOpen, ShoppingBag, Fish, Coins, LockKeyhole, UnlockKeyhole, X, MapPin, CircleHelp } from 'lucide-react';
import { Button } from '../../../../ui';
import type { GameProps } from '../../registry';
import { rods, tools, species, spots, rarities, type FishingView, type FishingAction, type FishingRequest } from '../../../../../shared/fishing';
import { Scene, FishArt } from './Scene';
import './fishing.css';
type Panel = 'bag' | 'book' | 'shop' | 'help' | null;
export default function DeskFishing({ paused, diagnostics }: GameProps) {
  const [view, setView] = useState<FishingView>();
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'signal' | 'reeling'>('idle');
  const [notice, setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const gate = useRef(false);
  const retryRequest = useRef<FishingRequest | null>(null);
  const reelTime = useRef(0);
  const remaining = useRef(0);
  const roundId = view?.state.round?.id;
  async function send(action: FishingAction, id?: string) {
    if (gate.current || (paused && action !== 'view')) return;
    gate.current = true; setBusy(true); setError(''); setProblem(''); setNotice('');
    const request = action === 'retry' && retryRequest.current ? retryRequest.current : { action, id, requestId: crypto.randomUUID(), roundId: view?.state.round?.id };
    try {
      const reply = await window.playground.fishing(request);
      if (!mounted.current) return;
      retryRequest.current = null;
      if (reply.view) setView(reply.view);
      if (reply.error) { setError(reply.error); setProblem(reply.correlationId ?? ''); }
      else if (action === 'sell' || action === 'sellAll') setNotice('收获已出售，狗牛币已入账');
      else if (action === 'buyRod' || action === 'buyTool') setNotice('购买成功，装备已放入背包');
      if (action === 'reel' || request.action === 'reel') setPhase(reply.view?.state.round ? 'signal' : 'idle');
      return reply;
    } catch (failure) {
      // An uncertain IPC reply retries the same operation id; a successful command cannot run twice.
      if (action !== 'view') retryRequest.current = request;
      if (mounted.current) {
        setError('暂时无法连接，请重试；已完成的操作不会重复执行。');
        setProblem(diagnostics.capture(failure, 'ipc'));
        if (action === 'reel') setPhase('signal');
      }
    } finally { gate.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true;
    void send('view');
    const focus = () => { void send('view'); };
    window.addEventListener('focus', focus);
    return () => { mounted.current = false; window.removeEventListener('focus', focus); };
  }, []);
  useEffect(() => { if (view && !paused && !panel) root.current?.focus(); }, [!!view]);
  useEffect(() => {
    if (!roundId) { setPhase('idle'); return; }
    remaining.current = view!.state.round!.wait * 1000;
    setPhase('waiting');
  }, [roundId]);
  useEffect(() => {
    if (paused || panel || busy || !view?.state.round || (phase !== 'waiting' && phase !== 'reeling')) return;
    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const elapsed = Math.max(0, now - last); last = now;
      if (phase === 'waiting') {
        remaining.current -= elapsed;
        if (remaining.current <= 0) { setPhase('signal'); return; }
      } else {
        reelTime.current -= elapsed;
        if (reelTime.current <= 0) { void send('reel'); return; }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [paused, panel, busy, phase, roundId]);
  function primary() {
    if (paused || panel || busy || view?.pending || retryRequest.current) return;
    if (phase === 'idle') void send('cast');
    else if (phase === 'signal') { reelTime.current = 900; setPhase('reeling'); }
  }
  const state = view?.state;
  if (!view || !state) return <div className="pg-feedback" role="status"><p>{error || '正在来到池塘边…'}</p>{error && <Button disabled={busy || paused} onClick={() => void send('view')}>重新读取</Button>}{problem && <small>问题编号：{problem}</small>}</div>;
  const rod = rods.find(r => r.id === state.equipped)!;
  const sale = state.bag.filter(c => !c.locked).reduce((sum, c) => sum + c.value, 0);
  const noRods = !Object.values(state.rods).some(Boolean);
  const locked = busy || paused || view.pending || !!retryRequest.current;
  const stranded = noRods && !state.round;
  const controlsLocked = locked || !!state.round;
  const lastFish = species.find(s => s.id === state.last?.species);
  const openPanel = (next: Panel) => { setPanel(next); setNotice(''); if (!busy && !retryRequest.current) void send('view'); };
  return <div className={`df-game ${paused ? 'is-paused' : ''}`} ref={root} tabIndex={0} aria-label="工位钓鱼，空格抛竿或收线" onKeyDown={event => {
    if (event.code !== 'Space' || event.repeat || event.target !== root.current) return;
    event.preventDefault(); primary();
  }}>
    <div className="df-topline"><div className="df-location"><MapPin size={14}/>{spots.find(s => s.id === state.spot)!.name}<span>已发现 {Object.keys(state.book).length}/12</span></div><span className="df-wallet"><Coins size={16}/>{view.balance}<small>狗牛币</small></span></div>
    <Scene rod={state.equipped} spot={state.spot} phase={phase} signal={state.round?.signal} paused={paused || !!panel || busy} result={state.last} fishColor={lastFish?.color} net={state.tools.includes('net')} float={state.tools.includes('float')}/>
    <div className="df-dock"><div className="df-equipped"><span className="df-rod-dot" style={{ background: rod.color }}/><div><strong>{rod.name}{noRods ? ' · 已损坏' : ''}</strong><small>承重 {rod.capacity} kg · {state.bait === 'plain' ? '普通饵' : '虫饵'}</small></div></div>
      <div className="df-main-action">{stranded ? <Button variant="primary" disabled={locked} onClick={() => void send('rescue')}>领取应急竹竿</Button> : <Button variant="primary" disabled={locked || view.walletLocked || phase === 'waiting' || phase === 'reeling'} onClick={primary}>{busy ? '处理中…' : phase === 'waiting' ? '等一点动静…' : phase === 'signal' ? '收线，看看是什么' : phase === 'reeling' ? '慢慢收线…' : state.last ? '再抛一竿' : '抛竿'}</Button>}<small>{phase === 'signal' ? '慢慢来，信号会等你' : phase === 'waiting' ? '水下的动静，不一定是鱼' : phase === 'reeling' ? '水下会是什么呢' : '空格也可以 · 随时暂停'}</small></div>
      <div className="df-shortcuts"><button aria-label={`鱼篓，${state.bag.length} 份收获`} disabled={locked || !!state.round} onClick={() => openPanel('bag')}><Fish size={18}/><span>鱼篓 {state.bag.length}</span></button><button aria-label="图鉴" disabled={locked || !!state.round} onClick={() => openPanel('book')}><BookOpen size={18}/><span>图鉴</span></button><button aria-label="工具商店" disabled={locked || !!state.round} onClick={() => openPanel('shop')}><ShoppingBag size={18}/><span>商店</span></button><button aria-label="玩法帮助" disabled={locked || !!state.round} onClick={() => openPanel('help')}><CircleHelp size={17}/></button></div>
    </div>
    {(error || view.pending || view.walletLocked) && <div className="df-error" role="alert"><span>{error || (view.pending ? '本次操作尚未保存，请重试保存。' : '钱包暂不可用，请在主界面处理。')}{problem && <small>问题编号：{problem}</small>}</span><Button size="sm" disabled={busy || paused} onClick={() => void send(view.pending || retryRequest.current ? 'retry' : 'view')}>{view.pending ? '重试保存' : '重试'}</Button></div>}
    {notice && <div className="df-notice" role="status">{notice}</div>}
    {panel && <section className="df-panel" aria-label={{ bag: '鱼篓', book: '鱼类图鉴', shop: '工具商店', help: '玩法帮助' }[panel]}>
      <header><div><small>{panel === 'shop' ? 'RIVERSIDE SUPPLIES' : panel === 'book' ? 'LITTLE DISCOVERIES' : panel === 'bag' ? 'TODAY’S CATCH' : 'TAKE YOUR TIME'}</small><h3>{{ bag: '岸边的收获', book: '水下的邻居', shop: '河边杂货铺', help: '钓鱼小记' }[panel]}</h3></div><button className="df-close" aria-label="返回池塘" onClick={() => { setPanel(null); root.current?.focus(); }}><X size={18}/></button></header>
      {panel === 'bag' && <><div className="df-panel-summary"><span>{state.bag.length}/200 份 · 锁定的收获会保留</span><Button size="sm" variant="primary" disabled={locked || !sale || view.walletLocked} onClick={() => void send('sellAll')}>一键出售 · {sale} 币</Button></div><div className="df-items">{state.bag.length === 0 ? <p className="df-empty">鱼篓还是空的，去水边坐一会儿吧。</p> : state.bag.map(item => {
        const fish = species.find(s => s.id === item.species);
        return <article className="df-item" key={item.id}>{fish ? <FishArt color={fish.color}/> : <span className="df-item-object">{item.species === 'badge' ? '▤' : '♧'}</span>}<div><strong>{fish?.name ?? (item.species === 'badge' ? '旧工牌' : '瓶中纸条')}</strong><small>{item.kg.toFixed(2)} kg · {fish ? rarities[fish.rarity] : '河边旧物'}</small></div><button className="df-lock" aria-label={item.locked ? '解锁收获' : '锁定收获'} disabled={locked} onClick={() => void send('lock', item.id)}>{item.locked ? <LockKeyhole size={16}/> : <UnlockKeyhole size={16}/>}</button><Button size="sm" disabled={locked || item.locked || view.walletLocked} onClick={() => void send('sell', item.id)}>{item.value} 币出售</Button></article>;
      })}</div></>}
      {panel === 'book' && <div className="df-book">{species.map(fish => { const entry = state.book[fish.id]; return <article key={fish.id} className={`df-species ${entry ? '' : 'is-unknown'}`}><FishArt color={fish.color} rare={fish.rarity >= 3}/><span className={`df-rarity rarity-${fish.rarity}`}>{entry ? rarities[fish.rarity] : '未发现'}</span><strong>{entry ? fish.name : '？'}</strong><small>{entry ? `${entry.count} 次 · 最大 ${entry.largest.toFixed(2)} kg` : spots.find(s => s.id === fish.spot)!.name}</small>{entry && <p>{fish.note}</p>}</article>; })}</div>}
      {panel === 'shop' && <><div className="df-spots">{spots.map(spot => <button key={spot.id} disabled={controlsLocked || Object.keys(state.book).length < spot.required} aria-pressed={state.spot === spot.id} onClick={() => void send('spot', spot.id)}><strong>{spot.name}</strong><small>{Object.keys(state.book).length < spot.required ? `发现 ${spot.required} 种鱼后开放` : spot.description}</small></button>)}</div><h4>鱼竿 <span>购买即装备 · 超载可能断竿</span></h4><div className="df-items">{rods.map(r => <article className="df-item" key={r.id}><svg className="df-rod-art" viewBox="0 0 60 48" aria-hidden="true"><path d="M8 41Q26 18 50 6" fill="none" stroke={r.color} strokeWidth="4"/><path d="M50 6 51 37" stroke={r.color} fill="none"/></svg><div><strong>{r.name} {state.equipped === r.id && state.rods[r.id] > 0 && <em>使用中</em>}</strong><small>承重 {r.capacity} kg · 持有 {state.rods[r.id]} 根</small></div>{state.rods[r.id] > 0 && state.equipped !== r.id && <Button size="sm" disabled={controlsLocked} onClick={() => void send('equip', r.id)}>装备</Button>}<Button size="sm" disabled={controlsLocked || view.walletLocked || view.balance < r.price} onClick={() => void send('buyRod', r.id)}>{r.price} 币购买</Button></article>)}</div>
        <h4>随身工具 <span>永久使用 · 无需补充</span></h4><div className="df-items">{tools.map(tool => <article className="df-item" key={tool.id}><span className="df-item-object">{tool.icon}</span><div><strong>{tool.name}</strong><small>{tool.description}</small></div><Button size="sm" disabled={controlsLocked || view.walletLocked || state.tools.includes(tool.id) || view.balance < tool.price} onClick={() => void send('buyTool', tool.id)}>{state.tools.includes(tool.id) ? '已拥有' : `${tool.price} 币购买`}</Button></article>)}</div><div className="df-baits"><span>鱼饵</span>{(['plain', 'worm'] as const).map(bait => <button key={bait} disabled={controlsLocked || (bait === 'worm' && !state.tools.includes('baitbox'))} aria-pressed={state.bait === bait} onClick={() => void send('bait', bait)}>{bait === 'plain' ? '普通饵 · 无限' : '虫饵 · 无限'}</button>)}</div></>}
      {panel === 'help' && <div className="df-help"><p>抛竿后等浮标或鱼线出现动静，再点击收线。信号不会过期，不用拼手速；也可能收上来旧物、水草或空钩。</p><p>鱼超过鱼竿承重时，越重越容易断竿。断竿会损失当前鱼竿，猎物逃走；鱼篓内的收获保留。没有可用鱼竿时可以免费领取应急竹竿。</p><p>鱼竿用狗牛币购买。出售收获可以赚币，锁定的收获不会被出售。卖掉鱼后，图鉴记录仍会保留。</p><details><summary>概率与兑换规则</summary><p>每竿空钩约 12%，旧物或水草约 11%，鱼约 77%。鱼种权重按当前钓点计算；虫饵将稀有及以上鱼的权重乘以 1.8。浮标减少等待，抄网增加尺寸与重量。</p><p>超载断竿概率为（重量 ÷ 承重 − 1）× 60%，最高 95%；承重内不会断。鱼的价值由种类决定，尺寸最多提供约 28% 加成。具体收获价值以鱼篓为准。</p></details><p>离开窗口自动暂停，回来手动继续。返回大厅、重开或关窗会保留收藏与当前竿结果，重新进入时重新等待；不会重新抽取结果。交易保存成功后才会生效。</p></div>}
    </section>}
  </div>;
}
