# Builds the icons of SuperPrompt from the approved logo (experiments\brand\v3, made by make-logo.js):
# the multi-size SuperPrompt.ico for SuperPrompt.exe (PNG entries), the website/app icons in app\, and icon-N.png here.
# Run make-logo.js first:  node experiments\brand\make-logo.js research\brand-v3\superprompt-logo-source.webp experiments\brand\v3
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$app = Join-Path $proj 'app'
$v3 = Join-Path $PSScriptRoot 'v3'
$out = $PSScriptRoot
# ICO for SuperPrompt.exe: the transparent mark, so it sits on any Explorer or taskbar colour.
# Sizes up to 128 are classic 32-bit DIB entries (the C# compiler's /win32icon does not embed PNG-compressed small
# entries correctly, and Windows then shows its generic program icon); 256 stays PNG, as Windows expects.
Add-Type -AssemblyName System.Drawing
function DibEntry([string]$png) {
  $bmp = [System.Drawing.Bitmap]::FromFile($png); $n = $bmp.Width
  $ms = New-Object System.IO.MemoryStream; $w = New-Object System.IO.BinaryWriter $ms
  $w.Write([UInt32]40); $w.Write([Int32]$n); $w.Write([Int32]($n * 2)); $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]0); $w.Write([UInt32]0); $w.Write([Int32]0); $w.Write([Int32]0); $w.Write([UInt32]0); $w.Write([UInt32]0)
  for ($y = $n - 1; $y -ge 0; $y--) { for ($x = 0; $x -lt $n; $x++) { $c = $bmp.GetPixel($x, $y); $w.Write([byte]$c.B); $w.Write([byte]$c.G); $w.Write([byte]$c.R); $w.Write([byte]$c.A) } }
  $rowBytes = [int]([math]::Ceiling($n / 32.0) * 4)
  for ($y = $n - 1; $y -ge 0; $y--) { $row = New-Object byte[] $rowBytes
    for ($x = 0; $x -lt $n; $x++) { if ($bmp.GetPixel($x, $y).A -lt 128) { $row[[int][math]::Floor($x / 8)] = $row[[int][math]::Floor($x / 8)] -bor (0x80 -shr ($x % 8)) } }
    $w.Write($row) }
  $bmp.Dispose(); $w.Flush(); return ,$ms.ToArray()
}
$icoSizes = 16, 24, 32, 48, 64, 128, 256
$pngs = $icoSizes | ForEach-Object { $f = Join-Path $v3 "logo-$_.png"; if ($_ -ge 256) { ,[System.IO.File]::ReadAllBytes($f) } else { DibEntry $f } }
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
foreach ($n in 16, 24, 32, 48, 64, 128, 180, 256, 512) { Copy-Item (Join-Path $v3 "logo-$n.png") (Join-Path $out "icon-$n.png") -Force }
# website and app: header mark (1x/2x), browser tab icons, home-screen icon on the dark tile (iOS fills transparency with black)
Copy-Item (Join-Path $v3 'logo-64.png') (Join-Path $app 'logo-64.png') -Force
Copy-Item (Join-Path $v3 'logo-128.png') (Join-Path $app 'logo-128.png') -Force
Copy-Item (Join-Path $v3 'logo-32.png') (Join-Path $app 'favicon-32.png') -Force
Copy-Item (Join-Path $v3 'logo-64.png') (Join-Path $app 'favicon.png') -Force
Copy-Item (Join-Path $v3 'tile-180.png') (Join-Path $app 'icon-180.png') -Force
Get-Item (Join-Path $out 'SuperPrompt.ico') | Select-Object Name, Length
