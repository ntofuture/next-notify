<# : build.bat
@echo off
setlocal
set "NN_BUILD=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create([IO.File]::ReadAllText($env:NN_BUILD)))" %*
set "code=%errorlevel%"
echo.
if not "%code%"=="0" echo Build failed (exit code %code%).
pause
exit /b %code%
#>

param(
    [string]$Version,
    [string]$DownloadBase = 'https://storage.nextofuture.com/applications/next-notify',
    [string]$Mode
)

$ErrorActionPreference = 'Stop'

$root = Split-Path $env:NN_BUILD -Parent
$app = Join-Path $root 'app'
$dist = Join-Path $app 'dist'

$nodeDir = Join-Path $env:NVM_HOME 'v24.14.0'
if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) { throw "Node.js 24.14.0 not found in ${nodeDir}. Install it with: nvm install 24.14.0" }
$env:Path = "$nodeDir;$env:Path"

$modes = @{ '1' = 'build'; '2' = 'installer' }
if (-not $Mode) {
    Write-Host '1. Build: app folder to try locally (publish\)'
    Write-Host '2. Installer: installer and update files for the server (installer\)'
    while (-not $Mode) { $Mode = $modes[(Read-Host 'Choose 1 or 2').Trim()] }
}
elseif ($Mode -notin $modes.Values) { throw "Not a mode: $Mode (use build or installer)" }
$out = Join-Path $root $(if ($Mode -eq 'build') { 'publish' } else { 'installer' })

$current = (Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json).version
$versionPattern = '^\d+\.\d+\.\d+$'
if ($Mode -eq 'build') { $Version = $current }
elseif (-not $Version) {
    while ($true) {
        $answer = (Read-Host "Version [$current] (Enter keeps it)").Trim()
        if (-not $answer) { $Version = $current; break }
        if ($answer -match $versionPattern) { $Version = $answer; break }
        Write-Host 'Use major.minor.patch, e.g. 2.0.1.' -ForegroundColor Yellow
    }
}
elseif ($Version -notmatch $versionPattern) { throw "Not a version: $Version (use major.minor.patch, e.g. 2.0.1)" }

Push-Location $app
try {
    if ($Version -ne $current) {
        if ([version]$Version -lt [version]$current) {
            Write-Warning "$Version is older than ${current}: installed copies only update to a newer version."
        }
        npm.cmd version $Version --no-git-tag-version | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'npm version failed' }
        Write-Host "Version changed: $current -> $Version (app\package.json, app\package-lock.json)"
    }

    if (-not (Test-Path (Join-Path $app 'node_modules'))) {
        Write-Host 'Installing packages ...'
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    }

    Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Building Next Notify $Version ..."
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    if ($Mode -eq 'build') {
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
        npx.cmd electron-builder --dir
        if ($LASTEXITCODE -ne 0) { throw 'electron-builder --dir failed' }
    }
    else {
        npm.cmd run dist
        if ($LASTEXITCODE -ne 0) { throw 'npm run dist failed' }
    }
}
finally {
    Pop-Location
}

Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $out | Out-Null

if ($Mode -eq 'build') {
    $unpacked = Join-Path $dist 'win-unpacked'
    if (-not (Test-Path $unpacked)) { throw "No app folder found in $dist" }
    Copy-Item $unpacked -Destination $out -Recurse
    Write-Host ''
    Write-Host "Ready: $(Join-Path $out 'win-unpacked\Next Notify.exe')"
    Write-Host 'Quit the installed Next Notify before starting it: only one copy can run.'
    return
}

$files = Get-ChildItem $dist -File | Where-Object { $_.Name -like "Next-Notify-*$Version*" -or $_.Name -like 'latest*.yml' }
if (-not $files) { throw "No installer found in $dist" }
$files | Copy-Item -Destination $out

$installers = $files | Where-Object { $_.Name -notlike 'latest*.yml' } | Sort-Object Name
$feeds = $files | Where-Object { $_.Name -like 'latest*.yml' } | Sort-Object Name

Write-Host ''
Write-Host "Ready in ${out}:"
foreach ($file in @($installers) + @($feeds)) { Write-Host ("  {0} ({1:N1} MB)" -f $file.Name, ($file.Length / 1MB)) }
Write-Host ''
Write-Host "Upload everything in $out to $DownloadBase/ in this order:"
Write-Host '  1. the installers and .blockmap files'
Write-Host ("  2. last: {0}" -f (($feeds | ForEach-Object Name) -join ', '))
