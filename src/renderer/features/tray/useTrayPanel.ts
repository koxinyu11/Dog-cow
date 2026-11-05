import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fields, Result } from '../../../shared/contracts';
import { TRAY_ERRORS, type TrayDisplay, type TrayPanelData, type TrayPanelPhase } from '../../../shared/tray';
interface Failure { message: string; code?: string; correlationId?: string }
export function useTrayPanel() {
  const [data, setData] = useState<TrayPanelData>();
  const [arrowLeft, setArrowLeft] = useState(160);
  const [phase, setPhase] = useState<TrayPanelPhase>('hidden');
  const [failure, setFailure] = useState<Failure>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const receive = useCallback((next: TrayPanelData) => setData(previous => !previous || next.sequence > previous.sequence ? next : previous), []);
  const bootstrap = useCallback(async () => {
    const result = await window.dogcow.invoke('bootstrap');
    if (!result.trayPanel) throw Error('Panel state missing');
    receive(result.trayPanel);
    await window.dogcow.invoke('trayPanelAction', { action: 'ready' });
  }, [receive]);
  useEffect(() => {
    const unsubscribe = window.dogcow.trayPanel(event => { receive(event.data); setPhase(event.phase); setArrowLeft(event.arrowLeft); });
    void bootstrap().catch(() => setFailure({ message: '状态读取失败，请重试。' }));
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') void window.dogcow.invoke('trayPanelAction', { action: 'hide' }).catch(() => setFailure({ message: '面板收起失败，请重试。' })); };
    window.addEventListener('keydown', escape);
    return () => { unsubscribe(); window.removeEventListener('keydown', escape); };
  }, [bootstrap, receive]);
  useEffect(() => { if (data) document.documentElement.dataset.theme = data.theme; }, [data?.theme]);
  const execute = async (method: 'trayPreferences' | 'trayPanelAction' | 'retryTray', payload: Fields) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailure(undefined);
    try {
      const result: Result = await window.dogcow.invoke(method, payload);
      if (result.trayPanel) receive(result.trayPanel);
      if (result.errorCode || (method === 'trayPreferences' && (!result.applied || !result.persisted))) {
        setFailure({ message: result.message || '操作未完成，请重试。', code: result.errorCode, correlationId: result.correlationId });
      }
    } catch { setFailure({ message: '操作未完成，请重试。' }); }
    finally { lock.current = false; setBusy(false); }
  };
  const choose = (display: TrayDisplay) => { if (data) void execute('trayPreferences', { display, expectedWindowRevision: data.revision }); };
  const action = (action: string) => void execute('trayPanelAction', { action });
  const retry = () => {
    if (!data) { void bootstrap().then(() => setFailure(undefined)).catch(() => setFailure({ message: '状态读取失败，请重试。' })); return; }
    if (data.tray?.errorCode) void execute('retryTray', {});
    else choose(data.view.display);
  };
  const code = data?.tray?.errorCode;
  const feedback = failure ?? (code ? { message: TRAY_ERRORS[code as keyof typeof TRAY_ERRORS] || '菜单栏异常，请重试。', code, correlationId: data?.tray?.correlationId }
    : data?.dirty || data?.warning ? { message: '未保存', code: data.warning, correlationId: data.correlationId } : undefined);
  const copy = async () => { const result = await window.dogcow.invoke('copyTrayDiagnostics'); if (result.errorCode) throw Error(result.errorCode); };
  return { data, phase, arrowLeft, busy, feedback, choose, action, retry, copy };
}
