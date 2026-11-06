import { useEffect, useState } from 'react';
import type { CoinsView } from '../../../shared/coins';
import type { PresetKey } from '../../../shared/board';
import { coinWallpaper } from '../../../shared/wallpapers';
import { command } from '../../state';
import { Scene } from '../../board/Scene';
import { CoinDialog, reducedMotion } from './CoinCard';
import './coins.css';

const SHATTER_MS = 700;

/** A coin wallpaper not yet bought: locked preview, two-step purchase, or a shortcut to the exchange when short. */
export function CoinSwatch({ preset, coins, onBought, notify }: {
  preset: PresetKey; coins: CoinsView | undefined; onBought: (anchor: Element | null) => void; notify: (message: string) => void;
}) {
  const wall = coinWallpaper(preset)!;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shatter, setShatter] = useState(false);
  const [exchange, setExchange] = useState(false);
  const balance = coins?.balance ?? 0;
  const short = wall.price - balance;
  const locked = !coins || !!coins.error;

  useEffect(() => { if (!confirm) return; const t = window.setTimeout(() => setConfirm(false), 4000); return () => window.clearTimeout(t); }, [confirm]);

  async function click(target: HTMLButtonElement) {
    if (busy || locked) return;
    if (short > 0) { setExchange(true); return; }
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    // The snapshot that confirms the purchase swaps this swatch for a normal one, so the shatter plays first.
    if (!reducedMotion()) { setShatter(true); await new Promise((r) => window.setTimeout(r, SHATTER_MS)); }
    const result = await command('coins', { action: 'buy-wallpaper', id: wall.id });
    if (!result.applied) { notify(result.message || '购买失败，请稍后再试。'); setShatter(false); setBusy(false); setConfirm(false); return; }
    onBought(target.isConnected ? target : document.querySelector('.bg-grid'));
  }

  return (
    <>
      <button type="button" className={`bg-swatch coin-swatch${shatter ? ' is-shatter' : ''}${confirm ? ' is-confirm' : ''}`} disabled={busy && !shatter}
        aria-label={`${wall.name}，${wall.price} 狗牛币${short > 0 ? `，还差 ${short}` : ''}`} onClick={(e) => void click(e.currentTarget)}>
        <Scene preset={preset} />
        <span className="coin-lock" aria-hidden="true">
          <span className="coin-lock-icon">🔒</span>
          <strong>{confirm ? `确认花 ${wall.price} 币？` : `🪙 ${wall.price}`}</strong>
          {!confirm && <small>{locked ? '钱包不可用' : short > 0 ? `还差 ${short} 币` : '点击解锁'}</small>}
          <i className="coin-shard s1" /><i className="coin-shard s2" /><i className="coin-shard s3" /><i className="coin-shard s4" />
        </span>
        <span className="bg-swatch-label"><span className="bg-swatch-name">{wall.emoji} {wall.name}</span></span>
      </button>
      <CoinDialog open={exchange} coins={coins} onClose={() => setExchange(false)} />
    </>
  );
}
