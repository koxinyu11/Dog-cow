import { useEffect, useMemo, useState } from 'react';
import type { ListedSecurity } from '../../../../../shared/market/game';
import { aggregateCandles, movingAverage, macd } from '../../../../../shared/market/indicators';
import { money } from './TradePanel';
import { MarketChart } from './Chart';
const PERIODS = [5, 10, 20, 60];
const COLORS: Record<number, string> = { 5: '#b38b36', 10: '#478ab0', 20: '#9976aa', 60: '#6c9366' };
const W = 720, H = 430, LEFT = 8, RIGHT = 100, TOP = 14, BOTTOM = 244;
const timeLabel = (minute: number) => `D${Math.floor(minute / 1440) + 1} ${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export function AnalysisChart({ asset, minute }: { asset: ListedSecurity; minute: number }) {
  const [mode, setMode] = useState<'candles' | 'line'>('candles'), [interval, setInterval] = useState(5), [range, setRange] = useState(48);
  const [enabled, setEnabled] = useState([5, 10, 20]), [hover, setHover] = useState<number | null>(null);
  const bars = useMemo(() => aggregateCandles(asset.candles ?? [], interval), [asset.candles, interval]);
  const averages = useMemo(() => Object.fromEntries(PERIODS.map(n => [n, movingAverage(bars.map(b => b.close), n)])), [bars]);
  const oscillator = useMemo(() => macd(bars.map(b => b.close)), [bars]);
  const start = Math.max(0, bars.length - range), visible = bars.slice(start), length = visible.length;
  useEffect(() => { setHover(null); }, [asset.id, interval, range]);
  const index = Math.max(0, Math.min(length - 1, hover ?? length - 1)), absolute = start + index, current = visible[index];
  const priceValues = visible.flatMap(b => [b.high, b.low]);
  for (const n of enabled) for (const v of averages[n].slice(start)) if (v !== null) priceValues.push(v);
  const minPrice = priceValues.length ? Math.min(...priceValues) : 0, maxPrice = priceValues.length ? Math.max(...priceValues) : 1;
  const padding = Math.max(1, maxPrice - minPrice) * .08, low = minPrice - padding, high = maxPrice + padding;
  const plotWidth = W - LEFT - RIGHT, step = plotWidth / Math.max(1, length);
  const x = (i: number) => LEFT + step * (i + .5), y = (price: number) => BOTTOM - (price - low) / (high - low) * (BOTTOM - TOP);
  const maxVolume = Math.max(1, ...visible.map(b => b.volume));
  const macdValues = [...oscillator.dif.slice(start), ...oscillator.dea.slice(start), ...oscillator.histogram.slice(start)].filter((v): v is number => v !== null);
  const macdMax = Math.max(1, ...macdValues.map(Math.abs)), macdY = (value: number) => 374 - value / macdMax * 35;
  const path = (values: readonly (number | null)[], scale: (v: number) => number) => {
    let started = false;
    return values.slice(start).map((value, i) => { if (value === null) { started = false; return ''; } const instruction = `${started ? 'L' : 'M'}${x(i)},${scale(value)}`; started = true; return instruction; }).join(' ');
  };
  const bodyWidth = Math.max(1.2, Math.min(8, step * .58));
  const valueLabel = (value: number | null | undefined) => value == null ? '—' : money(value);
  return <div className="mk-analysis">
    <div className="mk-chart-toolbar"><div role="group" aria-label="图表类型"><button aria-pressed={mode === 'candles'} onClick={() => setMode('candles')}>蜡烛 K 线</button><button aria-pressed={mode === 'line'} onClick={() => setMode('line')}>趋势</button></div>
      <select aria-label="K线周期" value={interval} onChange={e => setInterval(Number(e.target.value))}>{[5, 15, 30, 60].map(n => <option key={n} value={n}>{n} 分钟</option>)}</select>
      <select aria-label="可见K线数量" value={range} onChange={e => setRange(Number(e.target.value))}><option value={24}>近 24 根</option><option value={48}>近 48 根</option><option value={96}>近 96 根</option><option value={1000}>全部</option></select>
    </div>
    <div className="mk-ohlc" aria-live="off"><span>{current ? timeLabel(current.time) : '历史趋势'}</span>{current && <><span>开 <b>{money(current.open)}</b></span><span>高 <b>{money(current.high)}</b></span><span>低 <b>{money(current.low)}</b></span><span>收 <b>{money(current.close)}</b></span><span>量 <b>{current.volume.toLocaleString()}</b></span></>}</div>
    <div className="mk-ma-controls" role="group" aria-label="均线显示">{PERIODS.map(n => <button key={n} style={{ '--ma-color': COLORS[n] } as React.CSSProperties} aria-pressed={enabled.includes(n)} onClick={() => setEnabled(values => values.includes(n) ? values.filter(p => p !== n) : [...values, n])}>MA{n} <span>{valueLabel(averages[n][absolute])}</span></button>)}</div>
    {!length ? <div className="mk-no-candles"><MarketChart values={asset.history} positive={asset.change >= 0} /><p>已有历史仅含收盘价。真实 K 线从下一轮行情开始记录。</p></div> : <svg className="mk-analysis-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" tabIndex={0}
      aria-label={`${asset.name}，${interval}分钟${mode === 'candles' ? '蜡烛K线' : '趋势图'}，含均线、成交量和MACD。左右方向键查看各根数据。`}
      onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); const px = (event.clientX - box.left) / box.width * W; setHover(Math.max(0, Math.min(length - 1, Math.floor((px - LEFT) / step)))); }} onPointerLeave={() => setHover(null)}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setHover(Math.max(0, Math.min(length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))); } }}>
      {[0, .5, 1].map(ratio => { const price = low + (high - low) * ratio; return <g key={ratio}><line className="mk-gridline" x1={LEFT} x2={W - RIGHT} y1={y(price)} y2={y(price)} /><text x={W - RIGHT + 9} y={y(price) + 3} className="mk-axis-text">{money(price)}</text></g>; })}
      {mode === 'candles' ? visible.map((bar, i) => <g key={bar.time} className={bar.close >= bar.open ? 'mk-up' : 'mk-down'}><line x1={x(i)} x2={x(i)} y1={y(bar.high)} y2={y(bar.low)} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" /><rect x={x(i) - bodyWidth / 2} y={Math.min(y(bar.open), y(bar.close))} width={bodyWidth} height={Math.max(1, Math.abs(y(bar.open) - y(bar.close)))} fill={bar.close >= bar.open ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" /></g>)
        : <path d={path(bars.map(b => b.close), y)} className={asset.change >= 0 ? 'mk-up' : 'mk-down'} stroke="currentColor" fill="none" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />}
      {enabled.map(n => <path key={n} d={path(averages[n], y)} fill="none" stroke={COLORS[n]} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <line x1={LEFT} x2={W - RIGHT} y1="267" y2="267" className="mk-panel-line" /><text x={LEFT} y="280" className="mk-axis-text">VOL</text><text x={W - RIGHT + 9} y="289" className="mk-axis-text">{new Intl.NumberFormat('zh-CN', { notation: 'compact' }).format(maxVolume)}</text>
      {visible.map((bar, i) => <rect key={bar.time} x={x(i) - bodyWidth / 2} y={321 - bar.volume / maxVolume * 31} width={bodyWidth} height={bar.volume / maxVolume * 31} className={bar.close >= bar.open ? 'mk-up' : 'mk-down'} fill="currentColor" opacity=".65" />)}
      <line x1={LEFT} x2={W - RIGHT} y1="333" y2="333" className="mk-panel-line" /><text x={LEFT} y="347" className="mk-axis-text">MACD 12 / 26 / 9</text>
      <line x1={LEFT} x2={W - RIGHT} y1={macdY(0)} y2={macdY(0)} className="mk-gridline" /><text x={W - RIGHT + 9} y={macdY(0) + 3} className="mk-axis-text">0.00</text>
      {oscillator.histogram.slice(start).map((value, i) => value === null ? null : <rect key={visible[i].time} x={x(i) - bodyWidth / 2} y={Math.min(macdY(value), macdY(0))} width={bodyWidth} height={Math.max(.5, Math.abs(macdY(value) - macdY(0)))} fill="currentColor" className={value >= 0 ? 'mk-up' : 'mk-down'} opacity=".7" />)}
      <path d={path(oscillator.dif, macdY)} fill="none" stroke="#b38b36" strokeWidth="1.1" vectorEffect="non-scaling-stroke" /><path d={path(oscillator.dea, macdY)} fill="none" stroke="#478ab0" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
      {[0, Math.floor((length - 1) / 2), length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => <text key={i} x={x(i)} y="426" textAnchor={i === 0 ? 'start' : i === length - 1 ? 'end' : 'middle'} className="mk-axis-text">{timeLabel(visible[i].time)}</text>)}
      {hover !== null && current && <g className="mk-crosshair"><line x1={x(index)} x2={x(index)} y1={TOP} y2="412" /><line x1={LEFT} x2={W - RIGHT} y1={y(current.close)} y2={y(current.close)} /><circle cx={x(index)} cy={y(current.close)} r="3" /></g>}
    </svg>}
    <div className="mk-macd-values"><span>DIF <b>{valueLabel(oscillator.dif[absolute])}</b></span><span>DEA <b>{valueLabel(oscillator.dea[absolute])}</b></span><span>MACD <b>{valueLabel(oscillator.histogram[absolute])}</b></span><span>{current && minute < current.time + interval ? '当前 K 线形成中' : '不复权'}</span></div>
    <details className="mk-indicator-help"><summary>指标说明</summary><p>MA 按所选周期的收盘价计算。MACD 使用 SMA 初始化的 EMA12、EMA26 与信号 EMA9，柱值为 2 × (DIF − DEA)。不足周期显示“—”。首尾 K 线可能未完整；分红除息缺口保留，指标不代表未来走势。</p></details>
  </div>;
}
