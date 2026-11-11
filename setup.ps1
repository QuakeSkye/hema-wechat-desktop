param([string]$Proxy)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This helper is tested on Windows x64 only.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$info = (& $node -p 'JSON.stringify({major:Number(process.versions.node.split(String.fromCharCode(46))[0]),arch:process.arch})') | ConvertFrom-Json
if ($info.major -lt 22 -or $info.arch -ne 'x64') { throw 'Install Node.js 22 or newer, Windows x64. Node.js 24 x64 is the tested version.' }
$oldPath = $env:PATH
$oldProxy = $env:npm_config_proxy
$oldHttpsProxy = $env:npm_config_https_proxy
Push-Location $PSScriptRoot
try {
    if ($Proxy) { $env:npm_config_proxy=$Proxy; $env:npm_config_https_proxy=$Proxy }
    # Install the lockfile without automatically running third-party lifecycle scripts.
    & $npm ci --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed. Check network access to registry.npmjs.org.' }
    $env:PATH = (Join-Path $PSScriptRoot 'node_modules\.bin') + [IO.Path]::PathSeparator + $oldPath
    # Frida's audited installer downloads its official version-matched binary.
    Push-Location (Join-Path $PSScriptRoot 'node_modules\frida')
    try {
        & $node 'scripts\install.js'
        if ($LASTEXITCODE -ne 0) { throw 'Frida binary installation failed. Check GitHub release download access; optionally supply -Proxy.' }
    } finally { Pop-Location }
    & $node --input-type=module -e "import * as f from 'frida'; await f.getLocalDevice(); console.log('Frida local runtime ready');"
    if ($LASTEXITCODE -ne 0) { throw 'Frida local runtime is unavailable.' }
    & $npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Source validation failed.' }
    Write-Output 'Setup complete. Open the WeChat mini-program list, run start-hema.cmd, then open Hema.'
} finally {
    $env:PATH=$oldPath
    $env:npm_config_proxy=$oldProxy
    $env:npm_config_https_proxy=$oldHttpsProxy
    Pop-Location
}
