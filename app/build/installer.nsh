!macro customHeader
  ManifestDPIAware true
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW nnInstShow
!macroend

!macro customFinishPage
  AutoCloseWindow true
  Page custom nnFinish
!macroend

!macro customInstall
  ${IfNot} ${Silent}
    ${If} $nnShortcut != 1
      Delete "$newDesktopLink"
    ${EndIf}
    ${If} $nnAutostart != 1
      CreateDirectory "$APPDATA\${PRODUCT_NAME}"
      FileOpen $0 "$APPDATA\${PRODUCT_NAME}\no-autostart" w
      FileClose $0
    ${EndIf}
  ${EndIf}
  Delete "$newStartMenuLink"
  CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, p 0, p 0)'
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -show'
!macroend

!macro customUnInstall
  SetAutoClose true
  ${IfNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
  ${EndIf}
!macroend

!macro nnPx OUT VALUE
  IntOp ${OUT} ${VALUE} * $nnS
  IntOp ${OUT} ${OUT} + 50
  IntOp ${OUT} ${OUT} / 100
!macroend

!macro nnClickable VAR X Y FILE CALLBACK
  !insertmacro nnPx $R8 ${X}
  !insertmacro nnPx $R9 ${Y}
  ${NSD_CreateBitmap} $R8 $R9 1 1 ""
  Pop ${VAR}
  ${NSD_SetImage} ${VAR} "$PLUGINSDIR\nn\${FILE}" $R7
  ${NSD_OnClick} ${VAR} ${CALLBACK}
!macroend

!macro nnColors HWND
  ${If} $nnDark == 1
    SetCtlColors ${HWND} A3ACBE 0C111B
  ${Else}
    SetCtlColors ${HWND} 46516A FFFFFF
  ${EndIf}
!macroend

!macro nnStatic X Y FILE
  !insertmacro nnPx $R8 ${X}
  !insertmacro nnPx $R9 ${Y}
  System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "", i 0x5400000E, i R8, i R9, i 1, i 1, p $nnDlg, p 0, p 0, p 0)p.R6'
  System::Call 'user32::LoadImageW(p 0, w "$PLUGINSDIR\nn\${FILE}", i 0, i 0, i 0, i 0x10)p.R7'
  SendMessage $R6 0x172 0 $R7
!macroend

!macro nnWidth OUT NAME
  ${If} $nnLang == tr
    StrCpy ${OUT} ${NN_${NAME}_W_tr}
  ${Else}
    StrCpy ${OUT} ${NN_${NAME}_W_en}
  ${EndIf}
!macroend

!macro nnCommon
  !include "setup\art\art.nsh"
  !ifdef BUILD_UNINSTALLER
    !define NN_UN un.
  !else
    !define NN_UN ""
  !endif

  Var nnReady
  Var nnSet
  Var nnS
  Var nnLang
  Var nnDark
  Var nnAccent
  Var nnTrack
  Var nnFont
  Var nnW
  Var nnH
  Var nnDlg

  Function ${NN_UN}nnPrepare
    ${If} $nnReady == 1
      Return
    ${EndIf}
    StrCpy $nnReady 1
    !ifndef BUILD_UNINSTALLER
      StrCpy $nnAutostart 1
      StrCpy $nnShortcut 0
      StrCpy $nnLaunch 1
    !endif
    InitPluginsDir
    CreateDirectory "$PLUGINSDIR\nn"

    StrCpy $nnLang en
    ${If} $LANGUAGE == 1055
      StrCpy $nnLang tr
    ${EndIf}

    ClearErrors
    ReadRegDWORD $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" AppsUseLightTheme
    ${If} $0 == 1
      StrCpy $1 light
      StrCpy $nnDark 0
      StrCpy $nnAccent 0xDC580B
      StrCpy $nnTrack 0xEDEBEA
    ${Else}
      StrCpy $1 dark
      StrCpy $nnDark 1
      StrCpy $nnAccent 0xF5C73B
      StrCpy $nnTrack 0x342A25
    ${EndIf}

    System::Call 'user32::GetDpiForSystem()i.r0'
    StrCpy $nnS 100
    ${If} $0 >= 192
      StrCpy $nnS 200
    ${ElseIf} $0 >= 144
      StrCpy $nnS 150
    ${ElseIf} $0 >= 120
      StrCpy $nnS 125
    ${EndIf}

    StrCpy $nnSet "$1-$nnLang-$nnS"
    !insertmacro nnExtractArt

    File "/oname=$PLUGINSDIR\nn\rem.ttf" "${BUILD_RESOURCES_DIR}\setup\fonts\REM-Light.ttf"
    System::Call 'gdi32::AddFontResourceExW(w "$PLUGINSDIR\nn\rem.ttf", i 0x10, p 0)'
    IntOp $0 $nnS * 135
    IntOp $0 $0 + 500
    IntOp $0 $0 / 1000
    IntOp $0 0 - $0
    System::Call 'gdi32::CreateFontW(i r0, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w "REM Light")p.r0'
    StrCpy $nnFont $0

    !insertmacro nnPx $nnW 560
    !insertmacro nnPx $nnH 464

    System::Call '*(i, i, i, i)p.r1'
    System::Call 'user32::SystemParametersInfoW(i 0x30, i 0, p r1, i 0)'
    System::Call '*$1(i.r2, i.r3, i.r4, i.r5)'
    System::Free $1
    IntOp $6 $4 - $2
    IntOp $6 $6 - $nnW
    IntOp $6 $6 / 2
    IntOp $6 $6 + $2
    IntOp $7 $5 - $3
    IntOp $7 $7 - $nnH
    IntOp $7 $7 / 2
    IntOp $7 $7 + $3

    System::Call 'user32::GetWindowLongW(p $HWNDPARENT, i -16)i.r0'
    IntOp $0 $0 & 0xFF30FFFF
    System::Call 'user32::SetWindowLongW(p $HWNDPARENT, i -16, i r0)'
    System::Call 'user32::GetWindowLongW(p $HWNDPARENT, i -20)i.r0'
    IntOp $0 $0 & 0xFFFFFCFE
    System::Call 'user32::SetWindowLongW(p $HWNDPARENT, i -20, i r0)'
    System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i r6, i r7, i $nnW, i $nnH, i 0x24)'

    !insertmacro nnPx $0 32
    IntOp $1 $nnW + 1
    IntOp $2 $nnH + 1
    System::Call 'gdi32::CreateRoundRectRgn(i 0, i 0, i r1, i r2, i r0, i r0)p.r3'
    System::Call 'user32::SetWindowRgn(p $HWNDPARENT, p r3, i 1)'
  FunctionEnd

  Function ${NN_UN}nnChrome
    GetDlgItem $0 $HWNDPARENT 1018
    System::Call 'user32::SetWindowPos(p r0, p 0, i 0, i 0, i $nnW, i $nnH, i 0x14)'
    System::Call 'user32::GetWindow(p $HWNDPARENT, i 5)p.r0'
    ${DoWhile} $0 != 0
      System::Call 'user32::GetClassNameW(p r0, w .r2, i 64)'
      ${If} $2 != "#32770"
        ShowWindow $0 ${SW_HIDE}
      ${EndIf}
      System::Call 'user32::GetWindow(p r0, i 2)p.r0'
    ${Loop}
  FunctionEnd

  Function ${NN_UN}nnPath
    !insertmacro nnPx $1 34
    !insertmacro nnPx $2 128
    !insertmacro nnPx $3 494
    !insertmacro nnPx $4 20
    System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "$INSTDIR", i 0x5400C200, i r1, i r2, i r3, i r4, p $nnDlg, p 0, p 0, p 0)p.r0'
    SendMessage $0 ${WM_SETFONT} $nnFont 1
    !insertmacro nnColors $0
  FunctionEnd

  Function ${NN_UN}nnBackground
    Exch $0
    ${NSD_CreateBitmap} 0 0 1 1 ""
    Pop $1
    ${NSD_SetImage} $1 "$PLUGINSDIR\nn\$0" $2
    ${NSD_OnClick} $1 ${NN_UN}nnDrag
    System::Call 'user32::SetWindowPos(p r1, p 1, i 0, i 0, i 0, i 0, i 0x13)'
    Pop $0
  FunctionEnd

  Function ${NN_UN}nnDrag
    Pop $0
    System::Call 'user32::ReleaseCapture()'
    SendMessage $HWNDPARENT 0xA1 2 0
  FunctionEnd

  Function ${NN_UN}nnCancel
    Pop $0
    SendMessage $HWNDPARENT ${WM_COMMAND} 2 0
  FunctionEnd

  Function ${NN_UN}nnNext
    Pop $0
    SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
  FunctionEnd

  Function ${NN_UN}nnProgress
    Call ${NN_UN}nnChrome
    FindWindow $nnDlg "#32770" "" $HWNDPARENT
    !insertmacro nnColors $nnDlg
    System::Call 'user32::SetWindowPos(p $nnDlg, p 0, i 0, i 0, i $nnW, i $nnH, i 0x14)'
    GetDlgItem $0 $nnDlg 1016
    ShowWindow $0 ${SW_HIDE}
    GetDlgItem $0 $nnDlg 1027
    ShowWindow $0 ${SW_HIDE}
    GetDlgItem $0 $nnDlg 1006
    ShowWindow $0 ${SW_HIDE}

    GetDlgItem $0 $nnDlg 1004
    System::Call 'uxtheme::SetWindowTheme(p r0, w "", w "")'
    System::Call 'user32::GetWindowLongW(p r0, i -16)i.r1'
    IntOp $1 $1 & 0xFF7FFFFF
    System::Call 'user32::SetWindowLongW(p r0, i -16, i r1)'
    System::Call 'user32::GetWindowLongW(p r0, i -20)i.r1'
    IntOp $1 $1 & 0xFFFDFDFF
    System::Call 'user32::SetWindowLongW(p r0, i -20, i r1)'
    SendMessage $0 0x409 0 $nnAccent
    SendMessage $0 0x2001 0 $nnTrack
    !insertmacro nnPx $1 32
    !insertmacro nnPx $2 268
    !insertmacro nnPx $3 496
    !insertmacro nnPx $4 5
    System::Call 'user32::SetWindowPos(p r0, p 0, i r1, i r2, i r3, i r4, i 0x34)'

    Call ${NN_UN}nnPath
  FunctionEnd
!macroend

!macro customWelcomePage
  Var nnAutostart
  Var nnShortcut
  Var nnLaunch
  Var nnRow1
  Var nnRow2
  Var nnLaunchRow

  !insertmacro nnCommon

  Page custom nnWelcome

  Function nnOnOff
    Exch $0
    ${If} $0 == 1
      StrCpy $0 on
    ${Else}
      StrCpy $0 off
    ${EndIf}
    Exch $0
  FunctionEnd

  Function nnWelcome
    Call nnPrepare
    Call nnChrome
    nsDialogs::Create 1018
    Pop $nnDlg
    !insertmacro nnColors $nnDlg
    Call nnPath
    !insertmacro nnWidth $R0 PRIMARY
    !insertmacro nnWidth $R1 CANCEL
    IntOp $R2 528 - $R0
    IntOp $R3 $R2 - 12
    IntOp $R3 $R3 - $R1

    Push $nnAutostart
    Call nnOnOff
    Pop $0
    !insertmacro nnClickable $nnRow1 22 166 "row1-$0.bmp" nnToggleAutostart
    Push $nnShortcut
    Call nnOnOff
    Pop $0
    !insertmacro nnClickable $nnRow2 22 210 "row2-$0.bmp" nnToggleShortcut
    !insertmacro nnClickable $0 512 16 "close.bmp" nnCancel
    !insertmacro nnClickable $0 $R3 337 "cancel.bmp" nnCancel
    !insertmacro nnClickable $0 $R2 337 "install.bmp" nnNext

    Push welcome.bmp
    Call nnBackground
    nsDialogs::Show
  FunctionEnd

  Function nnToggleAutostart
    Pop $0
    IntOp $nnAutostart $nnAutostart ^ 1
    Push $nnAutostart
    Call nnOnOff
    Pop $0
    ${NSD_SetImage} $nnRow1 "$PLUGINSDIR\nn\row1-$0.bmp" $1
  FunctionEnd

  Function nnToggleShortcut
    Pop $0
    IntOp $nnShortcut $nnShortcut ^ 1
    Push $nnShortcut
    Call nnOnOff
    Pop $0
    ${NSD_SetImage} $nnRow2 "$PLUGINSDIR\nn\row2-$0.bmp" $1
  FunctionEnd

  Function nnInstShow
    Call nnProgress
    Push $nnAutostart
    Call nnOnOff
    Pop $0
    !insertmacro nnStatic 22 166 "dim1-$0.bmp"
    Push $nnShortcut
    Call nnOnOff
    Pop $0
    !insertmacro nnStatic 22 210 "dim2-$0.bmp"
    !insertmacro nnStatic 0 0 "installing.bmp"
    System::Call 'user32::SetWindowPos(p R6, p 1, i 0, i 0, i 0, i 0, i 0x13)'
  FunctionEnd

  Function nnFinish
    Call nnChrome
    nsDialogs::Create 1018
    Pop $nnDlg
    !insertmacro nnColors $nnDlg
    Call nnPath
    !insertmacro nnWidth $R0 FINISH
    IntOp $R2 528 - $R0

    Push $nnLaunch
    Call nnOnOff
    Pop $0
    !insertmacro nnClickable $nnLaunchRow 22 166 "launch-$0.bmp" nnToggleLaunch
    !insertmacro nnClickable $0 $R2 337 "done.bmp" nnDone

    Push finish.bmp
    Call nnBackground
    nsDialogs::Show
  FunctionEnd

  Function nnToggleLaunch
    Pop $0
    IntOp $nnLaunch $nnLaunch ^ 1
    Push $nnLaunch
    Call nnOnOff
    Pop $0
    ${NSD_SetImage} $nnLaunchRow "$PLUGINSDIR\nn\launch-$0.bmp" $1
  FunctionEnd

  Function nnDone
    Pop $0
    ${If} $nnLaunch == 1
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
    ${EndIf}
    SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
  FunctionEnd
!macroend

!macro customUnWelcomePage
  !insertmacro nnCommon

  UninstPage custom un.nnUnWelcome
  !include "uninstfiles.nsh"

  Function un.nnUnWelcome
    Call un.nnPrepare
    Call un.nnChrome
    nsDialogs::Create 1018
    Pop $nnDlg
    !insertmacro nnColors $nnDlg
    Call un.nnPath
    !insertmacro nnWidth $R0 UNINSTALL
    !insertmacro nnWidth $R1 CANCEL
    IntOp $R2 528 - $R0
    IntOp $R3 $R2 - 12
    IntOp $R3 $R3 - $R1

    !insertmacro nnClickable $0 512 16 "close.bmp" un.nnCancel
    !insertmacro nnClickable $0 $R3 337 "cancel.bmp" un.nnCancel
    !insertmacro nnClickable $0 $R2 337 "uninstall.bmp" un.nnNext

    Push unwelcome.bmp
    Call un.nnBackground
    nsDialogs::Show
  FunctionEnd

  Function un.nnUnShow
    Call un.nnProgress
    !insertmacro nnStatic 0 0 "uninstalling.bmp"
    System::Call 'user32::SetWindowPos(p R6, p 1, i 0, i 0, i 0, i 0, i 0x13)'
  FunctionEnd
!macroend

!macro customUninstallPage
  UninstPage custom un.nnUnFinish
  !define MUI_PAGE_CUSTOMFUNCTION_PRE un.nnSkip

  Function un.nnUnFinish
    Call un.nnChrome
    nsDialogs::Create 1018
    Pop $nnDlg
    !insertmacro nnColors $nnDlg
    Call un.nnPath
    !insertmacro nnWidth $R0 FINISH
    IntOp $R2 528 - $R0
    !insertmacro nnClickable $0 $R2 337 "done.bmp" un.nnNext

    Push unfinish.bmp
    Call un.nnBackground
    nsDialogs::Show
  FunctionEnd

  Function un.nnSkip
    Abort
  FunctionEnd
!macroend
