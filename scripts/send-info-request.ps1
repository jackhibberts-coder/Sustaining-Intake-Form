<#
.SYNOPSIS
    Sends information request emails to assigned team members.

.DESCRIPTION
    This script sends personalized emails to team members requesting
    specific information for a sustaining intake request.

.PARAMETER PacketId
    The ID of the data packet

.PARAMETER RequestId
    The ID of the specific info request

.PARAMETER Question
    The information being requested

.PARAMETER AssignedTo
    JSON array of assigned team members [{name, email}]

.PARAMETER ProjectTitle
    The title of the project/request

.PARAMETER RequesterName
    Name of the original requester

.NOTES
    Requires Microsoft Outlook to be installed and running.

.EXAMPLE
    .\send-info-request.ps1 -PacketId "2026-02-03..." -RequestId "req-123" -Question "Please provide quote" -AssignedTo '[{"name":"John","email":"john@example.com"}]' -ProjectTitle "Test Request" -RequesterName "Jane Doe"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$PacketId,

    [Parameter(Mandatory=$true)]
    [string]$RequestId,

    [Parameter(Mandatory=$true)]
    [string]$Question,

    [Parameter(Mandatory=$true)]
    [string]$AssignedTo,

    [Parameter(Mandatory=$true)]
    [string]$ProjectTitle,

    [Parameter(Mandatory=$true)]
    [string]$RequesterName,

    [string]$Problem = "",
    [string]$RequestedAction = ""
)

# ============================================
# CONFIGURATION
# ============================================
$Config = @{
    ResponseFormUrl = "https://jackhibberts-coder.github.io/Sustaining-Intake-Form/respond.html"
}

# ============================================
# FUNCTIONS
# ============================================

function Build-InfoRequestEmailHtml {
    param(
        [string]$RecipientName,
        [string]$RecipientEmail,
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
        .cta-button:hover { background: #d44a22; }
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
Write-Host "Send Information Request Emails" -ForegroundColor Cyan
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Parse assigned team members
try {
    $recipients = $AssignedTo | ConvertFrom-Json
}
catch {
    Write-Error "Failed to parse AssignedTo JSON: $_"
    exit 1
}

Write-Host "`nProject: $ProjectTitle" -ForegroundColor Yellow
Write-Host "Sending to $($recipients.Count) recipient(s)..." -ForegroundColor Yellow

$successCount = 0
$failCount = 0

foreach ($recipient in $recipients) {
    Write-Host "`nProcessing: $($recipient.name) ($($recipient.email))"

    # Build response URL with pre-filled parameters
    $responseUrl = "$($Config.ResponseFormUrl)?packetId=$([System.Uri]::EscapeDataString($PacketId))&requestId=$([System.Uri]::EscapeDataString($RequestId))&email=$([System.Uri]::EscapeDataString($recipient.email))&name=$([System.Uri]::EscapeDataString($recipient.name))"

    # Build email HTML
    $htmlBody = Build-InfoRequestEmailHtml `
        -RecipientName $recipient.name `
        -RecipientEmail $recipient.email `
        -ProjectTitle $ProjectTitle `
        -RequesterName $RequesterName `
        -Question $Question `
        -Problem $Problem `
        -RequestedAction $RequestedAction `
        -ResponseUrl $responseUrl

    $subject = "Information Request: $ProjectTitle"

    # Send email
    $result = Send-OutlookEmail -To $recipient.email -Subject $subject -HtmlBody $htmlBody

    if ($result) {
        $successCount++
    }
    else {
        $failCount++
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Results: $successCount sent, $failCount failed" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "========================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
    exit 1
}
