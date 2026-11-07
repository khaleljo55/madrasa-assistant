# المساعد الإداري — بناء ملف التثبيت على هذا الجهاز
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
function Msg($text, $buttons = 'OK', $icon = 'Information') {
  return [System.Windows.Forms.MessageBox]::Show($text, 'المساعد الإداري', $buttons, $icon)
}

# 1) صلاحية المسؤول (يحتاجها ويندوز لفك بعض أدوات البناء)
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

$root = $PSScriptRoot
Set-Location $root
$log = Join-Path $root 'build-log.txt'
Start-Transcript -Path $log -Force | Out-Null

function Step($n, $text) { Write-Host ""; Write-Host "[$n/5] $text" -ForegroundColor Cyan }
function Fail($text) {
  Write-Host $text -ForegroundColor Red
  Stop-Transcript | Out-Null
  Msg ("$text`n`nسجل العملية محفوظ في:`n$log`nأرسله لي إن احتجت مساعدة.") 'OK' 'Error' | Out-Null
  exit 1
}

try {
  Write-Host "=== بناء ملف تثبيت المساعد الإداري ===" -ForegroundColor Green

  Step 1 "التحقق من Node.js"
  $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Start-Process 'https://nodejs.org/en/download'; Fail 'Node.js غير مثبت. ثبّته من الصفحة التي فُتحت ثم أعد المحاولة.' }
  Write-Host ("Node " + (& node -v))

  # خوادم تنزيل بديلة وسريعة لأدوات البناء
  $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  $env:npm_config_audit = 'false'
  $env:npm_config_fund = 'false'
  $mirrors = @{ ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'; ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/' }

  Step 2 "تنزيل أدوات البناء (أول مرة فقط، قد تستغرق بضع دقائق)"
  if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }
  & npm.cmd install --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail 'تعذّر تنزيل أدوات البناء. تأكد من اتصال الإنترنت ثم أعد المحاولة.' }

  Step 3 "بناء ملف التثبيت"
  $built = $false
  foreach ($useMirror in @($true, $false)) {
    foreach ($k in $mirrors.Keys) { if ($useMirror) { Set-Item "env:$k" $mirrors[$k] } else { Remove-Item "env:$k" -ErrorAction SilentlyContinue } }
    if (-not $useMirror) { Write-Host "إعادة المحاولة من الخادم الأصلي..." -ForegroundColor Yellow }
    & npx.cmd --no-install electron-builder --win nsis --x64 --publish never
    if ($LASTEXITCODE -eq 0) { $built = $true; break }
  }
  if (-not $built) { Fail 'تعذّر بناء ملف التثبيت.' }
  $setup = Get-ChildItem 'dist' -Filter '*Setup*.exe' | Select-Object -First 1
  if (-not $setup) { Fail 'لم يُعثر على ملف التثبيت بعد البناء.' }

  Step 4 "فحص البرنامج (سيفتح ويُغلق تلقائياً)"
  $exe = Get-ChildItem 'dist\win-unpacked' -Filter '*.exe' | Select-Object -First 1
  $out = Join-Path $env:TEMP 'madrasa-smoke'
  if (Test-Path $out) { Remove-Item $out -Recurse -Force }
  $p = Start-Process -FilePath $exe.FullName -ArgumentList "--smoke-test=$out" -PassThru
  if (-not $p.WaitForExit(120000)) { $p.Kill(); Fail 'انتهت مهلة فحص البرنامج.' }
  $reportFile = Join-Path $out 'smoke.json'
  if (-not (Test-Path $reportFile)) { Fail 'لم يكتمل فحص البرنامج.' }
  $report = Get-Content $reportFile -Raw -Encoding UTF8
  Write-Host $report
  Copy-Item $reportFile (Join-Path $root 'check-report.json') -Force
  if ($p.ExitCode -ne 0) { Fail 'البرنامج لم يجتز الفحص.' }
  Write-Host "اجتاز البرنامج الفحص: كل الأقسام تعمل، والحفظ يعمل." -ForegroundColor Green

  Step 5 "تم"
  $final = Join-Path $root $setup.Name
  Copy-Item $setup.FullName $final -Force
  Stop-Transcript | Out-Null
  $ans = Msg ("تم بناء ملف التثبيت بنجاح واجتاز الفحص ✓`n`n$($setup.Name)`n`nهل تريد تثبيت البرنامج الآن؟") 'YesNo' 'Information'
  if ($ans -eq 'Yes') { Start-Process $final } else { Start-Process explorer.exe "/select,`"$final`"" }
} catch {
  Fail ("حدث خطأ: " + $_.Exception.Message)
}
