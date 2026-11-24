const { app, BrowserWindow, Tray, Menu, ipcMain, screen, powerMonitor, nativeImage, globalShortcut, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');
const { todayKey } = require('./dates');

const TRASH_DAYS = 15;
const COLORS = ['yellow', 'mint', 'rose', 'sky', 'sand'];
const DAYKEY = /^\d{4}-\d{2}-\d{2}$/;
app.setName('AP Note Pad');

// One instance owns the notes on disk. A second launch quits before it builds a window,
// a tray icon or a Store, and the running instance is asked to bring its notes back.
const SINGLE = !!process.env.APNP_SELFTEST || app.requestSingleInstanceLock();
if (!SINGLE) {
  // A second launch says what is going on instead of vanishing silently, and offers to
  // open the data folder so the startup log can be sent back if the first copy is stuck.
  app.whenReady().then(() => {
    slog('[second-instance] another copy is running; exiting');
    if (!process.env.APNP_NODIALOG) try {
      const pick = dialog.showMessageBoxSync({ type: 'info', title: 'AP Note Pad', message: 'AP Note Pad is already running.', buttons: ['OK', 'Open log folder'], defaultId: 0, detail: 'If you cannot see a note or its icon near the clock, the running copy may be stuck. Open the log folder and send the startup-log.txt file over.' });
      if (pick === 1) { try { shell.openPath(dataDir); } catch (e) {} }
    } catch (e) {}
    app.exit(0);
  });
}

const dataDir = process.env.APNP_DATA || app.getPath('userData');
// Handled startup problems must not fail silently: every caught early error is appended
// to startup-log.txt next to the notes file so it can be sent back for diagnosis.
function slog(line) {
  try {
    const f = path.join(dataDir, 'startup-log.txt');
    try { if (fs.statSync(f).size > 65536) fs.renameSync(f, f + '.old'); } catch (e) {}
    fs.appendFileSync(f, new Date().toISOString() + ' ' + line + '\n');
    return true;
  } catch (e) { return false; }
}
function fatalBox(title, e) {
  const msg = String(e && e.message || e);
  const logged = slog('[dialog] ' + title + ': ' + msg);
  const tail = logged
    ? '\n\nNothing of yours was deliberately deleted. A detail file (startup-log.txt) was saved next to your notes - please send it over.'
    : '\n\nNothing of yours was deliberately deleted. Please tell us what you saw.';
  if (process.env.APNP_SELFTEST) return; // dialogs block headless test runs; the log line above records the call
  try { dialog.showErrorBox(title, msg + tail); } catch (x) {}
}
process.on('uncaughtException', e => { slog('[fatal] ' + (e && e.stack || e)); fatalBox('AP Note Pad hit a problem', e); });
process.on('unhandledRejection', e => { slog('[rejection] ' + (e && e.stack || e)); fatalBox('AP Note Pad hit a problem', e); });

// The second instance never touches the data folder; only the owner builds a Store.
const store = SINGLE ? new Store(dataDir) : null;
const windows = new Map();
let tray = null, searchWin = null, lastToday = todayKey(), booted = false;
const shortcutOK = { newNote: true, search: true };

// A failed save (for example an antivirus lock) is retried once inside the store and
// then shown on the note so it never fails silently.
if (store) store.onError = msg => { slog('[save] ' + msg); windows.forEach(w => { if (!w.isDestroyed()) w.webContents.send('save-error', msg); }); };
if (SINGLE) slog('[startup] begin ' + app.getVersion() + ' on ' + process.platform + ', data at ' + dataDir);

const S = () => store.data.settings;
const newId = () => 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
// A day is { text, items }. Older saves stored just the items array.
const normDay = d => Array.isArray(d) ? { text: '', items: d } : { text: (d && d.text) || '', items: (d && d.items) || [] };
const live = () => Object.keys(store.data.notes).filter(id => !store.data.notes[id].deletedAt);
const clampStr = (s, n) => String(s == null ? '' : s).slice(0, n);
// Validate and clean a day coming from a note window: shape, sizes, and no empty rows.
function cleanDay(data) {
  const d = Array.isArray(data) ? { items: data } : (data && typeof data === 'object' ? data : {});
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 200)
    .map(it => ({ t: clampStr(it && it.t, 500), done: !!(it && it.done) }))
    .filter(it => it.t.trim().length > 0);
  return { text: clampStr(d.text, 20000), items };
}

function safeBounds(b) {
  const def = { width: 300, height: 340 };
  const ok = b && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(b[k]));
  if (!ok) { const wa = screen.getPrimaryDisplay().workArea; return { x: wa.x + 80, y: wa.y + 80, ...def }; }
  const wa = screen.getDisplayMatching(b).workArea;
  const width = Math.min(Math.max(b.width || def.width, 220), wa.width);
  const height = Math.min(Math.max(b.height || def.height, 200), wa.height);
  return { x: Math.min(Math.max(b.x, wa.x), wa.x + wa.width - width), y: Math.min(Math.max(b.y, wa.y), wa.y + wa.height - height), width, height };
}

function createNoteWindow(id) {
  try {
  const note = store.data.notes[id];
  if (process.env.APNP_SELFTEST && process.env.APNP_INJECT_WINFAIL) throw new Error('injected window failure');
  const acrylic = S().glass === 'acrylic' && process.platform === 'win32';
  const opts = {
    ...safeBounds(note.bounds), frame: false, skipTaskbar: true, resizable: !note.locked,
    // minimizable:true on purpose: with frame:false there is no minimize button and with
    // skipTaskbar:true no taskbar button, so the user gains no minimize affordance, but
    // Windows Show Desktop (Win+D / the sliver) then produces a real iconic minimize that
    // Electron reports via the 'minimize' event and win.isMinimized() — with minimizable:false
    // the window disappears with no event at all (observed on the user's PC).
    minWidth: 220, minHeight: 200, minimizable: true, maximizable: false,
    fullscreenable: false, hasShadow: acrylic, roundedCorners: true, show: false, title: 'AP Note Pad', backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  };
  if (acrylic) opts.backgroundMaterial = 'acrylic'; else opts.transparent = true;
  const win = new BrowserWindow(opts);
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'note.html'), { query: { id, glass: acrylic ? 'acrylic' : 'translucent' } });
  win.once('ready-to-show', () => {
    win.showInactive();
  });
  let t = null;
  // Never persist bounds while minimized: Windows reports (-32000,-32000) then and the
  // saved corner would be lost. The real bounds come back with the window on restore.
  const persist = () => { clearTimeout(t); t = setTimeout(() => { if (win.isDestroyed() || win.isMinimized()) return; note.bounds = win.getBounds(); store.saveSafe(); }, 250); };
  win.on('moved', persist); win.on('resized', persist); win.on('move', persist); win.on('resize', persist);
  // Show Desktop (Win+D / the sliver beside the clock) minimizes ordinary top-level windows.
  // Bounce the note straight back so it stays on the desktop where it was. Prefer
  // showInactive (no focus grab); only if that does not lift the minimized state, fall
  // back to restore(). Real-Windows behavior of this bounce-back is unverified.
  // Bounce-back: restore shortly after a minimize. A small delay is required — the
  // desktop does not finish coming forward immediately, so a same-tick restore is lost.
  // Auto-restore paths (bounce / external-hide / poller) all honour the user's
  // stayAfterShowDesktop setting (tray menu); when it is off, notes behave like any window.
  const stayOn = () => S().stayAfterShowDesktop !== false;
  const bounce = () => { if (!stayOn()) return; const n = store.data.notes[id]; if (!n || n.hidden || n.deletedAt) return; if (!win.isDestroyed() && win.isMinimized()) { win.showInactive(); if (!win.isDestroyed() && win.isMinimized()) win.restore(); } };
  win.on('minimize', () => { slog('[win] minimize ' + id); setTimeout(bounce, 200); setTimeout(bounce, 600); });
  // On his Windows 11, Win+D / the Show Desktop sliver never sends a minimize command:
  // the startup log shows only 'hide' events, no minimize, no SC_MINIMIZE. An external
  // ShowWindow-hide with no matching hidden flag is the Show Desktop path and is bounced
  // back. Virtual-desktop switches use shell cloaking, which does not send ShowWindow
  // messages, so no 'hide' event fires there and this never follows the user across
  // desktops. A deliberate hide (hidden flag set first, below) and app quit are never undone.
  const extHide = () => { if (quitting || !stayOn()) return; const n = store.data.notes[id]; if (!n || n.hidden || n.deletedAt) return; if (!win.isDestroyed() && !win.isVisible()) { slog('[win] external-hide restore ' + id); win.showInactive(); } };
  win.on('hide', () => { slog('[win] hide ' + id); setTimeout(extHide, 300); setTimeout(extHide, 900); });
  win.on('show', () => slog('[win] show ' + id));
  win.on('restore', () => slog('[win] restore ' + id));
  // Diagnostic: log raw SC_MINIMIZE so we can tell 'Windows sent the command but Electron
  // emitted no event' apart from 'Windows never sent one' on the user's machine.
  if (process.platform === 'win32' && win.hookWindowMessage) {
    try { win.hookWindowMessage(0x0112, (wParam) => { try { const cmd = (Buffer.isBuffer(wParam) ? wParam.readUInt16LE(0) : Number(wParam)) & 0xFFF0; if (cmd === 0xF020 || cmd === 0xF120) slog('[winmsg] WM_SYSCOMMAND 0x' + cmd.toString(16) + ' ' + id); } catch (e) {} }); } catch (e) { slog('[winmsg] hook failed: ' + (e && e.message || e)); }
  }
  win.on('closed', () => windows.delete(id));
  windows.set(id, win);
  return win;
  } catch (e) { slog('[window] ' + id + ': ' + (e && e.stack || e)); return null; }
}

function addNote() {
  const id = newId(), n = windows.size, wa = screen.getPrimaryDisplay().workArea;
  store.data.notes[id] = { color: COLORS[n % COLORS.length], locked: false, bounds: { x: wa.x + 80 + n * 36, y: wa.y + 80 + n * 36, width: 300, height: 340 }, days: {} };
  store.saveSafe(); createNoteWindow(id); buildMenu(); return id;
}
function trashNote(id) {
  const n = store.data.notes[id]; if (!n) return;
  store.flush(); // make sure the newest typing is in memory and on disk before anything closes
  n.deletedAt = Date.now(); store.saveSafe();
  const w = windows.get(id); if (w) w.destroy(); windows.delete(id); buildMenu();
}
function restoreNote(id) { const n = store.data.notes[id]; if (!n) return; delete n.deletedAt; delete n.hidden; store.saveSafe(); createNoteWindow(id); buildMenu(); }
function purgeTrash() {
  const cut = Date.now() - TRASH_DAYS * 864e5; let ch = false;
  for (const id of Object.keys(store.data.notes)) { const n = store.data.notes[id]; if (n.deletedAt && n.deletedAt < cut) { delete store.data.notes[id]; ch = true; } }
  if (ch) store.saveSafe();
}
function snippet(n) {
  for (const k of Object.keys(n.days).sort().reverse()) { const d = normDay(n.days[k]); const first = (d.text || '').trim().split('\n')[0] || (d.items[0] && d.items[0].t); if (first) return first.slice(0, 28); }
  return '(empty note)';
}
// Optional fun: rotate every note's color every 2 minutes. Off by default.
let colorTimer = null;
// Desktop persistence: Show Desktop does not always deliver a 'minimize' event on real
// Windows, so a light poller enforces the same rule: a note that was not deliberately
// hidden stays visible. Deliberate hides (hidden flag) are never undone.
function persistenceTick() {
  for (const [id, win] of windows) {
    if (win.isDestroyed()) continue;
    const n = store.data.notes[id];
    if (!n || n.hidden || n.deletedAt) continue;
    try { if (!stayOnGlobal()) continue; if (win.isMinimized()) { slog('[persist] restoring minimized ' + id); win.showInactive(); if (!win.isDestroyed() && win.isMinimized()) win.restore(); } } catch (e) { slog('[persist] ' + id + ': ' + (e && e.message || e)); }
  }
}
let persistTimer = null;
let quitting = false;
const stayOnGlobal = () => store.data.settings.stayAfterShowDesktop !== false;
function cycleColors() {
  for (const id of live()) {
    const n = store.data.notes[id];
    n.color = COLORS[(COLORS.indexOf(n.color) + 1) % COLORS.length];
    const w = windows.get(id);
    if (w && !w.isDestroyed()) w.webContents.send('note-color', { id, color: n.color });
  }
  store.saveSafe(); buildMenu();
}
function applyColorTimer() {
  if (colorTimer) { clearInterval(colorTimer); colorTimer = null; }
  if (S().autoColor) colorTimer = setInterval(cycleColors, 2 * 60 * 1000);
}
function broadcastSettings() { windows.forEach(w => { if (!w.isDestroyed()) w.webContents.send('settings', S()); }); }
function setSetting(k, v, reopen) { S()[k] = v; store.saveSafe(); if (reopen) reopenAll(); else broadcastSettings(); buildMenu(); }
function reopenAll() { store.flush(); for (const w of [...windows.values()]) w.destroy(); windows.clear(); live().forEach(id => { if (!store.data.notes[id].hidden) createNoteWindow(id); }); }
function showAllNotes() {
  let changed = false;
  for (const id of live()) {
    const n = store.data.notes[id];
    if (n.hidden) { delete n.hidden; changed = true; }
    if (!windows.has(id)) createNoteWindow(id);
  }
  if (changed) store.saveSafe();
  windows.forEach(w => { if (!w.isDestroyed()) w.showInactive(); });
}

function buildMenu() {
  if (!tray) return;
  const trashed = Object.keys(store.data.notes).filter(id => store.data.notes[id].deletedAt);
  const radio = (label, k, v, reopen) => ({ label, type: 'radio', checked: S()[k] === v, click: () => setSetting(k, v, reopen) });
  const notice = store.quarantined ? [{ label: 'A damaged notes file was set aside; the old file is kept in the notes folder', enabled: false }, { type: 'separator' }] : [];
  tray.setContextMenu(Menu.buildFromTemplate([
    ...notice,
    { label: 'New note' + (shortcutOK.newNote ? '\tCtrl+Alt+N' : ''), click: addNote },
    { label: 'Search notes' + (shortcutOK.search ? '\tCtrl+Alt+F' : ''), click: openSearch },
    { label: 'Show all notes', click: showAllNotes },
    { type: 'separator' },
    { label: 'Theme', submenu: [radio('Light', 'theme', 'light'), radio('Dark', 'theme', 'dark')] },
    { label: 'Glass opacity', submenu: [0.3, 0.45, 0.55, 0.7, 0.85].map(o => ({ label: Math.round(o * 100) + '%', type: 'radio', checked: Math.abs(S().opacity - o) < 0.01, click: () => setSetting('opacity', o) })) },
    { label: 'Font size', submenu: [12, 14, 16, 18].map(f => ({ label: f + ' px', type: 'radio', checked: S().fontSize === f, click: () => setSetting('fontSize', f) })) },
    { label: 'Glass style', submenu: [radio('Acrylic (Windows 11)', 'glass', 'acrylic', true), radio('Translucent', 'glass', 'translucent', true)] },
    { label: 'Unticked tasks on a new day', submenu: [{ label: 'Ask me each time (not chosen yet)', type: 'radio', checked: S().carryForward === null, click: () => setSetting('carryForward', null) }, { label: 'Carry them to the new day', type: 'radio', checked: S().carryForward === true, click: () => setSetting('carryForward', true) }, { label: 'Start the new day blank', type: 'radio', checked: S().carryForward === false, click: () => setSetting('carryForward', false) }] },
    { type: 'separator' },
    { label: 'Trash (' + trashed.length + ')', enabled: trashed.length > 0, submenu: [{ label: 'Trash empties for good after 15 days', enabled: false }, { type: 'separator' }].concat(trashed.map(id => ({ label: 'Restore: ' + snippet(store.data.notes[id]), click: () => restoreNote(id) }))) },
    { label: 'Change note colors every 2 minutes', type: 'checkbox', checked: !!S().autoColor, click: m => { S().autoColor = m.checked; store.saveSafe(); applyColorTimer(); buildMenu(); } },
    { label: 'Bring notes back after Show Desktop (Win+D)', type: 'checkbox', checked: S().stayAfterShowDesktop !== false, click: m => { S().stayAfterShowDesktop = m.checked; store.saveSafe(); buildMenu(); } },
    { label: 'Start with Windows', type: 'checkbox', checked: S().startWithWindows !== false, click: m => { try { app.setLoginItemSettings({ openAtLogin: m.checked }); } catch (e) {} S().startWithWindows = m.checked; store.saveSafe(); buildMenu(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}
function buildTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png')));
  tray.setToolTip('AP Note Pad'); buildMenu(); tray.on('right-click', buildMenu);
  tray.on('click', showAllNotes);
}

function openSearch() {
  if (searchWin && !searchWin.isDestroyed()) { searchWin.focus(); return; }
  const wa = screen.getPrimaryDisplay().workArea;
  searchWin = new BrowserWindow({ width: 420, height: 440, x: wa.x + Math.round(wa.width / 2) - 210, y: wa.y + 100, frame: false, skipTaskbar: true, alwaysOnTop: true,
    resizable: false, backgroundColor: '#f6f2ee', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  searchWin.loadFile(path.join(__dirname, 'search.html'));
  searchWin.on('blur', () => { if (searchWin && !searchWin.isDestroyed()) searchWin.close(); });
}

ipcMain.handle('load', (e, id) => ({ note: (id && store.data.notes[id]) || null, today: todayKey(), settings: S() }));
ipcMain.handle('save-day', (e, arg) => {
  const { id, day, data } = arg || {};
  const n = id && store.data.notes[id];
  if (!n || typeof day !== 'string' || !DAYKEY.test(day)) return false;
  n.days[day] = cleanDay(data); // memory is current from this line; the disk write is debounced
  store.saveSoon();
  return true;
});
ipcMain.handle('set-carry', (e, v) => { if (v !== null && typeof v !== 'boolean') return false; S().carryForward = v; store.saveSafe(); broadcastSettings(); buildMenu(); return true; });
ipcMain.on('close-note', (e, id) => {
  // Set the deliberate-hidden flag BEFORE hiding, so the hide-event bounce can always
  // tell this apart from an external (Win+D cloak) hide regardless of event ordering.
  const n = store.data.notes[id]; if (n) { n.hidden = true; store.saveSafe(); }
  const w = windows.get(id); if (w) w.hide();
});
ipcMain.on('new-note', addNote);
ipcMain.on('delete-note', (e, id) => trashNote(id));
ipcMain.on('set-color', (e, arg) => { const { id, color } = arg || {}; const n = id && store.data.notes[id]; if (n && COLORS.includes(color)) { n.color = color; store.saveSafe(); } });
ipcMain.on('set-opacity', (e, v) => { v = Number(v); if (!(v >= 0.2 && v <= 0.95)) return; S().opacity = v; store.saveSafe(); broadcastSettings(); buildMenu(); });
ipcMain.on('set-lock', (e, arg) => { const { id, locked } = arg || {}; const n = id && store.data.notes[id]; if (!n) return; n.locked = !!locked; store.saveSafe(); const w = windows.get(id); if (w) w.setResizable(!n.locked); });
ipcMain.handle('search', (e, q) => {
  q = clampStr(q, 200).trim().toLowerCase(); if (!q) return [];
  const out = [];
  for (const id of live()) for (const [day, items] of Object.entries(store.data.notes[id].days)) { const d = normDay(items); if (d.text.toLowerCase().includes(q)) out.push({ id, day, text: d.text.trim().split('\n').find(l => l.toLowerCase().includes(q)) || d.text.slice(0, 60), done: false }); for (const it of d.items) if (it.t.toLowerCase().includes(q)) out.push({ id, day, text: it.t, done: !!it.done }); }
  return out.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 50);
});
ipcMain.on('open-result', (e, arg) => {
  const { id, day } = arg || {}; if (!id || !DAYKEY.test(day || '')) return;
  if (!windows.has(id) && store.data.notes[id] && !store.data.notes[id].deletedAt) { delete store.data.notes[id].hidden; store.saveSafe(); createNoteWindow(id); }
  const w = windows.get(id); if (!w) return; w.show(); w.webContents.send('goto-day', day);
  if (searchWin && !searchWin.isDestroyed()) searchWin.close();
});

function checkRollover() {
  const t = todayKey();
  if (t !== lastToday) { lastToday = t; windows.forEach(w => { if (!w.isDestroyed()) w.webContents.send('day-changed', t); }); }
}
setInterval(checkRollover, 30000);

function registerShortcuts() {
  try { shortcutOK.newNote = globalShortcut.register('Control+Alt+N', addNote); } catch (e) { shortcutOK.newNote = false; }
  try { shortcutOK.search = globalShortcut.register('Control+Alt+F', openSearch); } catch (e) { shortcutOK.search = false; }
  if (!shortcutOK.newNote || !shortcutOK.search) console.log('[shortcuts] unavailable:', JSON.stringify(shortcutOK));
}

app.whenReady().then(() => {
  if (!SINGLE) return; // a second launch never builds anything
  try {
  // v3.1 one-time migration: the WorkerW desktop-pin from v3 is removed. On his PC it
  // left the note behind the desktop icon layer, which made it visible but unclickable.
  // Show Desktop protection is the minimize bounce-back on each window, always on.
  // A failed settings save (for example an antivirus lock) must not abort startup: it
  // is retried inside the store, logged, and the app keeps coming up.
  if (S().desktopPinV31 === undefined) { delete S().desktopLayer; S().desktopPinV31 = true; if (!store.saveSafe()) slog('[startup] settings save failed: ' + store.lastError); }
  // Auto-open on PC startup unless the user turned it off in the tray menu. The saved
  // corner and size come back through safeBounds on every launch.
  try { app.setLoginItemSettings({ openAtLogin: S().startWithWindows !== false }); } catch (e) {}
  purgeTrash();
  applyColorTimer();
  // Hidden notes stay hidden across restarts - a deliberate hide is never undone.
  // The tray icon (and its "Show all notes" item) is always there to bring them back.
  if (!live().length) addNote(); else live().forEach(id => { if (!store.data.notes[id].hidden) createNoteWindow(id); });
  if (windows.size === 0) {
    if (live().some(id => store.data.notes[id].hidden)) {
      // Every note was deliberately hidden before the last quit. That is a normal
      // state, not an error: the tray icon and "Show all notes" bring them back.
      slog('[startup] all notes hidden by user; tray "Show all notes" restores them');
    } else { slog('[startup] no note window could be created'); fatalBox('AP Note Pad could not open a note', new Error('No note window could be created')); }
  }
  if (store.quarantined) slog('[store] a damaged notes file was set aside: ' + store.quarantined);
  registerShortcuts();
  try { buildTray(); } catch (e) { slog('[tray] ' + (e && e.stack || e)); }
  powerMonitor.on('resume', checkRollover); powerMonitor.on('unlock-screen', checkRollover);
  persistTimer = setInterval(persistenceTick, 1500); if (persistTimer.unref) persistTimer.unref();
  booted = true;
  } catch (e) { slog('[startup] ' + (e && e.stack || e)); fatalBox('AP Note Pad could not start', e); }
  if (process.env.APNP_SELFTEST) require('./selftest')({ store, windows, addNote, trashNote, restoreNote, checkRollover, app, createNoteWindow, live, showAllNotes, cycleColors, COLORS });
  if (SINGLE) slog('[startup] ready, windows=' + windows.size);
});
if (SINGLE) app.on('second-instance', () => { if (booted) showAllNotes(); });
app.on('window-all-closed', () => { if (!process.env.APNP_SELFTEST) { /* tray keeps the app alive */ } });
app.on('before-quit', () => { quitting = true; if (store) store.flush(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
