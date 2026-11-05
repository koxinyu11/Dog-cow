import { Power } from 'lucide-react';
import { TrayIconButton } from './TrayIconButton';
export function TrayActions({ busy, onQuit }: { busy: boolean; onQuit(): void }) {
  return <footer className="tray-panel-actions"><TrayIconButton label="退出狗牛" danger disabled={busy} onClick={onQuit}><Power size={16} /></TrayIconButton></footer>;
}
