param(
  [string]$TaskName = "NTU CBA Daily Draft",
  [string]$Time = "09:15",
  [switch]$DryRun,
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$logDir = Join-Path $projectRoot ".tmp"
$outLog = Join-Path $logDir "daily-generate.out.log"
$errLog = Join-Path $logDir "daily-generate.err.log"

function Show-Plan {
  param([string]$Mode)

  Write-Output "Mode: $Mode"
  Write-Output "TaskName: $TaskName"
  Write-Output "ProjectRoot: $projectRoot"
  Write-Output "Npm: $npm"
  Write-Output "Time: $Time"
  Write-Output "Command: npm.cmd run generate"
  Write-Output "Stdout: $outLog"
  Write-Output "Stderr: $errLog"
}

if ($Uninstall) {
  Show-Plan "uninstall"
  if ($DryRun) {
    Write-Output "Dry run only. No scheduled task removed."
    exit 0
  }

  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "Scheduled task removed if it existed."
  exit 0
}

Show-Plan "install"
if ($DryRun) {
  Write-Output "Dry run only. No scheduled task created."
  exit 0
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$argument = "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location -LiteralPath '$projectRoot'; & '$npm' run generate > '$outLog' 2> '$errLog'`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Generate one NTU CBA Xiaohongshu draft every day." -Force | Out-Null

Write-Output "Scheduled task installed."
Write-Output "Use scripts/install-daily-task.ps1 -Uninstall to remove it."
