// Builds the uninstall helper script. One builder serves both routes:
//  - the "Uninstall AP Note Pad.cmd" shipped next to the exe (mode ASK: the user
//    answers at uninstall time whether notes/backups are deleted too), and
//  - the tray menu flow, which asks in a native dialog first and bakes the answer in.
//
// Safety rules enforced by the generated script:
//  - Refuses shared/unsafe roots (profile root, Desktop, Documents, Downloads,
//    drive roots) and refuses to run if the app folder or any listed install
//    subfolder is a junction/symlink (deletion could escape the folder).
//  - Every manifest entry is validated: entries that are absolute or contain
//    ".." abort the whole uninstall. Only listed files are deleted, one by one;
//    folders go only when empty afterwards, so personal files stay put.
//  - The Windows startup entry is removed only when its value is EXACTLY this
//    install's exe path (checked with PowerShell, case-insensitive, quotes
//    stripped); an entry pointing anywhere else is left untouched.
//  - Notes/backups deletion is an explicit opt-in and is narrowed to known app
//    data inside the dedicated AppData folder; linked folders are skipped and
//    unrecognized files are kept and reported.
function buildCmd(appDir, mode) {
  const L = ['@echo off', 'setlocal'];
  L.push('set "T=%TEMP%\\ap-note-pad-uninstall.cmd"');
  L.push('if /i not "%~f0"=="%T%" (');
  L.push('  copy /y "%~f0" "%T%" >nul');
  L.push('  start "" cmd /c ""%T%" "' + (appDir || '%~dp0') + '" ' + mode + '""');
  L.push('  ping 127.0.0.1 -n 2 >nul');
  L.push('  del "%~f0" 2>nul');
  L.push('  exit /b');
  L.push(')');
  L.push('set "APPDIR=%~1"');
  L.push('set "MODE=%~2"');
  L.push('if "%APPDIR%"=="" (echo No app folder given.& pause& exit /b 1)');
  L.push('if "%APPDIR:~-1%"=="\\" set "APPDIR=%APPDIR:~0,-1%"');
  L.push('if /i "%APPDIR%"=="%USERPROFILE%" goto unsafe');
  L.push('if /i "%APPDIR%"=="%USERPROFILE%\\Desktop" goto unsafe');
  L.push('if /i "%APPDIR%"=="%USERPROFILE%\\Documents" goto unsafe');
  L.push('if /i "%APPDIR%"=="%USERPROFILE%\\Downloads" goto unsafe');
  L.push('if "%APPDIR:~1,2%"==":\\" if "%APPDIR:~3,1%"=="" goto unsafe');
  L.push('call :rejectlink "%APPDIR%"');
  L.push('if not exist "%APPDIR%\\AP Note Pad.exe" (echo AP Note Pad.exe not found in %APPDIR% - nothing deleted.& pause& exit /b 1)');
  L.push('if not exist "%APPDIR%\\uninstall-files.txt" (echo Install file list missing - nothing deleted.& pause& exit /b 1)');
  L.push('if not exist "%APPDIR%\\uninstall-dirs.txt" (echo Install folder list missing - nothing deleted.& pause& exit /b 1)');
  L.push('for /f "usebackq delims=" %%D in ("%APPDIR%\\uninstall-dirs.txt") do call :rejectlink "%APPDIR%\\%%D"');
  if (mode === 'ASK') {
    L.push('echo Uninstall AP Note Pad from this PC.');
    L.push('choice /c YNC /n /m "Also permanently delete ALL notes and backups in AppData? [Y=delete all / N=keep notes / C=cancel] "');
    L.push('if errorlevel 3 exit /b');
    L.push('if errorlevel 2 (set "MODE=KEEP") else (set "MODE=DELDATA")');
  }
  L.push('taskkill /im "AP Note Pad.exe" >nul 2>&1');
  L.push('ping 127.0.0.1 -n 3 >nul');
  L.push('taskkill /f /im "AP Note Pad.exe" >nul 2>&1');
  L.push('powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=\'%APPDIR%\\AP Note Pad.exe\'; $k=\'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\'; $v=(Get-ItemProperty -Path $k -Name \'AP Note Pad\' -ErrorAction SilentlyContinue).\'AP Note Pad\'; if ($null -ne $v -and ($v.Trim([char]34) -ieq $p)) { Remove-ItemProperty -Path $k -Name \'AP Note Pad\' }" >nul 2>&1');
  L.push('for /f "usebackq delims=" %%F in ("%APPDIR%\\uninstall-files.txt") do call :delfile "%%F"');
  L.push('for /f "usebackq delims=" %%D in ("%APPDIR%\\uninstall-dirs.txt") do rmdir "%APPDIR%\\%%D" 2>nul');
  L.push('del /q "%APPDIR%\\uninstall-files.txt" "%APPDIR%\\uninstall-dirs.txt" 2>nul');
  L.push('rmdir "%APPDIR%" 2>nul');
  L.push('if /i "%MODE%"=="DELDATA" call :deldata');
  L.push('if exist "%APPDIR%\\" (echo AP Note Pad removed. Files you added yourself were left in %APPDIR%.) else (echo AP Note Pad removed completely.)');
  L.push('del "%~f0" 2>nul');
  L.push('exit /b');
  L.push('');
  L.push(':rejectlink');
  L.push('if not exist "%~1\\" exit /b 0');
  L.push('for %%A in ("%~1") do set "A=%%~aA"');
  L.push('if not "%A:l=%"=="%A%" (echo Refusing to continue: "%~1" is a link, not a real folder.& pause& exit)');
  L.push('exit /b 0');
  L.push('');
  L.push(':delfile');
  L.push('set "F=%~1"');
  L.push('if not "%F:..=%"=="%F%" (echo Bad install file list entry: %F% - nothing deleted.& pause& exit)');
  L.push('if "%F:~0,1%"=="\\" (echo Bad install file list entry: %F% - nothing deleted.& pause& exit)');
  L.push('if "%F:~1,1%"==":" (echo Bad install file list entry: %F% - nothing deleted.& pause& exit)');
  L.push('del /q "%APPDIR%\\%F%" 2>nul');
  L.push('exit /b 0');
  L.push('');
  L.push(':rmdirsafe');
  L.push('if not exist "%~1\\" exit /b 0');
  L.push('for %%A in ("%~1") do set "A=%%~aA"');
  L.push('if not "%A:l=%"=="%A%" (echo Leaving linked folder untouched: %~1& exit /b 0)');
  L.push('rmdir /s /q "%~1"');
  L.push('exit /b 0');
  L.push('');
  L.push(':deldata');
  L.push('set "DDIR=%APPDATA%\\AP Note Pad"');
  L.push('if not exist "%DDIR%\\" exit /b 0');
  L.push('for %%A in ("%DDIR%") do set "A=%%~aA"');
  L.push('if not "%A:l=%"=="%A%" (echo Data folder is a link - leaving it untouched.& exit /b 0)');
  L.push('del /q "%DDIR%\\notes.json" "%DDIR%\\notes.json.bak*" "%DDIR%\\notes.json.corrupt-*" "%DDIR%\\notes.json.rescued-*" 2>nul');
  L.push('del /q "%DDIR%\\Preferences" "%DDIR%\\Local State" "%DDIR%\\config.json" 2>nul');
  L.push('for %%D in ("Cache" "Code Cache" "GPUCache" "DawnGraphiteCache" "DawnWebGPUCache" "Local Storage" "Session Storage" "Network" "Crashpad" "blob_storage" "databases" "IndexedDB" "File System" "Service Worker" "shared_proto_db") do call :rmdirsafe "%DDIR%\\%%~D"');
  L.push('rmdir "%DDIR%" 2>nul');
  L.push('if exist "%DDIR%\\" echo Some unrecognized files were kept in %DDIR%.');
  L.push('exit /b 0');
  L.push('');
  L.push(':unsafe');
  L.push('echo For safety, uninstall refuses to run on this folder: %APPDIR%');
  L.push('echo Keep the app in its own folder and run again.');
  L.push('pause');
  L.push('exit /b 1');
  return L.join('\r\n') + '\r\n';
}
module.exports = { buildCmd };
