# Runs inside Windows Sandbox (clean Windows, networking disabled). Unpacks the portable ZIP, starts SuperPrompt.exe
# like a double-click, then records what happened into C:\sbx\result (mapped back to the host).
$ErrorActionPreference = 'Continue'
$res = 'C:\sbx\result'
New-Item -ItemType Directory -Force $res | Out-Null
$log = @{}
try {
  $zip = Get-ChildItem 'C:\sbx\pkg' -Filter '*.zip' | Select-Object -First 1
  $log.zip = $zip.Name
  $log.zipSha256 = (Get-FileHash $zip.FullName -Algorithm SHA256).Hash.ToLower()
  $dest = Join-Path $env:USERPROFILE 'Desktop\SuperPrompt'
  Expand-Archive $zip.FullName -DestinationPath $dest -Force
  $log.unpacked = @(Get-ChildItem $dest | ForEach-Object Name)
  $log.network = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up' | ForEach-Object Name)
  $log.nodeOrPythonPresent = [bool](Get-Command node -ErrorAction SilentlyContinue) -or [bool](Get-Command python -ErrorAction SilentlyContinue)
  $log.webview2Runtime = @(Get-ChildItem 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application' -Directory -ErrorAction SilentlyContinue | ForEach-Object Name)
  $log.edgePresent = Test-Path 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  $exe = Join-Path $dest 'SuperPrompt.exe'
  $log.exeVersion = (Get-Item $exe).VersionInfo.ProductVersion
  Unblock-File $exe -ErrorAction SilentlyContinue
  $p = Start-Process $exe -PassThru
  Start-Sleep 20
  $log.exeRunning = -not $p.HasExited
  $log.listening = @(Get-NetTCPConnection -State Listen -LocalPort 8766 -ErrorAction SilentlyContinue | ForEach-Object LocalAddress)
  $kids = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $p.Id }
  $log.windowProcess = @($kids | ForEach-Object { $_.Name + ' ' + [regex]::Match($_.CommandLine, '--app=\S+').Value })
  $log.windowTitles = @(Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object { $_.ProcessName + ': ' + $_.MainWindowTitle })
  foreach ($u in 'http://127.0.0.1:8766/', 'http://127.0.0.1:8766/prompt-engine.js', 'http://127.0.0.1:8766/history/') {
    try { $r = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 10; $log["get " + $u] = "$($r.StatusCode) $($r.Headers['Content-Type']) $($r.RawContentLength) bytes" } catch { $log["get " + $u] = "ERROR $_" }
  }
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $bmp.Save((Join-Path $res 'sandbox-screen.png'), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
  # close the app window and confirm the app stops
  $w = Get-Process | Where-Object { $_.MainWindowTitle -like 'SuperPrompt*' } | Select-Object -First 1
  if ($w) { $w.CloseMainWindow() | Out-Null; Start-Sleep 6 }
  $log.exeExitedAfterClose = $p.HasExited
  $log.portFreedAfterClose = -not (Get-NetTCPConnection -State Listen -LocalPort 8766 -ErrorAction SilentlyContinue)
  $sl = Join-Path $env:LOCALAPPDATA 'SuperPrompt\startup.log'
  if (Test-Path $sl) { Copy-Item $sl (Join-Path $res 'startup.log') }
} catch { $log.error = "$_" }
$log | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $res 'sandbox-result.json') -Encoding UTF8
'done' | Set-Content (Join-Path $res 'DONE.txt')

