@echo off
chcp 65001 >nul
title Madrasa Assistant - Build
cd /d "%~dp0"
setlocal EnableExtensions

echo.
echo ===== بناء ملف تثبيت «المساعد الإداري» =====
echo.

REM صلاحية المسؤول مطلوبة لفك أدوات البناء
net session >nul 2>&1
if errorlevel 1 (
  echo  يحتاج البناء صلاحية المسؤول.
  echo  اضغط بالزر الأيمن على Build-Installer.bat واختر «تشغيل كمسؤول» Run as administrator
  echo.
  pause
  exit /b 1
)

set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js غير مثبت. ثبّته من الصفحة التي ستُفتح ثم أعد المحاولة.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
for /f "tokens=2 delims=:, " %%V in ('findstr /c:"\"version\"" package.json') do set "VER=%%~V"
echo  الإصدار: %VER%
set CSC_IDENTITY_AUTO_DISCOVERY=false
set npm_config_audit=false
set npm_config_fund=false
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

echo.
echo [1/4] تنزيل أدوات البناء (أول مرة قد تستغرق بضع دقائق)
if exist dist rmdir /s /q dist
call npm install --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto fail

echo.
echo [2/4] بناء ملف التثبيت
call npx --no-install electron-builder --win nsis --x64 --publish never
if errorlevel 1 (
  echo  إعادة المحاولة من الخادم الأصلي...
  set ELECTRON_MIRROR=
  set ELECTRON_BUILDER_BINARIES_MIRROR=
  call npx --no-install electron-builder --win nsis --x64 --publish never
  if errorlevel 1 goto fail
)
set "SETUP="
for %%F in (dist\*Setup*.exe) do set "SETUP=%%~nxF"
if not defined SETUP goto fail

echo.
echo [3/4] فحص البرنامج (سيفتح ويُغلق تلقائياً)
set "OUT=%TEMP%\madrasa-smoke"
if exist "%OUT%" rmdir /s /q "%OUT%"
set "APPEXE="
for %%E in (dist\win-unpacked\*.exe) do set "APPEXE=%%E"
start "" /wait "%APPEXE%" --smoke-test="%OUT%"
set "SMOKE=%errorlevel%"
if not exist "%OUT%\smoke.json" (
  echo  لم يكتمل فحص البرنامج.
  goto fail
)
copy /y "%OUT%\smoke.json" check-report.json >nul
if not "%SMOKE%"=="0" (
  type check-report.json
  echo  البرنامج لم يجتز الفحص. أرسل الملف check-report.json للمطوّر.
  goto fail
)
echo  اجتاز البرنامج الفحص: كل الأقسام تعمل، والحفظ يعمل.
copy /y "dist\%SETUP%" "%SETUP%" >nul

echo.
echo [4/4] تم بناء ملف التثبيت بنجاح: %SETUP%
echo.

REM النشر في صفحة الإصدارات (اختياري)
set "PUBURL=https://github.com/khaleljo55/madrasa-assistant/releases/new?tag=v%VER%"
where gh >nul 2>&1
if errorlevel 1 goto manualpub
choice /c YN /m "هل تريد نشر الإصدار %VER% تحديثاً تلقائياً (Y نعم / N لا)"
if errorlevel 2 goto install
gh auth status >nul 2>&1
if errorlevel 1 (
  echo  سجّل الدخول إلى GitHub مرة واحدة: اضغط Enter ثم انسخ الرمز إلى المتصفح.
  gh auth login --hostname github.com --git-protocol https --web
)
gh release view v%VER% -R khaleljo55/madrasa-assistant >nul 2>&1
if errorlevel 1 (
  gh release create v%VER% "%SETUP%" -R khaleljo55/madrasa-assistant --target main --title "المساعد الإداري %VER%" --notes-file RELEASE.md --latest
) else (
  gh release upload v%VER% "%SETUP%" -R khaleljo55/madrasa-assistant --clobber
)
if errorlevel 1 (
  echo  تعذّر النشر التلقائي؛ سيُفتح النشر اليدوي.
  goto manualpub
)
echo  نُشر التحديث %VER% بنجاح.
goto install

:manualpub
choice /c YN /m "هل تريد فتح صفحة نشر التحديث في GitHub لرفع الملف يدوياً (Y نعم / N لا)"
if errorlevel 2 goto install
start "" "%PUBURL%"
explorer /select,"%CD%\%SETUP%"
echo  اسحب الملف %SETUP% إلى مربع Attach binaries ثم اضغط Publish release.

:install
echo.
choice /c YN /m "هل تريد تثبيت البرنامج على هذا الجهاز الآن (Y نعم / N لا)"
if errorlevel 2 (
  explorer /select,"%CD%\%SETUP%"
  goto end
)
start "" "%SETUP%"
goto end

:fail
echo.
echo  ===== لم يكتمل البناء =====
echo  صوّر هذه النافذة وأرسلها للمطوّر.

:end
echo.
pause
