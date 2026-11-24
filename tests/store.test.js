// Plain-node tests for the v3 Store: quarantine, validated rotating backups, flush.
const fs = require('fs');
const path = require('path');
const { Store } = require(path.join(__dirname, '..', 'src', 'store.js'));

const root = require('path').join(require('os').tmpdir(), 'apnp-storetest-data');
const out = { checks: {} };
const reset = () => { fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true }); };
const file = path.join(root, 'notes.json');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

// 1. roundtrip
reset();
let s = new Store(root);
s.data.notes.n1 = { days: { '2026-11-14': { text: 'hello', items: [{ t: 'a', done: false }] } } };
s.save();
out.checks.roundtrip = read(file).notes.n1.days['2026-11-14'].text === 'hello';
out.checks.bak_written = fs.existsSync(file + '.bak') === false; // no previous file on first save, so no backup yet

// 2. second save creates .bak with the OLD content
s.data.notes.n1.days['2026-11-14'].text = 'v2text';
s.save();
out.checks.bak_has_old = read(file + '.bak').notes.n1.days['2026-11-14'].text === 'hello';
out.checks.main_has_new = read(file).notes.n1.days['2026-11-14'].text === 'v2text';

// 3. rotation: third save shifts .bak to .bak2
s.data.notes.n1.days['2026-11-14'].text = 'v3text';
s.save();
out.checks.bak2_has_oldest = read(file + '.bak2').notes.n1.days['2026-11-14'].text === 'hello';
out.checks.bak_has_v2 = read(file + '.bak').notes.n1.days['2026-11-14'].text === 'v2text';

// 4. corrupt main + good bak: loads bak, main quarantined
reset();
fs.writeFileSync(file, 'GARBAGE{');
fs.writeFileSync(file + '.bak', JSON.stringify({ version: 1, notes: { n1: { days: { '2026-11-10': { text: 'PRECIOUS', items: [] } } } }, settings: {} }));
s = new Store(root);
out.checks.corrupt_main_loads_bak = s.data.notes.n1.days['2026-11-10'].text === 'PRECIOUS';
out.checks.corrupt_main_quarantined = !fs.existsSync(file) && fs.readdirSync(root).some(f => f.startsWith('notes.json.corrupt-'));
out.checks.rescued_copy_made = fs.readdirSync(root).some(f => f.startsWith('notes.json.rescued-'));
// retention over ongoing use: 5 more saves with rotation must not touch the kept files
for (let i = 0; i < 5; i++) { s.data.notes.n1.days['2026-11-10'].text = 'edit ' + i; s.save(); }
const rescued = fs.readdirSync(root).find(f => f.startsWith('notes.json.rescued-'));
out.checks.rescued_survives_rotation = !!rescued && read(path.join(root, rescued)).notes.n1.days['2026-11-10'].text === 'PRECIOUS';
out.checks.quarantined_survives_rotation = fs.readdirSync(root).some(f => f.startsWith('notes.json.corrupt-'));
out.checks.current_data_fine_after_rotations = read(file).notes.n1.days['2026-11-10'].text === 'edit 4';

// 5. corrupt main + ALL corrupt baks: starts blank, nothing overwritten, baks kept
reset();
fs.writeFileSync(file, 'GARBAGE{');
fs.writeFileSync(file + '.bak', 'GARBAGE{');
s = new Store(root);
out.checks.all_corrupt_starts_blank = Object.keys(s.data.notes).length === 0;
s.data.notes.n2 = { days: {} };
s.save();
out.checks.all_corrupt_bak_kept = fs.readFileSync(file + '.bak', 'utf8') === 'GARBAGE{';
out.checks.all_corrupt_main_quarantined = fs.readdirSync(root).some(f => f.startsWith('notes.json.corrupt-'));
out.checks.all_corrupt_new_main_ok = read(file).notes.n2.days !== undefined;
// retention over ongoing use: every damaged backup must survive later saves/rotations
for (let i = 0; i < 6; i++) { s.data.notes.n2.days['2026-11-1' + i] = { text: 'e' + i, items: [] }; s.save(); }
out.checks.all_corrupt_every_damaged_file_retained = fs.readdirSync(root).filter(f => f.includes('.corrupt-')).length === 2;
out.checks.all_corrupt_data_fine_after_rotations = read(file).notes.n2.days['2026-11-15'].text === 'e5';

// 6. corrupt current file is never rotated over a good .bak
reset();
s = new Store(root);
s.data.notes.n1 = { days: { '2026-11-01': { text: 'GOOD OLD', items: [] } } };
s.save();
s.data.notes.n1.days['2026-11-01'].text = 'GOOD NEWER';
s.save(); // .bak now GOOD OLD, main GOOD NEWER
fs.writeFileSync(file, 'GARBAGE{'); // disk damage while app runs
s.data.notes.n1.days['2026-11-01'].text = 'AFTER DAMAGE';
s.save();
out.checks.bak_survives_disk_damage = read(file + '.bak').notes.n1.days['2026-11-01'].text === 'GOOD OLD';
out.checks.damage_quarantined = fs.readdirSync(root).some(f => f.startsWith('notes.json.corrupt-'));
out.checks.main_has_after = read(file).notes.n1.days['2026-11-01'].text === 'AFTER DAMAGE';

// 7. saveSoon + flush
reset();
s = new Store(root);
s.data.notes.n1 = { days: {} };
s.saveSoon(50);
s.data.notes.n1.days['2026-11-14'] = { text: 'debounced', items: [] };
s.flush();
out.checks.flush_writes = read(file).notes.n1.days['2026-11-14'].text === 'debounced';

// 8. defaults include v3 choices
out.checks.default_desktopLayer = !('desktopLayer' in s.data.settings);
out.checks.default_startWithWindows = s.data.settings.startWithWindows === true;

console.log(JSON.stringify(out, null, 2));
