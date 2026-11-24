# AP Note Pad - User Guide

AP Note Pad puts small glass-style sticky notes directly on your Windows 11
desktop. Each note holds text and tick-box tasks for one day.

## Installing (unsigned build)

1. Download `AP-Note-Pad-Setup-0.3.7.exe` from the
   [Releases](https://github.com/atharvpawar16/AP-Note-Pad/releases) page.
2. If you have used AP Note Pad before, copy your `%APPDATA%\AP Note Pad`
   folder somewhere safe first.
3. If the app is running, quit it from the tray icon, then run the installer.
   It installs for your user account only; no administrator rights needed.

Windows may show a blue "Windows protected your PC" screen. That is the
standard SmartScreen prompt for apps without a code-signing certificate; this
build is unsigned. To continue, click **More info**, then **Run anyway**. Do
not turn SmartScreen off.

To check the download is intact, compare its SHA-256 with the value on the
release page: open PowerShell and run
`Get-FileHash .\AP-Note-Pad-Setup-0.3.7.exe`. The two values should match.

## First run

The app starts with Windows and opens today's notes where you left them.
Look for its icon near the clock (system tray); the app has no taskbar button.

## Everyday use

- New note: tray menu > New note, or press Ctrl+Alt+N
- Search all days: tray menu > Search, or press Ctrl+Alt+F
- Move between days with the Prev/Next arrows on a note's date bar.
  Tomorrow's note opens only when that day starts.
- Tick boxes check off tasks for that day; past days stay readable forever.
- Drag a note by its top edge to move it; drag its corner to resize.
  Position and size are restored on the next start.
- Deleted notes go to Trash (tray menu) and are kept for 15 days; restore
  them from there if you change your mind.

## Look and feel

From the tray menu: Theme, Opacity, Font size and Glass style
(acrylic / mica / solid), plus per-note colors (yellow, mint, rose, sky, sand).

If notes disappear after Show Desktop (Win+D), they come back on their own.
You can turn that off in the tray: "Bring notes back after Show Desktop".

## Your data

Notes live in `%APPDATA%\AP Note Pad` as `notes.json` plus dated backup
copies. If a notes file is ever damaged, it is moved aside instead of
overwriting the backups, and a fresh file starts blank.

A `startup-log.txt` in the same folder records startup problems. If something
looks wrong, send that file with your report.

## Uninstall

Use Windows Settings > Apps, the app's tray menu > Uninstall, or the
"Uninstall AP Note Pad" shortcut next to the app. At uninstall time you
choose whether your notes and backups are kept or deleted.

Known issue in version 0.3.6: the uninstaller can stop early on some PCs.
It deletes nothing when that happens, but the app may be left stopped and its
"Start with Windows" entry removed. To finish removal manually:

1. Quit the app from the tray.
2. Delete the folder `%LOCALAPPDATA%\Programs\AP Note Pad`.
3. Your notes stay in `%APPDATA%\AP Note Pad` unless you delete that folder
   yourself.
