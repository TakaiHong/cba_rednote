param(
  [string]$TaskName = "NTU CBA Reddit Link Collector",
  [string]$Time = "10:00",
  [string]$Query = "NTU",
  [ValidateRange(1, 100)]
  [int]$Limit = 100,
  [ValidateRange(1, 100)]
  [int]$ContentLimit = 25,
  [ValidateRange(1, 30)]
  [int]$RequestDelaySeconds = 5,
  [ValidateSet(1, 2, 3, 4, 6)]
  [int]$RunsPerDay = 4,
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
  Write-Output "RunsPerDay: $RunsPerDay"
  Write-Output "Commands: reddit:collect-links (limit $Limit), then reddit:collect-content (limit $ContentLimit, delay $RequestDelaySeconds seconds, target 10000 posts, max 1 GB)"
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
$argument = "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location -LiteralPath '$projectRoot'; & '$npm' run reddit:collect-links -- --query '$Query' --limit $Limit --wait-seconds $WaitSeconds > '$outLog' 2> '$errLog'; if (`$LASTEXITCODE -eq 0) { & '$npm' run reddit:collect-content -- --limit $ContentLimit --request-delay-seconds $RequestDelaySeconds --target-posts 10000 --max-bytes 1gb --wait-seconds $WaitSeconds >> '$outLog' 2>> '$errLog' }`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$timeOfDay = [DateTime]::ParseExact($Time, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$baseRunAt = (Get-Date).Date.AddHours($timeOfDay.Hour).AddMinutes($timeOfDay.Minute)
$intervalHours = 24 / $RunsPerDay
$triggers = for ($run = 0; $run -lt $RunsPerDay; $run += 1) {
  New-ScheduledTaskTrigger -Daily -At $baseRunAt.AddHours($run * $intervalHours)
}
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description "Collect attended public Reddit NTU post links, then anonymized post and comment text within the local corpus cap." -Force | Out-Null

Write-Output "Scheduled task installed."
Write-Output "It runs only while $userId is signed in."
Write-Output "Use scripts/install-reddit-collector-task.ps1 -Uninstall to remove it."
