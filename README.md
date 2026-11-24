# AP Note Pad

A Windows 11 desktop sticky-notes app: frameless glass-style notes that live on the
desktop, with per-day text and task lists, tray control, and automatic JSON backups.

[![Tests](https://github.com/atharvpawar16/AP-Note-Pad/actions/workflows/tests.yml/badge.svg)](https://github.com/atharvpawar16/AP-Note-Pad/actions/workflows/tests.yml)

**Docs:** [User guide](docs/USER-GUIDE.md) · [Development notes](docs/DEVELOPMENT.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

## Features

- Frameless notes, one window per note, Apple-style glass look (acrylic/mica/solid styles)
- Day-wise notes: date bar with Prev/Next; tomorrow's note opens only when that day starts
- Tick-box checklists per day; past days are never deleted
- Starts with Windows and restores each note's position and size
- Notes stay on the desktop (no taskbar button) and come back after Show Desktop (Win+D);
  this recovery can be toggled from the tray ("Bring notes back after Show Desktop")
- Tray menu: New note, Search, Theme, Opacity, Font size, Glass style, Trash,
  Start with Windows, Uninstall, Quit
- Shortcuts: Ctrl+Alt+N new note, Ctrl+Alt+F search
- Rotating JSON backups with quarantine-on-damage: a corrupted notes file is moved
  aside instead of overwriting older backups
- Per-user NSIS installer (no admin) with a proper uninstaller: you choose at
  uninstall time whether your notes and backups are kept or removed

## Data

Notes live in `%APPDATA%\AP Note Pad` (notes.json plus dated backups). Uninstalling
the app does not touch them unless you explicitly ask it to.

## Install

A ready-made Windows installer (`AP-Note-Pad-Setup-<version>.exe`) will be published
on the Releases page. No installer is published there yet; to use the app today,
run it from source as described below.

Once published, the installer sets up the app per-user under
`%LOCALAPPDATA%\Programs\AP Note Pad`; no administrator rights needed. The build is
unsigned, so Windows SmartScreen may show its standard warning for unrecognized apps.

## Build from source

Requires Node.js LTS.

```
npm install
npm start          # run from source
npm run dist       # portable folder in dist/ via electron-packager
```

Installer build (Linux or Windows with NSIS 3.x):

```
node scripts/gen-nsis.js        # regenerate uninstall manifests from dist/
makensis installer.nsi          # produces AP-Note-Pad-Setup-<version>.exe
```

## Tests

```
node tests/store.test.js        # store/quarantine/backup unit checks (plain node)
```

`src/selftest.js` is an in-app integration harness (needs an X display on
Linux; excluded from packaged builds).

## Release status

v0.3.6 is the current app version. The app payload built from this source tree
matches the 0.3.6 build previously delivered to its first user. No installer is
published on GitHub Releases yet.

Known issue in that delivered 0.3.6 installer: its uninstaller can stop early on
some machines before finishing. When that happens it deletes nothing, but it
may leave the app stopped and its "Start with Windows" entry removed. Quitting
from the tray and deleting the app's folder removes the app; notes in
`%APPDATA%\AP Note Pad` stay unless you delete them yourself.

The installer source in this repository already contains a fix for that early
stop, and the fix is not in any build delivered so far. Building the installer
from this source therefore does NOT reproduce the delivered 0.3.6 installer, and
any installer built from this source will ship under a new version number.

## Verification status

Verified on a real Windows 11 machine: install, note visibility, and Win+D
recovery (v0.3.6). The build and test harness otherwise runs on Linux; Windows
verification of the remaining behaviors is ongoing.
