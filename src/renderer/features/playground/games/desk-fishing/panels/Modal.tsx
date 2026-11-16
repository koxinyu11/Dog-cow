import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export interface Tab<T extends string> { id: T; label: string; icon?: ReactNode; badge?: number }
/** In-game floating window: dims the scene, traps focus, closes on Esc or backdrop click. */
export function Modal<T extends string>({ label, tabs, active, onTab, onClose, children, footer }: {
  label: string; tabs: readonly Tab<T>[]; active: T; onTab(id: T): void; onClose(): void; children: ReactNode; footer?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  function keys(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <div className="df-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="df-modal" role="dialog" aria-modal="true" aria-label={label} ref={box} tabIndex={-1} onKeyDown={keys}>
      <header className="df-modal-head">
        <div className="df-modal-tabs" role="tablist">{tabs.map(tab => <button key={tab.id} role="tab" aria-selected={active === tab.id} onClick={() => onTab(tab.id)}>{tab.icon}<span>{tab.label}</span>{!!tab.badge && <b>{tab.badge}</b>}</button>)}</div>
        <button className="df-modal-close" aria-label="关闭" onClick={onClose}><X size={18}/></button>
      </header>
      <div className="df-modal-body">{children}</div>
      {footer && <footer className="df-modal-foot">{footer}</footer>}
    </div>
  </div>;
}
