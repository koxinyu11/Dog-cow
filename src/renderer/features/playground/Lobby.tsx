import { useMemo, useState, type MouseEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '../../ui';
import { categoriesOf, filterGames, groupByCategory, lobbyTier, sortGames } from './catalog';
import { GameCard } from './GameCard';
import { ParkScene } from './ParkScene';
import type { LocalGame } from './registry';
type Open = (game: LocalGame, event: MouseEvent<HTMLButtonElement>) => void;
function Grid({ games, open, feature = false }: { games: readonly LocalGame[]; open: Open; feature?: boolean }) {
  return <div className={`pg-grid${feature ? ' is-feature' : ''}`}>{games.map(game => <GameCard key={game.id} game={game} onOpen={event => open(game, event)} />)}</div>;
}
export function Lobby({ games, recent, open }: { games: readonly LocalGame[]; recent: readonly string[]; open: Open }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const sorted = useMemo(() => sortGames(games), [games]);
  const tier = lobbyTier(sorted.length);
  if (tier === 'empty') return <section className="pg-empty"><ParkScene /><p>第一款游戏即将开场</p></section>;
  if (tier === 'feature') return <Grid games={sorted} open={open} feature />;
  const recentGames = recent.map(id => sorted.find(game => game.id === id)).filter((game): game is LocalGame => !!game);
  const filtering = tier === 'large' && (!!query.trim() || !!category);
  const shown = tier === 'large' ? filterGames(sorted, query, category) : sorted;
  const clear = () => { setQuery(''); setCategory(null); };
  return <>
    {recentGames.length > 0 && !filtering && <section className="pg-section" aria-label="继续玩">
      <h2>继续玩</h2>
      <div className="pg-recent">{recentGames.map(game => <GameCard key={game.id} game={game} compact onOpen={event => open(game, event)} />)}</div>
    </section>}
    {tier === 'large' && <div className="pg-toolbar">
      <div className="pg-chips" role="group" aria-label="分类">
        <button className="pg-chip" aria-pressed={!category} onClick={() => setCategory(null)}>全部</button>
        {categoriesOf(sorted).map(name => <button key={name} className="pg-chip" aria-pressed={category === name} onClick={() => setCategory(category === name ? null : name)}>{name}</button>)}
      </div>
      <label className="pg-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="搜索游戏" placeholder="搜索" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>}
    {shown.length === 0 ? <div className="pg-feedback is-inline" role="status"><p>没有匹配的游戏</p><Button size="sm" icon={<X size={14} />} onClick={clear}>清除筛选</Button></div>
      : tier === 'large' && !filtering ? groupByCategory(shown).map(group => <section className="pg-section" key={group.category} aria-label={group.category}><h2>{group.category}<small>{group.games.length}</small></h2><Grid games={group.games} open={open} /></section>)
      : <section className="pg-section" aria-label="全部游戏">{tier === 'standard' && <h2>全部游戏</h2>}<Grid games={shown} open={open} /></section>}
  </>;
}
