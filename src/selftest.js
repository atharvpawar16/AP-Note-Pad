// Automated checks used while building (run under a virtual display). Not part of normal use.
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = async ({ store, windows, app, live, trashNote, restoreNote, showAllNotes, cycleColors, COLORS }) => {
  const out = { stage: process.env.APNP_STAGE, checks: {} };
  const stage = process.env.APNP_STAGE, shot = process.env.APNP_SHOT;
  await sleep(2500);
  const id = live().find(i => windows.has(i)) || live()[0], win = windows.get(id), wc = win && win.webContents;
  const js = c => wc.executeJavaScript(c);
  const snap = async n => { fs.writeFileSync(`${shot}/${n}.png`, (await wc.capturePage()).toPNG()); };
  try {
    if (stage === 'guard') {
      // Guard scenarios: just report startup outcome (windows, log) without driving the UI.
      out.checks.windows_open = windows.size;
      out.checks.live_notes = live().length;
      try { out.checks.log = fs.readFileSync(process.env.APNP_DATA + '/startup-log.txt', 'utf8'); } catch (e) { out.checks.log = null; }
      fs.writeFileSync(process.env.APNP_OUT, JSON.stringify(out, null, 2));
      if (process.env.APNP_HOLD) return; // keep running: holds the single-instance lock
      app.exit(0); return;
    } else if (stage === 'persist') {
      // Persistence: an external hide with no hidden flag (the Win+D cloak path his log
      // shows) must be bounced by the hide-event handler; a deliberate hide (flag set
      // first, as close-note does) must stay hidden; a normal window is untouched.
      const pid = live().find(i => windows.has(i)) || live()[0], pw = windows.get(pid);
      await sleep(2500);
      out.checks.visible_window_untouched = pw.isVisible() && !pw.isMinimized();
      pw.hide(); await sleep(1400);
      out.checks.external_hide_bounced = pw.isVisible();
      // The tray switch turns recovery off: an external hide then stays hidden.
      store.data.settings.stayAfterShowDesktop = false;
      pw.hide(); await sleep(1400);
      out.checks.recovery_disabled_by_setting = !pw.isVisible();
      store.data.settings.stayAfterShowDesktop = true;
      pw.showInactive(); await sleep(300);
      store.data.notes[pid].hidden = true; pw.hide(); await sleep(1400);
      out.checks.deliberate_hide_preserved = !pw.isVisible();
      delete store.data.notes[pid].hidden;
      if (!pw.isVisible()) pw.showInactive(); await sleep(300);
      // Minimize path where the env supports real iconic state (Xvfb often does not).
      pw.minimize(); await sleep(600);
      if (pw.isMinimized()) { await sleep(2500); out.checks.poller_restores_minimized = pw.isVisible() && !pw.isMinimized(); }
      else out.checks.env_minimize_unsupported = true;
    } else if (stage === '1') {
      win.setBounds({ x: 210, y: 140, width: 320, height: 380 }); await sleep(700);
      for (const t of ['Buy milk', 'Call the bank', 'Water plants']) { await js(`document.getElementById('add').value=${JSON.stringify(t)};document.getElementById('add').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`); }
      await js(`document.querySelector('li input[type=checkbox]').click()`); await sleep(500);
      out.checks.order_after_tick = await js(`[...document.querySelectorAll('li .t')].map(e=>e.value)`);
      out.checks.next_disabled_today = await js(`document.getElementById('next').disabled`);
      const todayText = await js(`document.getElementById('date').textContent`); out.checks.date_today = todayText;
      await snap('today');
      await js(`document.getElementById('prev').click()`); await sleep(200);
      out.checks.prev_day_text = await js(`document.getElementById('date').textContent`);
      out.checks.prev_day_items = await js(`document.querySelectorAll('li').length`);
      out.checks.next_enabled_on_past = !(await js(`document.getElementById('next').disabled`));
      await js(`document.getElementById('text').value='Plain note line one\\nline two';document.getElementById('text').dispatchEvent(new Event('input'))`);
      await js(`document.getElementById('add').value='Yesterday task';document.getElementById('add').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`); await sleep(400);
      await js(`document.getElementById('menu').click()`); await snap('past_menu');
      await js(`document.getElementById('menu').click();document.getElementById('next').click()`); await sleep(200);
      out.checks.back_to_today_items = await js(`document.querySelectorAll('li').length`);
      out.checks.next_disabled_again = await js(`document.getElementById('next').disabled`);
      // midnight rollover simulation
      const { shiftKey } = require('./dates'); const { todayKey } = require('./dates');
      const tomorrow = shiftKey(todayKey(), 1);
      wc.send('day-changed', tomorrow); await sleep(400);
      out.checks.after_rollover_date = await js(`document.getElementById('date').textContent`);
      out.checks.after_rollover_items = await js(`document.querySelectorAll('li').length`);
      out.checks.carry_prompt_shown = !(await js(`document.getElementById('ask').hidden`));
      out.checks.carry_setting_still_unchosen = store.data.settings.carryForward === null;
      await snap('carry_prompt');
      await js(`document.getElementById('askyes').click()`); await sleep(400);
      out.checks.after_carry_items = await js(`[...document.querySelectorAll('li .t')].map(e=>e.value)`);
      out.checks.carry_choice_still_unchosen_after_once = store.data.settings.carryForward === null;
      await js(`document.getElementById('prev').click()`); await sleep(200);
      out.checks.old_day_kept = await js(`document.querySelectorAll('li').length`);
      out.checks.taskbar_skip = process.platform; // skipTaskbar set in code; only a Windows PC can confirm
      out.bounds = win.getBounds();
      // add a second note, trash and restore
      const before = live().length; const nid = require('./main_hooks') ; 
    } else if (stage === '3') {
      const { shiftKey, todayKey } = require('./dates');
      const n = store.data.notes[id];
      await js(`document.getElementById('menu').click()`); await sleep(150); await snap('panel');
      out.checks.panel_open = !(await js(`document.getElementById('panel').hidden`));
      // lock
      await js(`document.getElementById('lock').click()`); await sleep(300);
      out.checks.locked_saved = store.data.notes[id].locked === true; out.checks.resizable_when_locked = win.isResizable();
      await js(`document.getElementById('lock').click()`); await sleep(300); out.checks.resizable_after_unlock = win.isResizable();
      // dark + color + opacity
      store.data.settings.theme = 'dark'; store.data.settings.opacity = 0.7; wc.send('settings', store.data.settings);
      await js(`document.querySelector('.sw.mint').click()`); await sleep(300); await js(`document.getElementById('menu').click()`); await sleep(200); await snap('dark_mint');
      store.data.settings.theme = 'light'; wc.send('settings', store.data.settings); await js(`document.querySelector('.sw.rose').click()`); await sleep(300); await snap('light_rose');
      // carry-forward off by default: tomorrow starts blank. Then on: seeds unticked only
      out.checks.text_kept = await js(`(document.getElementById('prev').click(), document.getElementById('text').value)`);
      // trash + restore
      const cnt = live().length; trashNote(id); await sleep(300);
      out.checks.trash = { live_before: cnt, live_after: live().length, win_closed: !windows.has(id) };
      restoreNote(id); await sleep(1500);
      out.checks.restored = { live: live().length, win: windows.has(id) };
    } else if (stage === '4') {
      win.setBounds({ x: 40, y: 40, width: 320, height: 400 }); await sleep(500);
      await js(`const t=document.getElementById('text'); t.value='Plan for today:\\nFinish the quarterly report draft.\\nCall mom in the evening.'; t.dispatchEvent(new Event('input'))`);
      for (const x of ['Buy milk', 'Water plants', 'Send the invoice']) await js(`document.getElementById('add').value=${JSON.stringify(x)};document.getElementById('add').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`);
      await js(`document.querySelector('li input[type=checkbox]').click()`); await sleep(500); await snap('final');
    } else if (stage === '5') {
      // v3: migration, defaults, immediate save, empty-row filtering, minimize bounce-back, hidden persistence
      out.checks.visible_note_started_visible = win.isVisible();
      if (store.data.notes.nhid1) out.checks.deliberate_hide_preserved_at_startup = store.data.notes.nhid1.hidden === true && !windows.has('nhid1');
      out.checks.migration_pin_removed = !('desktopLayer' in store.data.settings);
      out.checks.migration_marked = store.data.settings.desktopPinV31 === true;
      out.checks.start_with_windows_default_true = store.data.settings.startWithWindows === true;
      const day = '2026-11-14';
      const ret = await js(`window.ap.saveDay('${id}','${day}',{text:'hi there',items:[{t:'',done:false},{t:'   ',done:false},{t:'real task',done:false}]})`);
      await sleep(200);
      out.checks.save_day_returned = ret;
      out.checks.memory_updated_immediately = store.data.notes[id].days[day] && store.data.notes[id].days[day].text === 'hi there';
      out.checks.empty_rows_filtered = store.data.notes[id].days[day].items.length === 1 && store.data.notes[id].days[day].items[0].t === 'real task';
      store.flush();
      const onDisk = JSON.parse(fs.readFileSync(process.env.APNP_DATA + '/notes.json', 'utf8'));
      out.checks.flush_writes_disk = onDisk.notes[id].days[day].text === 'hi there';
      // minimize bounce-back: with a real WM the window minimizes; then the OS event path must restore it
      out.checks.stay_setting_default = store.data.settings.stayAfterShowDesktop === true;
      const boundsBefore = { ...store.data.notes[id].bounds };
      win.minimize(); await sleep(150);
      out.checks.minimized_once = win.isMinimized();
      if (!win.isMinimized()) win.emit('minimize'); // no WM: fire the event Show Desktop would fire
      await sleep(600);
      out.checks.visible_after_bounce = win.isVisible() && !win.isMinimized();
      // A minimize/restore cycle must never poison the saved corner (Windows reports
      // -32000,-32000 for minimized windows); the seeded position stays as it was.
      const bAfter = store.data.notes[id].bounds;
      out.checks.bounds_not_poisoned_by_minimize = bAfter && Number.isFinite(bAfter.x) && bAfter.x > -1000 && Math.abs(bAfter.x - boundsBefore.x) <= 4 && Math.abs(bAfter.y - boundsBefore.y) <= 4;
      // Renderer-driven opacity: dragging the note's Glass slider must reach the main
      // process over IPC and come back applied in the renderer (regression: preload send()).
      await js(`(() => { const op = document.getElementById('opacity'); op.value = 70; op.dispatchEvent(new Event('input')); return true; })()`);
      await sleep(400);
      out.checks.opacity_slider_ipc_updates_setting = Math.abs(store.data.settings.opacity - 0.7) < 0.001;
      out.checks.opacity_applied_in_renderer = await js(`document.documentElement.style.getPropertyValue('--alpha')`) === '0.7';
      // hidden state persists and Show all clears it
      await js(`window.ap.closeNote('${id}')`); await sleep(400);
      out.checks.hidden_saved = store.data.notes[id].hidden === true && !win.isVisible();
      win.emit('minimize'); await sleep(300); // a stray minimize must not undo a deliberate hide
      out.checks.hide_not_undone_by_bounce = !win.isVisible();
      showAllNotes(); await sleep(600);
      out.checks.show_all_restores = store.data.notes[id].hidden === undefined && win.isVisible();
      // minimum size enforced
      win.setSize(120, 120); await sleep(200);
      const sz = win.getSize();
      out.checks.min_size_enforced = sz[0] >= 220 && sz[1] >= 200;
      out.checks.min_size_actual = sz.join('x');
    } else if (stage === '2') {
      out.bounds = win.getBounds();
      out.checks.items_restored = await js(`document.querySelectorAll('li').length`);
      out.checks.text_restored = await js(`document.getElementById('text').value`);
      out.checks.date = await js(`document.getElementById('date').textContent`);
      await snap('restored');
      out.disk = JSON.parse(fs.readFileSync(process.env.APNP_DATA + '/notes.json', 'utf8')).notes[id].bounds;
    }
  } catch (e) { out.error = String(e.stack || e); }
  fs.writeFileSync(process.env.APNP_OUT, JSON.stringify(out, null, 2));
  app.exit(0);
};
