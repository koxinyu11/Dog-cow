import { useRef, useState } from 'react';
import { METRICS, type MetricId } from '../../../shared/board';
import { createElement } from 'react';
import { Link2, PencilLine, Undo2 } from 'lucide-react';
import { METRIC_ICON, useBoardApi } from '../../board/metrics';
import { fx } from '../../motion/fx';
import { useContextMenu, type MenuItem } from '../../ui';

/**
 * Editable title. Left-click ✎ edits the text. Right-click ✎ (or the title) swaps the title
 * for live data such as 实时收入 or 下班倒计时; the choice is saved with the board.
 */
export function Copy({
  value,
  name,
  commit,
  fallback = '',
  label = '标题',
}: {
  value: string;
  name: string;
  commit: (key: string, value: string) => void;
  fallback?: string;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const host = useRef<HTMLSpanElement>(null);
  const { metrics, bindings, bind } = useBoardApi();
  const openMenu = useContextMenu();
  const bound = bindings[name];
  const finish = () => {
    commit(name, draft.trim());
    setEditing(false);
    fx('title', host.current);
  };
  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };
  const menu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const items: MenuItem[] = [
      { icon: <PencilLine size={15} />, label: '自定义文字', onSelect: () => {
          if (bound) bind(name, null);
          startEdit();
        } },
      'divider',
      ...(Object.keys(METRICS) as MetricId[]).map((id) => ({
        icon: createElement(METRIC_ICON[id], { size: 15 }),
        label: `换成「${METRICS[id]}」`,
        active: bound === id,
        onSelect: () => bind(name, id, host.current),
      })),
    ];
    if (bound) items.push('divider', { icon: <Undo2 size={15} />, label: '恢复为文字', onSelect: () => bind(name, null, host.current) });
    else if (value && fallback) items.push('divider', { icon: <Undo2 size={15} />, label: `恢复自动（${fallback}）`, onSelect: () => commit(name, '') });
    openMenu(event.clientX, event.clientY, items);
  };
  if (editing)
    return (
      <input
        autoFocus
        className="copy-input"
        aria-label={`编辑${label}`}
        value={draft}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') {
            event.preventDefault();
            setEditing(false);
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={finish}
      />
    );
  return (
    <span ref={host} className={`copy-edit ${bound ? 'is-bound' : ''}`} onContextMenu={menu}>
      {bound ? (
        <span className="copy-metric" title={`${METRICS[bound]}（右键 ✎ 可更换）`}>
          {createElement(METRIC_ICON[bound], { size: '0.9em', strokeWidth: 2.4, 'aria-hidden': true })} {metrics[bound]}
        </span>
      ) : (
        <span>{value || fallback || '点击设置文字'}</span>
      )}
      <button
        type="button"
        className="copy-edit-trigger"
        aria-label={`修改${label}（右键换成实时数据）`}
        title="左键改文字 · 右键换成实时数据"
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={menu}
        onClick={(event) => {
          event.stopPropagation();
          if (bound) menu(event);
          else startEdit();
        }}
      >
        {bound ? <Link2 size={12} /> : <PencilLine size={12} />}
      </button>
    </span>
  );
}
