param(
  [string]$TaskName = "NTU CBA Daily Draft"
)

$ErrorActionPreference = "Stop"

Write-Output "TaskName: $TaskName"

try {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
} catch {
  Write-Output "Installed: false"
  Write-Output "Detail: Unable to query Windows Task Scheduler. $($_.Exception.Message)"
  exit 0
}

if ($null -eq $task) {
  Write-Output "Installed: false"
  Write-Output "Detail: Run npm.cmd run schedule:install to create the daily draft task."
  exit 0
}

Write-Output "Installed: true"
Write-Output "State: $($task.State)"

try {
  $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
  Write-Output "LastRunTime: $($info.LastRunTime)"
  Write-Output "LastTaskResult: $($info.LastTaskResult)"
  Write-Output "NextRunTime: $($info.NextRunTime)"
} catch {
  Write-Output "Detail: Installed, but task run info could not be read. $($_.Exception.Message)"
}
