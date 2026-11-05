import { useEffect, useMemo, useRef, useState } from 'react';
import type { TitlesView } from '../../../shared/titles/types';
import { command } from '../../state';
import { Button, Switch } from '../../ui';
import { Modal } from '../../components/Modal';
import { TitleBadge, TitleChip } from './TitleBadge';
import './titles.css';

/** Settings → 职称: a warehouse that only ever shows unlocked titles. */
export function TitlesPane({ titles, visible, focusId, notify }: {
  titles: TitlesView | undefined; visible: boolean; focusId: string; notify: (text: string, tone?: 'ok' | 'error') => void;
}) {
  const items = titles?.items ?? [];
  const [picked, setPicked] = useState('');
  const [detail, setDetail] = useState('');
  const [detailError, setDetailError] = useState('');
  // Ids that were new when the pane opened keep their stamp while it stays open.
  const [fresh, setFresh] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const unseenKey = (titles?.unseen ?? []).join(',');

  useEffect(() => {
    if (!visible) { setFresh([]); setDetail(''); return; }
    const unseen = titles?.unseen ?? [];
    if (!unseen.length) return;
    setFresh((list) => [...new Set([...list, ...unseen])]);
    void command('titles', { action: 'seen', ids: unseen });
  }, [visible, unseenKey]);

  useEffect(() => {
    if (!visible) return;
    const target = focusId || titles?.worn || items[items.length - 1]?.id || '';
    setPicked(target);
    if (target) requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-title-id="${CSS.escape(target)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  }, [visible, focusId]);

  const shelves = useMemo(() => {
    const map = new Map<string, { name: string; cards: typeof items }>();
    for (const card of items) {
      const shelf = map.get(card.series) ?? { name: card.seriesName, cards: [] };
      shelf.cards.push(card);
      map.set(card.series, shelf);
    }
    return [...map.values()];
  }, [items]);

  const run = async (payload: Record<string, unknown>) => {
    const result = await command('titles', payload);
    if (!result.applied) notify(result.message, 'error');
    return result.applied;
  };
  const closeDetail = () => {
    const id = detail;
    setDetail(''); setDetailError('');
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-title-id="${CSS.escape(id)}"]`)?.focus());
  };
  // The popup sits above the settings dialog, where page toasts are hidden; show errors inline.
  const wear = async (payload: Record<string, unknown>) => {
    const result = await command('titles', payload);
    if (result.applied) closeDetail();
    else setDetailError(result.message || '没有保存成功，请重试。');
  };

  if (titles?.error) return <div className="banner is-error">{titles.error}</div>;
  const worn = items.find((card) => card.id === titles?.worn);
  const selected = items.find((card) => card.id === detail);

  return (
    <div className="titles-pane" ref={ref}>
      <header className="titles-plate">
        <div>
          <b>职称仓库</b>
          <span>已获聘 {items.length} 个</span>
        </div>
        {worn && <TitleChip card={worn} onClick={() => setPicked(worn.id)} />}
        <Switch label="在标题旁显示职称" checked={titles?.showInHeader ?? true} onChange={(value) => void run({ action: 'show', value })} />
      </header>

      {!items.length ? (
        <div className="titles-wall is-empty"><p>工牌会在日常里自己冒出来。</p></div>
      ) : (
        <div className="titles-wall">
          {shelves.map((shelf) => (
            <section className="titles-shelf" key={shelf.name} aria-label={shelf.name}>
              <h4>{shelf.name}</h4>
              <div className="titles-hooks">
                {shelf.cards.map((card) => (
                  <TitleBadge key={card.id} card={card} fresh={fresh.includes(card.id)} selected={card.id === picked} onClick={() => { setPicked(card.id); setDetail(card.id); setDetailError(''); }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal className="title-detail-dialog" open={!!selected} title={selected?.name ?? ''} onClose={closeDetail}>
        {selected && (
          <div className="titles-detail">
            <TitleBadge card={selected} size="large" />
            <p className="titles-copy">{selected.copy}</p>
            <details>
              <summary>正经说法</summary>
              <p>{selected.rule}</p>
            </details>
            {detailError && <p className="titles-detail-error" role="alert">{detailError}</p>}
            <div className="titles-detail-actions">
              {selected.id === titles?.worn
                ? <Button onClick={() => void wear({ action: 'unwear' })}>卸下</Button>
                : <Button variant="primary" onClick={() => void wear({ action: 'wear', id: selected.id })}>佩戴</Button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
