import { useRef } from 'react';
import type { ActivityKind, Snapshot } from '../../../shared/contracts';
import { ACTIVITIES, ACTIVITY_KEYS } from './activities';

export function ActivityTabs({ state, value, onChange }: { state: Snapshot; value: ActivityKind; onChange: (kind: ActivityKind) => void }) {
  const host = useRef<HTMLSpanElement>(null);
  return <span ref={host} className="activity-tabs" role="tablist" aria-label="带薪活动" onPointerDown={event => event.stopPropagation()}>
    {ACTIVITY_KEYS.map((kind, index) => {
      const { label, Icon } = ACTIVITIES[kind];
      const active = state.income.toilet?.records.find(item => item.kind === kind && item.status !== 'completed');
      const failed = state.income.toilet?.pendingSave || state.income.toilet?.error;
      const status = failed ? 'error' : active?.status === 'needs-review' ? 'review' : active ? 'running' : '';
      return <button type="button" role="tab" key={kind} aria-selected={value === kind} aria-controls="paid-activity-panel" tabIndex={value === kind ? 0 : -1}
        aria-label={`${label}${status === 'running' ? '，计时中' : status === 'review' ? '，待核对' : status === 'error' ? '，记录异常' : ''}`}
        title={label} className={value === kind ? 'is-selected' : ''} onClick={() => onChange(kind)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
          if (next < 0) return;
          event.preventDefault(); event.stopPropagation();
          onChange(ACTIVITY_KEYS[next]); host.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>
        <Icon size={14} aria-hidden="true" /><span className="activity-tab-label">{label}</span>
        {status && <i className={`activity-tab-dot is-${status}`} aria-hidden="true" />}
      </button>;
    })}
  </span>;
}
