!if "${INSTALLERICON}" != ""
  !ifndef MUI_UNICON
    !define MUI_UNICON "${INSTALLERICON}"
  !endif
  UninstallIcon "${INSTALLERICON}"
!endif