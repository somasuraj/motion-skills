# Present a deck from a remote Linux machine: everything that runs (terminal, workbench files, demo projects, checks) runs
# there; the deck is shown here, in its own window, through an SSH tunnel. Optional: used only by "Present (Remote Linux).cmd".
#   powershell -ExecutionPolicy Bypass -File remote.ps1 -Page talk.html
# Settings: _present\remote.txt (asked for the first time). Needs the OpenSSH client (built into Windows 10/11) and, on the
# Linux machine, Python 3. Sign-in is SSH's own (a key, or a password typed into this window); nothing is stored by the deck.
# Written by the motion skills' presenter kit.
param([string]$Page = 'index.html')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cfgFile = Join-Path $PSScriptRoot 'remote.txt'

function Read-Cfg {
  $c = @{ host = ''; folder = ''; forward = '8000 8080 9000' }
  if (Test-Path $cfgFile) { foreach ($l in Get-Content $cfgFile) { if ($l -match '^\s*(host|folder|forward)\s*[:=]\s*(.*)$') { $c[$Matches[1]] = $Matches[2].Trim() } } }
  return $c
}
$cfg = Read-Cfg
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { Write-Host 'The OpenSSH client is missing. Windows: Settings > Apps > Optional features > OpenSSH Client.'; exit 1 }
if (-not $cfg.host) {
  Write-Host 'Present from a remote Linux machine. (Saved in _present\remote.txt; edit it any time.)'
  $cfg.host = Read-Host 'The Linux machine (user@host, or user@host:port)'
  $deckName = [System.IO.Path]::GetFileNameWithoutExtension($Page)
  $f = Read-Host "Folder for the deck on that machine [~/decks/$deckName]"; $cfg.folder = if ($f) { $f } else { "~/decks/$deckName" }
  $w = Read-Host "Demo ports to bring to this computer [$($cfg.forward)]"; if ($w) { $cfg.forward = $w }
  @("# Present (Remote Linux): where this deck runs. host: user@host or user@host:port. folder: the deck's folder there.",
    "# forward: ports of demo apps on that machine to open here as localhost (space-separated).",
    "host: $($cfg.host)", "folder: $($cfg.folder)", "forward: $($cfg.forward)") | Set-Content -Path $cfgFile -Encoding UTF8
}
$target = $cfg.host; $sshPort = @()
if ($target -match '^(.+):(\d+)$') { $target = $Matches[1]; $sshPort = @('-p', $Matches[2]) }
$folder = $cfg.folder; if (-not $folder) { $folder = '~/decks/' + [System.IO.Path]::GetFileNameWithoutExtension($Page) }
$rfolder = $folder -replace '^~/', '$HOME/'   # expanded by the remote shell

# 1. reach the machine and find Python 3 there
Write-Host "Connecting to $target ..."
& ssh @sshPort -o ConnectTimeout=10 $target "command -v python3 >/dev/null || { echo NO_PYTHON; exit 3; }; mkdir -p `"$rfolder`" && echo READY"
if ($LASTEXITCODE -eq 3) { Write-Host 'Python 3 is not installed on that machine (it runs the deck there). Install it, for example: sudo apt install python3'; exit 1 }
if ($LASTEXITCODE -ne 0) { Write-Host "Could not reach $target over SSH (exit $LASTEXITCODE). Check the address in _present\remote.txt and your SSH key."; exit 1 }

# 2. copy the deck, the kit and the demo projects (the machine's own demo.json and workspace.txt are kept)
Write-Host 'Copying the deck to that machine ...'
$items = @($Page, '_present') + @('demo-projects' | Where-Object { Test-Path (Join-Path $root $_) })
Push-Location $root
try {
  $excl = '--exclude=_present/demo.json --exclude=_present/workspace.txt --exclude=_present/remote.txt'
  cmd /c "tar -czf - $excl $($items -join ' ') | ssh $($sshPort -join ' ') $target `"tar -xzf - -C $rfolder`""
  if ($LASTEXITCODE -ne 0) { Write-Host 'Copying failed.'; exit 1 }
} finally { Pop-Location }

# 3. a port free here; the same number is used there, so the page's address is the same on both ends
$probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0); $probe.Start(); $port = $probe.LocalEndpoint.Port; $probe.Stop()
$fwd = @('-L', "${port}:127.0.0.1:$port")
foreach ($p in ($cfg.forward -split '[\s,]+' | Where-Object { $_ -match '^\d+$' })) {
  $busy = $false; try { $t = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, [int]$p); $t.Start(); $t.Stop() } catch { $busy = $true }
  if ($busy) { Write-Host "Port $p is in use on this computer: not forwarded." } else { $fwd += @('-L', "${p}:127.0.0.1:$p") }
}

# 4. start the deck's server there (it ends when this connection closes) and wait for its address
Write-Host 'Starting the deck on that machine ...'
$psi = New-Object System.Diagnostics.ProcessStartInfo 'ssh'
$psi.Arguments = (@($sshPort) + @('-tt', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=15') + $fwd + @($target, "cd `"$rfolder`" && exec python3 _present/serve.py `"$Page`" --no-browser --remote --port $port")) -join ' '
$psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true
$ssh = [System.Diagnostics.Process]::Start($psi)
$url = $null; $deadline = (Get-Date).AddSeconds(60)
while (-not $url -and (Get-Date) -lt $deadline -and -not $ssh.HasExited) {
  $line = $ssh.StandardOutput.ReadLine(); if ($line -eq $null) { break }
  Write-Host "  $line"
  if ($line -match '(http://127\.0\.0\.1:\d+/\S+)') { $url = $Matches[1] }
}
if (-not $url) { Write-Host 'The deck did not start on that machine (see above).'; try { $ssh.Kill() } catch {}; exit 1 }

# 5. the deck in its own window here; closing it ends the connection, which stops the server there
$cands = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LocalAppData\Google\Chrome\Application\chrome.exe")
$exe = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$prof = Join-Path ([System.IO.Path]::GetTempPath()) ('present-' + [guid]::NewGuid().ToString('N'))
try {
  if ($exe) {
    $proc = Start-Process -FilePath $exe -PassThru -ArgumentList @("--app=$url", "--user-data-dir=`"$prof`"", '--no-first-run', '--no-default-browser-check', '--window-size=1600,940')
    Write-Host "The deck runs on $target and is shown here. Close its window to stop."
    while (-not $proc.HasExited -and -not $ssh.HasExited) { Start-Sleep -Milliseconds 300 }
    if ($ssh.HasExited) { Write-Host 'The connection to the Linux machine closed.' }
  } else { Start-Process $url; Write-Host 'Opened in your default browser. Press Enter here when you are done.'; Read-Host | Out-Null }
} finally {
  try { if (-not $ssh.HasExited) { $ssh.Kill() } } catch {}
  Start-Sleep -Milliseconds 500; Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $prof
}
