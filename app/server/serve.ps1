# SuperPrompt - tiny local web server (Windows PowerShell 5.1, no installs).
# Serves the app folder on this computer only (loopback) and opens the default browser.
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [int]$Port = 8765,
    [switch]$NoBrowser,
    [int]$StopAfterSeconds = 0
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')

$mime = @{
    '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8';  '.js'  = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
    '.svg'  = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'
    '.ttf'  = 'font/ttf'; '.otf' = 'font/otf'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
}
$blocked = @('.ps1', '.bat', '.cmd')

# Try the preferred port first (so saved data in the browser stays with the same address), then the next ones.
$listener = $null
$base = $null
for ($p = $Port; $p -lt $Port + 40; $p++) {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://127.0.0.1:$p/")
    try {
        $l.Start(); $listener = $l; $base = "http://127.0.0.1:$p/"; break
    } catch {
        $l.Close()
        # Some accounts may not register 127.0.0.1; "localhost" is always loopback-only and allowed.
        $l = New-Object System.Net.HttpListener
        $l.Prefixes.Add("http://localhost:$p/")
        try { $l.Start(); $listener = $l; $base = "http://localhost:$p/"; break } catch { $l.Close() }
    }
}
if (-not $listener) {
    Write-Host 'Could not find a free port between' $Port 'and' ($Port + 39) -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '  SuperPrompt is running at:' -ForegroundColor Cyan
Write-Host "  $base" -ForegroundColor White
Write-Host ''
Write-Host '  Only this computer can open it. Keep this window open while you use it.'
Write-Host '  To stop: close this window or press Ctrl+C.'
Write-Host ''

if (-not $NoBrowser) { Start-Process $base }

function Send-Bytes($res, [int]$code, [string]$type, [byte[]]$bytes) {
    $res.StatusCode = $code
    $res.ContentType = $type
    $res.Headers['Cache-Control'] = 'no-cache'
    $res.Headers['X-Content-Type-Options'] = 'nosniff'
    $res.ContentLength64 = $bytes.Length
    if ($bytes.Length -gt 0) { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    $res.OutputStream.Close()
}
function Send-Text($res, [int]$code, [string]$text) {
    Send-Bytes $res $code 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes($text))
}

$started = Get-Date
try {
    while ($listener.IsListening) {
        if ($StopAfterSeconds -gt 0 -and ((Get-Date) - $started).TotalSeconds -ge $StopAfterSeconds) { break }
        $async = $listener.BeginGetContext($null, $null)
        while (-not $async.AsyncWaitHandle.WaitOne(300)) {
            if ($StopAfterSeconds -gt 0 -and ((Get-Date) - $started).TotalSeconds -ge $StopAfterSeconds) { break }
        }
        if (-not $async.IsCompleted) { break }
        $ctx = $listener.EndGetContext($async)
        $req = $ctx.Request; $res = $ctx.Response
        try {
            if ($req.HttpMethod -ne 'GET' -and $req.HttpMethod -ne 'HEAD') { Send-Text $res 405 'Method not allowed'; continue }
            $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
            $rel = $rel.TrimStart('/').Replace('/', '\')
            $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
            if (-not ($full -eq $Root -or $full.StartsWith($Root + '\', [System.StringComparison]::OrdinalIgnoreCase))) { Send-Text $res 403 'Forbidden'; continue }
            if (Test-Path -LiteralPath $full -PathType Container) {
                if (-not $req.Url.AbsolutePath.EndsWith('/')) {
                    $res.StatusCode = 301
                    $res.RedirectLocation = $req.Url.AbsolutePath + '/' + $req.Url.Query
                    $res.OutputStream.Close(); continue
                }
                $full = Join-Path $full 'index.html'
            }
            $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
            if ($blocked -contains $ext -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
                Send-Text $res 404 'Not found'
                continue
            }
            $type = $mime[$ext]; if (-not $type) { $type = 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($full)
            if ($req.HttpMethod -eq 'HEAD') { $res.ContentLength64 = $bytes.Length; $res.ContentType = $type; $res.OutputStream.Close() }
            else { Send-Bytes $res 200 $type $bytes }
            Write-Host ('  ' + (Get-Date -Format 'HH:mm:ss') + '  ' + $req.Url.AbsolutePath) -ForegroundColor DarkGray
        } catch {
            try { Send-Text $res 500 'Server error' } catch { }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
