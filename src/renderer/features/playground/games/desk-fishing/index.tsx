import { useEffect, useRef, useState } from 'react';
import { BookOpen, ShoppingBag, Fish, Coins, MapPin, CircleHelp, X } from 'lucide-react';
import { Button } from '../../../../ui';
import type { GameProps } from '../../registry';
import { rods, species, spots, durabilityLeft, type FishingView, type FishingAction, type FishingRequest } from '../../../../../shared/fishing';
import { Scene } from './Scene';
import { Modal } from './panels/Modal';
import { Bag, BagFooter } from './panels/Bag';
import { Book } from './panels/Book';
import { Shop, type ShopTab } from './panels/Shop';
import './fishing.css';
type Panel = 'bag' | 'book' | 'shop' | null;
export default function DeskFishing({ paused, diagnostics }: GameProps) {
  const [view, setView] = useState<FishingView>();
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'signal' | 'reeling'>('idle');
  const [notice, setNotice] = useState('');
  const [shopTab, setShopTab] = useState<ShopTab>('rods');
  const [help, setHelp] = useState(false);
  /** Brief lock after a reel so the reveal is seen before a panel can cover it. */
  const [revealing, setRevealing] = useState(false);
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
      if (action === 'reel' || request.action === 'reel') {
        setPhase(reply.view?.state.round ? 'signal' : 'idle');
        if (!reply.view?.state.round) setRevealing(true);
      }
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
  useEffect(() => {
    if (!revealing) return;
    const timer = setTimeout(() => setRevealing(false), 1200);
    return () => clearTimeout(timer);
  }, [revealing]);
  function primary() {
    if (paused || panel || busy || view?.pending || retryRequest.current) return;
    if (phase === 'idle') void send('cast');
    else if (phase === 'signal') { reelTime.current = 900; setPhase('reeling'); }
  }
  const state = view?.state;
  if (!view || !state) return <div className="pg-feedback" role="status"><p>{error || '正在来到池塘边…'}</p>{error && <Button disabled={busy || paused} onClick={() => void send('view')}>重新读取</Button>}{problem && <small>问题编号：{problem}</small>}</div>;
  const rod = rods.find(r => r.id === state.equipped)!;
  const noRods = !Object.values(state.rods).some(Boolean);
  const locked = busy || paused || view.pending || !!retryRequest.current;
  const stranded = noRods && !state.round;
  const controlsLocked = locked || !!state.round;
  const entryLocked = locked || !!state.round || revealing;
  const discovered = Object.keys(state.book).length;
  const life = noRods ? 0 : durabilityLeft(state, state.equipped);
  const lifeTone = life > .5 ? 'good' : life > .2 ? 'worn' : 'bad';
  const openPanel = (next: Exclude<Panel, null>, tab?: ShopTab) => { setPanel(next); setHelp(false); setNotice(''); if (tab) setShopTab(tab); if (!busy && !retryRequest.current) void send('view'); };
  const closePanel = () => { setPanel(null); root.current?.focus(); };
  const props = { view, locked, controlsLocked, send: (action: FishingAction, id?: string) => void send(action, id) };
  const label = busy ? '处理中…' : phase === 'waiting' ? '等一点动静…' : phase === 'signal' ? '收线' : phase === 'reeling' ? '慢慢收线…' : state.last ? '再抛一竿' : '抛竿';
  const hint = phase === 'signal' ? '慢慢来，信号会等你' : phase === 'waiting' ? '水下的动静，不一定是鱼' : phase === 'reeling' ? '水下会是什么呢' : '空格也可以';
  const alert = (error || view.pending || view.walletLocked) && <div className="df-toast is-error" role="alert"><span>{error || (view.pending ? '本次操作尚未保存' : '钱包暂不可用，请在主界面处理')}{problem && <small>问题编号：{problem}</small>}</span><button disabled={busy || paused} onClick={() => void send(view.pending || retryRequest.current ? 'retry' : 'view')}>{view.pending ? '重试保存' : '重试'}</button></div>;
  return <div className={`df-game ${paused ? 'is-paused' : ''}`} ref={root} tabIndex={0} aria-label="工位钓鱼，空格抛竿或收线" onKeyDown={event => {
    if (event.code !== 'Space' || event.repeat || event.target !== root.current) return;
    event.preventDefault(); primary();
  }}>
    <Scene rod={state.equipped} spot={state.spot} phase={phase} signal={state.round?.signal} paused={paused || !!panel || busy} result={state.last} net={state.tools.includes('net')} float={state.tools.includes('float')}/>
    <div className="df-hud">
      <div className="df-chip"><MapPin size={13}/>{spots.find(s => s.id === state.spot)!.name}<span>·</span><button className="df-chip-link" disabled={entryLocked} onClick={() => openPanel('book')}>图鉴 {discovered}/{species.length}</button></div>
      <div className="df-chip is-wallet"><Coins size={14}/><b>{view.balance}</b></div>
    </div>
    {!panel && alert}
    {!panel && notice && <div className="df-toast" role="status">{notice}</div>}
    <div className="df-dock">
      <button className="df-equipped" disabled={entryLocked} onClick={() => openPanel('shop', 'rods')} aria-label={`${rod.name}，打开商店`}>
        <span className="df-rod-dot" style={{ background: rod.color }}/>
        <span><strong>{rod.name}{noRods ? ' · 已损坏' : lifeTone === 'bad' ? <em>快断了</em> : null}</strong><small>{rod.capacity} kg · {state.bait === 'plain' ? '普通饵' : '虫饵'}</small>
          {!noRods && <i className={`df-life is-${lifeTone}`} role="meter" aria-label="鱼竿耐久" aria-valuenow={Math.round(life * 100)} aria-valuemin={0} aria-valuemax={100}><b style={{ width: `${life * 100}%` }}/></i>}</span>
      </button>
      <div className="df-main-action" data-phase={phase}>
        {stranded ? <Button variant="primary" disabled={locked} onClick={() => void send('rescue')}>领取应急竹竿</Button>
          : <Button variant="primary" disabled={locked || view.walletLocked || phase === 'waiting' || phase === 'reeling'} onClick={primary}>{label}</Button>}
        <small>{hint}</small>
      </div>
      <div className="df-shortcuts">
        <button aria-label={`鱼篓，${state.bag.length} 份收获`} disabled={entryLocked} onClick={() => openPanel('bag')}><Fish size={18}/>{state.bag.length > 0 && <b>{state.bag.length}</b>}<span>鱼篓</span></button>
        <button aria-label="图鉴" disabled={entryLocked} onClick={() => openPanel('book')}><BookOpen size={18}/><span>图鉴</span></button>
        <button aria-label="商店" disabled={entryLocked} onClick={() => openPanel('shop')}><ShoppingBag size={18}/><span>商店</span></button>
        <button className="is-small" aria-label="玩法帮助" aria-expanded={help} onClick={() => setHelp(!help)}><CircleHelp size={16}/></button>
      </div>
      {help && <div className="df-help-pop" role="note">
        <button className="df-help-close" aria-label="关闭帮助" onClick={() => setHelp(false)}><X size={14}/></button>
        <ul><li>抛竿后等浮标有动静，再点收线，信号不会过期。</li><li>鱼太重会断竿，鱼竿越用越旧也更容易断；鱼篓里的收获不受影响。</li><li>出售收获换狗牛币，锁定的不会被卖掉。</li><li>离开窗口自动暂停，当前这一竿会保留。</li></ul>
      </div>}
    </div>
    {panel && <Modal label={{ bag: '鱼篓', book: '图鉴', shop: '商店' }[panel]} active={panel} onTab={next => openPanel(next)} onClose={closePanel}
      tabs={[{ id: 'bag', label: '鱼篓', icon: <Fish size={15}/>, badge: state.bag.length }, { id: 'book', label: '图鉴', icon: <BookOpen size={15}/> }, { id: 'shop', label: '商店', icon: <ShoppingBag size={15}/> }]}
      footer={panel === 'bag' && state.bag.length ? <BagFooter {...props}/> : panel === 'shop' ? <><span className="df-foot-note">购买即装备 · 永久使用</span><span className="df-chip is-wallet is-flat"><Coins size={14}/><b>{view.balance}</b></span></> : undefined}>
      {alert}
      {notice && <div className="df-toast is-inline" role="status">{notice}</div>}
      {panel === 'bag' && <Bag {...props}/>}
      {panel === 'book' && <Book {...props}/>}
      {panel === 'shop' && <>
        <div className="df-seg" role="group" aria-label="商品分类">{([['rods', '鱼竿'], ['tools', '工具'], ['spots', '钓点与鱼饵']] as const).map(([id, name]) => <button key={id} aria-pressed={shopTab === id} onClick={() => setShopTab(id)}>{name}</button>)}</div>
        <Shop {...props} tab={shopTab}/>
      </>}
    </Modal>}
  </div>;
}
