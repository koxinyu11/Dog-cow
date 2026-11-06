import type { ReactNode } from 'react';
import type { ActivityKind } from '../../../shared/contracts';
import type { getActivity } from './activities';
import type { SceneMode, ScenePhase } from './useActivityMotion';

/*
 * Decorative scenes. Every scene shares the same motion vocabulary from toilet.css:
 *   .am-enter  plays once when the activity starts   (data-phase="enter")
 *   .am-leave  plays once when the activity ends     (data-phase="leave")
 *   .am-tick   low-frequency nudge while running     (.is-running)
 *   .am-drift  ambient steam/vapour while running    (.is-running)
 * A new activity scene only needs to tag its parts with these classes.
 */
type Activity = ReturnType<typeof getActivity>;
type SceneProps = { mode: SceneMode; phase: ScenePhase; gained: boolean };

function Frame({ mode, phase, className = '', children }: { mode: SceneMode; phase: ScenePhase; className?: string; children: ReactNode }) {
  return <svg className={`toilet-scene activity-scene is-${mode} ${className}`} data-phase={phase || undefined} viewBox="0 0 150 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <rect x="8" y="6" width="134" height="108" rx="14" fill="var(--toilet-room)" />
    {children}
  </svg>;
}

function Stall({ mode, phase, gained, mine }: SceneProps & { mine: boolean }) {
  const sign = mode === 'running' ? '💩 使用中' : mode === 'review' ? '待核对' : mode === 'off' ? '暂停营业' : '空闲';
  return <Frame mode={mode} phase={phase} className={gained ? 'is-gained' : ''}>
    <g>
      <rect x="66" y="40" width="26" height="22" rx="5" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <path d="M56 64h46v6c0 12-9 19-20 19h-6c-11 0-20-7-20-19Z" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <path d="M70 89v10h18V89" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <text className="toilet-flush-poop" x="79" y="74" textAnchor="middle" fontSize="13">💩</text>
    </g>
    <g className="toilet-roll am-tick">
      <path d="M112 44h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="119" cy="54" r="9" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <circle cx="119" cy="54" r="3" fill="var(--toilet-room)" stroke="currentColor" strokeWidth="1.5" />
    </g>
    <g className="toilet-door">
      <rect x="20" y="14" width="78" height="86" rx="7" fill="var(--toilet-door)" stroke="currentColor" strokeWidth="2" />
      <circle cx="88" cy="58" r="2.5" fill="currentColor" />
      <g className="am-enter">
        <rect x="31" y="24" width="56" height="17" rx="8.5" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="1.5" />
        <text x="59" y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">{sign}</text>
      </g>
      {mine && <g><rect x="24" y="78" width="20" height="14" rx="4" fill="var(--activity-color)" /><text x="34" y="88.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">你</text></g>}
    </g>
    <g className="toilet-hooves am-tick" fill="currentColor">
      <rect x="44" y="100" width="11" height="8" rx="3" /><rect x="62" y="100" width="11" height="8" rx="3" />
    </g>
  </Frame>;
}

function Coffee({ mode, phase }: SceneProps) {
  return <Frame mode={mode} phase={phase}>
    <path d="M24 99h102" stroke="currentColor" opacity=".25" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="72" cy="97" rx="38" ry="5" fill="currentColor" opacity=".1" />
    <g className="am-tick am-leave">
      <path d="M48 50h46l-5 40H53Z" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2.5" />
      <path d="M94 56h8c17 0 14 26-11 25" fill="none" stroke="currentColor" strokeWidth="3" />
      <path className="am-enter break-fill" d="M51 64h40l-2 15H53Z" fill="var(--activity-color)" opacity=".45" />
      <path d="M44 48h54" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </g>
    <g className="am-drift" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M60 39c-9-9 9-10 0-21" /><path d="M76 36c-9-9 9-10 0-21" /><path d="M91 39c-9-9 9-10 0-21" />
    </g>
  </Frame>;
}

function Smoking({ mode, phase }: SceneProps) {
  return <Frame mode={mode} phase={phase}>
    <path d="M24 99h102" stroke="currentColor" opacity=".25" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="77" cy="94" rx="36" ry="8" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
    <g className="am-tick am-leave">
      <path d="m36 68 67-18 4 14-67 18Z" fill="var(--toilet-porcelain)" stroke="currentColor" strokeWidth="2" />
      <path d="m36 68 20-5 4 14-20 5Z" fill="var(--activity-color)" />
      <path d="m101 51 4-1 4 14-4 1Z" className="break-ember am-enter" />
    </g>
    <path className="am-drift" d="M108 44c-20-15 16-16-2-30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Frame>;
}

function Custom({ mode, phase, activity }: SceneProps & { activity: Activity }) {
  const Icon = activity.Icon;
  return <div className={`toilet-scene activity-scene custom-activity-scene is-${mode}`} data-phase={phase || undefined} aria-hidden="true">
    <span className="custom-activity-bubble am-enter am-leave"><span className="am-tick"><Icon size={52} strokeWidth={1.5} /></span></span>
  </div>;
}

/** Compact single-icon form used where a full scene would be too small to read (medium cards). */
export function ActivityBadge({ activity, mode, phase }: { activity: Activity; mode: SceneMode; phase: ScenePhase }) {
  const Icon = activity.Icon;
  return <span className={`activity-badge activity-scene is-${mode}`} data-phase={phase || undefined} aria-hidden="true">
    <span className="am-enter am-leave"><span className="am-tick"><Icon size={22} strokeWidth={1.75} /></span></span>
  </span>;
}

export function ActivityScene({ kind, activity, mode, phase, gained, mine = false }: SceneProps & { kind: ActivityKind; activity: Activity; mine?: boolean }) {
  if (kind === 'toilet') return <Stall mode={mode} phase={phase} gained={gained} mine={mine} />;
  if (kind === 'coffee') return <Coffee mode={mode} phase={phase} gained={gained} />;
  if (kind === 'smoking') return <Smoking mode={mode} phase={phase} gained={gained} />;
  return <Custom mode={mode} phase={phase} gained={gained} activity={activity} />;
}
