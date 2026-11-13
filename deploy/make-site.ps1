# Builds deploy\site (what goes to Cloudflare Pages) from app\, keeping only the files the website needs.
# Excluded on purpose: the local launcher, the local server script, the local README, and anything outside app\
# (tests, reports, screenshots, research notes, backups, private prompt examples).
param([switch]$WithDownload, [switch]$ShowButton)
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$app = Join-Path $proj 'app'
$site = Join-Path $PSScriptRoot 'site'
if (Test-Path $site) { Remove-Item $site -Recurse -Force }
New-Item -ItemType Directory $site | Out-Null
$exclude = @('Start SuperPrompt.bat', 'README.txt')
Get-ChildItem $app -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($app.Length + 1)
  -not ($exclude -contains $_.Name) -and -not $rel.StartsWith('server\')
} | ForEach-Object {
  $rel = $_.FullName.Substring($app.Length + 1)
  $dst = Join-Path $site $rel
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  Copy-Item $_.FullName $dst
}
# Security and privacy headers: the page may only talk to its own origin (no analytics, no third-party requests).
@"
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
/download/*
  Content-Disposition: attachment
"@ | Set-Content (Join-Path $site '_headers') -Encoding ascii
Copy-Item (Join-Path $PSScriptRoot '404.html') (Join-Path $site '404.html')
if ($WithDownload) {
  # the package file (always) and, with -ShowButton, release.json that turns the download button on
  $relPath = Join-Path $PSScriptRoot 'release.next.json'
  $rel = Get-Content $relPath -Raw | ConvertFrom-Json
  $dl = Join-Path $site 'download'
  New-Item -ItemType Directory -Force $dl | Out-Null
  Copy-Item (Join-Path $PSScriptRoot ('dist\' + $rel.file)) $dl
  # earlier published packages stay downloadable at their old links
  Get-ChildItem (Join-Path $PSScriptRoot 'dist') -Filter 'SuperPrompt-*-windows-x64-portable.zip' | Where-Object Name -ne $rel.file | Copy-Item -Destination $dl
  if ($ShowButton) { Copy-Item $relPath (Join-Path $site 'release.json') }
}
$files = Get-ChildItem $site -Recurse -File
"site files: $($files.Count)  size: $([math]::Round(($files | Measure-Object Length -Sum).Sum/1MB,2)) MB"
