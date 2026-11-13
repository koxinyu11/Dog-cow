import { Keyboard, Mouse } from 'lucide-react';
import type { MouseEvent } from 'react';
import { isNewGame } from './catalog';
import type { LocalGame } from './registry';
export function GameCard({ game, compact = false, onOpen }: { game: LocalGame; compact?: boolean; onOpen(event: MouseEvent<HTMLButtonElement>): void }) {
  const ControlIcon = game.controls === 'keyboard' ? Keyboard : game.controls === 'mouse' ? Mouse : null;
  const meta = [game.category, game.minutes ? `${game.minutes} 分钟` : ''].filter(Boolean).join(' · ');
  return <button className={`pg-game-card${compact ? ' is-compact' : ''}`} data-accent={game.accent ?? 'brand'} onClick={onOpen}>
    <span className="pg-cover" aria-hidden="true"><span className="pg-game-icon">{game.icon}</span></span>
    {!compact && isNewGame(game) && <span className="pg-badge">新</span>}
    <span className="pg-card-body">
      <span className="pg-card-title">{game.title}</span>
      {(meta || ControlIcon) && <span className="pg-card-meta">{meta}{ControlIcon && <ControlIcon size={13} aria-label={game.controls === 'keyboard' ? '键盘' : '鼠标'} />}</span>}
      {!compact && game.description && <span className="pg-card-desc">{game.description}</span>}
    </span>
  </button>;
}
