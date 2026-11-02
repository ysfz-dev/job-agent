# Registers the two scheduled tasks that make this thing live in the system
# rather than in a terminal:
#
#   JobAgent Daily      08:00 every day  -> fetch, score, write letters
#   JobAgent Dashboard  at logon         -> serve http://localhost:7171
#
# Both run hidden, under your own account, with no admin rights needed. Closing
# VS Code, closing the terminal, and rebooting all leave them running.
#
#   powershell -ExecutionPolicy Bypass -File scripts\install-tasks.ps1
#
# To remove them again:
#   Unregister-ScheduledTask -TaskName 'JobAgent Daily','JobAgent Dashboard' -Confirm:$false

$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $PSScriptRoot
$node   = (Get-Command node).Source
$vbs    = Join-Path $root 'scripts\hidden.vbs'
$daily  = Join-Path $root 'src\daily.js'
$serve  = Join-Path $root 'src\serve.js'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'

Write-Host "root : $root"
Write-Host "node : $node"
Write-Host ""

# Run as the current user, only when logged on. That is what we want: the
# dashboard is a localhost page, so it is useless when nobody is at the machine.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# --- daily pass -------------------------------------------------------------
$dailyAction  = New-ScheduledTaskAction -Execute $wscript -Argument "`"$vbs`" `"$node`" `"$daily`"" -WorkingDirectory $root
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At 8:00am

Register-ScheduledTask -TaskName 'JobAgent Daily' `
    -Action $dailyAction -Trigger $dailyTrigger -Principal $principal -Settings $settings `
    -Description 'Fetch jobs, score against profile, write cover letters.' `
    -Force | Out-Null
Write-Host "registered: JobAgent Daily      (08:00 daily)" -ForegroundColor Green

# --- dashboard --------------------------------------------------------------
# The server must not be killed after an hour like the daily pass, so it gets
# its own settings with no execution time limit.
$serveSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

$serveAction  = New-ScheduledTaskAction -Execute $wscript -Argument "`"$vbs`" `"$node`" `"$serve`"" -WorkingDirectory $root
$serveTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

Register-ScheduledTask -TaskName 'JobAgent Dashboard' `
    -Action $serveAction -Trigger $serveTrigger -Principal $principal -Settings $serveSettings `
    -Description 'Serve the job-agent dashboard on http://localhost:7171.' `
    -Force | Out-Null
Write-Host "registered: JobAgent Dashboard  (at logon)" -ForegroundColor Green

Write-Host ""
Write-Host "Starting both now so you do not have to reboot..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName 'JobAgent Dashboard'
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Done. Dashboard: http://localhost:7171" -ForegroundColor Cyan
Write-Host "Run the first pass now with:  npm run daily"
