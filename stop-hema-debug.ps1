$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $watchState = Join-Path $PSScriptRoot 'hema-watch-status.json'
    if (Test-Path -LiteralPath $watchState) {
        $watchPid = (Get-Content -LiteralPath $watchState -Raw | ConvertFrom-Json).pid
        $watchProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $watchPid) -ErrorAction SilentlyContinue
        $watchCommand = ([uri]::UnescapeDataString([string]$watchProcess.CommandLine)).Replace('\','/')
        if ($watchProcess.Name -eq 'node.exe' -and $watchProcess.CommandLine -match 'hema-watch\.mjs' -and $watchCommand.IndexOf(($PSScriptRoot.Replace('\','/') + '/'),[StringComparison]::OrdinalIgnoreCase) -ge 0) { Stop-Process -Id $watchPid }
    }
    $listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 62000 -State Listen -ErrorAction SilentlyContinue
    if (-not $listener) { Write-Output 'Hema debugger is not running'; return }
    $debugProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $listener.OwningProcess)
    $debugCommand = ([uri]::UnescapeDataString([string]$debugProcess.CommandLine)).Replace('\','/')
    if ($debugProcess.Name -ne 'node.exe' -or $debugProcess.CommandLine -notmatch 'src[/\\]index\.ts' -or $debugCommand.IndexOf(($PSScriptRoot.Replace('\','/') + '/'),[StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw 'Port owner does not match the expected debugger; no process was stopped'
    }
    & node (Join-Path $PSScriptRoot 'hema-session.mjs') restore
    Stop-Process -Id $debugProcess.ProcessId
    Write-Output 'Session check restored and local debugger stopped. Close and reopen Hema for a completely fresh session.'
} finally { Pop-Location }
