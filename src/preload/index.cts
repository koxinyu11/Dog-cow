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
  'iouImage',
  'owed',
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
  'trayPreferences',
  'trayPanelAction',
  'retryTray',
  'copyTrayDiagnostics',
  'resetCapsulePosition',
  'capsuleMenu',
  'checkUpdates',
  'openUpdate',
  'installUpdate',
  'copyUpdateDiagnostics',
  'openSource',
  'quit',
]);
const bridge: Bridge = {
  openHopes(callback) {
    const handler = () => callback();
    ipcRenderer.on('dogcow:open-hopes', handler);
    return () => ipcRenderer.removeListener('dogcow:open-hopes', handler);
  },
  openIncomeSettings(callback) {
    const handler = () => callback();
    ipcRenderer.on('dogcow:open-income-settings', handler);
    return () => ipcRenderer.removeListener('dogcow:open-income-settings', handler);
  },
  trayPanel(callback) {
    const handler = (_event: Electron.IpcRendererEvent, value: import('../shared/tray.js').TrayPanelEvent) => callback(value);
    ipcRenderer.on('dogcow:tray-panel', handler);
    return () => ipcRenderer.removeListener('dogcow:tray-panel', handler);
  },
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
