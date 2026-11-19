import { ShieldCheck } from 'lucide-react';
import { charms, specialBaits } from '../../../../../shared/fishing-gear';
import { fishFound } from '../../../../../shared/fishing';
import type { PanelProps } from './panels/types';
export function Loadout({ view, controlsLocked, send }: Pick<PanelProps, 'view' | 'controlsLocked' | 'send'>) {
  const { state } = view;
  const blocked = controlsLocked || view.walletLocked;
  return <div className="df-loadout">
    <label><span>鱼饵</span><select aria-label="当前钓法" value={state.bait} disabled={blocked} onChange={event => send('bait', event.target.value)}>
      <option value="plain">普通饵 ∞</option>
      <option value="worm" disabled={!state.tools.includes('baitbox')}>虫饵 ∞</option>
      <option value="scout" disabled={fishFound(state.book) < 10 || !state.gear.stock.scout}>探索饵 · {state.gear.stock.scout}</option>
      <option value="magnet" disabled={!state.gear.stock.magnet}>寻宝钩 · {state.gear.stock.magnet}</option>
      {specialBaits.map(bait => <option key={bait.id} value={bait.id} disabled={fishFound(state.book) < bait.requiredFish || !state.gear.stock[bait.id]}>{bait.name} · {state.gear.stock[bait.id]}</option>)}
    </select></label>
    <label><span>挂件</span><select aria-label="当前挂件" value={state.gear.charm ?? 'none'} disabled={blocked} onChange={event => send('charm', event.target.value)}>
      <option value="none">不佩戴</option>{charms.map(charm => <option key={charm.id} value={charm.id} disabled={!state.gear.charms.includes(charm.id)}>{charm.name}{!state.gear.charms.includes(charm.id) ? ' · 未拥有' : ''}</option>)}
    </select></label>
    <button className="df-guard" aria-label="自动使用护线扣" aria-pressed={state.gear.guard} disabled={blocked || !state.gear.stock.guard} onClick={() => send('guard', state.gear.guard ? 'off' : 'on')} title={state.gear.guard ? '将要断竿时使用护线扣' : '开启护线保护'}><ShieldCheck size={13}/><span>护线 {state.gear.stock.guard}</span></button>
  </div>;
}
