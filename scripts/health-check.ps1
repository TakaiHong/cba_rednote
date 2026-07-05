param(
  [int]$ServerPort = 8787,
  [int]$ClientPort = 5173
)

$ErrorActionPreference = "Stop"

function Assert-PortListening {
  param(
    [int]$Port,
    [string]$Name
  )

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connection) {
    throw "$Name is not listening on port $Port."
  }

  Write-Output "$Name port OK: $Port"
}

function Assert-JsonEndpoint {
  param(
    [string]$Url,
    [string]$Name
  )

  $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 10
  if (-not $response.ok) {
    throw "$Name returned ok=false."
  }

  return $response
}

Assert-PortListening -Port $ServerPort -Name "Backend"
Assert-PortListening -Port $ClientPort -Name "Frontend"

$health = Assert-JsonEndpoint -Url "http://127.0.0.1:$ServerPort/api/health" -Name "Health"
$status = Assert-JsonEndpoint -Url "http://127.0.0.1:$ServerPort/api/status" -Name "Status"

Write-Output "Health OK: http://127.0.0.1:$ServerPort/api/health"
Write-Output "Status OK: http://127.0.0.1:$ServerPort/api/status"
Write-Output "Service: $($health.service)"
Write-Output "Posts: total=$($status.counts.total), approved=$($status.counts.approved), published=$($status.counts.published)"
Write-Output "Recommendation: $($status.strategy.recommendation)"
