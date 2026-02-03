<#
.SYNOPSIS
    Sends daily digest email summarizing pending sustaining intake requests.

.DESCRIPTION
    This script reads pending data packets from Google Drive via the Apps Script API
    and sends a summary email to the engineer via Outlook COM.

.NOTES
    Requires:
    - Microsoft Outlook to be installed and running
    - Network access to Google Apps Script

.EXAMPLE
    .\send-daily-digest.ps1

    Run manually or via Windows Task Scheduler at 9:00 AM daily
#>

# ============================================
# CONFIGURATION
# ============================================
$Config = @{
    GoogleScriptUrl = "https://script.google.com/macros/s/AKfycbxPURU2dD3o13f-SiCSZcZcBTjjw3NjwBzLIyBgsDnSP6Om4g1GpNWYXvyW-QnQ726C/exec"
    ReviewFormUrl = "https://jackhibberts-coder.github.io/Sustaining-Intake-Form/review.html"
    EngineerEmail = "JackH@repfitness.com"
    EngineerName = "Jack Hibberts"
    SenderName = "Sustaining Intake System"
}

# ============================================
# FUNCTIONS
# ============================================

function Get-PendingPackets {
    <#
    .SYNOPSIS
        Fetches pending packets from the Google Apps Script API
    #>
    param([string]$Status = "pending")

    try {
        $url = "$($Config.GoogleScriptUrl)?action=listPackets&status=$Status"
        $response = Invoke-RestMethod -Uri $url -Method Get -ContentType "application/json"

        if ($response.success -and $response.packets) {
            return $response.packets
        }
        return @()
    }
    catch {
        Write-Warning "Error fetching $Status packets: $_"
        return @()
    }
}

function Format-Date {
    param([string]$DateString)

    if ([string]::IsNullOrEmpty($DateString)) {
        return "N/A"
    }

    try {
        $date = [DateTime]::Parse($DateString)
        return $date.ToString("MMM d, yyyy")
    }
    catch {
        return $DateString
    }
}

function Get-PriorityColor {
    param([string]$Priority)

    switch ($Priority.ToLower()) {
        "critical" { return "#dc2626" }
        "high"     { return "#ea580c" }
        "medium"   { return "#ca8a04" }
        "low"      { return "#16a34a" }
        default    { return "#6b7280" }
    }
}

function Build-DigestEmailHtml {
    param(
        [array]$PendingPackets,
        [array]$WaitingPackets,
        [array]$InReviewPackets
    )

    $totalCount = $PendingPackets.Count + $WaitingPackets.Count + $InReviewPackets.Count

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
        .header { background: #000; color: #fff; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0 0; color: #999; }
        .summary { background: #f8f8f8; padding: 15px; margin: 20px 0; border-radius: 8px; }
        .summary-stat { display: inline-block; margin-right: 30px; }
        .summary-stat .number { font-size: 28px; font-weight: bold; color: #EB5628; }
        .summary-stat .label { font-size: 12px; color: #666; text-transform: uppercase; }
        .section { margin: 25px 0; }
        .section h2 { font-size: 18px; color: #333; border-bottom: 2px solid #EB5628; padding-bottom: 8px; margin-bottom: 15px; }
        .packet { background: #fff; border: 1px solid #e5e5e5; border-left: 4px solid #EB5628; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
        .packet-title { font-weight: 600; font-size: 16px; margin-bottom: 5px; }
        .packet-meta { font-size: 13px; color: #666; }
        .packet-meta span { margin-right: 15px; }
        .priority { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; color: #fff; }
        .btn { display: inline-block; background: #EB5628; color: #fff !important; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 13px; margin-top: 10px; }
        .btn:hover { background: #d44a22; }
        .empty { color: #999; font-style: italic; padding: 20px; text-align: center; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; text-align: center; }
        .dashboard-link { display: block; background: #000; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sustaining Intake Daily Digest</h1>
        <p>$(Get-Date -Format "dddd, MMMM d, yyyy")</p>
    </div>

    <div class="summary">
        <div class="summary-stat">
            <div class="number">$totalCount</div>
            <div class="label">Total Active Requests</div>
        </div>
        <div class="summary-stat">
            <div class="number">$($PendingPackets.Count)</div>
            <div class="label">Pending Review</div>
        </div>
        <div class="summary-stat">
            <div class="number">$($WaitingPackets.Count)</div>
            <div class="label">Waiting for Info</div>
        </div>
    </div>

    <a href="$($Config.ReviewFormUrl)" class="dashboard-link">Open Review Dashboard</a>
"@

    # Pending Packets Section
    if ($PendingPackets.Count -gt 0) {
        $html += @"
    <div class="section">
        <h2>Pending Review ($($PendingPackets.Count))</h2>
"@
        foreach ($packet in $PendingPackets) {
            $priorityColor = Get-PriorityColor -Priority $packet.ecrPriority
            $reviewUrl = "$($Config.ReviewFormUrl)?id=$([System.Uri]::EscapeDataString($packet.id))"
            $html += @"
        <div class="packet">
            <div class="packet-title">$([System.Web.HttpUtility]::HtmlEncode($packet.requestTitle))</div>
            <div class="packet-meta">
                <span><strong>Requester:</strong> $([System.Web.HttpUtility]::HtmlEncode($packet.requesterName))</span>
                <span><strong>Category:</strong> $([System.Web.HttpUtility]::HtmlEncode($packet.category))</span>
                <span><strong>Priority:</strong> <span class="priority" style="background:$priorityColor">$([System.Web.HttpUtility]::HtmlEncode($packet.ecrPriority))</span></span>
                <span><strong>Submitted:</strong> $(Format-Date $packet.submittedAt)</span>
            </div>
            <a href="$reviewUrl" class="btn">Review Request</a>
        </div>
"@
        }
        $html += "    </div>"
    }
    else {
        $html += @"
    <div class="section">
        <h2>Pending Review</h2>
        <div class="empty">No pending requests - you're all caught up!</div>
    </div>
"@
    }

    # Waiting for Info Section
    if ($WaitingPackets.Count -gt 0) {
        $html += @"
    <div class="section">
        <h2>Waiting for Information ($($WaitingPackets.Count))</h2>
"@
        foreach ($packet in $WaitingPackets) {
            $reviewUrl = "$($Config.ReviewFormUrl)?id=$([System.Uri]::EscapeDataString($packet.id))"
            $html += @"
        <div class="packet" style="border-left-color: #f59e0b;">
            <div class="packet-title">$([System.Web.HttpUtility]::HtmlEncode($packet.requestTitle))</div>
            <div class="packet-meta">
                <span><strong>Requester:</strong> $([System.Web.HttpUtility]::HtmlEncode($packet.requesterName))</span>
                <span><strong>Submitted:</strong> $(Format-Date $packet.submittedAt)</span>
            </div>
            <a href="$reviewUrl" class="btn" style="background:#f59e0b;">Check Status</a>
        </div>
"@
        }
        $html += "    </div>"
    }

    # Footer
    $html += @"
    <div class="footer">
        <p>This is an automated email from the Sustaining Intake Form system.</p>
        <p>Do not reply to this email.</p>
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
        # Create Outlook COM object
        $outlook = New-Object -ComObject Outlook.Application
        $mail = $outlook.CreateItem(0)  # 0 = olMailItem

        $mail.To = $To
        $mail.Subject = $Subject
        $mail.HTMLBody = $HtmlBody

        # Send the email
        $mail.Send()

        Write-Host "Email sent successfully to $To" -ForegroundColor Green

        # Clean up COM objects
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
Write-Host "Sustaining Intake Daily Digest" -ForegroundColor Cyan
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Fetch packets
Write-Host "`nFetching pending packets..." -ForegroundColor Yellow
$pendingPackets = Get-PendingPackets -Status "pending"
Write-Host "  Found $($pendingPackets.Count) pending packets"

Write-Host "Fetching waiting packets..." -ForegroundColor Yellow
$waitingPackets = Get-PendingPackets -Status "waiting"
Write-Host "  Found $($waitingPackets.Count) waiting packets"

Write-Host "Fetching in-review packets..." -ForegroundColor Yellow
$inReviewPackets = Get-PendingPackets -Status "in-review"
Write-Host "  Found $($inReviewPackets.Count) in-review packets"

$totalCount = $pendingPackets.Count + $waitingPackets.Count + $inReviewPackets.Count

if ($totalCount -eq 0) {
    Write-Host "`nNo active requests found. Skipping email." -ForegroundColor Green
    exit 0
}

# Build and send email
Write-Host "`nBuilding digest email..." -ForegroundColor Yellow
$htmlBody = Build-DigestEmailHtml -PendingPackets $pendingPackets -WaitingPackets $waitingPackets -InReviewPackets $inReviewPackets

$subject = "Sustaining Intake Digest: $totalCount Active Request(s) - $(Get-Date -Format 'MMM d, yyyy')"

Write-Host "Sending email to $($Config.EngineerEmail)..." -ForegroundColor Yellow
$result = Send-OutlookEmail -To $Config.EngineerEmail -Subject $subject -HtmlBody $htmlBody

if ($result) {
    Write-Host "`nDaily digest sent successfully!" -ForegroundColor Green
}
else {
    Write-Host "`nFailed to send daily digest." -ForegroundColor Red
    exit 1
}
