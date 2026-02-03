<#
.SYNOPSIS
    Sends notification email to engineer when a PoC submits a response.

.DESCRIPTION
    This script notifies the engineer that an information request has been
    responded to by a team member.

.PARAMETER PacketId
    The ID of the data packet

.PARAMETER ProjectTitle
    The title of the project/request

.PARAMETER ResponderName
    Name of the person who responded

.PARAMETER ResponderEmail
    Email of the person who responded

.NOTES
    Requires Microsoft Outlook to be installed and running.

.EXAMPLE
    .\send-response-notification.ps1 -PacketId "2026-02-03..." -ProjectTitle "Test Request" -ResponderName "John Doe" -ResponderEmail "john@example.com"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$PacketId,

    [Parameter(Mandatory=$true)]
    [string]$ProjectTitle,

    [Parameter(Mandatory=$true)]
    [string]$ResponderName,

    [Parameter(Mandatory=$true)]
    [string]$ResponderEmail
)

# ============================================
# CONFIGURATION
# ============================================
$Config = @{
    ReviewFormUrl = "https://jackhibberts-coder.github.io/Sustaining-Intake-Form/review.html"
    EngineerEmail = "JackH@repfitness.com"
    EngineerName = "Jack Hibberts"
}

# ============================================
# FUNCTIONS
# ============================================

function Build-NotificationEmailHtml {
    param(
        [string]$EngineerName,
        [string]$ProjectTitle,
        [string]$ResponderName,
        [string]$ReviewUrl
    )

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #16a34a; color: #fff; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .content { padding: 25px; }
        .notification-box { background: #f0fdf4; border: 1px solid #86efac; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center; }
        .notification-icon { font-size: 48px; margin-bottom: 10px; }
        .project-title { font-weight: 600; font-size: 18px; color: #000; margin: 15px 0 5px; }
        .responder { color: #666; font-size: 14px; }
        .cta-button { display: inline-block; background: #16a34a; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600; margin-top: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Response Received</h1>
    </div>

    <div class="content">
        <p>Hi $([System.Web.HttpUtility]::HtmlEncode($EngineerName)),</p>

        <div class="notification-box">
            <div class="notification-icon">&#10003;</div>
            <p>A response has been submitted for your information request.</p>
            <div class="project-title">$([System.Web.HttpUtility]::HtmlEncode($ProjectTitle))</div>
            <div class="responder">Response from: <strong>$([System.Web.HttpUtility]::HtmlEncode($ResponderName))</strong></div>
        </div>

        <p style="text-align: center;">
            <a href="$ReviewUrl" class="cta-button">Review Response</a>
        </p>
    </div>

    <div class="footer">
        <p>This is an automated notification from the Sustaining Intake Form system.</p>
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

        Write-Host "Email sent successfully to $To" -ForegroundColor Green

        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($mail) | Out-Null
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null

        return $true
    }
    catch {
        Write-Error "Failed to send email: $_"
        return $false
    }
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Send Response Notification" -ForegroundColor Cyan
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nProject: $ProjectTitle" -ForegroundColor Yellow
Write-Host "Responder: $ResponderName ($ResponderEmail)" -ForegroundColor Yellow
Write-Host "Notifying: $($Config.EngineerName) ($($Config.EngineerEmail))" -ForegroundColor Yellow

# Build review URL
$reviewUrl = "$($Config.ReviewFormUrl)?id=$([System.Uri]::EscapeDataString($PacketId))"

# Build email HTML
$htmlBody = Build-NotificationEmailHtml `
    -EngineerName $Config.EngineerName `
    -ProjectTitle $ProjectTitle `
    -ResponderName $ResponderName `
    -ReviewUrl $reviewUrl

$subject = "Response Received: $ProjectTitle (from $ResponderName)"

# Send email
Write-Host "`nSending notification..." -ForegroundColor Yellow
$result = Send-OutlookEmail -To $Config.EngineerEmail -Subject $subject -HtmlBody $htmlBody

if ($result) {
    Write-Host "`nNotification sent successfully!" -ForegroundColor Green
}
else {
    Write-Host "`nFailed to send notification." -ForegroundColor Red
    exit 1
}
