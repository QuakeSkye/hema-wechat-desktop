param([switch]$Repair)
$ErrorActionPreference = 'Stop'
$nodePath = (Get-Command node.exe).Source
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\frida\build\frida_binding.node'))) { throw 'Run install.cmd first. Frida dependencies are missing.' }
# Hema-specific launch is validated only for 26073; do not guess native offsets.
$runtimeProcesses = @(Get-CimInstance Win32_Process -Filter "name = 'WeChatAppEx.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' })
$versions = @($runtimeProcesses | ForEach-Object { $match=[regex]::Match($_.CommandLine,'RadiumWMPF[\\/](\d+)[\\/]'); if ($match.Success) { [int]$match.Groups[1].Value } } | Select-Object -Unique)
if ($versions.Count -eq 0) { throw 'Open the mini-program list in WeChat first; then run start-hema.cmd before opening Hema.' }
if ($versions.Count -ne 1 -or $versions[0] -ne 26073) { throw ('Unsupported WMPF version: ' + ($versions -join ',') + '. This Hema helper has been validated only on 26073. See docs/TROUBLESHOOTING.md.') }
if ($Repair) { & (Join-Path $PSScriptRoot 'stop-hema-debug.ps1') }
$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 62000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $owner = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $listener.OwningProcess)
    $ownerCommand = ([uri]::UnescapeDataString([string]$owner.CommandLine)).Replace('\','/')
    $rootMarker = $PSScriptRoot.Replace('\','/') + '/'
    if ($owner.Name -ne 'node.exe' -or $owner.CommandLine -notmatch 'src[/\\]index\.ts' -or $ownerCommand.IndexOf($rootMarker,[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Port 62000 belongs to another program or checkout' }
} else {
    if (-not (Get-Process WeChatAppEx -ErrorAction SilentlyContinue)) { throw 'Open the mini-program list in WeChat first, then run this launcher before opening Hema.' }
    $tsx = Join-Path $PSScriptRoot 'node_modules\tsx\dist\cli.mjs'
    $entry = Join-Path $PSScriptRoot 'src\index.ts'
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + $tsx + '"'),('"' + $entry + '"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'debugger.out.log') -RedirectStandardError (Join-Path $logDir 'debugger.err.log') | Out-Null
    $ready = $false
    for ($i=0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        $outLog = Join-Path $logDir 'debugger.out.log'
        if ((Test-Path -LiteralPath $outLog) -and ((Get-Content -LiteralPath $outLog -Raw) -match '\[frida\] script loaded')) { $ready=$true; break }
    }
    if (-not $ready) { throw 'Debugger did not start. Check logs/debugger.err.log.' }
}
$watchRunning = $false
$statePath = Join-Path $PSScriptRoot 'hema-watch-status.json'
if (Test-Path -LiteralPath $statePath) {
    $watchPid = (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).pid
    $watchProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $watchPid) -ErrorAction SilentlyContinue
    $watchCommand = ([uri]::UnescapeDataString([string]$watchProcess.CommandLine)).Replace('\','/')
    $watchRunning = $watchProcess.Name -eq 'node.exe' -and $watchProcess.CommandLine -match 'hema-watch\.mjs' -and $watchCommand.IndexOf(($PSScriptRoot.Replace('\','/') + '/'),[StringComparison]::OrdinalIgnoreCase) -ge 0
}
if (-not $watchRunning) {
    $watch = Join-Path $PSScriptRoot 'hema-watch.mjs'
    Start-Process -FilePath $nodePath -ArgumentList ('"' + $watch + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'watch.out.log') -RedirectStandardError (Join-Path $logDir 'watch.err.log') | Out-Null
}
Write-Output 'Hema helper is running. You can close and reopen Hema; the session patch will be reapplied automatically.'
