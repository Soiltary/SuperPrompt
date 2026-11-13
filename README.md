<div align="center">

<img src="experiments/brand/v3/logo-256.png" width="120" height="120" alt="SuperPrompt">

# SuperPrompt

**Write what you need in your own words. SuperPrompt turns it into a clear, structured prompt**

[Website](https://superprompt.pages.dev/) · [Download for Windows](https://github.com/Soiltary/SuperPrompt/releases/latest) · [Support](https://tip.dokan.sa/solitary) · [X @Soiltary](https://x.com/Soiltary) · [MIT License](LICENSE)

[العربية](#العربية) · [English](#english)

</div>

## English

SuperPrompt is a prompt builder that runs entirely on your device. Describe a task in Saudi dialect, formal Arabic or English, and it writes a structured prompt you can paste into Claude, ChatGPT, Gemini, Copilot, Codex or any other assistant.

- Works offline: no account, no subscription, no AI calls, no analytics. Nothing you type leaves your device
- 10 modes plus Auto, three detail levels, prompts in 10 output languages
- Keeps paths, versions, error codes and names exactly as you wrote them
- History with search, export and import (move it between the website and the Windows app)
- Arabic and English interface, right-to-left and left-to-right, light and dark themes

### Use it

| | |
|---|---|
| In the browser | https://superprompt.pages.dev/app/ (the home page https://superprompt.pages.dev/ has the demo video and the download) |
| On Windows | [Latest release](https://github.com/Soiltary/SuperPrompt/releases/latest): `SuperPrompt-<version>-windows-x64-portable.zip` |

**Windows app:** download the ZIP, unzip it, then open `SuperPrompt.exe`. No installation. Windows 10 and 11, 64-bit. The app opens in its own window using the Microsoft WebView2 runtime that ships with Windows, and keeps your data in `%LOCALAPPDATA%\SuperPrompt`. The file is not code-signed, so SmartScreen may ask once: **More info → Run anyway**. Compare the file with the SHA-256 listed in the release.

### Build it

Requirements: Windows 10 or 11, Python 3.11+, Node.js 24+, Windows PowerShell 5.1 and the C# compiler of .NET Framework 4 (included in Windows).

```powershell
# 1. Generate the pages into app\ (content lives in experiments\page-generator\*.py)
python experiments\page-generator\build.py app

# 2. Try it locally: double-click app\Start SuperPrompt.bat  (http://127.0.0.1:8765/)

# 3. Build the website folder deploy\site
powershell -File deploy\make-site.ps1

# 4. Build the Windows app (first time: fetch the WebView2 SDK from nuget.org)
powershell -File desktop\get-webview2.ps1
powershell -File desktop\build-exe.ps1 -Version 2.2.0    # -> deploy\dist\SuperPrompt-2.2.0-windows-x64-portable.zip
```

Logo, icons and the demo video (only when they change):

```powershell
# transparent logo in every size from the approved artwork, then SuperPrompt.ico and the app icons
node experiments\brand\make-logo.js <logo image> experiments\brand\v3
powershell -File experiments\brand\make-icons.ps1
# demo video (Arabic and English) recorded from the real generator; needs ffmpeg with libx264
node experiments\video\record-demo.js <path to ffmpeg.exe> both
```

Publishing the website (Cloudflare Pages, project `superprompt`):

```powershell
cd deploy
npm install
# release.next.json describes the package: version, file, size, SHA-256
powershell -File make-site.ps1 -WithDownload -ShowButton
npx wrangler pages deploy site --project-name superprompt --branch main
```

### Project layout

| Folder | What it holds |
|---|---|
| `app/` | The website and app: engine (`prompt-lexicon.js`, `prompt-engine.js`, `generator.js`), interface (`app.js`, `storage.js`, styles), generated pages, local launcher |
| `experiments/page-generator/` | Page generator and all interface text in Arabic and English |
| `experiments/brand/` | Logo (`v3/`), icons and the scripts that make them |
| `desktop/` | Windows app (`SuperPromptApp.cs`), build script and tests |
| `deploy/` | Website build and publishing scripts |
| `deploy/landing/` | The home page of the website: intro, demo video with Arabic and English subtitles, download and support (not part of the Windows app) |
| `experiments/video/` | Script that records the demo video from the generator |

### License

SuperPrompt is released under the [MIT License](LICENSE). Third-party components keep their own licenses:

- IBM Plex Sans Arabic, SIL Open Font License 1.1 (`app/fonts/OFL.txt`)
- Microsoft WebView2 SDK 1.0.4314.35, redistributed in the Windows package under its own license (downloaded by `desktop/get-webview2.ps1`)

---

## العربية

<div dir="rtl">

SuperPrompt مولّد برومبتات يشتغل بالكامل على جهازك. اكتب طلبك باللهجة السعودية أو الفصحى أو الإنجليزي، ويكتب لك برومبت منظّم تلصقه في Claude أو ChatGPT أو Gemini أو Copilot أو Codex أو أي مساعد

- يشتغل بدون إنترنت: بدون حساب ولا اشتراك ولا ذكاء اصطناعي سحابي ولا أدوات تحليل. اللي تكتبه ما يطلع من جهازك
- 10 أنماط مع التلقائي، وثلاث مستويات تفصيل، وبرومبتات بـ10 لغات
- يحافظ على المسارات والإصدارات وأكواد الأخطاء والأسماء مثل ما كتبتها
- سجل فيه بحث وتصدير واستيراد، وتنقله بين الموقع وبرنامج ويندوز
- واجهة عربية وإنجليزية، من اليمين ومن اليسار، ووضع فاتح وداكن

### الاستخدام

| | |
|---|---|
| في المتصفح | https://superprompt.pages.dev/app/ (والصفحة الرئيسية https://superprompt.pages.dev/ فيها فيديو الشرح والتحميل) |
| على ويندوز | [آخر إصدار](https://github.com/Soiltary/SuperPrompt/releases/latest): `SuperPrompt-<version>-windows-x64-portable.zip` |

**برنامج ويندوز:** نزّل ملف ZIP، فك الضغط، ثم افتح `SuperPrompt.exe`. بدون تثبيت، ويشتغل على ويندوز 10 و11 بنظام 64 بت. يفتح في نافذته الخاصة باستخدام محرك Microsoft WebView2 الموجود في ويندوز، وبياناتك تبقى في `%LOCALAPPDATA%\SuperPrompt`. الملف غير موقّع رقميًا، فممكن يطلب SmartScreen تأكيد مرة وحدة: **More info ثم Run anyway**. طابق الملف مع بصمة SHA-256 المكتوبة في صفحة الإصدار

### البناء

المتطلبات: ويندوز 10 أو 11، وPython 3.11 أو أحدث، وNode.js 24 أو أحدث، وWindows PowerShell 5.1، ومترجم C# الموجود مع .NET Framework 4 في ويندوز. الأوامر نفسها في القسم الإنجليزي:

1. توليد الصفحات داخل `app` من ملفات النصوص في `experiments\page-generator`
2. التجربة محليًا من `app\Start SuperPrompt.bat` على http://127.0.0.1:8765/
3. بناء مجلد الموقع بـ `deploy\make-site.ps1`
4. تنزيل WebView2 SDK أول مرة بـ `desktop\get-webview2.ps1`، ثم بناء البرنامج بـ `desktop\build-exe.ps1`
5. النشر على Cloudflare Pages من مجلد `deploy` بعد تحديث `release.next.json`

### الترخيص

SuperPrompt منشور بترخيص [MIT](LICENSE)، والمكونات الخارجية تبقى بتراخيصها:

- خط IBM Plex Sans Arabic بترخيص SIL Open Font License 1.1
- Microsoft WebView2 SDK 1.0.4314.35، ويُوزّع داخل حزمة ويندوز بترخيصه الخاص

### الدعم والتواصل

[دعم](https://tip.dokan.sa/solitary) · [X @Soiltary](https://x.com/Soiltary) · [الموقع](https://superprompt.pages.dev/)

</div>
