import type { CSSProperties } from 'react';
import { AlarmClock, CalendarHeart, Coffee, DoorOpen, ListChecks, PartyPopper, PiggyBank, Sparkles, UtensilsCrossed, type LucideIcon } from 'lucide-react';
// Type-only: the title catalog stays in the main process; locked titles never reach the renderer.
import type { Rarity, TitleCard } from '../../../shared/titles/types';

const ICONS: Record<string, LucideIcon> = { AlarmClock, CalendarHeart, Coffee, DoorOpen, ListChecks, PartyPopper, PiggyBank, Sparkles, UtensilsCrossed };
export const titleIcon = (name: string) => ICONS[name] ?? Sparkles;

export const RARITY: Record<Rarity, { label: string; stamp: string }> = {
  intern: { label: '实习', stamp: '已录用' },
  regular: { label: '正式', stamp: '转正' },
  special: { label: '编外', stamp: '特聘' },
  plate: { label: '铭牌', stamp: '终身' },
  secret: { label: '内部', stamp: '绝密 · 已解密' },
};

export const hiredOn = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 获聘`;
};

const accent = (card: TitleCard) => ({ '--title-color': card.color } as CSSProperties);

/** Small pill shown next to the app title. */
export function TitleChip({ card, onClick }: { card: TitleCard; onClick: () => void }) {
  const Icon = titleIcon(card.icon);
  return (
    <button type="button" className={`title-chip is-${card.rarity}`} style={accent(card)} onClick={onClick}
      aria-label={`职称：${card.name}（${RARITY[card.rarity].label}），查看职称仓库`}>
      <span className="title-chip-hole" aria-hidden="true" />
      <span className="title-chip-icon" aria-hidden="true"><Icon size={11} strokeWidth={2.6} /></span>
      <span className="title-chip-name">{card.name}</span>
      <small className="title-chip-rarity" aria-hidden="true">{RARITY[card.rarity].label}</small>
    </button>
  );
}

/** Vertical badge used on the warehouse shelf and, enlarged, in the detail view. */
export function TitleBadge({ card, size = 'shelf', fresh, selected, onClick }: {
  card: TitleCard; size?: 'shelf' | 'large'; fresh?: boolean; selected?: boolean; onClick?: () => void;
}) {
  const Icon = titleIcon(card.icon);
  const body = (
    <>
      <span className="title-badge-hole" aria-hidden="true" />
      <Icon className="title-badge-icon" size={size === 'large' ? 34 : 22} strokeWidth={2} aria-hidden="true" />
      <b className="title-badge-name">{card.name}</b>
      <small className="title-badge-meta">{RARITY[card.rarity].label} · {card.seriesName}</small>
      <small className="title-badge-date">{hiredOn(card.at)}</small>
      {fresh && <span className="title-badge-stamp" aria-hidden="true">{RARITY[card.rarity].stamp}</span>}
      {fresh && <span className="title-badge-new">新</span>}
    </>
  );
  const className = `title-badge is-${card.rarity} is-${size} ${selected ? 'is-selected' : ''} ${fresh ? 'is-fresh' : ''}`;
  return onClick
    ? <button type="button" className={className} style={accent(card)} onClick={onClick} aria-pressed={selected} data-title-id={card.id}>{body}</button>
    : <div className={className} style={accent(card)}>{body}</div>;
}
