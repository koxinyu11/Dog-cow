import type { TraySummary } from '../../../shared/tray-summary';
export function TrayWorkStatus({ summary }: { summary: TraySummary }) {
  return <span className={`tray-status is-${summary.tone}`}><i aria-hidden="true" />{summary.status}</span>;
}
