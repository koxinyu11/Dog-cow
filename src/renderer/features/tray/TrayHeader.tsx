import { PanelsTopLeft } from 'lucide-react';
import { CowMark } from './CowMark';
import { TrayIconButton } from './TrayIconButton';
export function TrayHeader({ busy, onOpen }: { busy: boolean; onOpen(): void }) {
  return <header className="tray-panel-header"><span className="tray-panel-brand"><CowMark size={24} /><span>狗牛</span></span>
    <TrayIconButton label="打开主界面" disabled={busy} onClick={onOpen}><PanelsTopLeft size={16} /></TrayIconButton>
  </header>;
}
