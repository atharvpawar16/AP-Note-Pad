// Tests for scripts/gen-nsis.js: runs the real generator against a fixture
// dist tree in a temp dir and checks both manifests it writes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const out = { checks: {} };
const c = out.checks;

// fixture: tmp/scripts/gen-nsis.js + tmp/dist/AP Note Pad-win32-x64 tree
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apnp-gennsis-'));
fs.mkdirSync(path.join(tmp, 'scripts'));
fs.copyFileSync(path.join(__dirname, '..', 'scripts', 'gen-nsis.js'), path.join(tmp, 'scripts', 'gen-nsis.js'));
const app = path.join(tmp, 'dist', 'AP Note Pad-win32-x64');
fs.mkdirSync(path.join(app, 'resources', 'app', 'deep'), { recursive: true });
fs.mkdirSync(path.join(app, 'locales'), { recursive: true });
fs.writeFileSync(path.join(app, 'AP Note Pad.exe'), 'exe');
fs.writeFileSync(path.join(app, 'resources', 'app', 'main.js'), 'js');
fs.writeFileSync(path.join(app, 'resources', 'app', 'deep', 'leaf.txt'), 'x');
fs.writeFileSync(path.join(app, 'locales', 'en-US.pak'), 'p');

execFileSync(process.execPath, [path.join(tmp, 'scripts', 'gen-nsis.js')], { stdio: 'pipe' });

const files = fs.readFileSync(path.join(tmp, 'scripts', 'uninstall-files.nsh'), 'utf8');
const dirs = fs.readFileSync(path.join(tmp, 'scripts', 'uninstall-prep-dirs.nsh'), 'utf8');

// every fixture file gets a Delete line, Windows separators, CRLF endings
c.delete_all_files = ['AP Note Pad.exe', 'resources\\app\\main.js', 'resources\\app\\deep\\leaf.txt', 'locales\\en-US.pak']
  .every(f => files.includes(`  Delete "$INSTDIR\\${f}"`));
c.crlf_endings = files.includes('\r\n') && !files.replace(/\r\n/g, '').includes('\n');

// dirs sorted deepest first so RMDir never empties a parent before its child
const rmOrder = files.split('\r\n').filter(l => l.includes('RMDir')).map(l => l.replace(/.*\$INSTDIR\\([^"]*)".*/, '$1'));
c.rmdir_deepest_first = rmOrder.indexOf('resources\\app\\deep') < rmOrder.indexOf('resources\\app')
  && rmOrder.indexOf('resources\\app') < rmOrder.indexOf('resources');

// prep-dirs manifest lists every dir exactly once for the PS reparse check
const fw = dirs.split('\r\n').filter(l => l.includes('FileWrite'));
c.prep_dirs_all = fw.length === 4 && ['resources', 'resources\\app', 'resources\\app\\deep', 'locales']
  .every(d => dirs.includes(`  FileWrite $0 ",'$INSTDIR\\${d}'"`));

fs.rmSync(tmp, { recursive: true, force: true });
const failed = Object.keys(c).filter(k => !c[k]);
console.log(JSON.stringify(out, null, 2));
if (failed.length) { console.error('FAILED:', failed.join(', ')); process.exit(1); }
console.log('gen-nsis.test.js:', Object.keys(c).length, 'checks passed');
