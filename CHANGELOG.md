# Changelog

## Unreleased

- Installer source contains a fix for the uninstaller stopping early on some
  machines. This fix is not in any delivered build; it will ship under a new
  version number.
- Project source published on GitHub.

## 0.3.6 - 2026-11-14

Current app version. First build delivered for daily use (shared privately; no
GitHub release).

- Frameless glass-style desktop notes, one window per note
- Day-wise text notes and tick-box checklists; past days are never deleted
- Notes stay on the desktop and come back after Show Desktop (Win+D)
- Starts with Windows; per-note position, size, color, opacity and glass style
- Tray menu, global shortcuts (Ctrl+Alt+N new note, Ctrl+Alt+F search)
- Rotating JSON backups with quarantine-on-damage
- Per-user NSIS installer (no admin) with data-keeping uninstaller

Fixed since earlier internal builds: notes vanishing after Win+D (0.3.4),
a false "no note window" error on all-hidden startup (0.3.5), and a broken
opacity slider (before 0.3.5).

Known issue: the 0.3.6 installer's uninstaller can stop early on some
machines. When that happens it deletes nothing, but it may leave the app
stopped and its "Start with Windows" entry removed. See the user guide for
manual removal steps.
