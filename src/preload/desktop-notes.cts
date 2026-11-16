import { contextBridge, ipcRenderer } from 'electron';
import type { NotesBridge, SurfaceView } from '../shared/desktop-note-window.js';
const bridge: NotesBridge = {
  send: command => ipcRenderer.send('dogcow:desktop-note', command),
  onView(callback) {
    const listener = (_event: Electron.IpcRendererEvent, view: SurfaceView) => callback(view);
    ipcRenderer.on('dogcow:desktop-notes-view', listener);
    return () => ipcRenderer.removeListener('dogcow:desktop-notes-view', listener);
  },
};
contextBridge.exposeInMainWorld('desktopNotes', bridge);
