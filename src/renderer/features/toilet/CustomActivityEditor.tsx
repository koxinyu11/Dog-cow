import { useState } from 'react';
import type { CustomActivityIcon, Snapshot } from '../../../shared/contracts';
import { Modal, Field } from '../../components/Modal';
import { Button } from '../../ui';
import { command } from '../../state';
import { CUSTOM_ICON_COMPONENTS } from './activities';
import { ACTIVITY_ICONS, searchActivityIcons } from '../../../../app/income/src/activity-icons.js';

export function CustomActivityEditor({ state, onClose }: { state: Snapshot; onClose: () => void }) {
  const original = state.income.toilet?.customActivity;
  const [name, setName] = useState(original?.name ?? '');
  const [icon, setIcon] = useState<CustomActivityIcon>(original?.icon ?? 'sparkles');
  const [query, setQuery] = useState('');
  const icons = searchActivityIcons(query) as CustomActivityIcon[];
  const SelectedIcon = CUSTOM_ICON_COMPONENTS[icon];
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const data = state.income.toilet;
  const trimmed = name.trim();
  const valid = [...trimmed].length >= 1 && [...trimmed].length <= 12 && !/[\u0000-\u001f\u007f]/u.test(trimmed);
  const save = async () => {
    if (!valid) { setError('请填写 1～12 个字符的活动名称。'); return; }
    setBusy(true); setError('');
    try {
      const result = await command('toilet', { action: 'configureCustom', name: trimmed, icon }, 'income');
      if (result.applied && result.persisted) onClose();
      else setError(result.message);
    } catch { setError('未收到保存结果，请核对当前设置后重试。'); }
    finally { setBusy(false); }
  };
  return <Modal open title="设置带薪活动" onClose={onClose} className="custom-activity-editor">
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <Field label="活动名称"><input autoFocus value={name} placeholder="例如：刷手机、散步、发呆" aria-label="活动名称" onChange={event => setName(event.target.value)} aria-invalid={!!error} /></Field>
      <div className="custom-activity-selection" aria-live="polite"><SelectedIcon size={24} aria-hidden="true" /><span aria-hidden="true">{ACTIVITY_ICONS[icon].emoji}</span><strong>{trimmed || '你的带薪活动'}</strong><span>{ACTIVITY_ICONS[icon].label}</span></div>
      <Field label="搜索图标"><input type="search" value={query} placeholder="吃饭、摸鱼、手机…" aria-label="搜索活动图标" onChange={event => setQuery(event.target.value)} /></Field>
      <fieldset className="custom-activity-icons"><legend>图标库 · {icons.length} 项</legend>
        {icons.map(key => {
          const { label, emoji } = ACTIVITY_ICONS[key];
          const Icon = CUSTOM_ICON_COMPONENTS[key];
          return <button type="button" key={key} aria-label={`${label} ${emoji}`} aria-pressed={icon === key} onClick={() => setIcon(key)}>
            <span className="custom-icon-pair" aria-hidden="true"><Icon size={22} /><span>{emoji}</span></span><span>{label}</span>
          </button>;
        })}
        {!icons.length && <div className="custom-icons-empty" role="status">没有匹配的图标。<Button type="button" variant="ghost" size="sm" onClick={() => setQuery('')}>清空搜索</Button></div>}
      </fieldset>
      {data?.records.some(item => item.kind === 'custom' && item.status !== 'completed') && <p className="muted">修改用于下一次活动，本次记录保持原名称与图标。</p>}
      {data?.pendingSave && <div className="toilet-pending" role="status">修改尚未保存，请保留窗口。
        <Button size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const result = await command('retrySave');
            if (result.persisted) onClose(); else setError(result.message);
          } catch { setError('重试未完成，请保留窗口并再试。'); }
          finally { setBusy(false); }
        }}>重试保存</Button>
      </div>}
      {(error || data?.error) && <p className="error" role="alert">{error || data?.error}</p>}
      <div className="toilet-actions"><Button type="submit" variant="primary" disabled={busy || !valid || data?.pendingSave || !!data?.error}>保存</Button>
        <Button type="button" variant="ghost" onClick={onClose}>取消</Button></div>
    </form>
  </Modal>;
}
