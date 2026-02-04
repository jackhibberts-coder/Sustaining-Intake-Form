<#
.SYNOPSIS
    Processes and sends all pending emails for the Sustaining Intake Form system.

.DESCRIPTION
    This script runs hourly to:
    1. Fetch all unsent info request emails
    2. Fetch all unsent response notification emails
    3. Send each email via Outlook COM
    4. Mark each as sent via the API

.NOTES
    Requires:
    - Microsoft Outlook to be installed and running
    - Network access to Google Apps Script API

.EXAMPLE
    .\process-pending-emails.ps1

    Run manually or via Windows Task Scheduler every hour
#>

# ============================================
# CONFIGURATION
# ============================================
$Config = @{
    GoogleScriptUrl = "https://script.google.com/macros/s/AKfycbxPURU2dD3o13f-SiCSZcZcBTjjw3NjwBzLIyBgsDnSP6Om4g1GpNWYXvyW-QnQ726C/exec"
    ResponseFormUrl = "https://jackhibberts-coder.github.io/Sustaining-Intake-Form/respond.html"
    ReviewFormUrl = "https://jackhibberts-coder.github.io/Sustaining-Intake-Form/review.html"
    EngineerEmail = "JackH@repfitness.com"
    EngineerName = "Jack Hibberts"
    LogFile = "$PSScriptRoot\logs\email-processing-$(Get-Date -Format 'yyyy-MM-dd').log"
}

# Ensure log directory exists
$logDir = Split-Path $Config.LogFile -Parent
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# ============================================
# LOGGING FUNCTIONS
# ============================================
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"

    # Write to console
    switch ($Level) {
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
        default { Write-Host $logMessage }
    }

    # Write to log file
    Add-Content -Path $Config.LogFile -Value $logMessage
}

# ============================================
# API FUNCTIONS
# ============================================
function Get-UnsentInfoRequests {
    try {
        $url = "$($Config.GoogleScriptUrl)?action=getUnsentInfoRequests"
        $response = Invoke-RestMethod -Uri $url -Method Get -ContentType "application/json"

        if ($response.success) {
            return $response.unsentRequests
        }
        return @()
    }
    catch {
        Write-Log "Error fetching unsent info requests: $_" -Level "ERROR"
        return @()
    }
}

function Get-UnsentNotifications {
    try {
        $url = "$($Config.GoogleScriptUrl)?action=getUnsentNotifications"
        $response = Invoke-RestMethod -Uri $url -Method Get -ContentType "application/json"

        if ($response.success) {
            return $response.unsentNotifications
        }
        return @()
    }
    catch {
        Write-Log "Error fetching unsent notifications: $_" -Level "ERROR"
        return @()
    }
}

function Mark-InfoRequestEmailed {
    param(
        [string]$PacketId,
        [string]$RequestId
    )

    try {
        $body = @{
            action = "markInfoRequestEmailed"
            packetId = $PacketId
            requestId = $RequestId
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri $Config.GoogleScriptUrl -Method Post -Body $body -ContentType "text/plain;charset=utf-8"
        return $response.success
    }
    catch {
        Write-Log "Error marking info request as emailed: $_" -Level "ERROR"
        return $false
    }
}

function Mark-ResponseNotificationEmailed {
    param(
        [string]$PacketId,
        [string]$RequestId,
        [int]$ResponseIndex
    )

    try {
        $body = @{
            action = "markResponseNotificationEmailed"
            packetId = $PacketId
            requestId = $RequestId
            responseIndex = $ResponseIndex
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri $Config.GoogleScriptUrl -Method Post -Body $body -ContentType "text/plain;charset=utf-8"
        return $response.success
    }
    catch {
        Write-Log "Error marking response notification as emailed: $_" -Level "ERROR"
        return $false
    }
}

# ============================================
# EMAIL FUNCTIONS
# ============================================
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

        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($mail) | Out-Null
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null

        return $true
    }
    catch {
        Write-Log "Failed to send email to $To : $_" -Level "ERROR"
        return $false
    }
}

function Build-InfoRequestEmailHtml {
    param(
        [string]$RecipientName,
        [string]$ProjectTitle,
        [string]$RequesterName,
        [string]$Question,
        [string]$Problem,
        [string]$RequestedAction,
        [string]$ResponseUrl
    )

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; }
        .header { background: #000; color: #fff; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; }
        .content { padding: 25px; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .project-box { background: #f8f8f8; border-left: 4px solid #EB5628; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .project-title { font-weight: 600; font-size: 18px; color: #000; margin-bottom: 10px; }
        .project-meta { font-size: 14px; color: #666; }
        .question-box { background: #fff3e0; border: 1px solid #ffcc80; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .question-label { font-size: 12px; color: #e65100; text-transform: uppercase; font-weight: 600; margin-bottom: 8px; }
        .question-text { font-size: 16px; color: #333; }
        .context-section { margin: 20px 0; }
        .context-section h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
        .context-text { background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px; }
        .cta-button { display: block; background: #EB5628; color: #fff !important; padding: 15px 30px; text-decoration: none; border-radius: 4px; text-align: center; font-size: 16px; font-weight: 600; margin: 25px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; text-align: center; }
        .note { background: #e3f2fd; padding: 12px; border-radius: 4px; font-size: 13px; color: #1565c0; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Information Request</h1>
    </div>

    <div class="content">
        <div class="greeting">
            Hi $([System.Web.HttpUtility]::HtmlEncode($RecipientName)),
        </div>

        <p>You have been assigned to provide information for a sustaining engineering request. Please review the details below and submit your response.</p>

        <div class="project-box">
            <div class="project-title">$([System.Web.HttpUtility]::HtmlEncode($ProjectTitle))</div>
            <div class="project-meta">
                <strong>Requested by:</strong> $([System.Web.HttpUtility]::HtmlEncode($RequesterName))
            </div>
        </div>

        <div class="question-box">
            <div class="question-label">Information Needed</div>
            <div class="question-text">$([System.Web.HttpUtility]::HtmlEncode($Question))</div>
        </div>
"@

    if (-not [string]::IsNullOrEmpty($Problem)) {
        $html += @"
        <div class="context-section">
            <h3>Problem Description</h3>
            <div class="context-text">$([System.Web.HttpUtility]::HtmlEncode($Problem))</div>
        </div>
"@
    }

    if (-not [string]::IsNullOrEmpty($RequestedAction)) {
        $html += @"
        <div class="context-section">
            <h3>Requested Action</h3>
            <div class="context-text">$([System.Web.HttpUtility]::HtmlEncode($RequestedAction))</div>
        </div>
"@
    }

    $html += @"
        <a href="$ResponseUrl" class="cta-button">Submit Your Response</a>

        <div class="note">
            <strong>Note:</strong> Please respond as soon as possible to help move this request forward. If you have questions, please contact the sustaining engineering team.
        </div>
    </div>

    <div class="footer">
        <p>This is an automated email from the Sustaining Intake Form system.</p>
        <p>If you believe you received this in error, please contact the engineering team.</p>
    </div>
</body>
</html>
"@

    return $html
}

function Build-ResponseNotificationEmailHtml {
    param(
        [string]$ProjectTitle,
        [string]$Question,
        [string]$ResponderName,
        [string]$ResponseText,
        [string]$RespondedAt,
        [string]$ReviewUrl
    )

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; }
        .header { background: #000; color: #fff; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; }
        .content { padding: 25px; }
        .project-box { background: #f8f8f8; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .project-title { font-weight: 600; font-size: 18px; color: #000; margin-bottom: 10px; }
        .question-text { font-size: 14px; color: #666; margin-bottom: 15px; }
        .response-box { background: #d1fae5; border: 1px solid #6ee7b7; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .response-label { font-size: 12px; color: #065f46; text-transform: uppercase; font-weight: 600; margin-bottom: 8px; }
        .response-meta { font-size: 13px; color: #047857; margin-bottom: 10px; }
        .response-text { font-size: 15px; color: #333; white-space: pre-wrap; }
        .cta-button { display: block; background: #EB5628; color: #fff !important; padding: 15px 30px; text-decoration: none; border-radius: 4px; text-align: center; font-size: 16px; font-weight: 600; margin: 25px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Response Received</h1>
    </div>

    <div class="content">
        <p>A response has been submitted for an information request you created.</p>

        <div class="project-box">
            <div class="project-title">$([System.Web.HttpUtility]::HtmlEncode($ProjectTitle))</div>
            <div class="question-text"><strong>Original Question:</strong> $([System.Web.HttpUtility]::HtmlEncode($Question))</div>
        </div>

        <div class="response-box">
            <div class="response-label">Response Received</div>
            <div class="response-meta">
                <strong>From:</strong> $([System.Web.HttpUtility]::HtmlEncode($ResponderName)) | <strong>Date:</strong> $RespondedAt
            </div>
            <div class="response-text">$([System.Web.HttpUtility]::HtmlEncode($ResponseText))</div>
        </div>

        <a href="$ReviewUrl" class="cta-button">View Full Request</a>
    </div>

    <div class="footer">
        <p>This is an automated email from the Sustaining Intake Form system.</p>
    </div>
</body>
</html>
"@

    return $html
}

# ============================================
# PROCESSING FUNCTIONS
# ============================================
function Process-InfoRequests {
    Write-Log "Fetching unsent info requests..."
    $unsentRequests = Get-UnsentInfoRequests

    if ($unsentRequests.Count -eq 0) {
        Write-Log "No unsent info requests found."
        return @{ sent = 0; failed = 0 }
    }

    Write-Log "Found $($unsentRequests.Count) unsent info request(s) to process."

    $sentCount = 0
    $failedCount = 0

    foreach ($request in $unsentRequests) {
        Write-Log "Processing info request: $($request.requestId) for project '$($request.projectTitle)'"

        foreach ($recipient in $request.assignedTo) {
            Write-Log "  Sending to: $($recipient.name) ($($recipient.email))"

            # Build response URL
            $responseUrl = "$($Config.ResponseFormUrl)?packetId=$([System.Uri]::EscapeDataString($request.packetId))&requestId=$([System.Uri]::EscapeDataString($request.requestId))&email=$([System.Uri]::EscapeDataString($recipient.email))&name=$([System.Uri]::EscapeDataString($recipient.name))"

            # Build email HTML
            $htmlBody = Build-InfoRequestEmailHtml `
                -RecipientName $recipient.name `
                -ProjectTitle $request.projectTitle `
                -RequesterName $request.requesterName `
                -Question $request.question `
                -Problem $request.problem `
                -RequestedAction $request.requestedAction `
                -ResponseUrl $responseUrl

            $subject = "Information Request: $($request.projectTitle)"

            # Send email
            $result = Send-OutlookEmail -To $recipient.email -Subject $subject -HtmlBody $htmlBody

            if ($result) {
                Write-Log "    Email sent successfully" -Level "SUCCESS"
            }
            else {
                $failedCount++
            }
        }

        # Mark as emailed (even if some recipients failed, to avoid duplicate sends)
        $markResult = Mark-InfoRequestEmailed -PacketId $request.packetId -RequestId $request.requestId
        if ($markResult) {
            $sentCount++
            Write-Log "  Marked request as emailed" -Level "SUCCESS"
        }
        else {
            Write-Log "  Failed to mark request as emailed" -Level "WARNING"
        }
    }

    return @{ sent = $sentCount; failed = $failedCount }
}

function Process-ResponseNotifications {
    Write-Log "Fetching unsent response notifications..."
    $unsentNotifications = Get-UnsentNotifications

    if ($unsentNotifications.Count -eq 0) {
        Write-Log "No unsent response notifications found."
        return @{ sent = 0; failed = 0 }
    }

    Write-Log "Found $($unsentNotifications.Count) unsent response notification(s) to process."

    $sentCount = 0
    $failedCount = 0

    foreach ($notification in $unsentNotifications) {
        Write-Log "Processing response notification for project '$($notification.projectTitle)'"
        Write-Log "  Response from: $($notification.responderName)"

        # Build review URL
        $reviewUrl = "$($Config.ReviewFormUrl)?id=$([System.Uri]::EscapeDataString($notification.packetId))"

        # Format responded date
        try {
            $respondedDate = [DateTime]::Parse($notification.respondedAt)
            $respondedAtFormatted = $respondedDate.ToString("MMM d, yyyy 'at' h:mm tt")
        }
        catch {
            $respondedAtFormatted = $notification.respondedAt
        }

        # Build email HTML
        $htmlBody = Build-ResponseNotificationEmailHtml `
            -ProjectTitle $notification.projectTitle `
            -Question $notification.question `
            -ResponderName $notification.responderName `
            -ResponseText $notification.responseText `
            -RespondedAt $respondedAtFormatted `
            -ReviewUrl $reviewUrl

        $subject = "Response Received: $($notification.projectTitle)"

        # Send email to engineer
        $result = Send-OutlookEmail -To $Config.EngineerEmail -Subject $subject -HtmlBody $htmlBody

        if ($result) {
            Write-Log "  Email sent to engineer" -Level "SUCCESS"

            # Mark as emailed
            $markResult = Mark-ResponseNotificationEmailed `
                -PacketId $notification.packetId `
                -RequestId $notification.requestId `
                -ResponseIndex $notification.responseIndex

            if ($markResult) {
                $sentCount++
                Write-Log "  Marked notification as emailed" -Level "SUCCESS"
            }
            else {
                Write-Log "  Failed to mark notification as emailed" -Level "WARNING"
            }
        }
        else {
            $failedCount++
        }
    }

    return @{ sent = $sentCount; failed = $failedCount }
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Log "========================================"
Write-Log "Sustaining Intake Email Processor"
Write-Log "========================================"

# Process info requests
$infoResults = Process-InfoRequests

Write-Log ""

# Process response notifications
$notificationResults = Process-ResponseNotifications

Write-Log ""
Write-Log "========================================"
Write-Log "Summary"
Write-Log "========================================"
Write-Log "Info Requests: $($infoResults.sent) sent, $($infoResults.failed) failed"
Write-Log "Notifications: $($notificationResults.sent) sent, $($notificationResults.failed) failed"

$totalFailed = $infoResults.failed + $notificationResults.failed
if ($totalFailed -gt 0) {
    Write-Log "Completed with $totalFailed error(s)" -Level "WARNING"
    exit 1
}
else {
    Write-Log "Completed successfully" -Level "SUCCESS"
    exit 0
}
