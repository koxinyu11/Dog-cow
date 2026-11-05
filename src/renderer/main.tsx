import { TrayPanel } from './features/tray/TrayPanel';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './theme';
import { App } from './App';
import { LoadingScreen } from './components/LoadingScreen';
import { boot } from './state';
import { setFxEnabled } from './motion/fx';
import { FX_PREF_KEY } from './board/Appearance';
import './ui/tokens.css';
import './ui/components.css';
import './motion/motion.css';
import './board/board.css';
import './board/modules.css';
import './board/backgrounds.css';
import './styles.css';
import './ui/forms.css';
if (navigator.userAgent.includes('Mac OS X')) document.documentElement.classList.add('is-mac');
if (localStorage.getItem(FX_PREF_KEY) === 'off') {
  setFxEnabled(false);
  document.documentElement.classList.add('no-fx');
}
const root = createRoot(document.getElementById('root')!);
if (new URLSearchParams(location.search).get('surface') === 'tray') {
  document.body.classList.add('tray-panel-body');
  root.render(<React.StrictMode><TrayPanel /></React.StrictMode>);
} else {
  initializeTheme();
  root.render(<React.StrictMode><App /></React.StrictMode>);
  void boot().catch(() => {
    root.render(<LoadingScreen ready={false} onComplete={() => {}} error="狗牛无法连接本机服务。请保留本机数据并重新打开。" />);
  });
}
