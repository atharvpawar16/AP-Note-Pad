// Contract test for src/uninstall.js buildCmd: the generated uninstaller script
// must keep every safety guard. Runs the real builder; fails if a guard is removed.
const path = require('path');
const { buildCmd } = require(path.join(__dirname, '..', 'src', 'uninstall.js'));

const out = { checks: {} };
const c = out.checks;
const cmd = buildCmd('C:\\Users\\x\\AppData\\Local\\Programs\\AP Note Pad', 'ASK');

// refuses shared/unsafe roots
c.guard_userprofile = cmd.includes('if /i "%APPDIR%"=="%USERPROFILE%" goto unsafe');
c.guard_desktop = cmd.includes('%USERPROFILE%\\Desktop" goto unsafe');
c.guard_documents = cmd.includes('%USERPROFILE%\\Documents" goto unsafe');
c.guard_downloads = cmd.includes('%USERPROFILE%\\Downloads" goto unsafe');
c.guard_drive_root = cmd.includes('if "%APPDIR:~1,2%"==":\\" if "%APPDIR:~3,1%"=="" goto unsafe');

// link refusal on the app folder and every manifest dir
c.rejectlink_appdir = cmd.includes('call :rejectlink "%APPDIR%"');
c.rejectlink_each_dir = cmd.includes('do call :rejectlink "%APPDIR%\\%%D"');
c.rejectlink_attr_check = cmd.includes('if not "%A:l=%"=="%A%" (echo Refusing to continue:');

// manifest entry validation: absolute paths and .. abort before any delete
c.entry_rejects_dotdot = cmd.includes('if not "%F:..=%"=="%F%" (echo Bad install file list entry:');
c.entry_rejects_abs_slash = cmd.includes('if "%F:~0,1%"=="\\" (echo Bad install file list entry:');
c.entry_rejects_drive = cmd.includes('if "%F:~1,1%"==":" (echo Bad install file list entry:');

// startup entry removed only on EXACT match of this install's exe path
c.runentry_exact_match = cmd.includes("($v.Trim([char]34) -ieq $p)") && cmd.includes("'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'");

// notes deletion is explicit opt-in (ASK flow) and scoped to known app data
c.ask_flow_choice = cmd.includes('choice /c YNC') && cmd.includes('set "MODE=KEEP"');
c.deldata_optin = cmd.includes('if /i "%MODE%"=="DELDATA" call :deldata');
c.deldata_scoped = cmd.includes('set "DDIR=%APPDATA%\\AP Note Pad"') && cmd.includes('notes.json.bak*');
c.deldata_link_safe = cmd.includes('echo Data folder is a link - leaving it untouched.');

// only listed files deleted; folders removed only when empty (plain rmdir)
c.deletes_from_manifest = cmd.includes('for /f "usebackq delims=" %%F in ("%APPDIR%\\uninstall-files.txt") do call :delfile');
c.rmdir_not_recursive_on_manifest = /for \/f "usebackq delims=" %%D in \("%APPDIR%\\uninstall-dirs\.txt"\) do rmdir "%APPDIR%\\%%D" 2>nul/.test(cmd);

// requires the app exe and both manifests before deleting anything
c.requires_exe = cmd.includes('if not exist "%APPDIR%\\AP Note Pad.exe"');
c.requires_file_manifest = cmd.includes('if not exist "%APPDIR%\\uninstall-files.txt"');
c.requires_dir_manifest = cmd.includes('if not exist "%APPDIR%\\uninstall-dirs.txt"');

const failed = Object.keys(c).filter(k => !c[k]);
console.log(JSON.stringify(out, null, 2));
if (failed.length) { console.error('FAILED:', failed.join(', ')); process.exit(1); }
console.log('uninstall-cmd.test.js:', Object.keys(c).length, 'checks passed');
