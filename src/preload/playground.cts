import { contextBridge, ipcRenderer } from 'electron';
import type { PlaygroundBridge, PlaygroundTheme } from '../shared/playground.js';
const bridge: PlaygroundBridge = {
  invoke(command) {
    if (command !== 'bootstrap' && command !== 'ready') return Promise.reject(Error('不允许的操作。'));
    return ipcRenderer.invoke('dogcow:playground', command);
  },
  report(value) { return ipcRenderer.invoke('dogcow:playground', 'report', value); },
  diagnostics(id) { return ipcRenderer.invoke('dogcow:playground', 'diagnostics', id); },
  copyDiagnostics(id) { return ipcRenderer.invoke('dogcow:playground', 'copyDiagnostics', id); },
  onTheme(callback) {
    const listener = (_event: Electron.IpcRendererEvent, theme: PlaygroundTheme) => {
      if (theme === 'light' || theme === 'dark') callback(theme);
    };
    ipcRenderer.on('dogcow:playground-theme', listener);
    return () => ipcRenderer.removeListener('dogcow:playground-theme', listener);
  },
};
contextBridge.exposeInMainWorld('playground', bridge);
