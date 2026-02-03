<#
.SYNOPSIS
    Sets up the Windows Task Scheduler task for daily digest emails.

.DESCRIPTION
    This script imports the scheduled task for sending daily digest emails
    at 9:00 AM on weekdays.

.NOTES
    Run this script once to set up the scheduled task.
    Must be run with appropriate permissions.

.EXAMPLE
    .\setup-scheduled-task.ps1
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Daily Digest Scheduled Task" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$xmlPath = Join-Path $scriptPath "DailyDigestTask.xml"

if (-not (Test-Path $xmlPath)) {
    Write-Error "Task XML file not found: $xmlPath"
    exit 1
}

Write-Host "`nImporting scheduled task..." -ForegroundColor Yellow

try {
    # Create the task folder if it doesn't exist
    $scheduler = New-Object -ComObject Schedule.Service
    $scheduler.Connect()
    $rootFolder = $scheduler.GetFolder("\")

    try {
        $repFolder = $rootFolder.GetFolder("Rep Fitness")
    }
    catch {
        Write-Host "Creating task folder 'Rep Fitness'..." -ForegroundColor Yellow
        $repFolder = $rootFolder.CreateFolder("Rep Fitness")
    }

    # Register the task
    Register-ScheduledTask -TaskName "Rep Fitness\Sustaining Intake Daily Digest" -Xml (Get-Content $xmlPath -Raw) -Force

    Write-Host "`nScheduled task created successfully!" -ForegroundColor Green
    Write-Host "`nTask Details:" -ForegroundColor Cyan
    Write-Host "  Name: Sustaining Intake Daily Digest"
    Write-Host "  Schedule: Every weekday at 9:00 AM"
    Write-Host "  Action: Runs send-daily-digest.ps1"

    Write-Host "`nTo verify the task:" -ForegroundColor Yellow
    Write-Host "  1. Open Task Scheduler (taskschd.msc)"
    Write-Host "  2. Navigate to: Task Scheduler Library > Rep Fitness"
    Write-Host "  3. You should see 'Sustaining Intake Daily Digest'"

    Write-Host "`nTo run the task manually:" -ForegroundColor Yellow
    Write-Host "  Right-click the task > Run"
    Write-Host "  Or run: schtasks /run /tn `"Rep Fitness\Sustaining Intake Daily Digest`""

}
catch {
    Write-Error "Failed to create scheduled task: $_"
    Write-Host "`nAlternative: Import manually via Task Scheduler" -ForegroundColor Yellow
    Write-Host "  1. Open Task Scheduler (taskschd.msc)"
    Write-Host "  2. Action > Import Task..."
    Write-Host "  3. Select: $xmlPath"
    exit 1
}
