# Renders app\favicon.svg to PNG sizes and a multi-size .ico (PNG-compressed entries), no downloads.
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$app = Join-Path $proj 'app'
$out = $PSScriptRoot
$svg = Get-Content (Join-Path $app 'favicon.svg') -Raw
$html = Join-Path $out 'render.html'
"<html><body style='margin:0;background:transparent'><div style='width:512px;height:512px'>$($svg -replace '<svg ', '<svg width=''512'' height=''512'' ')</div></body></html>" | Set-Content $html -Encoding UTF8
$big = Join-Path $out 'icon-512.png'
$prof = Join-Path $out 'chrome-prof'
$args1 = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', "--user-data-dir=`"$prof`"", '--window-size=512,512', "--screenshot=`"$big`"", ('"file:///' + ($html -replace '\\','/') + '"'))
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList $args1 -Wait -WindowStyle Hidden
Start-Sleep 1
Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($big)
function Save-Size([int]$n, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $n, $n
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, 0, 0, $n, $n)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$sizes = 16, 24, 32, 48, 64, 128, 180, 256
foreach ($n in $sizes) { Save-Size $n (Join-Path $out "icon-$n.png") }
$src.Dispose()
# ICO with PNG entries (Windows Vista and later)
$icoSizes = 16, 24, 32, 48, 64, 128, 256
$pngs = $icoSizes | ForEach-Object { [System.IO.File]::ReadAllBytes((Join-Path $out "icon-$_.png")) }
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$icoSizes.Count)
$offset = 6 + 16 * $icoSizes.Count
for ($i = 0; $i -lt $icoSizes.Count; $i++) {
  $n = $icoSizes[$i]; $len = $pngs[$i].Length
  $bw.Write([byte]($(if ($n -ge 256) { 0 } else { $n }))); $bw.Write([byte]($(if ($n -ge 256) { 0 } else { $n })))
  $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$len); $bw.Write([UInt32]$offset); $offset += $len
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $out 'SuperPrompt.ico'), $ms.ToArray())
Copy-Item (Join-Path $out 'icon-64.png') (Join-Path $app 'favicon.png') -Force
Copy-Item (Join-Path $out 'icon-180.png') (Join-Path $app 'icon-180.png') -Force
Remove-Item $html
Get-ChildItem $out -Filter '*.png' | Select-Object Name, Length
Get-Item (Join-Path $out 'SuperPrompt.ico') | Select-Object Name, Length
