import { useDisplayIncome } from '../../display-income';
import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, CircleHelp, Settings2 } from 'lucide-react';
import type { ModuleCtx } from '../../board/modules';
import type { Fields, Result } from '../../../shared/contracts';
import { defaultFun, goalMonths, treatCount, type Product, type ProductType } from '../../../shared/fun';
import { Button, Segmented } from '../../ui';
import { money } from '../../format';
import { Modal } from '../../components/Modal';
import { PickerPopover, focusPicker } from '../../components/PickerPopover';
import { ProductManager } from './ProductManager';

const icon = (p: Product) => p.emoji ?? (p.type === 'goal' ? '🎯' : '🧋');
const options: [ProductType, string][] = [['treat', '今日快乐'], ['goal', '大件算盘']];
function result(p: Product, earned: unknown, month: unknown) {
  if (p.type === 'goal') {
    const months = goalMonths(p.price, month);
    return months === null ? null : `≈ ${months.toLocaleString('zh-CN')} 个月工资`;
  }
  const n = treatCount(p.price, earned);
  return n === null ? null : `${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${p.unit || '份'}`;
}
function ProductResult({ product, text }: { product: Product; text: string | null }) {
  return <><span className="conv-emoji" aria-hidden="true">{icon(product)}</span><span className="conv-result"><span className="conv-name" title={product.name}>{product.name}</span><strong className={text === null ? 'is-muted' : ''}>{text ?? '暂时算不出'}</strong><small>¥{money(product.price)}{product.type !== 'goal' && ` / ${product.unit || '份'}`}</small></span></>;
}
type ProductItem = { p: Product; i: number };
function ProductPicker({ items, selected, disabled, onPick, error }: { items: ProductItem[]; selected: number; disabled: boolean; onPick: (i: number) => Promise<boolean>; error: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const choose = async (i: number) => {
    if (disabled) return;
    if (await onPick(i)) { setOpen(false); focusPicker(anchor); }
  };
  const current = items.find(x => x.i === selected);
  return <div ref={anchor} className="conv-picker">
    <button type="button" data-picker-trigger className="conv-product-trigger" aria-label="选择换算商品" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => setOpen(!open)}>
      <span>{current && `${icon(current.p)} ${current.p.name}`}</span><ChevronDown size={14} />
    </button>
    <PickerPopover id={id} open={open} anchor={anchor} onClose={() => setOpen(false)} label="选择换算商品" className="conv-product-menu">
      <div ref={list} onKeyDown={e => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        if (!buttons.length) return;
        e.preventDefault();
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>
        {items.map(x => <button type="button" key={x.i} data-autofocus={x.i === selected ? '' : undefined} aria-pressed={x.i === selected} disabled={disabled} onClick={() => void choose(x.i)}><span aria-hidden="true">{icon(x.p)}</span><span className="conv-menu-label"><b>{x.p.name}</b><small>¥{money(x.p.price)}{x.p.type !== 'goal' && ` / ${x.p.unit || '份'}`}</small></span>{x.i === selected && <Check size={15} />}</button>)}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </PickerPopover>
  </div>;
}
export function ConverterCard({ ctx, busy, error, run }: { ctx: ModuleCtx; busy: boolean; error: string; run: (p: Fields) => Promise<Result | null> }) {
  const { state, size, openSettings } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const compact = size === 's' || size === 'wide';
  const [mode, setMode] = useState<ProductType>(() => fun.products[fun.product]?.type ?? 'treat');
  const [pending, setPending] = useState<number | null>(null);
  const { money: incomeMoney } = useDisplayIncome();
  const earned = state.income.snapshot?.earnedToday;
  const month = state.income.snapshot?.expectedMonthIncome;
  const items = fun.products.map((p, i) => ({ p, i })).filter(x => (x.p.type ?? 'treat') === mode);
  const current = items.find(x => x.i === fun.product) ?? items[0];
  const compare = size === 'wide' || size === 'tall' || size === 'l';
  const pick = async (i: number) => {
    if (busy || pending !== null) return false;
    if (i === fun.product) return true;
    setPending(i);
    try { return !!(await run({ action: 'product', value: i })); } finally { setPending(null); }
  };
  if (!state.income.settings) return <div className="conv-empty"><span>工资报个数，快乐算清楚</span><Button size="sm" onClick={() => openSettings('income')}>设置工资</Button></div>;
  return <div className={`conv-card conv-${size}`}>
    <div className="conv-controls">
      <Segmented value={mode} options={options} label="换算模式" onChange={setMode} />
      <div className="conv-tools">
        <button className="conv-help-button" type="button" aria-label="这笔账怎么算" title="这笔账怎么算" onClick={() => setHelp(true)}><CircleHelp size={15} /></button>
        <button className="conv-edit" type="button" aria-label="管理商品" title="快乐价目表" disabled={busy} onClick={() => setOpen(true)}><Settings2 size={15} /><span>管理</span></button>
      </div>
    </div>
    <div className="conv-basis">{mode === 'treat' ? `今日已赚 ¥${incomeMoney(earned)}` : `预计月薪 ¥${incomeMoney(month)}`}{(mode === 'treat' ? earned == null : month == null) && ' · 数据暂缺'}</div>
    {!items.length ? <div className="conv-empty"><span>{mode === 'treat' ? '第一份快乐，安排什么？' : '大件梦想，先挑一个'}</span><Button size="sm" onClick={() => setOpen(true)}>加点快乐</Button></div> : compare ?
      <div className="conv-comparison" aria-label="商品换算结果">{items.map(x => <button type="button" key={x.i} aria-pressed={x.i === fun.product} disabled={busy || pending !== null} onClick={() => void pick(x.i)}><ProductResult product={x.p} text={result(x.p, earned, month)} /></button>)}</div> : <>
        {size === 's' ? <div className="conv-small-result">
          <ProductPicker items={items} selected={current.i} disabled={busy || pending !== null} onPick={pick} error={error} />
          <strong>{result(current.p, earned, month) ?? '暂时算不出'}</strong>
        </div> : <>
          <div className="conv-hero"><ProductResult product={current.p} text={result(current.p, earned, month)} /></div>
          {items.length > 1 && <ProductPicker items={items} selected={current.i} disabled={busy || pending !== null} onPick={pick} error={error} />}
        </>}
      </>}
    {!compact && mode === 'treat' && earned === 0 && <small className="conv-note">快乐额度，等待开张</small>}

    {!open && error && <p className="error" role="alert">{error}</p>}
    <Modal open={help} title="这笔账怎么算" onClose={() => setHelp(false)}><div>{mode === 'goal' ? <><p>商品价格 ÷ 预计月薪，向上取整。</p><p>按全部工资折算，未扣生活开销，不代表实际攒钱期限。</p></> : <p>今日已赚 ÷ 商品单价，保留两位小数并向下取整。</p>}</div></Modal>
    {open && <ProductManager products={fun.products} selected={fun.product} busy={busy} error={error} run={run} onClose={() => setOpen(false)} />}
  </div>;
}
