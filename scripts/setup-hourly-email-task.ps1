<#
.SYNOPSIS
    Sets up the hourly email processing scheduled task.

.DESCRIPTION
    Creates a Windows scheduled task that runs every hour to process
    pending emails for the Sustaining Intake Form system.

.EXAMPLE
    .\setup-hourly-email-task.ps1

    Run as Administrator to create the scheduled task.
#>

$TaskName = "Sustaining Intake - Process Pending Emails"
$ScriptPath = "$PSScriptRoot\process-pending-emails.ps1"

# Check if script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "Error: Script not found at $ScriptPath" -ForegroundColor Red
    exit 1
}

# Check for existing task
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task '$TaskName' already exists." -ForegroundColor Yellow
    $response = Read-Host "Do you want to replace it? (y/n)"
    if ($response -ne 'y') {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Existing task removed." -ForegroundColor Green
}

# Create the task
Write-Host "Creating scheduled task..." -ForegroundColor Cyan

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$ScriptPath`"" `
    -WorkingDirectory $PSScriptRoot

# Run every hour
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours(8) -RepetitionInterval (New-TimeSpan -Hours 1)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Processes and sends pending emails for the Sustaining Intake Form system. Runs every hour."

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Scheduled task created successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Name: $TaskName"
    Write-Host "Schedule: Every hour"
    Write-Host "Script: $ScriptPath"
    Write-Host ""
    Write-Host "You can manage this task in Task Scheduler or using:" -ForegroundColor Cyan
    Write-Host "  - View: Get-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  - Run now: Start-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  - Disable: Disable-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  - Remove: Unregister-ScheduledTask -TaskName '$TaskName'"
}
catch {
    Write-Host "Error creating scheduled task: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to run this script as Administrator." -ForegroundColor Yellow
    exit 1
}
