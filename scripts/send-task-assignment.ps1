<#
.SYNOPSIS
    Sends task assignment notification emails to subitem owners.

.DESCRIPTION
    This script notifies team members when they have been assigned a task
    (subitem) for a sustaining engineering request that has been pushed
    to Monday.com.

.PARAMETER Subitems
    JSON array of subitems [{name, ownerName, ownerEmail, dueDate}]

.PARAMETER ProjectTitle
    The title of the project/request

.PARAMETER MondayItemId
    The Monday.com item ID for linking

.NOTES
    Requires Microsoft Outlook to be installed and running.

.EXAMPLE
    .\send-task-assignment.ps1 -Subitems '[{"name":"Update drawing","ownerName":"John","ownerEmail":"john@example.com","dueDate":"2026-02-15"}]' -ProjectTitle "Test Request" -MondayItemId "12345"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Subitems,

    [Parameter(Mandatory=$true)]
    [string]$ProjectTitle,

    [Parameter(Mandatory=$true)]
    [string]$MondayItemId
)

# ============================================
# CONFIGURATION
# ============================================
$Config = @{
    MondayBoardUrl = "https://rep-fitness.monday.com/boards/8281967707/views/200096331"
}

# ============================================
# FUNCTIONS
# ============================================

function Format-Date {
    param([string]$DateString)

    if ([string]::IsNullOrEmpty($DateString)) {
        return "No due date set"
    }

    try {
        $date = [DateTime]::Parse($DateString)
        return $date.ToString("dddd, MMMM d, yyyy")
    }
    catch {
        return $DateString
    }
}

function Build-TaskAssignmentEmailHtml {
    param(
        [string]$RecipientName,
        [string]$TaskName,
        [string]$ProjectTitle,
        [string]$DueDate,
        [string]$MondayUrl
    )

    $dueDateFormatted = Format-Date -DateString $DueDate
    $hasDueDate = -not [string]::IsNullOrEmpty($DueDate)

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #000; color: #fff; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .content { padding: 25px; }
        .task-box { background: #f8f8f8; border-left: 4px solid #EB5628; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .task-name { font-weight: 600; font-size: 18px; color: #000; margin-bottom: 10px; }
        .task-project { color: #666; font-size: 14px; margin-bottom: 15px; }
        .task-due { background: $(if ($hasDueDate) { "#fef3c7" } else { "#f3f4f6" }); padding: 10px 15px; border-radius: 4px; display: inline-block; }
        .task-due-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .task-due-date { font-weight: 600; color: $(if ($hasDueDate) { "#92400e" } else { "#6b7280" }); }
        .cta-button { display: block; background: #EB5628; color: #fff !important; padding: 15px 30px; text-decoration: none; border-radius: 4px; text-align: center; font-size: 16px; font-weight: 600; margin: 25px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; text-align: center; }
        .instructions { background: #e3f2fd; padding: 15px; border-radius: 4px; margin-top: 20px; }
        .instructions h3 { margin: 0 0 10px; font-size: 14px; color: #1565c0; }
        .instructions ol { margin: 0; padding-left: 20px; font-size: 14px; color: #1565c0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>New Task Assigned</h1>
    </div>

    <div class="content">
        <p>Hi $([System.Web.HttpUtility]::HtmlEncode($RecipientName)),</p>

        <p>You have been assigned a new task for a sustaining engineering project. Please review the details below.</p>

        <div class="task-box">
            <div class="task-name">$([System.Web.HttpUtility]::HtmlEncode($TaskName))</div>
            <div class="task-project">Project: <strong>$([System.Web.HttpUtility]::HtmlEncode($ProjectTitle))</strong></div>
            <div class="task-due">
                <div class="task-due-label">Due Date</div>
                <div class="task-due-date">$dueDateFormatted</div>
            </div>
        </div>

        <a href="$MondayUrl" class="cta-button">View in Monday.com</a>

        <div class="instructions">
            <h3>Next Steps:</h3>
            <ol>
                <li>Open the task in Monday.com using the button above</li>
                <li>Review the project details and requirements</li>
                <li>Update the task status as you make progress</li>
                <li>Mark as complete when finished</li>
            </ol>
        </div>
    </div>

    <div class="footer">
        <p>This is an automated notification from the Sustaining Intake Form system.</p>
        <p>If you have questions about this task, please contact the sustaining engineering team.</p>
    </div>
</body>
</html>
"@

    return $html
}

function Send-OutlookEmail {
    param(
        [string]$To,
        [string]$Subject,
        [string]$HtmlBody
    )

    try {
        $outlook = New-Object -ComObject Outlook.Application
        $mail = $outlook.CreateItem(0)

        $mail.To = $To
        $mail.Subject = $Subject
        $mail.HTMLBody = $HtmlBody

        $mail.Send()

        Write-Host "  Email sent to $To" -ForegroundColor Green

        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($mail) | Out-Null
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null

        return $true
    }
    catch {
        Write-Error "  Failed to send email to $To : $_"
        return $false
    }
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Send Task Assignment Notifications" -ForegroundColor Cyan
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Parse subitems
try {
    $subitemList = $Subitems | ConvertFrom-Json
}
catch {
    Write-Error "Failed to parse Subitems JSON: $_"
    exit 1
}

Write-Host "`nProject: $ProjectTitle" -ForegroundColor Yellow
Write-Host "Monday Item ID: $MondayItemId" -ForegroundColor Yellow
Write-Host "Processing $($subitemList.Count) task assignment(s)..." -ForegroundColor Yellow

# Build Monday.com URL
$mondayUrl = "$($Config.MondayBoardUrl)/pulses/$MondayItemId"

$successCount = 0
$failCount = 0
$skippedCount = 0

foreach ($subitem in $subitemList) {
    # Skip if no owner email
    if ([string]::IsNullOrEmpty($subitem.ownerEmail)) {
        Write-Host "`nSkipping task '$($subitem.name)' - no owner assigned" -ForegroundColor Gray
        $skippedCount++
        continue
    }

    Write-Host "`nProcessing: $($subitem.name)"
    Write-Host "  Owner: $($subitem.ownerName) ($($subitem.ownerEmail))"

    # Build email HTML
    $htmlBody = Build-TaskAssignmentEmailHtml `
        -RecipientName $subitem.ownerName `
        -TaskName $subitem.name `
        -ProjectTitle $ProjectTitle `
        -DueDate $subitem.dueDate `
        -MondayUrl $mondayUrl

    $subject = "Task Assigned: $($subitem.name) - $ProjectTitle"

    # Send email
    $result = Send-OutlookEmail -To $subitem.ownerEmail -Subject $subject -HtmlBody $htmlBody

    if ($result) {
        $successCount++
    }
    else {
        $failCount++
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Results: $successCount sent, $failCount failed, $skippedCount skipped" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "========================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
    exit 1
}
