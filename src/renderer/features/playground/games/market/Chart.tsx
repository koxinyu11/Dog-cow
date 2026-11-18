export function MarketChart({ values, compact = false, positive = true }: { values: number[]; compact?: boolean; positive?: boolean }) {
  const data = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const low = Math.min(...data), high = Math.max(...data), spread = Math.max(1, high - low);
  const points = data.map((v, i) => `${i / (data.length - 1) * 600},${150 - (v - low) / spread * 130}`).join(' ');
  return <svg viewBox="0 0 600 180" preserveAspectRatio="none" className={`mk-chart ${positive ? 'mk-up' : 'mk-down'} ${compact ? 'is-compact' : ''}`} role="img" aria-label="价格走势，按五分钟采样">
    {!compact && [20, 65, 110, 155].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} className="mk-gridline" />)}
    {!compact && <polygon points={`0,180 ${points} 600,180`} className="mk-chart-area" />}
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth={compact ? 5 : 2} vectorEffect="non-scaling-stroke" />
  </svg>;
}
