import { app } from 'electron';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesktopNotesController, type DesktopNotesController } from './desktop-notes-controller.js';
import { sampleNotes } from '../shared/desktop-notes-prototype.js';
const url = process.env.DOGCOW_DEV_URL;
if (url !== 'http://127.0.0.1:5180') throw Error('样机仅允许本地开发入口。');
const profile = await mkdtemp(path.join(tmpdir(), 'dogcow-notes-sample-'));
app.setPath('userData', profile); app.setName('狗牛便签样机');
let controller: DesktopNotesController | undefined;
let revision = 0;
const notes = sampleNotes().map(note => ({ ...note, visible: true }));
async function start() {
  await app.whenReady();
  controller = createDesktopNotesController({ profile, simulated: true,
    preload: path.join(path.dirname(fileURLToPath(import.meta.url)), '../preload/desktop-notes.cjs'),
    url: `${url}/desktop-notes-prototype.html`,
    data: () => ({ notes, lineVisible: true, revision, pending: false, error: '' }),
    async toggle(noteId, taskId) { const task = notes.find(note => note.id === noteId)?.tasks.find(task => task.id === taskId); if (task) { task.done = !task.done; revision++; } },
    async retry() {}, async hide(id) { if (id === 'line') app.quit(); else { const note = notes.find(note => note.id === id); if (note) note.visible = false; } }, manage() {}, changed() { controller?.refresh(); },
  });
  await controller.initialize();
}
app.on('before-quit', () => controller?.dispose());
app.on('window-all-closed', () => app.quit());
void start().catch(error => { console.error(error); app.exit(1); });
