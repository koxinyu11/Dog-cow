import React from 'react';
import { createRoot } from 'react-dom/client';
import { captureFailure, installPlaygroundDiagnostics } from './features/playground/game-diagnostics';
import './ui/tokens.css';
import './ui/components.css';
import './features/playground/playground.css';
installPlaygroundDiagnostics();
if (navigator.userAgent.includes('Mac OS X')) document.documentElement.classList.add('is-mac');
function startupFailure(error: unknown) {
  const id = captureFailure(error, 'startup');
  const container = document.getElementById('root')!;
  const title = document.createElement('h1'); title.textContent = '游乐场启动失败';
  const detail = document.createElement('p'); detail.textContent = `问题编号：${id}。可回主窗口右键摩天轮复制诊断后重试。`;
  container.replaceChildren(title, detail);
}
void import('./features/playground/PlaygroundApp').then(({ PlaygroundApp }) => {
  createRoot(document.getElementById('root')!, { onUncaughtError: startupFailure }).render(<React.StrictMode><PlaygroundApp /></React.StrictMode>);
}).catch(startupFailure);
