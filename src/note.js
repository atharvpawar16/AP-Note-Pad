const D = window.APDates;
const id = new URLSearchParams(location.search).get('id');
const glass = new URLSearchParams(location.search).get('glass');
const $ = s => document.getElementById(s);
let note, settings, today, view, items = [], text = '';
const COLORS = ['yellow', 'mint', 'rose', 'sky', 'sand'];

function applySettings() {
  document.body.classList.toggle('dark', settings.theme === 'dark');
  document.documentElement.style.setProperty('--fs', settings.fontSize + 'px');
  document.documentElement.style.setProperty('--alpha', settings.opacity);
}
function applyNote() {
  COLORS.forEach(c => document.body.classList.toggle('c-' + c, note.color === c));
  document.body.classList.toggle('locked', !!note.locked);
  $('lock').textContent = note.locked ? 'Unlock position' : 'Lock position';
}
// Open tasks stay on top, ticked ones sink to the bottom (stable order inside each group).
const ordered = () => items.map((it, i) => ({ it, i })).sort((a, b) => (a.it.done ? 1 : 0) - (b.it.done ? 1 : 0) || a.i - b.i);

// Every edit is sent to the main process at once. The main process keeps it in memory
// immediately (so closing, trashing or restyling the note can never lose the last
// keystrokes) and debounces only the disk write there.
function persist() { const d = { text, items }; note.days[view] = d; window.ap.saveDay(id, view, d); }
const norm = d => Array.isArray(d) ? { text: '', items: d } : { text: (d && d.text) || '', items: (d && d.items) || [] };

// Unticked tasks from the latest earlier day. Whether they move to a new day is the user's choice (settings.carryForward: null = not chosen yet).
function pendingCarry() {
  if (view !== today || note.days[today]) return [];
  const prev = Object.keys(note.days).filter(k => k < today).sort().pop();
  return prev ? norm(note.days[prev]).items.filter(x => !x.done).map(x => ({ t: x.t, done: false })) : [];
}
function carryNow(list) { items = list.map(x => ({ ...x })); persist(); render(); }
function showDay(day) {
  view = day > today ? today : day; // a future day can never be opened
  const d = norm(note.days[view]);
  text = d.text; items = d.items.map(x => ({ ...x }));
  $('text').value = text;
  $('ask').hidden = true;
  const carry = pendingCarry();
  if (carry.length) {
    if (settings.carryForward === true) carryNow(carry);
    else if (settings.carryForward === null) {
      $('askmsg').textContent = carry.length + ' unticked task' + (carry.length > 1 ? 's' : '') + ' from the last day. Move to today?';
      $('ask').hidden = false;
      const done = (list, always) => { $('ask').hidden = true; if (list) carryNow(list); else { persist(); } if (always !== undefined) window.ap.setCarry(always); };
      $('askyes').onclick = () => done(carry); $('askno').onclick = () => done(null);
      $('askyesall').onclick = () => done(carry, true); $('asknoall').onclick = () => done(null, false);
    }
  }
  $('date').textContent = view === today ? 'Today \u00b7 ' + D.pretty(view) : D.pretty(view);
  $('date').title = D.pretty(view);
  $('next').disabled = !D.canGoNext(view, today);
  render();
}
function render() {
  const ul = $('list'); ul.innerHTML = '';
  for (const { it, i } of ordered()) {
    const li = document.createElement('li'); if (it.done) li.className = 'done';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!it.done;
    cb.onchange = () => { it.done = cb.checked; persist(); render(); };
    const t = document.createElement('input'); t.className = 't'; t.value = it.t; t.spellcheck = false;
    t.oninput = () => { it.t = t.value; persist(); };
    t.onkeydown = e => { if (e.key === 'Enter') $('add').focus(); };
    const rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '\u00d7'; rm.title = 'Remove task';
    rm.onclick = () => { items.splice(i, 1); persist(); render(); };
    li.append(cb, t, rm); ul.append(li);
  }
  $('foot').textContent = items.length ? items.filter(x => x.done).length + ' of ' + items.length + ' done' : '';
}

async function init() {
  document.body.classList.add(glass);
  const r = await window.ap.load(id);
  if (!r.note) { document.body.innerHTML = '<p style="padding:20px;font-family:sans-serif">This note no longer exists. You can close this window.</p>'; return; }
  note = r.note; settings = r.settings; today = r.today; note.days = note.days || {};
  applySettings(); applyNote(); showDay(today);
  const cw = $('colors');
  COLORS.forEach(c => { const b = document.createElement('button'); b.className = 'sw ' + c; b.title = c; b.onclick = () => { note.color = c; window.ap.setColor(id, c); applyNote(); }; cw.append(b); });
  $('prev').onclick = () => showDay(D.shiftKey(view, -1));
  $('next').onclick = () => { if (D.canGoNext(view, today)) showDay(D.shiftKey(view, 1)); };
  $('menu').onclick = () => { $('panel').hidden = !$('panel').hidden; };
  $('hide').onclick = () => window.ap.closeNote(id);
  $('lock').onclick = () => { note.locked = !note.locked; window.ap.setLock(id, note.locked); applyNote(); };
  $('del').onclick = () => { if ($('del').dataset.sure) { window.ap.deleteNote(id); } else { $('del').dataset.sure = 1; $('del').textContent = 'Click again: move to trash'; setTimeout(() => { delete $('del').dataset.sure; $('del').textContent = 'Delete note'; }, 3000); } };
  $('text').oninput = () => { text = $('text').value; persist(); };
  $('add').onkeydown = e => { if (e.key === 'Enter' && $('add').value.trim()) { items.push({ t: $('add').value.trim(), done: false }); $('add').value = ''; persist(); render(); } };
  const op = $('opacity');
  op.value = Math.round(settings.opacity * 100);
  op.oninput = () => window.ap.setOpacity(Number(op.value) / 100);
  window.ap.onSettings(s => { settings = s; applySettings(); op.value = Math.round(s.opacity * 100); });
  window.ap.onGotoDay(d => showDay(d));
  window.ap.onNoteColor(x => { if (x && x.id === id && COLORS.includes(x.color)) { note.color = x.color; applyNote(); } });
  let footT = null;
  const footNote = msg => { $('foot').textContent = msg; clearTimeout(footT); footT = setTimeout(render, 8000); };
  window.ap.onSaveError(() => footNote('Could not save to disk - retrying automatically'));
  window.ap.onDayChanged(t => { const wasToday = view === today; today = t; if (wasToday) showDay(t); else showDay(view); });
}
init();
