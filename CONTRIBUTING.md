# Contributing

## Setup

Requires Node.js LTS.

```
npm install
npm start          # run the app from source
node tests/store.test.js   # run the unit checks (plain node, no display needed)
```

## Project layout

- `src/main.js` - app entry: single-instance lock, tray, windows, shortcuts, IPC
- `src/store.js` - JSON persistence with rotating backups and quarantine
- `src/note.*` - note window UI; `src/search.*` - search window
- `src/preload.js` - the only bridge between UI and the main process
- `src/uninstall.js` - builds the uninstall helper script
- `scripts/gen-nsis.js` - regenerates installer manifests from `dist/`
- `installer.nsi`, `build/uninstall-custom.nsh` - installer source
- `tests/` - plain-node unit checks

## Rules that keep users safe

- `package.json` and `installer.nsi` versions must always match.
- Any change that alters a shipped binary means a version bump.
- After any packaging change, run the exact-artifact selftest against the
  packaged output, not only a source diff.
- The uninstaller must stay conservative: delete only manifest-listed files,
  refuse junction/symlink paths, and never touch notes unless the user
  explicitly asks.

## Pull requests

Small, focused PRs. Describe what you tested and on which OS. Windows-specific
behavior should be verified on a real Windows machine before merge.
