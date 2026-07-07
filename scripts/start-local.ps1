param(
  [int]$ServerPort = 8787,
  [int]$ClientPort = 5173
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $projectRoot ".tmp"
$node = (Get-Command node.exe -ErrorAction Stop).Source
$tsxCli = Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs"
$viteCli = Join-Path $projectRoot "node_modules\vite\bin\vite.js"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-PortListening {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($connection) {
    return $true
  }

  return [bool]((netstat -ano | Select-String -Pattern ":$Port\s+.*LISTENING") -ne $null)
}

function Start-NpmScript {
  param(
    [string]$ScriptName,
    [string]$OutLog,
    [string]$ErrLog
  )

  if ($ScriptName -eq "dev:server") {
    $fileName = $node
    $arguments = "`"$tsxCli`" watch server/src/index.ts"
  } elseif ($ScriptName -eq "dev:client") {
    $fileName = $node
    $arguments = "`"$viteCli`" --host 127.0.0.1 --port 5173 client"
  } else {
    throw "Unsupported local script: $ScriptName"
  }

  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = $fileName
  $processInfo.Arguments = $arguments
  $processInfo.WorkingDirectory = $projectRoot
  $processInfo.UseShellExecute = $true
  $processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  try {
    Set-Content -Path $OutLog -Value "Started $ScriptName via System.Diagnostics.ProcessStartInfo." -Encoding utf8
    Set-Content -Path $ErrLog -Value "" -Encoding utf8
  } catch {
    Write-Output "Could not initialize log files for $ScriptName; continuing startup."
  }
  [System.Diagnostics.Process]::Start($processInfo) | Out-Null
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
