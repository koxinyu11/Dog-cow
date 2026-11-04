import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
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
if (navigator.userAgent.includes('Mac OS X')) document.documentElement.classList.add('is-mac');
if (localStorage.getItem(FX_PREF_KEY) === 'off') {
  setFxEnabled(false);
  document.documentElement.classList.add('no-fx');
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
void boot().catch(() => {
  document.getElementById('root')!.textContent = '狗牛无法连接本机服务。请保留本机数据并重新打开。';
});
