param(
  [int]$ServerPort = 8787,
  [int]$ClientPort = 5173
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $projectRoot ".tmp"
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-PortListening {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Start-NpmScript {
  param(
    [string]$ScriptName,
    [string]$OutLog,
    [string]$ErrLog
  )

  Start-Process `
    -FilePath $npm `
    -ArgumentList @("run", $ScriptName) `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog | Out-Null
}

if (-not (Test-PortListening -Port $ServerPort)) {
  Start-NpmScript `
    -ScriptName "dev:server" `
    -OutLog (Join-Path $logDir "server.out.log") `
    -ErrLog (Join-Path $logDir "server.err.log")
  Write-Output "Started backend on port $ServerPort."
} else {
  Write-Output "Backend already listening on port $ServerPort."
}

if (-not (Test-PortListening -Port $ClientPort)) {
  Start-NpmScript `
    -ScriptName "dev:client" `
    -OutLog (Join-Path $logDir "client.out.log") `
    -ErrLog (Join-Path $logDir "client.err.log")
  Write-Output "Started frontend on port $ClientPort."
} else {
  Write-Output "Frontend already listening on port $ClientPort."
}

Write-Output "Frontend: http://127.0.0.1:$ClientPort"
Write-Output "Backend: http://127.0.0.1:$ServerPort"
Write-Output "Logs: $logDir"
Write-Output "Run npm.cmd run health after a few seconds to verify."
