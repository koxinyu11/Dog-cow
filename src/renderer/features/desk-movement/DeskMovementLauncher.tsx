import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { seatedQuick, walkingBreak, type DeskMove } from '../../../shared/desk-movement';
import { Modal } from '../../components/Modal';
import { command } from '../../state';
import { Button, Segmented } from '../../ui';
import { MovementCatalog } from './MovementCatalog';
import { MovementHistory } from './MovementHistory';
import { MovementPlan } from './MovementPlan';
import { MovementSession, type MovementSessionHandle } from './MovementSession';
import { PlanOverview } from './PlanOverview';
import { ICON, accentStyle } from './movement-icons';
import { loadDeskMovement, updateDeskMovement, useDeskMovement } from './use-desk-movement';
import './desk-movement.css';

export type MovementEntry = 'seated' | 'walk' | 'start-plan' | 'moves' | 'plan' | 'history';
type Tab = 'moves' | 'plan' | 'history';
const LAUNCH = 'dogcow:desk-movement';

export function launchDeskMovement(entry: MovementEntry) {
  window.dispatchEvent(new CustomEvent(LAUNCH, { detail: entry }));
}

export function DeskMovementLauncher() {
  const { data, error } = useDeskMovement();
  const [page, setPage] = useState<Tab | 'edit' | 'session' | null>(null);
  const [moves, setMoves] = useState<readonly DeskMove[]>([]);
  const [sessionKey, setSessionKey] = useState(0);
  const session = useRef<MovementSessionHandle>(null);
  // The session may only start timing once the weight (inside data) is known or known to be unreadable.
  const ready = data !== undefined || error !== '';

  const start = (list: readonly DeskMove[]) => {
    setMoves(list);
    setSessionKey(key => key + 1);
    setPage('session');
  };
  const close = () => {
    if (page === 'session' && session.current?.requestExit()) return;
    setPage(null);
  };
  const openEntry = async (entry: MovementEntry) => {
    if (entry === 'seated') start(seatedQuick);
    else if (entry === 'walk') start(walkingBreak);
    else if (entry === 'start-plan') start((data ?? await loadDeskMovement())?.plan.moves ?? seatedQuick);
    else setPage(entry);
  };
  const entryHandler = useRef(openEntry);
  entryHandler.current = openEntry;

  useEffect(() => {
    const listener = (event: Event) => void entryHandler.current((event as CustomEvent<MovementEntry>).detail);
    window.addEventListener(LAUNCH, listener);
    return () => window.removeEventListener(LAUNCH, listener);
  }, []);
  useEffect(() => window.dogcow.openDeskMovement(() => {
    setPage(current => current === 'session' ? current : 'plan');
  }), []);
  // Plan and history show reminder state and records that the main process can change; refresh on entry.
  const showsStoredData = page === 'plan' || page === 'history';
  useEffect(() => { if (showsStoredData) void loadDeskMovement(); }, [showsStoredData]);

  const saveWeight = async (value: number | undefined) => {
    try {
      const result = await command('deskMovement', { action: 'weight', weightKg: value ?? null });
      if (!result.deskMovement) return false;
      updateDeskMovement(result.deskMovement);
      return true;
    } catch { return false; }
  };

  const tab: Tab | null = page === 'edit' || page === 'session' ? null : page;
  const pending = <div className="dm-page dm-pending">
    {error ? <>
      <p className="dm-error" role="alert">{error}</p>
      <Button size="sm" variant="soft" icon={<RotateCcw size={ICON.btn} />} onClick={() => void loadDeskMovement()}>重试</Button>
    </> : <p role="status">正在读取…</p>}
  </div>;
  return <Modal open={page !== null} title={page === 'edit' ? '编辑计划' : '工位动一动'} onClose={close} className="desk-movement-dialog">
    <div className="dm-root" style={accentStyle}>
      {tab && <div className="dm-tabs">
        <Segmented<Tab> label="工位动一动" value={tab} onChange={setPage}
          options={[['plan', '计划'], ['moves', '动作库'], ['history', '记录']]} />
      </div>}
      {page === 'moves' && <div className="dm-page"><MovementCatalog onSelect={id => start([id])} /></div>}
      {page === 'plan' && (data ? <PlanOverview data={data} onStart={start} onEdit={() => setPage('edit')} onWeight={saveWeight} /> : pending)}
      {page === 'edit' && data && <MovementPlan initial={data.plan} onCancel={() => setPage('plan')} onSaved={value => { updateDeskMovement(value); setPage('plan'); }} />}
      {page === 'history' && (data ? <MovementHistory records={data.records} /> : pending)}
      {page === 'session' && <MovementSession ref={session} key={sessionKey} moves={moves} weightKg={data?.weightKg} weightReady={ready}
        onClose={() => setPage(null)} onSaved={updateDeskMovement} />}
    </div>
  </Modal>;
}
