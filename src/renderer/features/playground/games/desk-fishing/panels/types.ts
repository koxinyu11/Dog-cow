import type { FishingAction, FishingView } from '../../../../../../shared/fishing';
/** What every panel needs: current view, lock flags and the single command entry point. */
export interface PanelProps {
  view: FishingView;
  /** Any request in flight, pause, or unsaved state. */
  locked: boolean;
  /** `locked`, or a line is still out; equipment and spots cannot change. */
  controlsLocked: boolean;
  send(action: FishingAction, id?: string): void;
}
