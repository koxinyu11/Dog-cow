import { createRoot } from 'react-dom/client';
import { categories, rarities, rods, species } from '../../src/shared/fishing';
import { rodSkins } from '../../src/shared/fishing-gear';
import { CatchArt, RodArt } from '../../src/renderer/features/playground/games/desk-fishing/Art';
import '../../src/renderer/features/playground/games/desk-fishing/fishing.css';

createRoot(document.getElementById('root')!).render(<main className="df-game fixture-gallery">
  <h1>工位钓鱼 · 100 条图鉴插画验收</h1><p>隔离测试目录 · 全部发现状态，非用户存档</p>
  {['fish', 'creature', 'junk', 'treasure'].map(category => <section key={category}>
    <h2>{categories.find(c => c.id === category)!.name}</h2>
    <div className="fixture-grid">{species.filter(entry => entry.category === category).map(entry => <article key={entry.id} data-species={entry.id}>
      <CatchArt entry={entry}/><strong>{entry.name}</strong><small>{rarities[entry.rarity]}</small>
    </article>)}</div>
  </section>)}
  <section><h2>鱼竿皮肤 · 四档鱼竿通用</h2><div className="fixture-grid">
    {rods.flatMap(rod => rodSkins.map(skin => <article key={`${rod.id}-${skin.id}`} data-skin-variant={`${rod.id}-${skin.id}`}>
      <RodArt color={rod.color} skin={skin.id}/><strong>{skin.name}</strong><small>{rod.name}</small>
    </article>))}
  </div></section>
</main>);
