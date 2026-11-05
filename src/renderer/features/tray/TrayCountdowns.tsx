import { useState } from 'react';
import { ChevronDown, CalendarHeart, Plus } from 'lucide-react';
import type { TraySummary } from '../../../shared/tray-summary';
export function TrayCountdowns({ hopes, busy, onManage }: { hopes: TraySummary['hopes']; busy: boolean; onManage(): void }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="tray-countdowns" aria-label="盼头倒数日">
    <div className="tray-section-heading"><span><CalendarHeart size={13} />盼头</span><button className="tray-inline-button" disabled={busy} onClick={onManage} aria-label="管理盼头"><Plus size={13} /></button></div>
    {!hopes.length ? <button className="tray-countdown-empty" disabled={busy} onClick={onManage}>添加一个盼头 <Plus size={12} /></button>
      : <ul>{(expanded ? hopes : hopes.slice(0, 3)).map(hope => <li key={hope.id} className={hope.days === null ? 'is-pending' : hope.days < 0 ? 'is-past' : hope.days <= 1 ? 'is-near' : ''}>
        <span className="tray-hope-emoji m-bob" aria-hidden="true">{hope.emoji}</span><span className="tray-hope-name" title={[hope.name, hope.label, hope.date].filter(Boolean).join(' · ')}>{hope.name}{hope.label && <small>{hope.label}</small>}</span>
        <strong>{hope.days === null ? '待更新' : hope.days < 0 ? `已过 ${-hope.days} 天` : hope.days === 0 ? '今天' : hope.days === 1 ? '明天' : `还有 ${hope.days} 天`}</strong>
      </li>)}</ul>}
    {hopes.length > 3 && <button className="tray-countdown-more" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? '收起' : `更多 ${hopes.length - 3} 项`}<ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></button>}
  </section>;
}
