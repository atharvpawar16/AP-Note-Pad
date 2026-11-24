// Local JSON store. Atomic writes (temp file, fsync, then rename), validated rotating
// backups (.bak, .bak2, .bak3), and a dated quarantine copy of any damaged file so a
// broken notes file is never overwritten by the app.
const fs = require('fs');
const path = require('path');
const DEFAULTS = { glass: 'acrylic', theme: 'light', opacity: 0.55, fontSize: 14, autoColor: false, carryForward: null, startWithWindows: true, stayAfterShowDesktop: true };
const BACKUPS = 3;

class Store {
  constructor(dir) {
    this.dir = dir; this.file = path.join(dir, 'notes.json');
    this.data = { version: 1, settings: { ...DEFAULTS }, notes: {} };
    this._t = null; this.lastError = null; this.onError = null; this.quarantined = null;
    fs.mkdirSync(dir, { recursive: true });
    this.load();
  }
  _parse(f) {
    try {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (d && d.notes && typeof d.notes === 'object') return d;
    } catch (e) {}
    return null;
  }
  _quarantine(f) {
    // Keep a damaged file, dated, instead of overwriting it.
    try {
      if (fs.existsSync(f)) { fs.renameSync(f, f + '.corrupt-' + new Date().toISOString().replace(/[:.]/g, '-')); this.quarantined = f; }
    } catch (e) {}
  }
  _backupName(i) { return this.file + '.bak' + (i === 1 ? '' : i); }
  load() {
    let mainDamaged = false, recoveredFrom = null;
    for (const f of [this.file, ...Array.from({ length: BACKUPS }, (_, i) => this._backupName(i + 1))]) {
      const d = this._parse(f);
      if (d) { this.data = { version: 1, notes: d.notes, settings: { ...DEFAULTS, ...d.settings } }; recoveredFrom = f; break; }
      if (f === this.file && fs.existsSync(f)) mainDamaged = true;
    }
    if (mainDamaged) {
      // Keep the last-known-good copy we recovered from as a permanent dated file, so
      // backup rotation over time can never rotate it away. The damaged main file is
      // quarantined too. These kept files may permit recovery; they do not guarantee it.
      if (recoveredFrom && recoveredFrom !== this.file) {
        try { fs.copyFileSync(recoveredFrom, this.file + '.rescued-' + new Date().toISOString().replace(/[:.]/g, '-')); } catch (e) {}
      }
      this._quarantine(this.file);
    }
  }
  save() {
    const tmp = this.file + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeFileSync(fd, JSON.stringify(this.data, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (fs.existsSync(this.file)) {
      if (this._parse(this.file)) {
        // Rotate only known-good files into the backup chain. A damaged backup is never
        // overwritten by rotation: it is quarantined (kept, dated) instead.
        for (let i = BACKUPS; i >= 2; i--) {
          const a = this._backupName(i - 1), b = this._backupName(i);
          try { if (fs.existsSync(a)) { if (this._parse(a)) fs.renameSync(a, b); else this._quarantine(a); } } catch (e) {}
        }
        try { fs.copyFileSync(this.file, this._backupName(1)); } catch (e) {}
      } else {
        this._quarantine(this.file); // get the damaged file out of the way, keep it
      }
    }
    fs.renameSync(tmp, this.file);
  }
  // High-frequency edits go through saveSoon: in-memory data is always current,
  // the disk write is debounced. Call flush() before quitting.
  saveSoon(ms = 300) { clearTimeout(this._t); this._t = setTimeout(() => { this._t = null; this.saveSafe(); }, ms); if (this._t.unref) this._t.unref(); }
  flush() { if (this._t) { clearTimeout(this._t); this._t = null; } this.saveSafe(); }
  saveSafe() {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { this.save(); if (this.lastError) this.lastError = null; return true; }
      catch (e) { this.lastError = String(e && e.message || e); }
    }
    if (this.onError) { try { this.onError(this.lastError); } catch (e) {} }
    return false;
  }
}
module.exports = { Store, DEFAULTS };
