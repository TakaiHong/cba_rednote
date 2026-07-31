param(
  [string]$TaskName = "NTU CBA Reddit Link Collector",
  [string]$Time = "10:00",
  [string]$Query = "NTU",
  [ValidateRange(1, 100)]
  [int]$Limit = 50,
  [ValidateRange(0, 300)]
  [int]$WaitSeconds = 0,
  [switch]$DryRun,
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$logDir = Join-Path $projectRoot ".tmp"
$outLog = Join-Path $logDir "reddit-collector.out.log"
$errLog = Join-Path $logDir "reddit-collector.err.log"
$userId = "$env:USERDOMAIN\$env:USERNAME"

function Show-Plan {
  param([string]$Mode)

  Write-Output "Mode: $Mode"
  Write-Output "TaskName: $TaskName"
  Write-Output "ProjectRoot: $projectRoot"
  Write-Output "User: $userId (interactive logon only)"
  Write-Output "Time: $Time"
  Write-Output "Command: npm.cmd run reddit:collect-links -- --query $Query --limit $Limit --wait-seconds $WaitSeconds"
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

# The task only runs while this Windows user is signed in, so its visible Chrome profile and normal Reddit login state stay available.
$argument = "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location -LiteralPath '$projectRoot'; & '$npm' run reddit:collect-links -- --query '$Query' --limit $Limit --wait-seconds $WaitSeconds > '$outLog' 2> '$errLog'`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Collect new public Reddit NTU post links through the attended Chrome profile." -Force | Out-Null

Write-Output "Scheduled task installed."
Write-Output "It runs only while $userId is signed in."
Write-Output "Use scripts/install-reddit-collector-task.ps1 -Uninstall to remove it."
