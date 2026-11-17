import { rods, tools, spots, fishFound, durabilityLeft } from '../../../../../../shared/fishing';
import { RodArt, ToolArt } from '../Art';
import type { PanelProps } from './types';
import { Price } from './Price';
import { SkinShop, SupplyShop } from './GearShop';
export type ShopTab = 'rods' | 'skins' | 'tools' | 'supplies' | 'spots';
const MAX = rods[rods.length - 1].capacity;
export function Shop({ tab, ...props }: PanelProps & { tab: ShopTab }) {
  const { view, controlsLocked, send } = props;
  if (tab === 'skins') return <SkinShop {...props}/>;
  if (tab === 'supplies') return <SupplyShop {...props}/>;
  const { state, balance, walletLocked } = view;
  const blocked = controlsLocked || walletLocked;
  if (tab === 'rods') return <div className="df-goods">{rods.map(rod => {
    const count = state.rods[rod.id]; const using = state.equipped === rod.id && count > 0;
    return <article key={rod.id} className={`df-good ${using ? 'is-using' : ''}`}>
      <RodArt color={rod.color} skin={state.gear.skin}/>
      <div className="df-good-text">
        <strong>{rod.name}{using && <em>使用中</em>}</strong>
        <div className="df-meter" aria-label={`承重 ${rod.capacity} kg`}><i style={{ width: `${rod.capacity / MAX * 100}%`, background: rod.color }}/></div>
        <small>承重 {rod.capacity} kg · {count ? `耐久 ${Math.round(durabilityLeft(state, rod.id) * 100)}% · 持有 ${count}` : `全新可用 ${rod.durability} 次`}</small>
      </div>
      <div className="df-good-act">
        {count > 0 && !using && <button className="df-ghost" disabled={controlsLocked} onClick={() => send('equip', rod.id)}>装备</button>}
        <Price price={rod.price} balance={balance} disabled={blocked} onBuy={() => send('buyRod', rod.id)}/>
      </div>
    </article>;
  })}</div>;
  if (tab === 'tools') return <div className="df-goods">{tools.map(tool => {
    const owned = state.tools.includes(tool.id);
    return <article key={tool.id} className={`df-good ${owned ? 'is-using' : ''}`}>
      <ToolArt id={tool.id}/>
      <div className="df-good-text"><strong>{tool.name}</strong><small>{tool.description}</small></div>
      <div className="df-good-act"><Price owned={owned} price={tool.price} balance={balance} disabled={blocked} onBuy={() => send('buyTool', tool.id)}/></div>
    </article>;
  })}</div>;
  const found = fishFound(state.book);
  return <div className="df-places">
    {spots.map(spot => {
      const closed = found < spot.required; const here = state.spot === spot.id;
      return <button key={spot.id} className={`df-place is-${spot.id}`} aria-pressed={here} disabled={controlsLocked || closed || here} onClick={() => send('spot', spot.id)}>
        <span className="df-place-art" aria-hidden="true"/>
        <strong>{spot.name}{here && <em>在这里</em>}</strong>
        <small>{closed ? `再发现 ${spot.required - found} 种鱼后开放` : spot.description}</small>
      </button>;
    })}
    <div className="df-bait"><span>鱼饵</span><div role="group" aria-label="鱼饵">{(['plain', 'worm'] as const).map(bait => <button key={bait} aria-pressed={state.bait === bait} disabled={controlsLocked || (bait === 'worm' && !state.tools.includes('baitbox'))} onClick={() => send('bait', bait)}>{bait === 'plain' ? '普通饵' : '虫饵'}</button>)}</div>{!state.tools.includes('baitbox') && <small>购买双层饵盒后可用虫饵</small>}</div>
  </div>;
}
