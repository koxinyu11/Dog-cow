import { contextBridge, ipcRenderer } from 'electron';
import type { WindowTransition } from '../shared/capsule.js';
import type { Bridge, Method, Snapshot } from '../shared/contracts.js';
const allowed = new Set([
  'appearance',
  'bootstrap',
  'task',
  'copy',
  'layout',
  'board',
  'fun',
  'receiptImage',
  'settings',
  'leave',
  'removeLeave',
  'toilet',
  'titles',
  'prepareClock',
  'clock',
  'refreshCalendar',
  'retrySave',
  'chooseImport',
  'commitImport',
  'exportBackup',
  'windowMode',
  'windowModeReady',
  'windowTransitionReady',
  'capsulePreferences',
  'resetCapsulePosition',
  'capsuleMenu',
  'checkUpdates',
  'openUpdate',
  'openSource',
  'quit',
]);
const bridge: Bridge = {
  invoke(method: Method, payload = {}) {
    if (!allowed.has(method)) return Promise.reject(Error('不允许的操作。'));
    return ipcRenderer.invoke(`dogcow:${method}`, payload);
  },
  windowTransition(callback) {
    const handler = (_event: Electron.IpcRendererEvent, transition: WindowTransition) => callback(transition);
    ipcRenderer.on('dogcow:window-transition', handler);
    return () => ipcRenderer.removeListener('dogcow:window-transition', handler);
  },
  prepareWindowMode(callback) {
    const handler = (_event: Electron.IpcRendererEvent, nonce: string) => callback(nonce);
    ipcRenderer.on('dogcow:prepare-window-mode', handler);
    return () => ipcRenderer.removeListener('dogcow:prepare-window-mode', handler);
  },
  openCapsuleSettings(callback) {
    const handler = (_event: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('dogcow:open-capsule-settings', handler);
    return () => ipcRenderer.removeListener('dogcow:open-capsule-settings', handler);
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
