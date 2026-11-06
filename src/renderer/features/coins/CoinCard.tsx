import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { CoinSource, CoinsView } from '../../../shared/coins';
import { command } from '../../state';
import { Button, Rolling } from '../../ui';
import { Modal } from '../../components/Modal';
import { COIN_WALLPAPERS, coinItem } from '../../../shared/wallpapers';
import './coins.css';

const SOURCES: { id: CoinSource; name: string; icon: string }[] = [
  { id: 'steal', name: '偷来的钱', icon: '🎭' },
  { id: 'owed', name: '老板欠的钱', icon: '🪧' },
];
const FLY_MS = 1200;
export const reducedMotion = () => document.documentElement.classList.contains('no-fx') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const itemName = (item = '') => COIN_WALLPAPERS.find((w) => coinItem(w.id) === item)?.name ?? '消费';
const day = (at: number) => { const d = new Date(at); return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`; };

interface Flyer { id: number; x: number; y: number; dx: number; dy: number; delay: number }

/** Settings → 职称: compact wallet entry; the exchange lives in a second-level dialog. */
export function CoinCard({ coins }: { coins: CoinsView | undefined }) {
  const [open, setOpen] = useState(false);
  const pending = coins ? coins.pending.steal.coins + coins.pending.owed.coins : 0;
  return (
    <>
      <button type="button" className={`coin-card${pending ? ' has-pending' : ''}`} onClick={() => setOpen(true)} aria-label={`狗牛币 ${coins?.balance ?? 0}`}>
        <span className="coin-face" aria-hidden="true">🪙</span>
        <strong>{coins?.balance ?? 0}</strong>
        <span className="coin-card-label">狗牛币</span>
        {pending > 0 && <span className="coin-card-badge">+{pending}</span>}
      </button>
      <CoinDialog open={open} coins={coins} onClose={() => setOpen(false)} />
    </>
  );
}

export function CoinDialog({ open, coins, onClose }: { open: boolean; coins: CoinsView | undefined; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gain, setGain] = useState(0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [stamp, setStamp] = useState(false);
  const [history, setHistory] = useState(false);
  /** Balance shown while coins are still in the air. */
  const [shown, setShown] = useState<number | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const bank = useRef<HTMLSpanElement>(null);
  const cards = useRef<Partial<Record<CoinSource, HTMLDivElement | null>>>({});

  useLayoutEffect(() => { if (!open) { setError(''); setGain(0); setFlyers([]); setShown(null); setHistory(false); } }, [open]);

  const locked = !coins || !!coins.error;
  const total = coins ? coins.pending.steal.coins + coins.pending.owed.coins : 0;
  const balance = shown ?? coins?.balance ?? 0;

  async function exchange() {
    if (busy || locked || !total) return;
    setBusy(true); setError('');
    const before = coins!.balance;
    const plan = SOURCES.filter((s) => coins!.pending[s.id].coins > 0).map((s) => s.id);
    const result = await command('coins', { action: 'exchange' });
    if (!result.applied) { setError(result.message || '兑换失败，请稍后再试。'); setBusy(false); return; }
    const gained = Number(result.message.replace(/\D/g, '')) || total;
    window.setTimeout(() => setGain(0), FLY_MS + 1800);
    if (reducedMotion()) { setGain(gained); setBusy(false); return; }
    setShown(before);
    setFlyers(launch(plan));
    if (plan.includes('owed')) setStamp(true);
    window.setTimeout(() => { setShown(null); setGain(gained); }, FLY_MS * 0.75);
    window.setTimeout(() => { setFlyers([]); setStamp(false); setBusy(false); }, FLY_MS + 200);
  }

  /** Up to 12 decorative coins arc from each source card into the piggy bank. */
  function launch(plan: CoinSource[]): Flyer[] {
    const box = body.current?.getBoundingClientRect();
    const target = bank.current?.getBoundingClientRect();
    if (!box || !target) return [];
    const each = Math.max(3, Math.floor(12 / plan.length));
    return plan.flatMap((source, si) => {
      const from = cards.current[source]?.getBoundingClientRect();
      if (!from) return [];
      return Array.from({ length: each }, (_, i) => {
        const x = from.left - box.left + from.width * (0.25 + Math.random() * 0.5);
        const y = from.top - box.top + from.height * 0.45;
        return { id: si * 100 + i, x, y, dx: target.left - box.left + target.width / 2 - x, dy: target.top - box.top + target.height / 2 - y, delay: i * 45 + si * 30 };
      });
    });
  }

  return (
    <Modal open={open} title="狗牛币" onClose={onClose} className="coin-dialog">
      <div className="coin-body" ref={body}>
        {locked ? <div className="banner is-error">{coins?.error || '钱包数据异常，已锁定保护。'}</div> : <>
          <header className="coin-vault">
            <span className={`coin-bank${flyers.length ? ' is-eating' : ''}`} ref={bank} aria-hidden="true">🐷<i>🐮</i></span>
            <div>
              <span className="m-label">余额</span>
              <strong className="coin-balance"><Rolling text={String(balance)} /></strong>
            </div>
            {gain > 0 && <span className="coin-gain" role="status">+{gain} 狗牛币</span>}
          </header>

          <div className="coin-sources">
            {SOURCES.map((s) => {
              const p = coins.pending[s.id];
              return (
                <div key={s.id} ref={(el) => { cards.current[s.id] = el; }} className={`coin-source is-${s.id}${p.coins ? '' : ' is-empty'}`}>
                  {s.id === 'owed' && <span className={`coin-stamp${stamp ? ' is-hit' : ''}`} aria-hidden="true">×5</span>}
                  <span className="coin-source-name">{s.icon} {s.name}</span>
                  <strong>¥{p.yuan} <small>→ {p.coins} 币</small></strong>
                  <span className="coin-rate">1:{coins.rates[s.id]}</span>
                  {p.todayYuan > 0 && <span className="coin-tomorrow">今日 ¥{p.todayYuan} 明天可换</span>}
                </div>
              );
            })}
          </div>

          <Button variant="primary" className="coin-go" disabled={busy || !total} onClick={() => void exchange()}>
            {total ? `全部兑换 · +${total} 币` : '暂无可兑换'}
          </Button>
          {error && <p className="coin-error" role="alert">{error}</p>}

          {coins.entries.length > 0 && (
            <details className="coin-history" open={history} onToggle={(e) => setHistory(e.currentTarget.open)}>
              <summary>最近流水</summary>
              <ul>
                {coins.entries.map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <span>{day(e.at)}</span>
                    <span>{e.kind === 'exchange' ? `${e.yuan?.steal ? '🎭' : ''}${e.yuan?.owed ? '🪧' : ''} 兑换` : `🛍 ${itemName(e.item)}`}</span>
                    <strong className={e.coins < 0 ? 'is-out' : ''}>{e.coins > 0 ? '+' : ''}{e.coins}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>}
        {flyers.map((f) => (
          <i key={f.id} className="coin-flyer" aria-hidden="true"
            style={{ left: f.x, top: f.y, '--dx': `${f.dx}px`, '--dy': `${f.dy}px`, animationDelay: `${f.delay}ms` } as CSSProperties}>🪙</i>
        ))}
      </div>
    </Modal>
  );
}
