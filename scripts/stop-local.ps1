param(
  [int[]]$Ports = @(8787, 5173),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-ListeningProcessIds {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($connections) {
    return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
  }

  $matches = netstat -ano | Select-String -Pattern "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  return @($matches | ForEach-Object { [int]$_.Matches[0].Groups[1].Value } | Select-Object -Unique)
}

foreach ($port in $Ports) {
  $processIds = Get-ListeningProcessIds -Port $port
  if (-not $processIds) {
    Write-Output "No listener on port $port."
    continue
  }

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) {
      Write-Output "Process $processId for port $port already exited."
      continue
    }

    $message = "Stop port $port process $processId ($($process.ProcessName))"
    if ($DryRun) {
      Write-Output "Dry run: $message"
    } else {
      Stop-Process -Id $processId -Force
      Write-Output $message
    }
  }
}
