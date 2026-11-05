import { useEffect, useId, useRef, useState } from 'react';
import type { Snapshot } from '../../../shared/contracts';
import { TRAY_DISPLAYS, TRAY_ERRORS, trayView, type TrayDisplay } from '../../../shared/tray';
import { command, registerFlush } from '../../state';
import { Button } from '../../ui';
import { FormSelect } from '../../components/FormSelect';
import './tray.css';
import { CowMark } from './CowMark';

export function TraySettings({ state, notify }: { state: Snapshot; notify(message: string): void }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<Promise<boolean> | null>(null);
  useEffect(() => registerFlush(() => pending.current ?? Promise.resolve(true)), []);
  if (!state.tray?.supported) return null;
  const display = state.window.tray?.display ?? 'icon';
  const view = trayView(state, display);
  const save = (next: TrayDisplay) => {
    setBusy(true);
    const job = (async () => {
      try {
        const result = await command('trayPreferences', { display: next, expectedWindowRevision: state.window.revision });
        setFailed(!result.applied || !result.persisted);
        if (result.message) notify(result.message);
        return result.applied && result.persisted;
      } catch {
        setFailed(true);
        notify('菜单栏设置未保存，请重试。');
        return false;
      } finally { setBusy(false); }
    })();
    pending.current = job;
  };
  const errorCode = state.tray.errorCode as keyof typeof TRAY_ERRORS | undefined;
  const unsaved = failed || state.window.dirty || !!state.window.warning;
  const retry = async () => {
    setBusy(true);
    try { await command('retryTray'); } catch { notify('菜单栏重试失败，请再次重试。'); } finally { setBusy(false); }
  };
  return <section className="tray-settings" aria-labelledby={`${id}-heading`} aria-busy={busy}>
    <h3 id={`${id}-heading`}>菜单栏</h3>
    <div className="tray-settings-row">
      <label htmlFor={id}>显示内容</label>
      <span className="tray-preview" aria-label={`菜单栏预览：${TRAY_DISPLAYS[display]}`}>
        {display === 'icon' ? <CowMark size={28} /> : view.title}
      </span>
      <FormSelect id={id} value={display} disabled={busy} onChange={value => save(value as TrayDisplay)}>
        {Object.entries(TRAY_DISPLAYS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </FormSelect>
    </div>
    {(errorCode || unsaved) && <div className="tray-feedback" role="status">
      <span>{errorCode ? TRAY_ERRORS[errorCode] || '菜单栏异常，请重试。' : '未保存'}</span>
      {errorCode && <Button variant="ghost" disabled={busy} onClick={() => void retry()}>重试菜单栏</Button>}
      {unsaved && <Button variant="ghost" disabled={busy} onClick={() => save(display)}>重试保存</Button>}
      <details><summary>详情</summary>
        <span>{state.tray.errorCode || state.window.warning} · {state.tray.correlationId}</span>
        <Button variant="ghost" onClick={() => void command('copyTrayDiagnostics').then(r => notify(r.message)).catch(() => notify('诊断信息复制失败，请重试。'))}>复制诊断信息</Button>
      </details>
    </div>}
  </section>;
}
