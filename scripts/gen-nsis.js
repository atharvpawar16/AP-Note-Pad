// Generates NSIS includes at build time:
//  - uninstall-files.nsh: one Delete per installed file, RMDir per dir (deepest first)
//  - uninstall-prep-dirs.nsh: FileWrite lines appending each install dir to the PS
//    reparse-check array. Exact manifest of what the installer installed.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'dist', 'AP Note Pad-win32-x64');
const files = [], dirs = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name), rel = path.relative(root, p);
    if (e.isDirectory()) { dirs.push(rel); walk(p); } else files.push(rel);
  }
})(root);
dirs.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length || b.localeCompare(a));
const win = r => r.split(path.sep).join('\\');
fs.writeFileSync(path.join(__dirname, 'uninstall-files.nsh'),
  files.map(f => `  Delete "$INSTDIR\\${win(f)}"`).concat(dirs.map(d => `  RMDir "$INSTDIR\\${win(d)}"`)).join('\r\n') + '\r\n');
fs.writeFileSync(path.join(__dirname, 'uninstall-prep-dirs.nsh'),
  dirs.map(d => `  FileWrite $0 ",'$INSTDIR\\${win(d)}'"`).join('\r\n') + '\r\n');
console.log('nsis manifest:', files.length, 'files,', dirs.length, 'dirs');