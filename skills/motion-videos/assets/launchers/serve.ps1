# Serve one page from this folder on 127.0.0.1 and open it in its own app window (Edge or Chrome,
# with a temporary profile). When that window closes, the server stops. Windows PowerShell 5.1+, no installs.
#   powershell -ExecutionPolicy Bypass -File serve.ps1 -Page talk.html [-Port N] [-NoBrowser]
# Written by the motion skills' presenter kit.
param([string]$Page = 'index.html', [int]$Port = 0, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root $Page))) { Write-Host "Could not find $Page next to this launcher."; exit 1 }

if ($Port -eq 0) {   # a free port, chosen by the system
  $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0); $probe.Start()
  $Port = $probe.LocalEndpoint.Port; $probe.Stop()
}
$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add("http://127.0.0.1:$Port/"); $http.Start()
$url = "http://127.0.0.1:$Port/" + [uri]::EscapeDataString($Page).Replace('%2F', '/')
Write-Host "Serving $Page at $url"

$types = @{ '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.css' = 'text/css'; '.json' = 'application/json';
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'; '.webp' = 'image/webp';
  '.mp4' = 'video/mp4'; '.webm' = 'video/webm'; '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.m4a' = 'audio/mp4'; '.ogg' = 'audio/ogg';
  '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.vtt' = 'text/vtt'; '.txt' = 'text/plain; charset=utf-8' }
$rootFull = [System.IO.Path]::GetFullPath($root)

function Serve($ctx) {
  $res = $ctx.Response
  try {
    $rel = [uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = $Page }
    $file = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    if (-not $file.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
      $res.StatusCode = 404
    } else {
      $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-store')
      $bytes = [System.IO.File]::ReadAllBytes($file); $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch { try { $res.StatusCode = 500 } catch {} }
  finally { try { $res.Close() } catch {} }
}

$proc = $null; $prof = $null
if (-not $NoBrowser) {
  $cands = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LocalAppData\Google\Chrome\Application\chrome.exe")
  $exe = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($exe) {
    $prof = Join-Path ([System.IO.Path]::GetTempPath()) ("present-" + [guid]::NewGuid().ToString('N'))
    $proc = Start-Process -FilePath $exe -PassThru -ArgumentList @("--app=$url", "--user-data-dir=`"$prof`"", '--no-first-run', '--no-default-browser-check', '--window-size=1600,940')
    Write-Host 'Opened in its own window. Close that window to stop.'
  } else {
    Start-Process $url
    Write-Host 'No Edge or Chrome found: opened your default browser. Close this window when you are done.'
  }
} else { Write-Host 'Press Ctrl+C to stop.' }

try {
  $pending = $http.BeginGetContext($null, $null)
  while ($true) {
    if ($pending.AsyncWaitHandle.WaitOne(250)) { Serve ($http.EndGetContext($pending)); $pending = $http.BeginGetContext($null, $null) }
    elseif ($proc -and $proc.HasExited) { break }
  }
} finally {
  $http.Stop(); $http.Close()
  if ($prof) { Start-Sleep -Milliseconds 500; Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $prof }
}
