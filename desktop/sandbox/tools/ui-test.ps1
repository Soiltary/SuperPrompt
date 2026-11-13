# Drives the real SuperPrompt.exe window like a user, through Windows UI Automation (no debugging port, no dev tools):
# type a request, Ctrl+Enter, Copy (checks the Windows clipboard), Save, History > Export (file lands in Downloads),
# History > Import (a web export, through the Open dialog), close, reopen, and check the history is still there.
# Usage: powershell -File ui-test.ps1 -Exe <SuperPrompt.exe> -ImportFile <web export .json> -Out <result .json>
param([string]$Exe, [string]$ImportFile, [string]$Out)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$CT = [System.Windows.Automation.ControlType]
$R = [ordered]@{}
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class W32 {
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr after, string cls, string title);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, string l);
}
"@
function Find-Window($title, $sec = 40) {
  for ($i = 0; $i -lt $sec * 2; $i++) {
    $c = New-Object System.Windows.Automation.PropertyCondition($AE::NameProperty, $title)
    $w = $AE::RootElement.FindFirst($TS::Children, $c)
    if ($w) { return $w }
    Start-Sleep -Milliseconds 500
  }
  throw "window '$title' not found"
}
function All($root, $type) { $root.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $type))) }
function ByName($root, $type, $pattern, $sec = 15) {
  for ($i = 0; $i -lt $sec * 2; $i++) {
    foreach ($e in (All $root $type)) { if ($e.Current.Name -match $pattern) { return $e } }
    Start-Sleep -Milliseconds 500
  }
  throw "no $($type.ProgrammaticName) matching '$pattern'"
}
function Click($e) {
  try { $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }
  catch { $e.SetFocus(); Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait(' ') }
}
function MouseClick($e, $win) {
  [W32]::SetForegroundWindow([IntPtr]$win.Current.NativeWindowHandle) | Out-Null; Start-Sleep -Milliseconds 200
  $r = $e.Current.BoundingRectangle
  [W32]::SetCursorPos([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2)) | Out-Null; Start-Sleep -Milliseconds 100
  [W32]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); [W32]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero)
}
function Focus($e) {
  for ($k = 0; $k -lt 20; $k++) { try { $e.SetFocus(); return } catch { Start-Sleep -Milliseconds 500 } }
  throw "element never accepted focus: $($e.Current.Name)"
}
function Value($e) { try { $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch { '' } }

$dl = Join-Path $env:USERPROFILE 'Downloads'
New-Item -ItemType Directory -Force $dl | Out-Null
Get-ChildItem $dl -Filter 'superprompt-history-*.json' -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

# ---- run 1 ----
$p = Start-Process $Exe -PassThru
$w = Find-Window 'SuperPrompt | Prompt Builder'
$R.window = $w.Current.Name
Start-Sleep 2
$edits = @(All $w $CT::Edit)
$goal = $w.FindFirst($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty, 'goal')))
$run = 'RUN-' + (Get-Random -Minimum 100000 -Maximum 999999)
$R.runToken = $run
Start-Sleep 3
$typed = 0
do {
  $typed++
  [W32]::SetForegroundWindow([IntPtr]$w.Current.NativeWindowHandle) | Out-Null; Start-Sleep -Milliseconds 300
  Focus $goal; Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 200
  # typed, not pasted: Windows Sandbox shares its clipboard with the host, so a paste can carry the host's text
  [System.Windows.Forms.SendKeys]::SendWait("Outlook keeps asking for my password after the Windows 11 update, account test@example.com, ticket $run"); Start-Sleep -Milliseconds 600
} while (-not (Value $goal).Contains($run) -and $typed -lt 4)
$R.typedAttempts = $typed; $R.goalValue = (Value $goal); if (-not $R.goalValue.Contains($run)) { throw "typing failed after $typed attempts; goal=[$($R.goalValue)]" }
# press Generate from the keyboard (focus + Enter is a real user action), then wait until the token shows in the result
$gen = 0
do {
  $gen++
  [W32]::SetForegroundWindow([IntPtr]$w.Current.NativeWindowHandle) | Out-Null
  $gb = ByName $w $CT::Button '^(Generate|توليد)'; Focus $gb; Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep 2
} while (-not ((@(All $w $CT::Text | ForEach-Object { $_.Current.Name }) -join "`n").Contains($run)) -and $gen -lt 3)
$R.generatePresses = $gen
# the result view renders the prompt as text: the run token and the e-mail must appear there as written
$shown = (@(All $w $CT::Text | ForEach-Object { $_.Current.Name }) -join "`n")
$R.generate = @{ resultShowsToken = $shown.Contains($run); resultShowsEmail = $shown.Contains('test@example.com') }
Set-Clipboard -Value 'before-copy'
$tries = 0
do { $tries++; [W32]::SetForegroundWindow([IntPtr]$w.Current.NativeWindowHandle) | Out-Null; $cb = ByName $w $CT::Button '^(Copy|نسخ)$'; Focus $cb; Start-Sleep -Milliseconds 300; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep 1 } while ((Get-Clipboard -Raw) -eq 'before-copy' -and $tries -lt 4)
$R.copyClicks = $tries
$clip = (Get-Clipboard -Raw) -replace "`r`n", "`n"
$R.copy = @{ clipboardChars = $clip.TrimEnd("`n").Length; hasToken = $clip.Contains($run) }
Click (ByName $w $CT::Button '^(Save|حفظ)'); Start-Sleep 1
Click (ByName $w $CT::Hyperlink '^(History|السجل)$'); Start-Sleep 3
$w = $AE::RootElement.FindFirst($TS::Children, (New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $p.Id)))
$R.historyTitle = $w.Current.Name
Click (ByName $w $CT::Button '^(Export|تصدير)'); Start-Sleep 3
$exp = Get-ChildItem $dl -Filter 'superprompt-history-*.json' -ErrorAction SilentlyContinue | Select-Object -First 1
$R.export = if ($exp) { $j = Get-Content $exp.FullName -Raw -Encoding UTF8 | ConvertFrom-Json; @{ file = $exp.Name; app = $j.app; items = @($j.items).Count } } else { 'no file in Downloads' }
if ($exp) {
  # the item just saved (newest Outlook entry) is the ground truth for what Copy should have put on the clipboard
  $saved = @($j.items | Where-Object { $_.goal -match $run })[0]; $R.savedWithToken = [bool]$saved
  $R.copy.savedChars = ([string]$saved.result).Length
  $R.copy.matchesSaved = (($clip.TrimEnd("`n")) -eq (([string]$saved.result) -replace "`r`n", "`n").TrimEnd("`n"))
}
# import the web export through the Open dialog
Click (ByName $w $CT::Button '^(Import|استيراد)'); Start-Sleep 2
$dlg = $null
$dc = New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, '#32770')
for ($i = 0; $i -lt 30 -and -not $dlg; $i++) {
  $dlg = $w.FindFirst($TS::Descendants, $dc)
  if (-not $dlg) { $dlg = $AE::RootElement.FindFirst($TS::Children, $dc) }
  if (-not $dlg) { Start-Sleep -Milliseconds 500 }
}
if ($dlg) {
  $R.importDialog = $dlg.Current.Name
  # the dialog belongs to the WebView2 process, so it is filled with plain Win32 messages
  $h = [IntPtr]$dlg.Current.NativeWindowHandle
  $cbx = [W32]::GetDlgItem($h, 1148)
  $edit = [W32]::FindWindowEx([W32]::FindWindowEx($cbx, [IntPtr]::Zero, 'ComboBox', $null), [IntPtr]::Zero, 'Edit', $null)
  if ($edit -eq [IntPtr]::Zero) { $edit = $cbx }
  [W32]::SendMessage($edit, 0x000C, [IntPtr]::Zero, $ImportFile) | Out-Null   # WM_SETTEXT
  Start-Sleep -Milliseconds 300
  [W32]::SendMessage([W32]::GetDlgItem($h, 1), 0x00F5, [IntPtr]::Zero, $null) | Out-Null   # BM_CLICK on Open
  Start-Sleep 3} else { $R.importDialog = 'not found' }
$texts = @(All $w $CT::Text | ForEach-Object { $_.Current.Name })
$R.importToast = ($texts | Where-Object { $_ -match 'Import done|Imported|الاستيراد' } | Select-Object -First 1)
$R.historyTextsBeforeClose = @($texts | Where-Object { $_ -match 'Outlook|HP|Windows|الطابعة' }).Count
# close the window like a user and check the app stops
$w.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close(); Start-Sleep 4
$R.exitedAfterClose = $p.HasExited

# ---- run 2: reopen, history must still be there ----
$p = Start-Process $Exe -PassThru
$w = Find-Window 'SuperPrompt | Prompt Builder'
Start-Sleep 2
Click (ByName $w $CT::Hyperlink '^(History|السجل)$'); Start-Sleep 3
$w = $AE::RootElement.FindFirst($TS::Children, (New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $p.Id)))
$texts = @(All $w $CT::Text | ForEach-Object { $_.Current.Name })
$R.reopen = @{ title = $w.Current.Name; outlookEntry = [bool]($texts -match 'Outlook'); webEntry = [bool]($texts -match 'الطابعة|HP LaserJet'); countLabel = ($texts | Where-Object { $_ -match '^\d+ (prompts?|برومبت)' -or $_ -match 'saved' } | Select-Object -First 1) }
$w.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close(); Start-Sleep 3
$R | ConvertTo-Json -Depth 4 | Set-Content $Out -Encoding UTF8
$R | ConvertTo-Json -Depth 4
