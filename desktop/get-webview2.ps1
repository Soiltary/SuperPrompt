# Downloads the official Microsoft WebView2 SDK 1.0.4314.35 from nuget.org into desktop\vendor and checks its SHA-256.
# build-exe.ps1 needs it (Microsoft.Web.WebView2.Core/WinForms.dll and WebView2Loader.dll, all signed by Microsoft).
$ErrorActionPreference = 'Stop'
$ver = '1.0.4314.35'
$sha = '90778DEB1B77E36292828B4B5833C9255C27533F40E0DDD55891AE718944EDC4'
$vendor = Join-Path $PSScriptRoot 'vendor'
$pkg = Join-Path $vendor "microsoft.web.webview2.$ver.nupkg"
$dir = Join-Path $vendor "webview2-$ver"
New-Item -ItemType Directory -Force $vendor | Out-Null
if (-not (Test-Path $pkg)) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$ver" -OutFile $pkg -UseBasicParsing
}
$got = (Get-FileHash $pkg -Algorithm SHA256).Hash
if ($got -ne $sha) { Remove-Item $pkg; throw "SHA-256 mismatch for the WebView2 package: $got" }
if (-not (Test-Path $dir)) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($pkg, $dir)
}
foreach ($f in 'lib\net462\Microsoft.Web.WebView2.Core.dll', 'lib\net462\Microsoft.Web.WebView2.WinForms.dll', 'runtimes\win-x64\native\WebView2Loader.dll') {
  $s = Get-AuthenticodeSignature (Join-Path $dir $f)
  "$f  $($s.Status)  $($s.SignerCertificate.Subject)"
}
