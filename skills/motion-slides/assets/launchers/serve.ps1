# Serve one page from this folder on 127.0.0.1 and open it in its own app window (Edge or Chrome,
# with a temporary profile). When that window closes, the server stops. Windows PowerShell 5.1+, no installs.
#   powershell -ExecutionPolicy Bypass -File serve.ps1 -Page talk.html [-Port N] [-NoBrowser] [-TermDir folder] [-Shell "command line"]
# A deck's terminal drawer gets a real shell here when _present\term\ exists: a Windows console (ConPTY) on a WebSocket
# that only this deck window can open (127.0.0.1 only, a one-time key in the address, and an Origin check).
# Written by the motion skills' presenter kit.
param([string]$Page = 'index.html', [int]$Port = 0, [switch]$NoBrowser, [string]$TermDir = $HOME, [string]$Shell = '', [string]$Workspace = '')
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

# the deck's helpers (decks that use them: the kit then writes term.cs): the terminal drawer (xterm in _present\term,
# Windows 10 1809 or later) and the browser (opens pages in the presenter's own browser, beside the deck)
$term = $false; $web = $false; $key = ''
if (Test-Path (Join-Path $PSScriptRoot 'term.cs')) {
  try {
    if (-not ('DeckTerm' -as [type])) { Add-Type -TypeDefinition ([System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'term.cs'))) }
    $key = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
    if (-not $Shell) { $Shell = 'powershell.exe -NoLogo' }
    if (-not (Test-Path -LiteralPath $TermDir)) { $TermDir = $HOME }
    $term = Test-Path (Join-Path $PSScriptRoot 'term\xterm.js'); $web = $true; $url += "?tk=$key"
  } catch { Write-Host "Terminal and browser unavailable: $($_.Exception.Message)" }
}
# the workbench (decks that use it: the kit puts Monaco in _present\monaco): files of one demo folder, edited in the deck.
# The folder: -Workspace, else the first line of _present\workspace.txt, else a "workspace" folder next to the deck.
$wb = $false
if ($web -and (Test-Path (Join-Path $PSScriptRoot 'monaco\vs\loader.js'))) {
  if (-not $Workspace) { $wf = Join-Path $PSScriptRoot 'workspace.txt'
    if (Test-Path $wf) { $Workspace = (Get-Content $wf | Where-Object { $_ -and -not $_.StartsWith('#') } | Select-Object -First 1) } }
  if ($Workspace) { $Workspace = [Environment]::ExpandEnvironmentVariables($Workspace.Trim()) } else { $Workspace = Join-Path $root 'workspace' }
  if (-not [System.IO.Path]::IsPathRooted($Workspace)) { $Workspace = Join-Path $root $Workspace }
  try { New-Item -ItemType Directory -Force -Path $Workspace | Out-Null; $Workspace = (Resolve-Path -LiteralPath $Workspace).Path; $wb = $true
    if (-not $PSBoundParameters.ContainsKey('TermDir')) { $TermDir = $Workspace }   # the terminal starts in the demo folder
    Write-Host "Workbench folder: $Workspace" } catch { Write-Host "Workbench unavailable: $($_.Exception.Message)" }
}
# the presenter's own browser (their default, signed in), for pages the deck opens
function DefaultBrowser {
  $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LocalAppData\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  $prog = ''; try { $prog = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' -ErrorAction Stop).ProgId } catch {}
  if ($prog -like 'Chrome*' -and $chrome) { return $chrome }
  if ($edge) { return $edge }
  return $chrome
}
Write-Host "Serving $Page at $url"

$types = @{ '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.css' = 'text/css'; '.json' = 'application/json';
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'; '.webp' = 'image/webp';
  '.mp4' = 'video/mp4'; '.webm' = 'video/webm'; '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.m4a' = 'audio/mp4'; '.ogg' = 'audio/ogg';
  '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.ttf' = 'font/ttf'; '.vtt' = 'text/vtt'; '.txt' = 'text/plain; charset=utf-8' }
$rootFull = [System.IO.Path]::GetFullPath($root)

function Serve($ctx) {
  $req = $ctx.Request; $res = $ctx.Response
  if ($req.Url.AbsolutePath -eq '/__term') {   # the terminal drawer's socket: this deck window only
    if ($term -and $req.IsWebSocketRequest -and $req.QueryString['tk'] -eq $key -and $req.Headers['Origin'] -eq "http://127.0.0.1:$Port") {
      $c = 0; $r = 0; [void][int]::TryParse($req.QueryString['cols'], [ref]$c); [void][int]::TryParse($req.QueryString['rows'], [ref]$r)
      [DeckTerm]::Start($ctx, $Shell, $TermDir, [Math]::Max($c, 20), [Math]::Max($r, 5)); return
    }
    $res.StatusCode = 403; try { $res.Close() } catch {}; return
  }
  if ($req.Url.AbsolutePath.StartsWith('/__demo/')) {   # demo setup, pre-flight checks, demo project stages: this deck window only
    $site = $req.Headers['Sec-Fetch-Site']; $origin = $req.Headers['Origin']
    $okSite = if ($req.HttpMethod -eq 'POST') { $origin -eq "http://127.0.0.1:$Port" } else { -not $site -or $site -eq 'same-origin' }
    if (-not ($web -and $req.QueryString['tk'] -eq $key -and $okSite)) { $res.StatusCode = 403; try { $res.Close() } catch {}; return }
    $op = $req.Url.AbsolutePath.Substring(8)
    if ($op -eq 'apply' -and -not $wb) { $res.StatusCode = 409; try { $res.Close() } catch {}; return }
    [DeckDemo]::DeckRoot = $rootFull; [DeckDemo]::Start($ctx, $Workspace, $op); return
  }
  if ($req.Url.AbsolutePath.StartsWith('/__fs/')) {   # the workbench's files: this deck window only, inside the demo folder only
    $site = $req.Headers['Sec-Fetch-Site']; $origin = $req.Headers['Origin']
    $okSite = if ($req.HttpMethod -eq 'POST') { $origin -eq "http://127.0.0.1:$Port" } else { -not $site -or $site -eq 'same-origin' }
    if (-not ($wb -and $req.QueryString['tk'] -eq $key -and $okSite)) { $res.StatusCode = 403; try { $res.Close() } catch {}; return }
    [DeckFs]::Start($ctx, $Workspace, $req.Url.AbsolutePath.Substring(6)); return
  }
  if ($req.Url.AbsolutePath -eq '/__open' -or $req.Url.AbsolutePath -eq '/__deckfull') {   # the deck's browser: this deck window only
    $site = $req.Headers['Sec-Fetch-Site']
    if (-not ($web -and $req.QueryString['tk'] -eq $key -and (-not $site -or $site -eq 'same-origin'))) { $res.StatusCode = 403; try { $res.Close() } catch {}; return }
    $deckPid = if ($proc) { $proc.Id } else { 0 }
    if ($req.Url.AbsolutePath -eq '/__deckfull') { [DeckWin]::DeckFull($deckPid) }
    else {
      $u = [string]$req.QueryString['url']
      if ($u -notmatch '^https?://') { $res.StatusCode = 400; try { $res.Close() } catch {}; return }
      $b = DefaultBrowser
      if ($b) { [DeckWin]::Open($b, $u, $deckPid) } else { Start-Process $u }
    }
    $res.StatusCode = 204; try { $res.Close() } catch {}; return
  }
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
  if ($term) { [DeckTerm]::CloseAll() }
  $http.Stop(); $http.Close()
  if ($prof) { Start-Sleep -Milliseconds 500; Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $prof }
}
