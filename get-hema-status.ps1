$ErrorActionPreference = 'Stop'
$listener=Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 62000 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) { return [pscustomobject]@{state='stopped';name=''} }
$owner=Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $listener.OwningProcess)
$command=([uri]::UnescapeDataString([string]$owner.CommandLine)).Replace('\','/')
if ($owner.Name -ne 'node.exe' -or $command.IndexOf(($PSScriptRoot.Replace('\','/')+'/'),[StringComparison]::OrdinalIgnoreCase) -lt 0) { return [pscustomobject]@{state='port_conflict';name=''} }
$path=Join-Path $PSScriptRoot 'hema-watch-status.json'
if (Test-Path -LiteralPath $path) {
    try {
        $state=Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        $watch=Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $state.pid) -ErrorAction SilentlyContinue
        $watchCommand=([uri]::UnescapeDataString([string]$watch.CommandLine)).Replace('\','/')
        if ($watch.Name -eq 'node.exe' -and $watchCommand -match 'hema-watch\.mjs' -and $watchCommand.IndexOf(($PSScriptRoot.Replace('\','/')+'/'),[StringComparison]::OrdinalIgnoreCase) -ge 0) { return $state }
    } catch {}
}
return [pscustomobject]@{state='watcher_stopped';name=''}
