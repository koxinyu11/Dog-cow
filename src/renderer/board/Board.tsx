import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  BOARD_COLUMNS,
  MODULE_IDS,
  SIZES,
  SIZE_KEYS,
  nearestSize,
  pack,
  smartArrange,
  type BoardItem,
  type ModuleId,
  type SizeKey,
} from '../../shared/board';
import { fx, motionAllowed } from '../motion/fx';
import { ArrowDown, ArrowLeft, ArrowRight, Check, GripVertical, Palette, Undo2, RotateCcw, Wand2, Hand, Plus, RectangleHorizontal, RectangleVertical, Square, SquareDashed, X } from 'lucide-react';
import { Badge, Button, Emoji, IconButton, useContextMenu, type MenuItem } from '../ui';
import { Modal } from '../components/Modal';
import { MODULES, type ModuleCtx } from './modules';

const CELL_H = 172;
const GAP = 14;

type Drag = {
  id: ModuleId;
  from: 'board' | 'shelf';
  size: SizeKey;
  startX: number;
  startY: number;
  active: boolean;
  inside: boolean;
};
type Resize = { id: ModuleId; startX: number; startY: number; w0: number; h0: number; size: SizeKey };

const CARD_COLORS = ['#fff4d6', '#ffe1d6', '#fde2ef', '#e6e3ff', '#dcecff', '#daf2e4', '#2f3a34', '#3b3363'];

/** Relative luminance (WCAG) to decide whether a card needs light text. */
export function isDark(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.36;
}

export function Board({
  items,
  save,
  colors,
  saveColors,
  arrangeTick,
  ctx,
  title,
  shelfOpen,
  closeShelf,
}: {
  items: BoardItem[];
  save: (items: BoardItem[]) => Promise<void>;
  colors: Partial<Record<ModuleId, string>>;
  saveColors: (colors: Partial<Record<ModuleId, string>>) => Promise<void>;
  /** Incremented by the header button to request a smart arrange. */
  arrangeTick: number;
  ctx: Omit<ModuleCtx, 'size'>;
  title: (key: string, fallback: string) => ReactNode;
  shelfOpen: boolean;
  closeShelf: () => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const cols = narrow ? BOARD_COLUMNS / 2 : BOARD_COLUMNS;
  const [undo, setUndo] = useState<BoardItem[] | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const colorInput = useRef<HTMLInputElement>(null);
  const colorTarget = useRef<ModuleId | null>(null);
  const [moduleEditor, setModuleEditor] = useState<ModuleId | null>(null);
  const [preview, setPreview] = useState<BoardItem[] | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; id: ModuleId; size: SizeKey; removing: boolean } | null>(null);
  const [below, setBelow] = useState<{ count: number; first: ModuleId | null }>({ count: 0, first: null });
  const drag = useRef<Drag | null>(null);
  const target = useRef<BoardItem[] | null>(null);
  const resize = useRef<Resize | null>(null);
  const rects = useRef(new Map<string, DOMRect>());
  const shown = preview ?? items;
  const placed = pack(shown, cols);
  const rows = placed.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  const openMenu = useContextMenu();

  useEffect(() => {
    const node = grid.current!;
    const observer = new ResizeObserver(() => setNarrow(node.clientWidth < 640));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // FLIP: modules glide to their new slot, only when the packing itself changes.
  // Rects are stored in page coordinates so scrolling never counts as movement.
  const layoutKey = `${cols}|${placed.map((p) => `${p.id}:${p.x},${p.y},${p.w},${p.h}`).join(';')}`;
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    grid.current?.querySelectorAll<HTMLElement>('[data-board-id]').forEach((el) => {
      const id = el.dataset.boardId!;
      const r = el.getBoundingClientRect();
      const rect = new DOMRect(r.left + scrollX, r.top + scrollY, r.width, r.height);
      next.set(id, rect);
      const prev = rects.current.get(id);
      const dx = prev ? prev.left - rect.left : 0;
      const dy = prev ? prev.top - rect.top : 0;
      if (prev && motionAllowed() && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: 280,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    });
    rects.current = next;
  }, [layoutKey]);

  // Floating hint for modules below the fold.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const hidden = [...(grid.current?.querySelectorAll<HTMLElement>('[data-board-id]') ?? [])].filter(
        (el) => el.getBoundingClientRect().bottom - 60 > innerHeight,
      );
      const first = (hidden[0]?.dataset.boardId as ModuleId) ?? null;
      // Only re-render when the answer changes; scrolling alone must not re-render the board.
      setBelow((prev) => (prev.count === hidden.length && prev.first === first ? prev : { count: hidden.length, first }));
    };
    const check = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);
    const timer = setInterval(check, 1500);
    return () => {
      removeEventListener('scroll', check);
      removeEventListener('resize', check);
      clearInterval(timer);
      cancelAnimationFrame(frame);
    };
  }, [shown.length, cols]);

  const commit = async (next: BoardItem[]) => {
    setPreview(next);
    try {
      await save(next);
    } finally {
      setPreview(null);
    }
  };
  const cellW = () => ((grid.current?.clientWidth ?? 800) - GAP * (cols - 1)) / cols;
  const nodeFor = (id: string) => grid.current?.querySelector<HTMLElement>(`[data-board-id="${id}"]`);

  const targetOrder = (x: number, y: number, d: Drag): BoardItem[] | null => {
    const rect = grid.current!.getBoundingClientRect();
    const inside = x >= rect.left - 20 && x <= rect.right + 20 && y >= rect.top - 60 && y <= rect.bottom + CELL_H;
    d.inside = inside;
    const base = items.filter((i) => i.id !== d.id);
    if (!inside) return d.from === 'board' ? base : null;
    const w = cellW();
    const col = Math.max(0, Math.min(cols - 1, Math.floor((x - rect.left) / (w + GAP))));
    const row = Math.max(0, Math.floor((y - rect.top) / (CELL_H + GAP)));
    const basePlaced = pack(base, cols);
    let index = basePlaced.findIndex((p) => col >= p.x && col < p.x + p.w && row >= p.y && row < p.y + p.h);
    if (index >= 0) {
      const p = basePlaced[index];
      const relX = (x - rect.left - p.x * (w + GAP)) / (p.w * (w + GAP));
      const relY = (y - rect.top - p.y * (CELL_H + GAP)) / (p.h * (CELL_H + GAP));
      if ((p.w > 1 ? relX : relY) > 0.5) index++;
    } else {
      index = basePlaced.findIndex((p) => p.y > row || (p.y === row && p.x > col));
      if (index < 0) index = base.length;
    }
    const next = [...base];
    next.splice(index, 0, { id: d.id, size: d.size });
    return next;
  };

  const beginDrag = (event: React.PointerEvent, id: ModuleId, from: Drag['from'], size: SizeKey) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { id, from, size, startX: event.clientX, startY: event.clientY, active: false, inside: from === 'board' };
    const move = (e: PointerEvent) => {
      const d = drag.current!;
      if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      if (!d.active) {
        d.active = true;
        document.body.classList.add('is-dragging');
      }
      const next = targetOrder(e.clientX, e.clientY, d);
      target.current = next;
      setPreview(next);
      setGhost({ x: e.clientX, y: e.clientY, id, size, removing: d.from === 'board' && !d.inside });
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      document.body.classList.remove('is-dragging');
      const d = drag.current!;
      drag.current = null;
      setGhost(null);
      if (!d.active) {
        setPreview(null);
        return;
      }
      const current = target.current;
      target.current = null;
      if (!current || JSON.stringify(current) === JSON.stringify(items)) {
        setPreview(null);
        return;
      }
      const removed = !current.some((i) => i.id === d.id);
      if (removed) fx('module-remove', { x: d.startX, y: d.startY });
      void commit(current).then(() =>
        setTimeout(() => {
          if (!removed) fx(d.from === 'shelf' ? 'module-add' : 'module-drop', nodeFor(d.id));
        }, 30),
      );
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  };

  const beginResize = (event: React.PointerEvent, id: ModuleId, size: SizeKey) => {
    event.preventDefault();
    event.stopPropagation();
    const el = nodeFor(id)!;
    const r = el.getBoundingClientRect();
    resize.current = { id, startX: event.clientX, startY: event.clientY, w0: r.width, h0: r.height, size };
    document.body.classList.add('is-resizing');
    const allowed = SIZE_KEYS;
    const move = (e: PointerEvent) => {
      const rz = resize.current!;
      const w = Math.max(1, Math.min(cols, Math.round((rz.w0 + e.clientX - rz.startX + GAP) / (cellW() + GAP))));
      const h = Math.max(1, Math.min(2, Math.round((rz.h0 + e.clientY - rz.startY + GAP) / (CELL_H + GAP))));
      const next = nearestSize(w, h, allowed);
      if (next !== rz.size) {
        rz.size = next;
        setPreview(items.map((i) => (i.id === id ? { ...i, size: next } : i)));
      }
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      document.body.classList.remove('is-resizing');
      const rz = resize.current!;
      resize.current = null;
      if (rz.size !== size) {
        void commit(items.map((i) => (i.id === id ? { ...i, size: rz.size } : i)));
        setTimeout(() => fx('module-resize', nodeFor(id)), 30);
      } else setPreview(null);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };

  const setSize = (id: ModuleId, size: SizeKey) => {
    void commit(items.map((i) => (i.id === id ? { ...i, size } : i)));
    setTimeout(() => fx('module-resize', nodeFor(id)), 30);
  };
  const shift = (id: ModuleId, delta: number) => {
    const index = items.findIndex((i) => i.id === id);
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    void commit(next);
  };
  const remove = (id: ModuleId) => {
    const el = nodeFor(id);
    fx('module-remove', el);
    el?.classList.add('fx-poof');
    setTimeout(() => void commit(items.filter((i) => i.id !== id)), motionAllowed() ? 260 : 0);
  };
  const add = (id: ModuleId) => {
    void commit([...items, { id, size: MODULES[id].defaultSize }]).then(() =>
      setTimeout(() => {
        const el = nodeFor(id);
        el?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'center' });
        fx('module-add', el);
      }, 40),
    );
  };
  const arrange = () => {
    const before = items.map((i) => ({ ...i }));
    const { items: next, holes } = smartArrange(items, cols);
    if (JSON.stringify(next) === JSON.stringify(items)) {
      ctx.notify('只有一种摆法，已经是它啦');
      return;
    }
    if (holes) ctx.notify(`这些模块填不满，空了 ${holes} 小格`);
    void commit(next).then(() => {
      setUndo(before);
      clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 6000);
      fx('module-drop', grid.current);
    });
  };
  const firstTick = useRef(arrangeTick);
  useEffect(() => {
    if (arrangeTick !== firstTick.current) arrange();
  }, [arrangeTick]);
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  const setColor = (id: ModuleId, color: string | null) => {
    const next = { ...colors };
    if (color) next[id] = color;
    else delete next[id];
    void saveColors(next).then(() => fx('bind', nodeFor(id)));
  };
  const sizeMenu = (event: React.MouseEvent, id: ModuleId, size: SizeKey) => {
    event.preventDefault();
    const r = (event.currentTarget as Element).getBoundingClientRect();
    const index = items.findIndex((i) => i.id === id);
    const menu: MenuItem[] = SIZE_KEYS.map((k) => ({
      icon: { s: <Square size={12} />, m: <RectangleHorizontal size={15} />, l: <Square size={16} />, wide: <RectangleHorizontal size={18} strokeWidth={1.6} />, tall: <RectangleVertical size={15} /> }[k],
      label: `${SIZES[k].label}（${SIZES[k].hint}）`,
      active: k === size,
      onSelect: () => setSize(id, k),
    }));
    menu.push('divider');
    if (index > 0) menu.push({ icon: <ArrowLeft size={15} />, label: '往前挪', onSelect: () => shift(id, -1) });
    if (index < items.length - 1) menu.push({ icon: <ArrowRight size={15} />, label: '往后挪', onSelect: () => shift(id, 1) });
    menu.push('divider', {
      icon: <Palette size={15} />,
      label: (
        <span className="menu-swatches" onClick={(e) => e.stopPropagation()}>
          {CARD_COLORS.map((c) => (
            <i key={c} role="button" aria-label={`卡片颜色 ${c}`} style={{ background: c }} className={colors[id] === c ? 'is-on' : ''} onClick={() => { setColor(id, c); dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }} />
          ))}
        </span>
      ),
      onSelect: () => {},
    });
    menu.push({ icon: <Palette size={15} />, label: '自选卡片颜色…', onSelect: () => { colorTarget.current = id; if (colorInput.current) { colorInput.current.value = colors[id] || '#ffffff'; colorInput.current.click(); } } });
    if (colors[id]) menu.push({ icon: <RotateCcw size={15} />, label: '恢复默认颜色', onSelect: () => setColor(id, null) });
    menu.push('divider', { icon: <X size={15} />, label: '移出主屏', onSelect: () => remove(id) });
    openMenu(r.left, r.bottom + 4, menu);
  };

  const onBoard = new Set(items.map((i) => i.id));
  return (
    <>
      <div
        ref={grid}
        className={`board ${ghost ? 'is-drop-target' : ''}`}
        style={{ '--cols': cols, '--cell-h': `${CELL_H}px`, '--gap': `${GAP}px`, '--rows': Math.max(rows, 1) } as CSSProperties}
      >
        {placed.map((p) => {
          const def = MODULES[p.id];
          const dragging = ghost?.id === p.id;
          const card = colors[p.id];
          return (
            <section
              key={p.id}
              data-board-id={p.id}
              data-home-module={p.id}
              className={`board-item mod-${p.id} size-${p.size} ${dragging ? 'is-placeholder' : ''} ${card ? (isDark(card) ? 'is-custom is-dark' : 'is-custom is-light') : ''}`}
              style={{ gridColumn: `${p.x + 1} / span ${p.w}`, gridRow: `${p.y + 1} / span ${p.h}`, '--module-accent': def.accent, ...(card ? { '--card-bg': card } : {}) } as CSSProperties}
            >
              <header className="mod-head">
                <span
                  className="mod-grip"
                  title="按住拖动换位置，拖出主屏可移除"
                  onPointerDown={(e) => beginDrag(e, p.id, 'board', p.size)}
                  aria-hidden="true"
                >
                  <GripVertical size={14} />
                </span>
                <button
                  type="button"
                  className="mod-edit-button"
                  aria-label={`修改${def.name}内容`}
                  title="点击修改模块内容"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setModuleEditor(p.id)}
                >
                  <Badge icon={def.icon} color={def.accent} size="sm" />
                </button>
                <h2 className="mod-title" onPointerDown={(e) => e.target === e.currentTarget && beginDrag(e, p.id, 'board', p.size)}>
                  {title(def.titleKey, def.name)}
                </h2>
                <button className="mod-size" aria-label={`${def.name} 大小：${SIZES[p.size].label}，点击更换`} onClick={(e) => sizeMenu(e, p.id, p.size)}>
                  {SIZES[p.size].label}
                </button>
                <button className="mod-close" aria-label={`把${def.name}移出主屏`} title="移出主屏" onClick={() => remove(p.id)}>
                  <X size={13} />
                </button>
              </header>
              <div className="mod-body">{def.render({ ...ctx, size: p.size })}</div>
              <span
                className="mod-resize"
                title="拖动改变大小：小 · 中 · 大 · 长 · 竖"
                onPointerDown={(e) => beginResize(e, p.id, p.size)}
                aria-hidden="true"
              />
            </section>
          );
        })}
        {!placed.length && (
          <div className="board-empty" style={{ gridColumn: '1 / -1' }}>
            <Emoji size={48}>🐄</Emoji>
            <p>主屏空空如也。打开「模块库」把模块拖进来吧。</p>
          </div>
        )}
      </div>

      <input
        ref={colorInput}
        type="color"
        hidden
        aria-label="自选卡片颜色"
        onChange={(e) => colorTarget.current && setColor(colorTarget.current, e.target.value)}
      />
      {undo && (
        <div className="undo-pill" role="status">
          <Wand2 size={15} /> 已智能摆放
          <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={() => { const prev = undo; setUndo(null); void commit(prev); }}>
            撤销
          </Button>
        </div>
      )}
      {below.count > 0 && !ghost && !undo && (
        <button
          className="more-below"
          onClick={() =>
            below.first &&
            nodeFor(below.first)?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'center' })
          }
        >
          <ArrowDown size={15} strokeWidth={2.6} /> 下方还有 {below.count} 个模块
        </button>
      )}

      <aside className={`shelf ${shelfOpen ? 'is-open' : ''} ${ghost?.removing ? 'is-trash' : ''}`} aria-label="模块库" aria-hidden={!shelfOpen} inert={!shelfOpen}>
        <div className="shelf-head">
          <div>
            <h2>模块库</h2>
            <p className="muted">按住卡片拖进主屏，或点「＋」。把主屏模块拖到这里可移除。</p>
          </div>
          <IconButton label="关闭模块库" variant="ghost" onClick={closeShelf}><X size={16} /></IconButton>
        </div>
        <div className="shelf-list">
          {MODULE_IDS.map((id) => {
            const def = MODULES[id];
            const used = onBoard.has(id);
            return (
              <div
                key={id}
                className={`shelf-card ${used ? 'is-used' : ''}`}
                onPointerDown={used ? undefined : (e) => beginDrag(e, id, 'shelf', def.defaultSize)}
              >
                <div className="shelf-card-head">
                  <Badge icon={def.icon} color={def.accent} />
                  <div>
                    <b>{def.name}</b>
                    <small>{def.blurb}</small>
                  </div>
                  {used ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Check size={13} />}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        const el = nodeFor(id);
                        el?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'center' });
                        fx('module-drop', el);
                      }}
                    >
                      已在主屏
                    </Button>
                  ) : (
                    <IconButton label={`添加${def.name}`} variant="primary" size="sm" onPointerDown={(e) => e.stopPropagation()} onClick={() => add(id)}>
                      <Plus size={16} />
                    </IconButton>
                  )}
                </div>
                <div className={`shelf-preview board-item mod-${id} size-m`} style={{ '--module-accent': def.accent } as CSSProperties} inert>
                  {/* Live previews render only while the drawer is open. */}
                  {shelfOpen && <div className="mod-body">{def.render({ ...ctx, size: 'm' })}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="shelf-trash" aria-hidden="true">
          <Hand size={30} /> 松手移出主屏
        </div>
      </aside>

      <Modal
        open={moduleEditor !== null}
        title={moduleEditor ? `修改${MODULES[moduleEditor].name}` : '修改模块内容'}
        onClose={() => setModuleEditor(null)}
      >
        {moduleEditor && (
          <div
            className={`module-content-editor board-item mod-${moduleEditor} size-l`}
            style={{ '--module-accent': MODULES[moduleEditor].accent } as CSSProperties}
          >
            <div className="mod-body">{MODULES[moduleEditor].render({ ...ctx, size: 'l' })}</div>
          </div>
        )}
      </Modal>

      {ghost && (
        <div
          className={`drag-ghost ${ghost.removing ? 'is-removing' : ''}`}
          style={{ left: ghost.x, top: ghost.y, '--w': SIZES[ghost.size].w, '--h': SIZES[ghost.size].h } as CSSProperties}
          aria-hidden="true"
        >
          {(() => { const d = MODULES[ghost.id]; return <Badge icon={ghost.removing ? SquareDashed : d.icon} color={ghost.removing ? '#d2493a' : d.accent} size="lg" />; })()}
          <b>{MODULES[ghost.id].name}</b>
          <small>{ghost.removing ? '松手移除' : SIZES[ghost.size].label}</small>
        </div>
      )}
    </>
  );
}
