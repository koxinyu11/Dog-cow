import { Check } from 'lucide-react';
export function Price({ price, balance, disabled, onBuy, owned, verb = '购买' }: {
  price: number; balance: number; disabled: boolean; onBuy(): void; owned?: boolean; verb?: string;
}) {
  if (owned) return <span className="df-owned"><Check size={13}/>已拥有</span>;
  const short = price - balance;
  return <button className="df-price is-buy" disabled={disabled || short > 0} onClick={onBuy} title={short > 0 ? `还差 ${short} 狗牛币` : undefined}>
    <b>{price}</b>{short > 0 ? <small>还差 {short}</small> : verb}
  </button>;
}
