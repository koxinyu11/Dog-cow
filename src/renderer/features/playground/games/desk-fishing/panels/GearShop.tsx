import { useState } from 'react';
import { Check } from 'lucide-react';
import { durabilityLeft, fishFound, repairedWear, repairPrice, rods, skinAvailable } from '../../../../../../shared/fishing';
import { MAX_SUPPLIES, rodLook, rodSkins, supplies, type RodSkinId } from '../../../../../../shared/fishing-gear';
import { RodArt } from '../Art';
import { SupplyArt } from '../GearArt';
import { Price } from './Price';
import type { PanelProps } from './types';

export function SkinShop({ view, controlsLocked, send }: PanelProps) {
  const { state, balance, walletLocked } = view;
  const [preview, setPreview] = useState<RodSkinId>(state.gear.skin);
  const rod = rods.find(r => r.id === state.equipped)!;
  const look = rodLook(preview, rod.color);
  const blocked = controlsLocked || walletLocked;
  return <div className="df-skin-shop">
    <section className="df-skin-hero" data-skin-preview={preview}>
      <RodArt color={rod.color} skin={preview}/><div><span className="df-tag">外观预览</span><h4>{look.name}</h4><p>{rod.name} · 承重 {rod.capacity} kg</p><small>{look.note}</small></div>
    </section>
    <div className="df-skins">{rodSkins.map(skin => {
      const available = skinAvailable(state, skin);
      const using = state.gear.skin === skin.id;
      const requirement = 'reward' in skin ? skin.reward === 'catalog30' ? `图鉴 ${Object.keys(state.book).length}/30` : '首次发现神话条目' : '';
      return <article className={`df-skin ${using ? 'is-using' : ''}`} key={skin.id} data-skin-card={skin.id}>
        <button className="df-skin-preview" aria-label={`预览${skin.name}`} aria-pressed={preview === skin.id} onClick={() => setPreview(skin.id)}><RodArt color={rod.color} skin={skin.id}/><strong>{skin.name}</strong></button>
        <small>{'reward' in skin ? available ? '收集奖励 · 已解锁' : requirement : skin.id === 'default' ? '跟随鱼竿原色' : '通用皮肤 · 永久拥有'}</small>
        {using ? <span className="df-owned"><Check size={13}/>装备中</span> : available ? <button className="df-ghost" disabled={blocked} onClick={() => send('skin', skin.id)}>装备</button>
          : skin.price > 0 ? <Price price={skin.price} balance={balance} disabled={blocked} onBuy={() => send('buySkin', skin.id)}/>
          : <button className="df-ghost" disabled>尚未解锁</button>}
      </article>;
    })}</div>
  </div>;
}

export function SupplyShop({ view, controlsLocked, send }: PanelProps) {
  const { state, balance, walletLocked } = view;
  const rod = rods.find(r => r.id === state.equipped)!;
  const found = fishFound(state.book);
  const blocked = controlsLocked || walletLocked;
  const canRepair = state.rods[rod.id] > 0 && state.wear[rod.id] > 0;
  const before = Math.round(durabilityLeft(state, rod.id) * 100);
  const after = Math.round((1 - repairedWear(state.wear[rod.id], rod.durability) / rod.durability) * 100);
  return <div className="df-goods">
    {supplies.map(supply => {
      const closed = found < supply.requiredFish;
      const full = state.gear.stock[supply.id] + supply.pack > MAX_SUPPLIES;
      return <article className="df-good" data-supply-card={supply.id} key={supply.id}>
        <SupplyArt id={supply.id}/><div className="df-good-text"><strong>{supply.name}<em>持有 {state.gear.stock[supply.id]}</em></strong>
          <small>{closed ? `发现 ${supply.requiredFish} 种鱼后解锁 · ${found}/${supply.requiredFish}` : supply.note}</small><small>每包 {supply.pack} {supply.unit}</small></div>
        <div className="df-good-act">{full ? <span className="df-owned">已满</span> : <Price price={supply.price} balance={balance} disabled={blocked || closed} onBuy={() => send('buySupply', supply.id)}/>}</div>
      </article>;
    })}
    <article className="df-good" data-supply-card="repair"><SupplyArt id="repair"/><div className="df-good-text"><strong>修竿保养</strong><small>{rod.name} · 耐久 {before}% → {after}%</small><small>恢复 50% 耐久 · 断竿无法保养</small></div>
      <div className="df-good-act">{!state.rods[rod.id] ? <span className="df-owned">请先装备鱼竿</span> : !canRepair ? <span className="df-owned">状态良好</span>
        : <Price price={repairPrice(rod.id)} balance={balance} disabled={blocked} onBuy={() => send('repair')} verb="保养"/>}</div>
    </article>
  </div>;
}
