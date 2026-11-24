!macro customUnInstall
  ; Ask once at uninstall time: also delete the notes/backups data folder?
  ; Deletion is narrowed to known app data; unrecognized personal files are kept.
  MessageBox MB_YESNO|MB_ICONQUESTION "Also permanently delete ALL notes, past days and saved backups in the AP Note Pad data folder?$\r$\n$\r$\nChoose No to keep them." IDYES apnp_deldata IDNO apnp_keepdata
  apnp_deldata:
    Delete "$APPDATA\AP Note Pad\notes.json*"
    RMDir /r "$APPDATA\AP Note Pad\Cache"
    RMDir /r "$APPDATA\AP Note Pad\Code Cache"
    RMDir /r "$APPDATA\AP Note Pad\GPUCache"
    RMDir /r "$APPDATA\AP Note Pad\DawnGraphiteCache"
    RMDir /r "$APPDATA\AP Note Pad\DawnWebGPUCache"
    RMDir /r "$APPDATA\AP Note Pad\Local Storage"
    RMDir /r "$APPDATA\AP Note Pad\Session Storage"
    RMDir /r "$APPDATA\AP Note Pad\Network"
    RMDir /r "$APPDATA\AP Note Pad\Crashpad"
    RMDir /r "$APPDATA\AP Note Pad\blob_storage"
    RMDir /r "$APPDATA\AP Note Pad\databases"
    RMDir /r "$APPDATA\AP Note Pad\IndexedDB"
    RMDir /r "$APPDATA\AP Note Pad\File System"
    RMDir /r "$APPDATA\AP Note Pad\Service Worker"
    RMDir /r "$APPDATA\AP Note Pad\shared_proto_db"
    RMDir /r "$APPDATA\AP Note Pad\Local State"
    Delete "$APPDATA\AP Note Pad\Local State"
    Delete "$APPDATA\AP Note Pad\Preferences"
    Delete "$APPDATA\AP Note Pad\config.json"
    RMDir "$APPDATA\AP Note Pad"
    IfFileExists "$APPDATA\AP Note Pad\*.*" 0 apnp_keepdata
      MessageBox MB_OK|MB_ICONINFORMATION "AP Note Pad data was removed, but some unrecognized files in the data folder were kept:$\r$\n$APPDATA\AP Note Pad"
  apnp_keepdata:
  ; Remove the Windows startup entry only if it points exactly at THIS executable.
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "AP Note Pad"
  StrCmp $0 '"$INSTDIR\AP Note Pad.exe"' 0 +3
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "AP Note Pad"
    Goto +6
  StrCmp $0 "$INSTDIR\AP Note Pad.exe" 0 +4
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "AP Note Pad"
    Goto +2
    ; entry left untouched: it does not belong to this install
!macroend
