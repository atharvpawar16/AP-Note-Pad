# Development notes

## Architecture

Electron app with a small surface on purpose:

- `src/main.js` owns everything: a single-instance lock, the tray menu,
  one `BrowserWindow` per note (frameless, no taskbar button), the search
  window, global shortcuts and all IPC. Handled startup errors are appended
  to `startup-log.txt` next to the notes file so failures never vanish
  silently.
- `src/store.js` (`Store`, `DEFAULTS`) is the only writer of `notes.json`.
  Writes rotate through dated backups; a damaged main file is quarantined
  rather than overwritten.
- `src/preload.js` is the single bridge into the note UI.
- `src/dates.js` handles the per-day keys (`YYYY-MM-DD`).

## Tests

- `node tests/store.test.js` - plain-node checks of store, rotation and
  quarantine behavior. No display or Electron needed.
- `src/selftest.js` - in-app integration harness run under a virtual display
  during development (excluded from packaged builds). Run the exact-artifact
  variant against packaged output after ANY packaging change; a source diff
  alone is not enough.

## Packaging

```
npm run dist               # dist/AP Note Pad-win32-x64 via electron-packager
node scripts/gen-nsis.js   # regenerate uninstall manifests from dist/
makensis installer.nsi     # AP-Note-Pad-Setup-<version>.exe
```

`gen-nsis.js` writes the exact manifest the uninstaller deletes from:
`uninstall-files.nsh` (one Delete per installed file, RMDir per directory,
deepest first) and `uninstall-prep-dirs.nsh` (the directory list used by the
uninstaller's link checks). Keep no stray `.exe` in the project root while
packaging; electron-packager would include it.

## Uninstaller safety design

`src/uninstall.js` and `build/uninstall-custom.nsh` share these rules:

- Delete only manifest-listed files, one by one; remove folders only when
  empty afterwards.
- Refuse shared or unsafe roots (profile root, Desktop, Documents,
  Downloads, drive roots) and abort if the app folder or any listed
  subfolder is a junction/symlink.
- Remove the Windows startup entry only when its value is exactly this
  install's exe path.
- Notes/backups deletion is an explicit opt-in at uninstall time, narrowed
  to known app data; unrecognized personal files are kept.

## Versioning

`package.json` (`version`) and `installer.nsi` (`!define VERSION`) must stay
in sync. Any change that alters a shipped binary means a version bump, and a
fresh exact-artifact selftest before release.
