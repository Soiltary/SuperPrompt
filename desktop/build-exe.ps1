# Builds desktop\out\SuperPrompt.exe with the C# compiler that ships with Windows, embedding deploy\site
# (the same files as the website, without the download folder and _headers), then packs the portable ZIP.
param([string]$Version = '2.1.1')
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$site = Join-Path $proj 'deploy\site'
$out = Join-Path $PSScriptRoot 'out'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory $out | Out-Null
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$rsp = Join-Path $out 'resources.rsp'
$lines = @()
Get-ChildItem $site -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($site.Length + 1)
  -not $rel.StartsWith('download\') -and $_.Name -ne '_headers' -and $_.Name -ne 'release.json' -and $rel -ne '404.html'
} | ForEach-Object {
  $rel = $_.FullName.Substring($site.Length + 1) -replace '\\', '/'
  $lines += ('/resource:"{0}",site/{1}' -f $_.FullName, $rel)
}
$lines | Set-Content $rsp -Encoding UTF8
$exe = Join-Path $out 'SuperPrompt.exe'
$icon = Join-Path $proj 'experiments\brand\SuperPrompt.ico'
# official Microsoft WebView2 SDK 1.0.4314.35 (nuget.org, Microsoft-signed), redistributed next to the exe
$wv = Join-Path $PSScriptRoot 'vendor\webview2-1.0.4314.35'
$wvCore = Join-Path $wv 'lib\net462\Microsoft.Web.WebView2.Core.dll'
$wvForms = Join-Path $wv 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'
$wvLoader = Join-Path $wv 'runtimes\win-x64\native\WebView2Loader.dll'
& $csc /nologo /target:winexe /optimize+ /platform:x64 "/win32icon:$icon" "/out:$exe" `
  /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.dll "/reference:$wvCore" "/reference:$wvForms" `
  "@$rsp" (Join-Path $PSScriptRoot 'SuperPromptApp.cs')
if ($LASTEXITCODE -ne 0) { throw "csc failed" }
Copy-Item $wvCore, $wvForms, $wvLoader $out
"embedded files: $($lines.Count)"
"exe: $((Get-Item $exe).Length) bytes, version $((Get-Item $exe).VersionInfo.ProductVersion)"

# portable ZIP: the exe, a bilingual readme and the font licence
$pkg = Join-Path $out ("SuperPrompt-$Version-windows-x64-portable")
New-Item -ItemType Directory $pkg | Out-Null
Copy-Item $exe, (Join-Path $out 'Microsoft.Web.WebView2.Core.dll'), (Join-Path $out 'Microsoft.Web.WebView2.WinForms.dll'), (Join-Path $out 'WebView2Loader.dll') $pkg
Copy-Item (Join-Path $site 'fonts\OFL.txt') (Join-Path $pkg 'FONT-LICENSE-OFL.txt')
Copy-Item (Join-Path $wv 'LICENSE.txt') (Join-Path $pkg 'WebView2-SDK-LICENSE.txt')
Copy-Item (Join-Path $wv 'NOTICE.txt') (Join-Path $pkg 'WebView2-SDK-NOTICE.txt')
@"
SuperPrompt $Version for Windows (portable)
=============================================

English
- Double-click SuperPrompt.exe. It opens in its own window and works fully offline.
- No account, no subscription, no installation. Your prompts and settings stay on this PC
  (in %LOCALAPPDATA%\SuperPrompt).
- Move your history between the website and this app with History > Export / Import.
- Keep the files of this folder together (SuperPrompt.exe needs the three WebView2 DLLs next to it).
- Uses the Microsoft WebView2 runtime that ships with Windows 10 and 11. If it is missing, the app
  opens in Microsoft Edge, Google Chrome or Brave instead.
- The file is not code-signed, so Windows SmartScreen may ask once: More info > Run anyway.
- Close the window to stop the app.

العربية
- دبل كلك على SuperPrompt.exe. يفتح في نافذته الخاصة ويشتغل كامل بدون إنترنت
- بدون حساب ولا اشتراك ولا تثبيت. برومبتاتك وإعداداتك تبقى على جهازك
  (في %LOCALAPPDATA%\SuperPrompt)
- انقل سجلك بين الموقع والبرنامج من السجل > تصدير / استيراد
- خلّ ملفات المجلد مع بعض (SuperPrompt.exe يحتاج ملفات WebView2 الثلاثة جنبه)
- يستخدم محرك Microsoft WebView2 الموجود في ويندوز 10 و11، وإذا ما لقاه يفتح في Edge أو Chrome أو Brave
- الملف غير موقّع رقميًا، فممكن يطلب Windows SmartScreen تأكيد مرة وحدة: More info ثم Run anyway
- اقفل النافذة لإيقاف البرنامج

Links / الروابط
- Website / الموقع:   https://superprompt.pages.dev/
- Source / المصدر:    https://github.com/Soiltary/SuperPrompt
- Support / دعم:      https://tip.dokan.sa/solitary
- X:                  https://x.com/Soiltary
"@ | Set-Content (Join-Path $pkg 'README.txt') -Encoding UTF8
$dist = Join-Path $proj 'deploy\dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zipName = "SuperPrompt-$Version-windows-x64-portable.zip"
$zip = Join-Path $dist $zipName
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $pkg '*') -DestinationPath $zip
$z = Get-Item $zip
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
"zip: $zipName  $($z.Length) bytes  sha256 $hash"
