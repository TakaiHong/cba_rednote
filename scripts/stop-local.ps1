param(
  [int[]]$Ports = @(8787, 5173),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

foreach ($port in $Ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

  if (-not $connections) {
    Write-Output "No listener on port $port."
    continue
  }

  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
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
