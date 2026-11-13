<div align="center">

<img src="experiments/brand/v3/logo-256.png" width="120" height="120" alt="SuperPrompt">

# SuperPrompt

**Write what you need in your own words. SuperPrompt turns it into a clear, structured prompt.**

[Website](https://superprompt.pages.dev/) · [Open the generator](https://superprompt.pages.dev/app/) · [Download for Windows](https://github.com/Soiltary/SuperPrompt/releases/latest) · [Support](https://tip.dokan.sa/solitary) · [X @Soiltary](https://x.com/Soiltary) · [MIT License](LICENSE)

</div>

## What it does

SuperPrompt is a prompt builder that runs entirely on your device. Describe a task in Saudi dialect, formal Arabic or English, and it writes a structured prompt with a goal, steps, limits and a check, ready to paste into Claude, ChatGPT, Gemini, Copilot, Codex or any other assistant.

- **Private and offline:** no account, no subscription, no AI calls and no analytics. Nothing you type leaves your device.
- **Fits the request:** 10 modes plus Auto, three detail levels, three output formats and prompts in 10 languages.
- **Keeps details exact:** paths, versions, error codes and names stay exactly as you wrote them.
- **History:** search, edit, export and import, and move your history between the website and the Windows app.
- **Bilingual interface:** Arabic and English, right-to-left and left-to-right, light and dark themes.

## Get it

| | |
|---|---|
| In the browser | Open the generator at https://superprompt.pages.dev/app/. The home page, https://superprompt.pages.dev/, has a short demo video and the download. |
| On Windows | Download `SuperPrompt-<version>-windows-x64-portable.zip` from the [latest release](https://github.com/Soiltary/SuperPrompt/releases/latest). |

### Running the Windows app

1. Download the ZIP and unzip it. Keep the files in the folder together.
2. Open `SuperPrompt.exe`. Nothing is installed, and it works offline.

The app runs on Windows 10 and 11 (64-bit) and opens in its own window using the Microsoft WebView2 runtime that ships with Windows. Your prompts and settings stay on your PC in `%LOCALAPPDATA%\SuperPrompt`.

The file is not code-signed, so Windows SmartScreen may ask once: choose **More info**, then **Run anyway**. You can check the download against the SHA-256 listed on the release page:

```powershell
Get-FileHash .\SuperPrompt-<version>-windows-x64-portable.zip -Algorithm SHA256
```

### Moving your history

The website and the Windows app each keep their own history. To move it, open **History → Export** in one copy, then **History → Import** in the other. Imported prompts are merged with the existing ones, and nothing is replaced.

## Build from source

Requirements: Windows 10 or 11, Python 3.11+, Node.js 24+, Windows PowerShell 5.1, and the C# compiler of .NET Framework 4 (included with Windows).

```powershell
# 1. Generate the pages into app\ (all interface text lives in experiments\page-generator\*.py)
python experiments\page-generator\build.py app

# 2. Try it locally: double-click app\Start SuperPrompt.bat (opens http://127.0.0.1:8765/)

# 3. Build the website folder, deploy\site
powershell -File deploy\make-site.ps1

# 4. Build the Windows app (the first time, fetch the WebView2 SDK from nuget.org)
powershell -File desktop\get-webview2.ps1
powershell -File desktop\build-exe.ps1 -Version 2.2.0    # -> deploy\dist\SuperPrompt-2.2.0-windows-x64-portable.zip
```

Logo, icons and demo video (only needed when they change):

```powershell
# Transparent logo in every size from the approved artwork, then SuperPrompt.ico and the app icons
node experiments\brand\make-logo.js <logo image> experiments\brand\v3
powershell -File experiments\brand\make-icons.ps1

# Demo video in Arabic and English, recorded from the real generator (needs ffmpeg with libx264)
node experiments\video\record-demo.js <path to ffmpeg.exe> both
```

Publishing the website (Cloudflare Pages, project `superprompt`):

```powershell
cd deploy
npm install
# release.next.json describes the package: version, file, size and SHA-256
powershell -File make-site.ps1 -WithDownload -ShowButton
npx wrangler pages deploy site --project-name superprompt --branch main
```

## Project layout

| Folder | Contents |
|---|---|
| `app/` | The generator, shared by the website and the Windows app: engine (`prompt-lexicon.js`, `prompt-engine.js`, `generator.js`), interface (`app.js`, `storage.js`, styles), generated pages and the local launcher |
| `experiments/page-generator/` | Page generator and all interface text in Arabic and English |
| `experiments/brand/` | Logo (`v3/`), icons and the scripts that make them |
| `experiments/video/` | Script that records the demo video from the generator |
| `desktop/` | Windows app (`SuperPromptApp.cs`), build scripts and tests |
| `deploy/` | Website build and publishing scripts |
| `deploy/landing/` | The website's home page: intro, demo video with Arabic and English subtitles, download and support (not part of the Windows app) |

## License

SuperPrompt is released under the [MIT License](LICENSE). Third-party components keep their own licenses:

- IBM Plex Sans Arabic, SIL Open Font License 1.1 (`app/fonts/OFL.txt`)
- Microsoft WebView2 SDK 1.0.4314.35, redistributed in the Windows package under its own license (downloaded by `desktop/get-webview2.ps1`)

## Support and contact

If SuperPrompt saves you time, you can [support the project](https://tip.dokan.sa/solitary). For questions and ideas, reach out on [X @Soiltary](https://x.com/Soiltary).
