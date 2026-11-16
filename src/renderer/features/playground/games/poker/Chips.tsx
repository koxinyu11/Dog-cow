import type { CSSProperties } from 'react';
export const chipValues = [500, 100, 25, 10, 5, 1] as const;
export function Chip({ value }: {
    value: number;
}) {
    return <span className={`pk-chip pk-chip-${value}`}><span>{value}</span></span>;
}
/** Bounded visual stacks; the adjacent total always carries the exact value. */
export function ChipStack({ amount, total = true }: {
    amount: number;
    total?: boolean;
}) {
    let left = amount;
    const stacks = chipValues.flatMap(value => {
        const count = Math.floor(left / value);
        left %= value;
        return count ? [{ value, count }] : [];
    });
    return <span className="pk-chip-amount" aria-label={`${amount.toLocaleString()} 筹码`}>
    <span className="pk-chip-stacks" aria-hidden="true">{stacks.map(({ value, count }) => <span className="pk-chip-stack" key={value}>
      {Array.from({ length: Math.min(count, 4) }, (_, i) => <span key={i} style={{ '--chip-rise': `${i * -3}px` } as CSSProperties}><Chip value={value}/></span>)}
    </span>)}</span>
    {total && <b>{amount.toLocaleString()}</b>}
  </span>;
}
