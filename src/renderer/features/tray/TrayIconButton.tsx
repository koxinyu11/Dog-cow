import type { ReactNode } from 'react';
export function TrayIconButton({ label, children, disabled, danger = false, onClick }: { label: string; children: ReactNode; disabled?: boolean; danger?: boolean; onClick(): void }) {
  return <button type="button" className={`tray-icon-button${danger ? ' tray-quit' : ''}`} disabled={disabled} onClick={onClick} aria-label={label}>
    {children}<span className="tray-button-tooltip" role="tooltip">{label}</span>
  </button>;
}
