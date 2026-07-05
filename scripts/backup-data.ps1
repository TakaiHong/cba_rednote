param(
  [string]$OutDir = "backups",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$source = Join-Path $projectRoot "data/posts.json"
$backupRoot = Join-Path $projectRoot $OutDir
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $backupRoot "posts-$timestamp.json"

if (-not (Test-Path -LiteralPath $source)) {
  Write-Output "No data file found at $source. Nothing to back up."
  exit 0
}

Write-Output "Source: $source"
Write-Output "Target: $target"

if ($DryRun) {
  Write-Output "Dry run only. No backup created."
  exit 0
}

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
Copy-Item -LiteralPath $source -Destination $target
Write-Output "Backup created: $target"
