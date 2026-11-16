import { LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { species, rarities } from '../../../../../../shared/fishing';
import { CatchArt } from '../Art';
import type { PanelProps } from './types';
const ago = (at: number, now = Date.now()) => { const m = Math.floor((now - at) / 60000); return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.floor(m / 60)} 小时前` : new Date(at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }); };
export function Bag({ view, locked, send }: PanelProps) {
  const { bag } = view.state;
  if (!bag.length) return <div className="df-blank"><p>鱼篓还是空的</p><small>去水边坐一会儿吧</small></div>;
  return <div className="df-bag">{bag.map(item => {
    const entry = species.find(s => s.id === item.species)!;
    return <article className={`df-bag-item rarity-${entry.rarity} ${item.locked ? 'is-locked' : ''}`} key={item.id}>
      <button className="df-lock" aria-label={item.locked ? `解锁${entry.name}` : `锁定${entry.name}`} aria-pressed={item.locked} disabled={locked} onClick={() => send('lock', item.id)}>{item.locked ? <LockKeyhole size={13}/> : <UnlockKeyhole size={13}/>}</button>
      {item.at && <time dateTime={new Date(item.at).toISOString()} title={new Date(item.at).toLocaleString('zh-CN')}>{ago(item.at)}</time>}
      <div className="df-bag-art"><CatchArt entry={entry}/></div>
      <strong>{entry.name}</strong>
      <small>{item.kg.toFixed(2)} kg{entry.rarity ? ` · ${rarities[entry.rarity]}` : ''}</small>
      <button className="df-price" disabled={locked || item.locked || view.walletLocked} onClick={() => send('sell', item.id)}>{item.locked ? '已锁定' : <>出售 <b>{item.value}</b></>}</button>
    </article>;
  })}</div>;
}
export function BagFooter({ view, locked, send }: PanelProps) {
  const { bag } = view.state;
  const sale = bag.filter(c => !c.locked).reduce((sum, c) => sum + c.value, 0);
  const kept = bag.filter(c => c.locked).length;
  return <>
    <span className="df-foot-note">{bag.length}/200{kept ? ` · ${kept} 份已锁定` : ''}</span>
    <button className="df-cta" disabled={locked || !sale || view.walletLocked} onClick={() => send('sellAll')}>全部出售<b>{sale}</b>狗牛币</button>
  </>;
}
