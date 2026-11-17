@echo off
chcp 65001 >nul
title Madrasa Assistant - Cloud Sync Setup
cd /d "%~dp0"
setlocal EnableExtensions

echo.
echo ===== تجهيز المزامنة المشفّرة على Cloudflare (مجاني، مرة واحدة فقط) =====
echo.

set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js غير مثبت. ثبّته من الصفحة التي ستُفتح ثم أعد المحاولة.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
set npm_config_audit=false
set npm_config_fund=false

node cloud\deploy.js
if errorlevel 1 (
  echo.
  echo  لم يكتمل التجهيز. صوّر هذه النافذة وأرسلها.
  pause
  exit /b 1
)
echo.
echo ===== تم بنجاح =====
echo  الخطوة التالية: شغّل Build-Installer.bat كمسؤول لبناء النسخة الجديدة.
echo.
pause
