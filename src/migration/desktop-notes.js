export const DESKTOP_NOTES_KEY = 'dogcow.desktop-notes.v1';
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
export function validateDesktopNotes(value) {
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0
    || typeof value.lineVisible !== 'boolean' || !Array.isArray(value.notes) || value.notes.length > 32) throw Error('桌面便签数据无效，原始记录已保留。');
  const ids = new Set();
  for (const note of value.notes) {
    if (!object(note) || typeof note.id !== 'string' || !note.id || ['line', '__proto__', 'constructor', 'prototype'].includes(note.id) || note.id.length > 100 || ids.has(note.id)
      || !['single', 'list'].includes(note.kind) || typeof note.title !== 'string' || note.title.length > 120 || typeof note.visible !== 'boolean'
      || !Array.isArray(note.taskIds) || note.taskIds.length > 200 || (note.kind === 'single' && note.taskIds.length !== 1)
      || note.taskIds.some(id => typeof id !== 'string' || !id || id.length > 100) || new Set(note.taskIds).size !== note.taskIds.length) throw Error('桌面便签内容无效，原始记录已保留。');
    ids.add(note.id);
  }
  return value;
}
