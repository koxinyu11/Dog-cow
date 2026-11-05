import { TrayTaskSummary } from './TrayTaskSummary';
import { TrayCountdowns } from './TrayCountdowns';
import { useEffect, useRef } from 'react';
import { TrayPanelArrow } from './TrayPanelArrow';
import { TrayHeader } from './TrayHeader';
import { TrayMetrics } from './TrayMetrics';
import { TrayDisplayPicker } from './TrayDisplayPicker';
import { TrayActions } from './TrayActions';
import { TrayFeedback } from './TrayFeedback';
import { useTrayPanel } from './useTrayPanel';
import './tray-panel.css';
export function TrayPanel() {
  const { data, phase, arrowLeft, busy, feedback, choose, action, retry, copy } = useTrayPanel();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => {
      const height = entries[0]?.borderBoxSize[0]?.blockSize;
      if (height) void window.dogcow.invoke('trayPanelAction', { action: 'resize', height: height + 24 }).catch(() => {});
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (phase === 'opening') ref.current?.focus({ preventScroll: true }); }, [phase]);
  return <main className="tray-panel-host" data-phase={phase}>
    <div className="tray-panel" ref={ref} tabIndex={-1} aria-label="狗牛状态">
      <TrayPanelArrow left={arrowLeft} />
      <TrayHeader busy={busy || !data?.canSwitch} onOpen={() => action('open')} />
      {data ? <>
        <TrayMetrics data={data} onSettings={() => action('settings')} busy={busy || !data.canSwitch} />
        <TrayTaskSummary tasks={data.summary.tasks} />
        <TrayCountdowns hopes={data.summary.hopes} busy={busy || !data.canSwitch} onManage={() => action('hopes')} />
        <TrayDisplayPicker value={data.view.display} busy={busy} onChange={choose} />
      </> : <div className="tray-panel-loading" aria-label="正在读取状态"><span /><span /></div>}
      {feedback && <TrayFeedback message={feedback.message} code={feedback.code} correlationId={feedback.correlationId} busy={busy} onRetry={retry} onCopy={copy} />}
      <TrayActions busy={busy || !data?.canSwitch} onQuit={() => action('quit')} />
    </div>
  </main>;
}
