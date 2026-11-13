# Runs inside Windows Sandbox (clean Windows, networking disabled, no Node or Python): unpacks the downloaded ZIP and
# uses the real app window like a user through UI Automation (tools\ui-test.ps1).
$res = 'C:\sbx\result'; New-Item -ItemType Directory -Force $res | Out-Null
$zip = Get-ChildItem 'C:\sbx\pkg' -Filter '*.zip' | Select-Object -First 1
$dest = Join-Path $env:USERPROFILE 'Desktop\SuperPrompt'
Expand-Archive $zip.FullName -DestinationPath $dest -Force
$info = [ordered]@{ zip = $zip.Name; sha256 = (Get-FileHash $zip.FullName -Algorithm SHA256).Hash.ToLower();
  networkUp = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up').Count;
  nodeOrPython = [bool](Get-Command node -ErrorAction SilentlyContinue) -or [bool](Get-Command python -ErrorAction SilentlyContinue);
  edgePresent = Test-Path 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$info | ConvertTo-Json | Set-Content "$res\env.json" -Encoding UTF8
try { & 'C:\sbx\tools\ui-test.ps1' -Exe (Join-Path $dest 'SuperPrompt.exe') -ImportFile 'C:\sbx\tools\export-from-web.json' -Out "$res\ui-test-sandbox.json" *> "$res\ui-test-log.txt" } catch { "$_" | Set-Content "$res\ui-test-error.txt" }
$sl = Join-Path $env:LOCALAPPDATA 'SuperPrompt\startup.log'; if (Test-Path $sl) { Copy-Item $sl "$res\startup.log" }
'done' | Set-Content "$res\DONE.txt"