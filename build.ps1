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

function Step($n, $text) { Write-Host ""; Write-Host "[$n/6] $text" -ForegroundColor Cyan }
function Fail($text) {
  Write-Host $text -ForegroundColor Red
  Stop-Transcript | Out-Null
  Msg ("$text`n`nسجل العملية محفوظ في:`n$log`nأرسله لي إن احتجت مساعدة.") 'OK' 'Error' | Out-Null
  exit 1
}

# ─── النشر في صفحة الإصدارات على GitHub (من هذا الجهاز وبحساب صاحبه) ───
$Repo = 'khaleljo55/madrasa-assistant'
function Find-Gh {
  $env:Path = "$env:ProgramFiles\GitHub CLI;$env:LOCALAPPDATA\Programs\GitHub CLI;$env:Path"
  return (Get-Command gh -ErrorAction SilentlyContinue)
}
function Publish-Release($ver, $file) {
  $ErrorActionPreference = 'Continue'  # رسائل أداة GitHub تُكتب في stderr ولا تعني فشلاً
  if (-not (Find-Gh)) {
    Write-Host "تثبيت أداة GitHub (مرة واحدة فقط)..." -ForegroundColor Yellow
    & winget install --id GitHub.cli -e --silent --accept-source-agreements --accept-package-agreements | Out-Host
    if (-not (Find-Gh)) { throw 'تعذّر تثبيت أداة GitHub تلقائياً. ثبّتها من https://cli.github.com ثم أعد البناء.' }
  }
  & gh auth status --hostname github.com *> $null
  if ($LASTEXITCODE -ne 0) {
    Msg "سيُطلب منك الآن تسجيل الدخول إلى GitHub مرة واحدة فقط:`n`n1) اضغط Enter في النافذة السوداء فيُفتح المتصفح`n2) انسخ الرمز الظاهر في النافذة والصقه في المتصفح`n3) وافق على الصلاحية`n`nيُحفظ الدخول في هذا الجهاز فقط." 'OK' 'Information' | Out-Null
    & gh auth login --hostname github.com --git-protocol https --web --scopes repo
    if ($LASTEXITCODE -ne 0) { throw 'لم يكتمل تسجيل الدخول إلى GitHub.' }
  }
  $tag = "v$ver"
  # وصف الإصدار من سجل الإصدارات
  $log = Get-Content (Join-Path $root 'CHANGELOG.md') -Encoding UTF8
  $notes = @(); $in = $false
  foreach ($l in $log) { if ($l -match '^## ') { if ($in) { break }; if ($l -match "^## $([regex]::Escape($ver))\b") { $in = $true; continue } }; if ($in) { $notes += $l } }
  $notes = (($notes -join "`n").Trim()) + "`n`nالتحديث يحافظ على كل البيانات."
  $nf = Join-Path $env:TEMP "madrasa-notes-$ver.md"
  [IO.File]::WriteAllText($nf, $notes, (New-Object Text.UTF8Encoding $false))
  & gh release view $tag -R $Repo *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "الإصدار $tag موجود؛ تحديث ملف التثبيت فيه..."
    & gh release upload $tag $file -R $Repo --clobber
  } else {
    & gh release create $tag $file -R $Repo --target main --title "المساعد الإداري $ver" --notes-file $nf --latest
  }
  if ($LASTEXITCODE -ne 0) { throw 'رفض GitHub رفع الملف.' }
  Write-Host "نُشر التحديث $tag ✓ سيظهر للمستخدمين تلقائياً." -ForegroundColor Green
  Msg "نُشر التحديث $ver بنجاح ✓`n`nسيظهر في برنامج الأستاذة هدى شريط «يتوفر إصدار جديد» عند فتحه، وتحدّثه بضغطة زر." 'OK' 'Information' | Out-Null
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

  Step 5 "تم بناء ملف التثبيت"
  $final = Join-Path $root $setup.Name
  Copy-Item $setup.FullName $final -Force

  Step 6 "نشر التحديث عبر GitHub"
  $ver = (Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
  $pub = Msg ("تم بناء ملف التثبيت بنجاح واجتاز الفحص ✓`n`n$($setup.Name)`n`nهل تريد نشره الآن تحديثاً تلقائياً للبرنامج؟`n(يظهر للمستخدمين شريط «يتوفر إصدار جديد»)") 'YesNo' 'Question'
  if ($pub -eq 'Yes') {
    try { Publish-Release $ver $final } catch { Write-Host ("تعذّر النشر: " + $_.Exception.Message) -ForegroundColor Red; Msg ("لم يُنشر التحديث، لكن ملف التثبيت جاهز.`n`n" + $_.Exception.Message + "`n`nيمكنك إعادة تشغيل البناء لاحقاً للنشر.") 'OK' 'Warning' | Out-Null }
  }

  Stop-Transcript | Out-Null
  $ans = Msg ("ملف التثبيت جاهز:`n$($setup.Name)`n`nهل تريد تثبيت البرنامج على هذا الجهاز الآن؟") 'YesNo' 'Information'
  if ($ans -eq 'Yes') { Start-Process $final } else { Start-Process explorer.exe "/select,`"$final`"" }
} catch {
  Fail ("حدث خطأ: " + $_.Exception.Message)
}
