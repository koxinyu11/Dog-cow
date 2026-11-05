import { GripVertical, Maximize2, Clock, Hourglass, Wallet, Landmark, Drama, Timer, ListChecks, Briefcase } from 'lucide-react';
import { useState, useEffect, useRef, useId, type CSSProperties } from 'react';
import type { Snapshot } from '../../../shared/contracts';
import { capsuleValue, CAPSULE_METRICS, WINDOW_ERRORS, type CapsuleMetric } from '../../../shared/capsule';
import { command, registerFlush } from '../../state';
import { useTheme } from '../../theme';
import { Button, Switch } from '../../ui';
import { FormSelect } from '../../components/FormSelect';
import { capsuleTheme } from './capsule-theme';
import './capsule.css';

const METRIC_ICONS = {
  countdown: Hourglass, 'income-today': Wallet, 'income-month': Landmark,
  'stolen-duration': Timer, 'stolen-amount': Drama, 'task-progress': ListChecks,
  'worked-today': Briefcase, clock: Clock,
} satisfies Record<CapsuleMetric, typeof Clock>;
const warningText = (code: string) => WINDOW_ERRORS[code as keyof typeof WINDOW_ERRORS] ?? '窗口操作未完成，请重试。';

/** Shared visual content; preview never renders native-window controls. */
export function Capsule({ state, preview = false, expand }: { state: Snapshot; preview?: boolean; expand?: () => void }) {
  const { resolved } = useTheme();
  const theme = capsuleTheme(state.board.background, resolved);
  const metric = capsuleValue(state, state.window.metric);
  const Icon = METRIC_ICONS[state.window.metric];
  const long = metric.value.length > 17;
  const style = {
    '--capsule-surface': theme.surface, '--capsule-ink': theme.ink, '--capsule-muted': theme.muted,
    '--capsule-border': theme.border, '--capsule-border-hover': theme.borderHover, '--capsule-hover': theme.hover, '--capsule-highlight': theme.highlight,
  } as CSSProperties;
  return <div className={`capsule ${preview ? 'capsule-preview' : ''}`} style={style} title={metric.tooltip}
    onContextMenu={preview ? undefined : event => { event.preventDefault(); void command('capsuleMenu'); }}>
    {!preview && <span className="capsule-grip" aria-hidden="true"><GripVertical size={12} /></span>}
    <Icon size={14} className="capsule-icon" aria-hidden="true" />
    <span className="capsule-label">{metric.label}</span>
    <strong className="capsule-value">{long ? '数值较长' : metric.value}</strong>
    {!preview && <button type="button" className="capsule-expand" aria-label="展开主界面" disabled={state.window.phase !== 'idle'} onClick={expand}><Maximize2 size={14} /></button>}
    {!preview && state.window.warning && <span className="capsule-warning" aria-label={warningText(state.window.warning)} title={warningText(state.window.warning)}>!</span>}
  </div>;
}

export function CapsuleSettings({ state, notify }: { state: Snapshot; notify: (message: string) => void }) {
  const fieldId = useId();
  const { resolved } = useTheme();
  const theme = capsuleTheme(state.board.background, resolved);
  const [metric, setMetric] = useState<CapsuleMetric>(state.window.metric);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const pendingSave = useRef<Promise<boolean> | null>(null);
  useEffect(() => registerFlush(() => pendingSave.current ?? Promise.resolve(true)), []);
  useEffect(() => { setMetric(state.window.metric); }, [state.window.metric]);
  const save = (patch: { metric?: CapsuleMetric; alwaysOnTop?: boolean }) => {
    setBusy(true);
    const job = (async () => {
      try {
        const result = await command('capsulePreferences', { ...patch, expectedWindowRevision: state.window.revision });
        const saved = result.applied && result.persisted;
        setSaveFailed(!saved);
        if (result.message) notify(result.message);
        return saved;
      } catch {
        setSaveFailed(true);
        notify('窗口设置未保存，请重试。');
        return false;
      } finally { setBusy(false); }
    })();
    // The application menu must also wait for pending or failed settings saves.
    pendingSave.current = job;
    return job;
  };
  const needsRetry = saveFailed || state.window.dirty || !!state.window.warning;
  return <section id="capsule-settings" className="capsule-settings" tabIndex={-1} aria-labelledby={`${fieldId}-heading`}>
    <div className="capsule-settings-heading"><h3 id={`${fieldId}-heading`}>胶囊与悬挂</h3></div>
    <div className="capsule-preview-stage">
      <div className="capsule-preview-meta"><span>样式预览</span><span>{theme.name} · {resolved === 'dark' ? '深色' : '浅色'}</span></div>
      <div className="capsule-preview-content"><Capsule state={{ ...state, window: { ...state.window, metric } }} preview /></div>
    </div>
    <div className="capsule-settings-form" aria-busy={busy}>
      <div className="capsule-setting-row">
        <label htmlFor={fieldId}>显示数据</label>
        <FormSelect id={fieldId} aria-label="胶囊显示数据" value={metric} disabled={busy} onChange={value => {
          const next = value as CapsuleMetric;
          setMetric(next);
          void save({ metric: next });
        }}>
          {Object.entries(CAPSULE_METRICS).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </FormSelect>
      </div>
      <Switch label="始终置顶" checked={state.window.alwaysOnTop} disabled={busy} onChange={on => void save({ alwaysOnTop: on })} />
    </div>
    {needsRetry && <div className="capsule-save-feedback" role="status">
      <span>{state.window.warning ? warningText(state.window.warning) : saveFailed ? '设置未保存，请重试。' : '窗口设置尚未保存。'}</span>
      <Button variant="ghost" disabled={busy} onClick={() => void save({ metric })}>重试保存</Button>
    </div>}
  </section>;
}
