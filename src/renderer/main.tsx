import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { boot } from './state';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
void boot().catch(() => {
  document.getElementById('root')!.textContent = '狗牛无法连接本机服务。请保留本机数据并重新打开。';
});
