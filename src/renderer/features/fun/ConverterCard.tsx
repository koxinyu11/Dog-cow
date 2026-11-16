import { useDisplayIncome } from '../../display-income';
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Check, ChevronDown, CircleHelp, Ellipsis, Settings2 } from 'lucide-react';
import type { ModuleCtx } from '../../board/modules';
import type { Fields, Result } from '../../../shared/contracts';
import { defaultFun, type Product, type ProductType } from '../../../shared/fun';
import { goalSpan, spanText, treatShelf, type GoalSpan, type TreatShelf } from '../../../shared/fun-display';
import { Button, Segmented } from '../../ui';
import { money } from '../../format';
import { Modal } from '../../components/Modal';
import { PickerPopover, focusPicker } from '../../components/PickerPopover';
import { ProductManager } from './ProductManager';

const icon = (p: Product) => p.emoji ?? (p.type === 'goal' ? '🎯' : '🧋');
const unitOf = (p: Product) => p.unit || '份';
const priceText = (p: Product) => `¥${money(p.price)}${p.type !== 'goal' ? ` / ${unitOf(p)}` : ''}`;
const options: [ProductType, string][] = [['treat', '今日快乐'], ['goal', '大件算盘']];
type ProductItem = { p: Product; i: number };
type View = { kind: 'treat'; shelf: TreatShelf } | { kind: 'goal'; span: GoalSpan } | null;
function viewOf(p: Product, earned: unknown, month: unknown): View {
  if (p.type === 'goal') { const span = goalSpan(p.price, month); return span && { kind: 'goal', span }; }
  const shelf = treatShelf(p.price, earned); return shelf && { kind: 'treat', shelf };
}
function arrowKeys(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
}
/** Big number with small decimals/units; never reflows the meaning of the value. */
function Figure({ product, view }: { product: Product; view: View }) {
  if (!view) return <strong className="conv-figure is-muted">暂时算不出</strong>;
  if (view.kind === 'treat') {
    const [whole, decimals] = view.shelf.count.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
    return <strong className="conv-figure" aria-label={`${whole}.${decimals} ${unitOf(product)}`}><b>{whole}</b><i>.{decimals}</i><em>{unitOf(product)}</em></strong>;
  }
  const { span } = view;
  return <strong className="conv-figure" aria-label={`约 ${spanText(span)}工资`}>{span.months <= 12 ? <><b>{span.months}</b><em>个月</em></> : <><b>{span.years.toLocaleString('zh-CN')}</b><em>年</em>{span.rest > 0 && <><b className="is-rest">{span.rest}</b><em>个月</em></>}</>}</strong>;
}
/** Visual quantity: emoji shelf for treats, month/year cells for goals. */
function Shelf({ product, view, bar = false }: { product: Product; view: View; bar?: boolean }) {
  if (!view) return null;
  if (bar) {
    const value = view.kind === 'treat' ? view.shelf.fraction : view.span.unit === 'month' ? view.span.months / 12 : 1;
    return <span className="conv-bar" aria-hidden="true"><span style={{ '--p': value } as CSSProperties} /></span>;
  }
  if (view.kind === 'goal') {
    const { span } = view;
    return <span className={`conv-cells is-${span.unit}`} aria-hidden="true">
      {Array.from({ length: span.cells }, (_, i) => <span key={i} className={i < span.filled ? 'is-on' : ''} />)}
      {span.overflow && <small>×{Math.ceil(span.months / 12).toLocaleString('zh-CN')} 年</small>}
    </span>;
  }
  const { shelf } = view;
  const emoji = icon(product);
  return <span className="conv-shelf" aria-hidden="true">
    {Array.from({ length: shelf.shown }, (_, i) => <span key={i} className="conv-item">{emoji}</span>)}
    {shelf.overflow ? <small>×{shelf.whole.toLocaleString('zh-CN')}</small> : <span className="conv-item is-part" data-e={emoji} style={{ '--p': shelf.fraction } as CSSProperties} />}
  </span>;
}
function Hint({ product, view, basis }: { product: Product; view: View; basis: string }) {
  if (!view) return <small className="conv-hint">{basis} · 数据暂缺</small>;
  if (view.kind === 'treat') return <small className="conv-hint">再赚 <b>¥{money(view.shelf.remaining)}</b> 多一{unitOf(product)}</small>;
  return <small className="conv-hint">{priceText(product)} · {basis}</small>;
}
function ProductPicker({ items, selected, disabled, onPick, error }: { items: ProductItem[]; selected: number; disabled: boolean; onPick: (i: number) => Promise<boolean>; error: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const current = items.find(x => x.i === selected);
  const choose = async (i: number) => { if (!disabled && await onPick(i)) { setOpen(false); focusPicker(anchor); } };
  return <div ref={anchor} className="conv-picker">
    <button type="button" data-picker-trigger className="conv-product-trigger" aria-label="选择换算商品" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} disabled={disabled || items.length < 2} onClick={() => setOpen(!open)}>
      <span className="conv-trigger-emoji" aria-hidden="true">{current && icon(current.p)}</span><span className="conv-trigger-name">{current?.p.name}</span>{items.length > 1 && <ChevronDown size={13} />}
    </button>
    <PickerPopover id={id} open={open} anchor={anchor} onClose={() => setOpen(false)} label="选择换算商品" className="conv-product-menu">
      <div onKeyDown={arrowKeys}>
        {items.map(x => <button type="button" key={x.i} data-autofocus={x.i === selected ? '' : undefined} aria-pressed={x.i === selected} disabled={disabled} onClick={() => void choose(x.i)}><span aria-hidden="true">{icon(x.p)}</span><span className="conv-menu-label"><b>{x.p.name}</b><small>{priceText(x.p)}</small></span>{x.i === selected && <Check size={15} />}</button>)}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </PickerPopover>
  </div>;
}
function MoreMenu({ mode, setMode, manage, help, busy }: { mode: ProductType; setMode(mode: ProductType): void; manage(): void; help(): void; busy: boolean }) {
  const anchor = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const act = (fn: () => void) => { setOpen(false); fn(); };
  return <div ref={anchor} className="conv-more">
    <button type="button" data-picker-trigger className="conv-more-trigger" aria-label="更多" title="更多" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Ellipsis size={15} /></button>
    <PickerPopover id={id} open={open} anchor={anchor} onClose={() => setOpen(false)} label="换算设置" className="conv-more-menu">
      <Segmented value={mode} options={options} label="换算模式" onChange={value => { setMode(value); setOpen(false); focusPicker(anchor); }} />
      <div onKeyDown={arrowKeys}>
        <button type="button" disabled={busy} onClick={() => act(manage)}><Settings2 size={15} />管理商品</button>
        <button type="button" onClick={() => act(help)}><CircleHelp size={15} />这笔账怎么算</button>
      </div>
    </PickerPopover>
  </div>;
}
function Others({ items, earned, month, disabled, onPick }: { items: ProductItem[]; earned: unknown; month: unknown; disabled: boolean; onPick(i: number): void }) {
  if (!items.length) return null;
  return <div className="conv-others" aria-label="其他商品换算">{items.map(x => {
    const view = viewOf(x.p, earned, month);
    const value = !view ? '—' : view.kind === 'treat' ? `${view.shelf.count.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} ${unitOf(x.p)}` : spanText(view.span);
    return <button type="button" key={x.i} disabled={disabled} onClick={() => onPick(x.i)} title={`${x.p.name} · ${priceText(x.p)}`}><span className="conv-other-emoji" aria-hidden="true">{icon(x.p)}</span><span className="conv-other-name">{x.p.name}</span><b>{value}</b></button>;
  })}</div>;
}
export function ConverterCard({ ctx, busy, error, run }: { ctx: ModuleCtx; busy: boolean; error: string; run: (p: Fields) => Promise<Result | null> }) {
  const { state, size, openSettings } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [mode, setMode] = useState<ProductType>(() => fun.products[fun.product]?.type ?? 'treat');
  const [pending, setPending] = useState<number | null>(null);
  const { money: incomeMoney } = useDisplayIncome();
  const earned = state.income.snapshot?.earnedToday;
  const month = state.income.snapshot?.expectedMonthIncome;
  const items = fun.products.map((p, i) => ({ p, i })).filter(x => (x.p.type ?? 'treat') === mode);
  const current = items.find(x => x.i === fun.product) ?? items[0];
  const locked = busy || pending !== null;
  const pick = async (i: number) => {
    if (locked) return false;
    if (i === fun.product) return true;
    setPending(i);
    try { return !!(await run({ action: 'product', value: i })); } finally { setPending(null); }
  };
  if (!state.income.settings) return <div className="conv-empty"><span aria-hidden="true">🧋</span><Button size="sm" onClick={() => openSettings('income')}>设置工资</Button></div>;
  const basis = mode === 'treat' ? `今日 ¥${incomeMoney(earned)}` : `月薪 ¥${incomeMoney(month)}`;
  const more = <MoreMenu mode={mode} setMode={setMode} busy={busy} manage={() => setOpen(true)} help={() => setHelp(true)} />;
  const overlays = <>
    {!open && error && <p className="error" role="alert">{error}</p>}
    <Modal open={help} title="这笔账怎么算" onClose={() => setHelp(false)}><div>{mode === 'goal' ? <><p>商品价格 ÷ 预计月薪，向上取整。</p><p>按全部工资折算，未扣生活开销，不代表实际攒钱期限。</p></> : <p>今日已赚 ÷ 商品单价，保留两位小数并向下取整。</p>}</div></Modal>
    {open && <ProductManager products={fun.products} selected={fun.product} busy={busy} error={error} run={run} onClose={() => setOpen(false)} />}
  </>;
  if (!current) return <div className={`conv-card conv-${size}`}>
    <div className="conv-head"><span className="conv-mode">{mode === 'treat' ? '今日快乐' : '大件算盘'}</span>{more}</div>
    <div className="conv-empty"><Button size="sm" onClick={() => setOpen(true)}>{mode === 'treat' ? '加点快乐' : '挑个大件'}</Button></div>
    {overlays}
  </div>;
  const view = viewOf(current.p, earned, month);
  const picker = <ProductPicker items={items} selected={current.i} disabled={locked} onPick={pick} error={error} />;
  const others = <Others items={items.filter(x => x.i !== current.i)} earned={earned} month={month} disabled={locked} onPick={i => void pick(i)} />;
  const head = <div className="conv-head">{picker}{more}</div>;
  const figure = <Figure product={current.p} view={view} />;
  const hint = <Hint product={current.p} view={view} basis={basis} />;
  const emoji = <span className="conv-tile" aria-hidden="true">{icon(current.p)}</span>;
  return <div className={`conv-card conv-${size} is-${mode}`}>
    {size === 's' && <>{head}{figure}<Shelf product={current.p} view={view} bar /></>}
    {size === 'm' && <>{head}{figure}<div className="conv-line"><Shelf product={current.p} view={view} />{hint}</div></>}
    {size === 'wide' && <>
      <div className="conv-main">{emoji}<div className="conv-stack">{picker}{figure}</div></div>
      <div className="conv-visual"><Shelf product={current.p} view={view} />{hint}</div>
      {others}{more}
    </>}
    {size === 'tall' && <>{head}<div className="conv-hero">{emoji}{figure}</div><Shelf product={current.p} view={view} />{hint}{others}</>}
    {size === 'l' && <>
      <div className="conv-col">{head}<div className="conv-hero">{emoji}{figure}</div><Shelf product={current.p} view={view} />{hint}</div>
      <div className="conv-col is-side"><span className="conv-side-title">{basis}</span>{others}</div>
    </>}
    {overlays}
  </div>;
}
