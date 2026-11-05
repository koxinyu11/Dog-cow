import type { TrayPanelData } from '../../../shared/tray';
import { TrayWorkStatus } from './TrayWorkStatus';
export function TrayMetrics({ data, onSettings, busy }: { data: TrayPanelData; onSettings(): void; busy: boolean }) {
  const { view, summary, configured, calculationError } = data;
  return <section className="tray-metrics" aria-label="工作状态">
    <span className="tray-metric-caption">今日已赚 <span>· 估算</span></span>
    <div className="tray-income-line"><strong className="tray-income" title={view.income.tooltip}>{configured ? view.income.value : '—'}</strong><TrayWorkStatus summary={summary} /></div>
    <dl className="tray-work-grid">
      {[['已工作', summary.worked], ['距离下班', summary.countdown], ['本月已赚 · 估算', summary.month]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>)}
    </dl>
    {(!configured || calculationError) && <button className="tray-inline-button" disabled={busy} onClick={onSettings}>{configured ? '检查工作设置' : '设置工作规则'} ↗</button>}
  </section>;
}
