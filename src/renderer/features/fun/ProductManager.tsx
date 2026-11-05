import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Fields, Result } from '../../../shared/contracts';
import { PRODUCT_PRESETS, type Product, type ProductType } from '../../../shared/fun';
import { Button, Segmented } from '../../ui';
import { FormSelect } from '../../components/FormSelect';
import { Modal } from '../../components/Modal';

type Row = { emoji: string; name: string; price: string; unit: string; type: ProductType; sourceIndex?: number };
const toRow = (p: Product, sourceIndex?: number): Row => ({ sourceIndex, unit: p.unit ?? '', emoji: p.emoji ?? '', name: p.name, price: String(p.price), type: p.type ?? 'treat' });
const rowError = (r: Row) => !r.name.trim() ? '填个名字' : r.name.length > 60 ? '名字太长' : !(Number(r.price) > 0) ? '价格要大于 0' : Number(r.price) > 100000000 ? '价格太大' : '';

export function ProductManager({ products, selected, busy, error, run, onClose }: { products: Product[]; selected: number; busy: boolean; error: string; run: (p: Fields) => Promise<Result | null>; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => products.map((p, i) => toRow(p, i)));
  const [tried, setTried] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const full = rows.length >= 30;
  const invalid = rows.some(r => rowError(r));
  return <Modal open title="快乐价目表" onClose={() => { if (!busy) onClose(); }} className="conv-manager">
    <form onSubmit={async e => {
      e.preventDefault(); setTried(true);
      if (invalid) return;
      const value = rows.map(r => ({ name: r.name.trim(), price: Number(r.price), type: r.type, ...(r.unit.trim() ? { unit: r.unit.trim() } : {}), ...(r.emoji.trim() ? { emoji: r.emoji.trim() } : {}) }));
      if (await run({ action: 'products', value, selected: Math.max(0, rows.findIndex(r => r.sourceIndex === selected)) })) onClose();
    }}>
      <div className="conv-add-bar"><FormSelect aria-label="添加商品" value="" disabled={full || busy} onChange={value => {
        if (!value) return;
        const preset = PRODUCT_PRESETS.find(p => p.name === value);
        setRows(rs => [...rs, preset ? toRow(preset) : { emoji: '', name: '', price: '', unit: '', type: 'treat' }]);
      }}><option value="">{full ? '最多 30 个商品' : '＋ 添加商品'}</option>{PRODUCT_PRESETS.filter(p => !rows.some(r => r.name.trim() === p.name)).map(p => <option key={p.name} value={p.name}>{p.emoji} {p.name} · ¥{p.price}</option>)}<option value="custom">＋ 自定义商品</option></FormSelect><span>{rows.length} / 30</span></div>
      <fieldset disabled={busy} className="conv-fields"><div className="conv-row-head" aria-hidden="true"><span>图标</span><span>名称</span><span>价格 / 元</span><span>单位</span><span>类型</span><span /></div><div className="conv-rows">{rows.map((r, i) => {
        const err = tried || r.price !== '' ? rowError(r) : '';
        return <div key={i} className={err ? 'is-invalid' : ''}>
          <input aria-label="图标" className="conv-row-emoji" value={r.emoji} maxLength={8} placeholder="🎯" onChange={e => set(i, { emoji: e.target.value })} />
          <input aria-label="名称" value={r.name} maxLength={60} placeholder="名称" onChange={e => set(i, { name: e.target.value })} />
          <input aria-label="价格（元）" type="number" min="0.01" step="0.01" inputMode="decimal" value={r.price} placeholder="¥" onChange={e => set(i, { price: e.target.value })} />
          <input aria-label="单位" value={r.unit} maxLength={8} placeholder="份" onChange={e => set(i, { unit: e.target.value })} /><div className="conv-type"><Segmented value={r.type} label="商品类型" options={[[ 'treat', '小确幸' ], [ 'goal', '大件' ]]} onChange={type => set(i, { type })} /></div>
          <Button size="sm" variant="danger" aria-label={`移除 ${r.name || '这一行'}`} icon={<Trash2 size={13} />} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} />
          {err && <small className="error" role="alert">{err}</small>}
        </div>;
      })}</div>
      </fieldset>{error && <p className="error" role="alert">{error}</p>}<div className="dialog-actions"><Button disabled={busy} onClick={onClose}>取消</Button><Button type="submit" variant="primary" disabled={busy || (tried && invalid)}>{busy ? '保存中…' : '保存'}</Button></div>
    </form>
  </Modal>;
}
