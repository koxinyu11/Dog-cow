import { fishingMaps } from '../../../../../../shared/fishing-maps';
import { useState } from 'react';
import { species, categories, rarities, spots, type Category } from '../../../../../../shared/fishing';
import { CatchArt } from '../Art';
import type { PanelProps } from './types';
const order: Category[] = ['fish', 'creature', 'junk', 'treasure'];
const spotName = (id: string) => spots.filter(s => id === 'any' || s.id === id || fishingMaps[s.id]?.source === id).map(s => s.name).join('、');
export function Book({ view }: PanelProps) {
  const book = view.state.book;
  const [shelf, setShelf] = useState<Category>('fish');
  const [rarity, setRarity] = useState('all');
  const list = species.filter(s => s.category === shelf && (rarity === 'all' || s.rarity === Number(rarity)));
  const [pick, setPick] = useState<string>(species[0].id);
  const chosen = list.find(s => s.id === pick) ?? list[0];
  const record = chosen && book[chosen.id];
  return <div className="df-book-layout">
    <nav className="df-shelves" aria-label="图鉴分类">{order.map(id => {
      const all = species.filter(s => s.category === id); const got = all.filter(s => book[s.id]).length;
      return <button key={id} aria-pressed={shelf === id} onClick={() => { setShelf(id); setPick(all[0].id); }}>
        <span>{categories.find(c => c.id === id)!.name}</span><small>{got}/{all.length}</small><i><em style={{ width: `${got / all.length * 100}%` }}/></i>
      </button>;
    })}</nav>
    <div className="df-book-main">
      <div className="df-book-filter">
        <label>稀有度<select value={rarity} onChange={event => setRarity(event.target.value)} aria-label="按稀有度筛选图鉴">
          <option value="all">全部稀有度</option>
          {rarities.map((name, index) => <option value={index} key={name}>{name}</option>)}
        </select></label><span>{list.length} 条</span>
      </div>
      {chosen ? <section className={`df-detail rarity-${chosen.rarity} ${record ? '' : 'is-unknown'}`} aria-live="polite">
        <div className="df-detail-art"><CatchArt entry={chosen} silhouette={!record}/></div>
        <div>
          <span className={`df-tag rarity-${chosen.rarity}`}>{rarities[chosen.rarity]}{!record && ' · 未发现'}</span>
          <h4>{record ? chosen.name : '？？？'}</h4>
          <p>{record ? chosen.note : '还没有遇见过它。'}</p>
          <dl><div><dt>出没</dt><dd>{spotName(chosen.spot)}</dd></div>{record && <><div><dt>遇见</dt><dd>{record.count} 次</dd></div><div><dt>最重</dt><dd>{record.largest.toFixed(2)} kg</dd></div></>}</dl>
        </div>
      </section> : <p className="df-book-empty" role="status">这个分类还没有该稀有度的条目。</p>}
      <div className="df-book">{list.map(entry => {
        const known = !!book[entry.id];
        return <button key={entry.id} className={`df-species rarity-${entry.rarity} ${known ? '' : 'is-unknown'}`} aria-pressed={chosen?.id === entry.id} aria-label={known ? entry.name : `${rarities[entry.rarity]} · 未发现`} onClick={() => setPick(entry.id)}>
          <CatchArt entry={entry} silhouette={!known}/><span>{known ? entry.name : '？？？'}</span>
        </button>;
      })}</div>
    </div>
  </div>;
}
