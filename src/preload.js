const { contextBridge, ipcRenderer } = require('electron');
const on = (ch, cb) => ipcRenderer.on(ch, (e, v) => cb(v));
contextBridge.exposeInMainWorld('ap', {
  load: id => ipcRenderer.invoke('load', id),
  saveDay: (id, day, data) => ipcRenderer.invoke('save-day', { id, day, data }),
  setCarry: v => ipcRenderer.invoke('set-carry', v),
  closeNote: id => ipcRenderer.send('close-note', id),
  newNote: () => ipcRenderer.send('new-note'),
  deleteNote: id => ipcRenderer.send('delete-note', id),
  setColor: (id, color) => ipcRenderer.send('set-color', { id, color }),
  setLock: (id, locked) => ipcRenderer.send('set-lock', { id, locked }),
  search: q => ipcRenderer.invoke('search', q),
  openResult: (id, day) => ipcRenderer.send('open-result', { id, day }),
  onDayChanged: cb => on('day-changed', cb), onSettings: cb => on('settings', cb),
  onGotoDay: cb => on('goto-day', cb), onNoteColor: cb => on('note-color', cb), setOpacity: v => ipcRenderer.send('set-opacity', v),
  onSaveError: cb => on('save-error', cb),
});
