# Builds deploy\site (what goes to Cloudflare Pages):
#   /            the landing page (deploy\landing): intro, demo video, browser vs Windows, download, support
#   /app/        the generator (app\), the same files the Windows app embeds
#   /download/   the Windows packages (current and earlier versions), with -WithDownload
# Excluded on purpose: the local launcher, the local server script, the local README, and anything outside app\ and
# deploy\landing (tests, reports, screenshots, research notes, backups, private prompt examples).
# The landing page's version, size, SHA-256 and links come from release.next.json, and the video lengths from
# landing\assets\video\video-meta.json, so the page always matches the package it offers.
param([switch]$WithDownload, [switch]$ShowButton)
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$app = Join-Path $proj 'app'
$landing = Join-Path $PSScriptRoot 'landing'
$site = Join-Path $PSScriptRoot 'site'
if (Test-Path $site) { Remove-Item $site -Recurse -Force }
New-Item -ItemType Directory $site | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false

# 1) generator under /app/
$exclude = @('Start SuperPrompt.bat', 'README.txt')
Get-ChildItem $app -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($app.Length + 1)
  -not ($exclude -contains $_.Name) -and -not $rel.StartsWith('server\')
} | ForEach-Object {
  $dst = Join-Path $site ('app\' + $_.FullName.Substring($app.Length + 1))
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  Copy-Item $_.FullName $dst
}

# 2) landing page at the root, with the release details filled in
$relPath = Join-Path $PSScriptRoot 'release.next.json'
$rel = Get-Content $relPath -Raw -Encoding UTF8 | ConvertFrom-Json
$vm = Get-Content (Join-Path $landing 'assets\video\video-meta.json') -Raw | ConvertFrom-Json
$values = @{
  '{{VERSION}}' = $rel.version; '{{SIZE}}' = $rel.size_label; '{{SHA256}}' = $rel.sha256; '{{ZIP}}' = $rel.url
  '{{GH_RELEASE}}' = $rel.notes_url; '{{VIDEO_EN}}' = ('{0:0.0}' -f [double]$vm.en.seconds); '{{VIDEO_AR}}' = ('{0:0.0}' -f [double]$vm.ar.seconds)
}
Get-ChildItem $landing -Recurse -File | Where-Object { $_.Name -ne 'video-meta.json' } | ForEach-Object {
  $dst = Join-Path $site $_.FullName.Substring($landing.Length + 1)
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  if ($_.Extension -in '.html', '.js', '.css') {
    $t = [IO.File]::ReadAllText($_.FullName)
    foreach ($k in $values.Keys) { $t = $t.Replace($k, [string]$values[$k]) }
    if ($t -match '\{\{[A-Z_0-9]+\}\}') { throw "unfilled placeholder in $($_.Name): $($Matches[0])" }
    [IO.File]::WriteAllText($dst, $t, $utf8)
  } else { Copy-Item $_.FullName $dst }
}

# 3) headers, redirects for the old generator addresses, 404
# Security and privacy headers: the pages may only talk to their own origin (no analytics, no third-party requests).
@"
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
/download/*
  Content-Disposition: attachment
/assets/video/*
  Cache-Control: public, max-age=86400
"@ | Set-Content (Join-Path $site '_headers') -Encoding ascii
# before v2.2.0 the generator lived at the root; keep those links working
@"
/guide/* /app/guide/:splat 301
/prompts/* /app/prompts/:splat 301
/history/* /app/history/:splat 301
/about/* /app/about/:splat 301
/en/blog/* /app/en/blog/:splat 301
/guide /app/guide/ 301
/prompts /app/prompts/ 301
/history /app/history/ 301
/about /app/about/ 301
/en/blog /app/en/blog/ 301
/app /app/ 301
"@ | Set-Content (Join-Path $site '_redirects') -Encoding ascii
Copy-Item (Join-Path $PSScriptRoot '404.html') (Join-Path $site '404.html')

# 4) packages
if ($WithDownload) {
  $dl = Join-Path $site 'download'
  New-Item -ItemType Directory -Force $dl | Out-Null
  Copy-Item (Join-Path $PSScriptRoot ('dist\' + $rel.file)) $dl
  # earlier published packages stay downloadable at their old links
  Get-ChildItem (Join-Path $PSScriptRoot 'dist') -Filter 'SuperPrompt-*-windows-x64-portable.zip' | Where-Object Name -ne $rel.file | Copy-Item -Destination $dl
  if ($ShowButton) { Copy-Item $relPath (Join-Path $site 'release.json') }
}
$files = Get-ChildItem $site -Recurse -File
"site files: $($files.Count)  size: $([math]::Round(($files | Measure-Object Length -Sum).Sum/1MB,2)) MB"
