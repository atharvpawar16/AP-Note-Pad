; AP Note Pad - per-user installer (no admin). Build: NSISDIR=... makensis installer.nsi
!define APPNAME "AP Note Pad"
!define VERSION "0.3.6"
Name "${APPNAME}"
OutFile "AP-Note-Pad-Setup-${VERSION}.exe"
Unicode true
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
SetCompressor zlib

Page instfiles
UninstPage instfiles

Section
  SetOutPath $INSTDIR
  File /r "dist\AP Note Pad-win32-x64\*.*"
  WriteUninstaller "$INSTDIR\Uninstall ${APPNAME}.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\${APPNAME}.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" '"$INSTDIR\Uninstall ${APPNAME}.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${APPNAME}.exe"
SectionEnd

Section "Uninstall"
  ; Gate 1: explicit uninstall confirmation (program files only).
  MessageBox MB_OKCANCEL|MB_ICONQUESTION "Remove AP Note Pad from this PC?$\r$\n$\r$\nOnly the app in $INSTDIR and its Windows startup entry are removed. You will be asked separately about your notes and backups." IDOK prep
  Abort
  prep:
  ; Prepare via PowerShell: stop ONLY this install's processes (graceful, then force),
  ; remove the Run entry only when it is exactly this exe, and verify no junction/link
  ; exists in the install tree before any file is deleted. The script MUST write a
  ; result file naming its outcome; deletion proceeds only when that file says OK.
  ; Bare exit codes are never trusted alone (a failed powershell start can leave $0 stale).
  FileOpen $0 "$TEMP\apnp-prepare.ps1" w
  FileWrite $0 "$$ErrorActionPreference='SilentlyContinue'$\r$\n"
  FileWrite $0 "$$rf='$TEMP\apnp-prepare-result.txt'$\r$\n"
  FileWrite $0 "$$exe='$INSTDIR\${APPNAME}.exe'$\r$\n"
  FileWrite $0 "Get-Process | Where-Object { $$_.Path -ieq $$exe } | ForEach-Object { $$_.CloseMainWindow() }$\r$\n"
  FileWrite $0 "Start-Sleep -Seconds 2$\r$\n"
  FileWrite $0 "Get-Process | Where-Object { $$_.Path -ieq $$exe } | Stop-Process -Force$\r$\n"
  FileWrite $0 "$$k='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'$\r$\n"
  FileWrite $0 "$$v=(Get-ItemProperty -Path $$k -Name '${APPNAME}').'${APPNAME}'$\r$\n"
  FileWrite $0 "if ($$null -ne $$v -and $$v.Trim([char]34) -ieq $$exe) { Remove-ItemProperty -Path $$k -Name '${APPNAME}' }$\r$\n"
  FileWrite $0 "$$dirs=@('$INSTDIR'$\r$\n"
  !include "scripts\uninstall-prep-dirs.nsh"
  FileWrite $0 ")$\r$\n"
  FileWrite $0 "foreach ($$p in $$dirs) { $$i=Get-Item -LiteralPath $$p -Force; if ($$i -and ($$i.Attributes -band [IO.FileAttributes]::ReparsePoint)) { Set-Content -LiteralPath $$rf -Value ('LINK ' + $$p); exit 42 } }$\r$\n"
  FileWrite $0 "$$a=Get-Item -LiteralPath '$INSTDIR' -Force$\r$\n"
  FileWrite $0 "while ($$a -and $$a.Parent) { $$a=$$a.Parent; if ($$a.Attributes -band [IO.FileAttributes]::ReparsePoint) { Set-Content -LiteralPath $$rf -Value ('LINK ' + $$a.FullName); exit 42 } }$\r$\n"
  FileWrite $0 "if (Get-Process | Where-Object { $$_.Path -ieq $$exe }) { Set-Content -LiteralPath $$rf -Value 'PROC'; exit 43 }$\r$\n"
  FileWrite $0 "Set-Content -LiteralPath $$rf -Value 'OK'$\r$\n"
  FileWrite $0 "exit 0$\r$\n"
  FileClose $0
  Delete "$TEMP\apnp-prepare-result.txt"
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -File "$TEMP\apnp-prepare.ps1"' $0
  Delete "$TEMP\apnp-prepare.ps1"
  IfErrors prepfail
  IfFileExists "$TEMP\apnp-prepare-result.txt" haveresult prepfail
  haveresult:
  FileOpen $1 "$TEMP\apnp-prepare-result.txt" r
  FileRead $1 $2
  FileClose $1
  Delete "$TEMP\apnp-prepare-result.txt"
  StrCpy $3 $2 2
  StrCmp $3 "OK" startdel
  StrCpy $3 $2 4
  StrCmp $3 "LINK" 0 chkproc
    StrCpy $2 $2 "" 5
    Goto linked
  chkproc:
  StrCmp $3 "PROC" procfail prepfail
  linked:
    MessageBox MB_OK|MB_ICONEXCLAMATION "A folder in the AP Note Pad install path is a link to another location:$\r$\n$2$\r$\n$\r$\nUninstall was stopped to protect your other files. Remove the link and run uninstall again. Nothing was deleted."
    Abort
  procfail:
    MessageBox MB_OK|MB_ICONEXCLAMATION "AP Note Pad is still running and could not be closed. Quit it from the tray icon near the clock, then run uninstall again. Nothing was deleted."
    Abort
  prepfail:
    MessageBox MB_OK|MB_ICONEXCLAMATION "The uninstall safety check could not run correctly (code $0). Nothing was deleted. Please report this message."
    Abort
  startdel:
  ; remove exactly what the installer installed (generated manifest, one Delete per file)
  !include "scripts\uninstall-files.nsh"
  Delete "$INSTDIR\Uninstall ${APPNAME}.exe"
  Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  RMDir "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  RMDir "$INSTDIR"
  IfFileExists "$INSTDIR\*.*" 0 appgone
    MessageBox MB_OK|MB_ICONINFORMATION "AP Note Pad was removed. Files you added yourself were left in:$\r$\n$INSTDIR"
  appgone:
  ; Gate 2: separate, explicit opt-in for permanent notes/backups deletion.
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "PERMANENTLY delete ALL notes, past days and saved backups in the AP Note Pad data folder?$\r$\n$\r$\nThis cannot be undone. Choose No to keep them." IDNO keepdata
  FileOpen $0 "$TEMP\apnp-data.ps1" w
  FileWrite $0 "$$ErrorActionPreference='SilentlyContinue'$\r$\n"
  FileWrite $0 "$$d=Join-Path $$env:APPDATA '${APPNAME}'$\r$\n"
  FileWrite $0 "if (Test-Path -LiteralPath $$d) {$\r$\n"
  FileWrite $0 "$$root=Get-Item -LiteralPath $$d -Force$\r$\n"
  FileWrite $0 "$$bad=$$false$\r$\n"
  FileWrite $0 "$$a=$$root$\r$\n"
  FileWrite $0 "while ($$a -and $$a.Parent) { $$a=$$a.Parent; if ($$a.Attributes -band [IO.FileAttributes]::ReparsePoint) { $$bad=$$true } }$\r$\n"
  FileWrite $0 "  if ($$root -and -not ($$root.Attributes -band [IO.FileAttributes]::ReparsePoint) -and -not $$bad) {$\r$\n"
  FileWrite $0 "    Remove-Item -Path $\"$$d\notes.json*$\" -Force$\r$\n"
  FileWrite $0 "    Remove-Item -LiteralPath $\"$$d\Preferences$\",$\"$$d\Local State$\",$\"$$d\config.json$\" -Force$\r$\n"
  FileWrite $0 "    foreach ($$n in 'Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','Local Storage','Session Storage','Network','Crashpad','blob_storage','databases','IndexedDB','File System','Service Worker','shared_proto_db') {$\r$\n"
  FileWrite $0 "      $$p=Join-Path $$d $$n$\r$\n"
  FileWrite $0 "      $$i=Get-Item -LiteralPath $$p -Force$\r$\n"
  FileWrite $0 "      $$nested=$$null$\r$\n"
  FileWrite $0 "      if ($$i -and $$i.PSIsContainer) { $$nested=Get-ChildItem -LiteralPath $$p -Recurse -Force -Attributes ReparsePoint | Select-Object -First 1 }$\r$\n"
  FileWrite $0 "      if ($$i -and -not ($$i.Attributes -band [IO.FileAttributes]::ReparsePoint) -and -not $$nested) { Remove-Item -LiteralPath $$p -Recurse -Force }$\r$\n"
  FileWrite $0 "    }$\r$\n"
  FileWrite $0 "    if (-not (Get-ChildItem -LiteralPath $$d -Force)) { Remove-Item -LiteralPath $$d -Force }$\r$\n"
  FileWrite $0 "  }$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileWrite $0 "exit 0$\r$\n"
  FileClose $0
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -File "$TEMP\apnp-data.ps1"'
  Delete "$TEMP\apnp-data.ps1"
  IfFileExists "$APPDATA\${APPNAME}\*.*" 0 keepdata
    MessageBox MB_OK|MB_ICONINFORMATION "AP Note Pad data was removed, but unrecognized files were kept in:$\r$\n$APPDATA\${APPNAME}"
  keepdata:
SectionEnd