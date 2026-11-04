import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge, Method, Snapshot } from '../shared/contracts.js';
const allowed = new Set([
  'bootstrap',
  'task',
  'copy',
  'layout',
  'board',
  'settings',
  'leave',
  'removeLeave',
  'prepareClock',
  'clock',
  'refreshCalendar',
  'retrySave',
  'chooseImport',
  'commitImport',
  'exportBackup',
  'compact',
  'checkUpdates',
  'openSource',
  'quit',
]);
const bridge: Bridge = {
  invoke(method: Method, payload = {}) {
    if (!allowed.has(method)) return Promise.reject(Error('不允许的操作。'));
    return ipcRenderer.invoke(`dogcow:${method}`, payload);
  },
  beforeQuit(callback) {
    const handler = (_event: Electron.IpcRendererEvent, nonce: string) => callback(nonce);
    ipcRenderer.on('dogcow:before-quit', handler);
    return () => ipcRenderer.removeListener('dogcow:before-quit', handler);
  },
  subscribe(callback) {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: Snapshot) => callback(snapshot);
    ipcRenderer.on('dogcow:state', handler);
    return () => ipcRenderer.removeListener('dogcow:state', handler);
  },
};
contextBridge.exposeInMainWorld('dogcow', bridge);
