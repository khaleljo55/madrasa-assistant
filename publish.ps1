# المساعد الإداري — نشر ملف التثبيت في صفحة الإصدارات على GitHub (اختياري)
# يعمل من جهاز صاحب المشروع وبحسابه. لا يثبّت أي برنامج بنفسه.
param([string]$Final)
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
function Msg($text, $buttons = 'OK', $icon = 'Information') { return [System.Windows.Forms.MessageBox]::Show($text, 'المساعد الإداري', $buttons, $icon) }
$root = $PSScriptRoot
$repo = 'khaleljo55/madrasa-assistant'
$ver = (Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version

$ans = Msg "تم بناء ملف التثبيت ✓`n`nهل تريد نشر الإصدار $ver تحديثاً تلقائياً للبرنامج؟`n(يظهر للمستخدمين شريط «يتوفر إصدار جديد»)" 'YesNo' 'Question'
if ($ans -ne 'Yes') { return }

$env:Path = "$env:ProgramFiles\GitHub CLI;$env:LOCALAPPDATA\Programs\GitHub CLI;$env:Path"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Start-Process 'https://cli.github.com'
  Msg "للنشر تحتاج أداة GitHub الرسمية (مرة واحدة فقط):`n`n1) نزّلها من الصفحة التي فُتحت (Download for Windows) وثبّتها`n2) أعد تشغيل Build-Installer.bat`n`nملف التثبيت جاهز الآن ويمكنك استخدامه." 'OK' 'Information' | Out-Null
  return
}
gh auth status --hostname github.com 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Msg "سجّل الدخول إلى GitHub مرة واحدة فقط:`n`n1) اضغط Enter في النافذة السوداء فيُفتح المتصفح`n2) انسخ الرمز الظاهر في النافذة والصقه في المتصفح`n3) وافق`n`nيُحفظ الدخول في هذا الجهاز فقط." 'OK' 'Information' | Out-Null
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { Msg 'لم يكتمل تسجيل الدخول؛ لم يُنشر التحديث.' 'OK' 'Warning' | Out-Null; return }
}
# وصف الإصدار من سجل الإصدارات
$lines = Get-Content (Join-Path $root 'CHANGELOG.md') -Encoding UTF8
$notes = @(); $in = $false
foreach ($l in $lines) { if ($l -like '## *') { if ($in) { break }; if ($l -like "## $ver *") { $in = $true; continue } }; if ($in) { $notes += $l } }
$nf = Join-Path $env:TEMP "madrasa-notes-$ver.md"
[IO.File]::WriteAllText($nf, (($notes -join "`n").Trim() + "`n`nالتحديث يحافظ على كل البيانات."), (New-Object Text.UTF8Encoding $false))
$tag = "v$ver"
gh release view $tag -R $repo 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { gh release upload $tag $Final -R $repo --clobber }
else { gh release create $tag $Final -R $repo --target main --title "المساعد الإداري $ver" --notes-file $nf --latest }
if ($LASTEXITCODE -eq 0) { Msg "نُشر التحديث $ver بنجاح ✓`n`nسيظهر للمستخدمين شريط «يتوفر إصدار جديد» عند فتح البرنامج." 'OK' 'Information' | Out-Null }
else { Msg 'رفض GitHub رفع الملف؛ ملف التثبيت جاهز ويمكن إرساله يدوياً.' 'OK' 'Warning' | Out-Null }
