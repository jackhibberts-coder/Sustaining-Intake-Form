# Sustaining Intake Form - Implementation Guide

This guide walks you through implementing and testing the workflow automation expansion.

---

## Prerequisites

- [ ] Microsoft Outlook installed and configured with your Rep Fitness account
- [ ] Access to Google Apps Script (script.google.com)
- [ ] Access to Monday.com with API token
- [ ] Windows PC for running PowerShell scripts
- [ ] Web hosting location (local file system works for testing)

---

## Phase 1: Google Apps Script Setup

### Step 1.1: Update Code.gs

1. Open Google Apps Script: https://script.google.com
2. Open your existing Sustaining Intake Form project
3. **BACKUP**: Copy your current Code.gs content somewhere safe
4. Replace the entire contents of Code.gs with the new version from this folder
5. Save the file (Ctrl+S)

### Step 1.2: Initialize Google Drive Folders

1. In the Apps Script editor, find the function dropdown (next to "Run" button)
2. Select `initializeFolders`
3. Click **Run**
4. If prompted, authorize the script to access Google Drive
5. Check the execution log (View > Execution log) - should say "Folder structure initialized"

**Verify:** Open Google Drive and look for a folder called `SustainingIntakePackets` with subfolders:
- pending
- in-review
- waiting
- approved
- pushed

### Step 1.3: Test Monday.com Connection

1. In the function dropdown, select `testConnection`
2. Click **Run**
3. Check execution log - should show "Connection successful!" with your board name

### Step 1.4: Deploy the Updated Script

1. Click **Deploy** > **Manage deployments**
2. Click the **pencil icon** (edit) on your existing deployment
3. Under "Version", select **New version**
4. Click **Deploy**
5. Copy the Web App URL (you'll need this for the next steps)

**Your URL should look like:**
```
https://script.google.com/macros/s/AKfycbx.../exec
```

### Step 1.5: Test the API

Open a browser and navigate to your deployment URL. You should see:
```json
{"success":true,"status":"OK","message":"Sustaining Intake Form API is running","version":"2.0"}
```

---

## Phase 2: Frontend Files Setup

### Step 2.1: Decide on Hosting

**Option A: Local File System (for testing)**
- Files can be opened directly from your computer
- URLs will be `file:///C:/Users/jackh/OneDrive...`

**Option B: Web Server (for production)**
- GitHub Pages, internal web server, etc.
- URLs will be `https://your-domain.com/...`

For this guide, we'll use **local file system** for testing.

### Step 2.2: Update JavaScript Configuration

You need to update the Google Apps Script URL in three files:

**File 1: script.js (Line 11)**
```javascript
GOOGLE_SCRIPT_URL: 'YOUR_DEPLOYMENT_URL_HERE',
```

**File 2: review.js (Line 9)**
```javascript
GOOGLE_SCRIPT_URL: 'YOUR_DEPLOYMENT_URL_HERE',
```

**File 3: respond.js (Line 9)**
```javascript
GOOGLE_SCRIPT_URL: 'YOUR_DEPLOYMENT_URL_HERE',
```

Replace `YOUR_DEPLOYMENT_URL_HERE` with your actual Google Apps Script deployment URL.

### Step 2.3: Verify Files Exist

Confirm these files are in your project folder:
- [ ] index.html
- [ ] review.html
- [ ] respond.html
- [ ] styles.css
- [ ] review.css
- [ ] respond.css
- [ ] script.js
- [ ] review.js
- [ ] respond.js
- [ ] REP_Logo_White_*.webp

---

## Phase 3: PowerShell Scripts Configuration

### Step 3.1: Update Script Configuration

Edit each PowerShell script in the `/scripts/` folder:

**send-daily-digest.ps1 (Lines 25-30)**
```powershell
$Config = @{
    GoogleScriptUrl = "YOUR_DEPLOYMENT_URL_HERE"
    ReviewFormUrl = "file:///C:/Users/jackh/OneDrive%20-%20Rep%20Fitness/Documents/SUSTAINING%20PROJECTS/SUSTAINING%20INTAKE%20FORM/review.html"
    EngineerEmail = "JackH@repfitness.com"
    EngineerName = "Jack Hibberts"
}
```

**send-info-request.ps1 (Lines 38-40)**
```powershell
$Config = @{
    ResponseFormUrl = "file:///C:/Users/jackh/OneDrive%20-%20Rep%20Fitness/Documents/SUSTAINING%20PROJECTS/SUSTAINING%20INTAKE%20FORM/respond.html"
}
```

**send-response-notification.ps1 (Lines 33-37)**
```powershell
$Config = @{
    ReviewFormUrl = "file:///C:/Users/jackh/OneDrive%20-%20Rep%20Fitness/Documents/SUSTAINING%20PROJECTS/SUSTAINING%20INTAKE%20FORM/review.html"
    EngineerEmail = "JackH@repfitness.com"
    EngineerName = "Jack Hibberts"
}
```

**send-task-assignment.ps1 (Lines 34-36)**
```powershell
$Config = @{
    MondayBoardUrl = "https://rep-fitness.monday.com/boards/8281967707/views/200096331"
}
```

### Step 3.2: Test PowerShell Execution Policy

Open PowerShell and run:
```powershell
Get-ExecutionPolicy
```

If it says "Restricted", you need to allow script execution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Phase 4: Testing Each Component

### Test 1: Intake Form Submission

1. Open `index.html` in your browser
2. Fill out all required fields with test data:
   - Requester Name: Your name
   - Category: Feature Change
   - Request Title: TEST - Delete Me
   - Problem: Test problem description
   - Requested Action: Test action
   - Testing Required: TBD
   - Suppliers: Not Selected
   - Cost Impact: No cost impact - test
   - ECO Release Date: Any future date
   - ECR Priority: Low
   - Inventory Disposition: N/A

3. Click **Submit Request**

**Expected Result:**
- Success modal shows "Request Submitted Successfully!"
- Modal displays a Request ID (timestamp-based)

**Verify in Google Drive:**
- Open `SustainingIntakePackets/pending/` folder
- You should see a new JSON file with your test data

### Test 2: Review Dashboard

1. Open `review.html` in your browser (no URL parameters)

**Expected Result:**
- Shows three sections: Pending Requests, Waiting for Information, In Review
- Your test submission should appear under "Pending Requests"

### Test 3: Review Single Packet

1. From the dashboard, click **Review** on your test packet
   (Or manually add `?id=YOUR_PACKET_ID` to the URL)

**Expected Result:**
- Full packet details displayed
- Two buttons: "Proceed to Monday.com" and "Request More Information"

### Test 4: Request Information Flow

1. On the review page, click **Request More Information**
2. In the panel that appears:
   - Select a template from dropdown (e.g., "Supplier quote needed")
   - The question field auto-fills with template text
   - Expand a team section (e.g., Quality)
   - Check one or more team members
3. Click **Send Information Requests**

**Expected Result:**
- Success message appears
- Packet moves to "waiting" status

**Verify:**
- Check Google Drive `SustainingIntakePackets/waiting/` folder
- The packet JSON should have `infoRequests` array populated

### Test 5: Response Form

1. Construct a response URL manually:
   ```
   respond.html?packetId=YOUR_PACKET_ID&requestId=YOUR_REQUEST_ID
   ```
   (Get these IDs from the packet JSON file)

2. Fill out the response form:
   - Your Name: Test Responder
   - Your Email: test@example.com
   - Response: Test response text

3. Click **Submit Response**

**Expected Result:**
- Success message: "Response Submitted Successfully!"

**Verify:**
- Check the packet JSON - the info request should have a response added

### Test 6: Proceed to Monday.com

1. Go back to `review.html?id=YOUR_PACKET_ID`
2. Click **Proceed to Monday.com**
3. In the panel:
   - Click **+ Add Subitem**
   - Select a template (e.g., "Update drawing")
   - Set a due date
   - Select an owner from dropdown
4. Click **Push to Monday.com**

**Expected Result:**
- Success message with link to Monday.com item
- Item created in Monday.com with subitems

**Verify in Monday.com:**
- Open your board
- Find the new item with your test title
- Expand subitems - your task should be there

### Test 7: Daily Digest Email

1. Open PowerShell
2. Navigate to scripts folder:
   ```powershell
   cd "C:\Users\jackh\OneDrive - Rep Fitness\Documents\SUSTAINING PROJECTS\SUSTAINING INTAKE FORM\scripts"
   ```
3. Run the digest script:
   ```powershell
   .\send-daily-digest.ps1
   ```

**Expected Result:**
- Console output shows packets found
- Email appears in your Outlook inbox
- Email contains summary of active requests

**Note:** Outlook must be running for this to work.

### Test 8: Info Request Email (Manual Test)

```powershell
.\send-info-request.ps1 `
  -PacketId "test-packet-id" `
  -RequestId "test-request-id" `
  -Question "Please provide a quote for this component" `
  -AssignedTo '[{"name":"Test User","email":"your-email@repfitness.com"}]' `
  -ProjectTitle "Test Project" `
  -RequesterName "Jack Hibberts"
```

**Expected Result:**
- Email arrives in the specified inbox
- Contains project context and question
- Has link to response form

### Test 9: Response Notification Email (Manual Test)

```powershell
.\send-response-notification.ps1 `
  -PacketId "test-packet-id" `
  -ProjectTitle "Test Project" `
  -ResponderName "Test User" `
  -ResponderEmail "test@example.com"
```

**Expected Result:**
- Email arrives at engineer's inbox
- Shows who responded and link to review

### Test 10: Task Assignment Email (Manual Test)

```powershell
.\send-task-assignment.ps1 `
  -Subitems '[{"name":"Update drawing","ownerName":"Test User","ownerEmail":"your-email@repfitness.com","dueDate":"2026-02-15"}]' `
  -ProjectTitle "Test Project" `
  -MondayItemId "12345678"
```

**Expected Result:**
- Email arrives with task details
- Shows task name, project, due date
- Links to Monday.com

---

## Phase 5: Set Up Scheduled Task

### Step 5.1: Run Setup Script

1. Open PowerShell **as Administrator**
2. Navigate to scripts folder:
   ```powershell
   cd "C:\Users\jackh\OneDrive - Rep Fitness\Documents\SUSTAINING PROJECTS\SUSTAINING INTAKE FORM\scripts"
   ```
3. Run setup:
   ```powershell
   .\setup-scheduled-task.ps1
   ```

**Expected Result:**
- Task created successfully message
- Task visible in Task Scheduler

### Step 5.2: Verify in Task Scheduler

1. Open Task Scheduler (search "Task Scheduler" in Start menu)
2. Navigate to: Task Scheduler Library > Rep Fitness
3. You should see "Sustaining Intake Daily Digest"
4. Right-click > **Run** to test manually

### Step 5.3: Adjust Schedule (Optional)

If you want to change the 9:00 AM schedule:
1. Right-click the task > Properties
2. Go to Triggers tab
3. Edit the trigger to your preferred time

---

## Phase 6: Clean Up Test Data

After testing is complete:

1. **Delete test packets from Google Drive:**
   - Open `SustainingIntakePackets` folder
   - Delete any test JSON files

2. **Delete test item from Monday.com:**
   - Find the test item on your board
   - Delete it

3. **Clear browser localStorage (optional):**
   - Open browser DevTools (F12)
   - Go to Application > Local Storage
   - Delete `repfitness_intake_draft` if present

---

## Troubleshooting

### "Failed to connect to server" on form submission

1. Check the Google Apps Script URL in script.js
2. Verify the script is deployed as a web app
3. Check browser console for CORS errors

### Emails not sending

1. Verify Outlook is running
2. Check PowerShell execution policy
3. Run scripts manually to see error output

### Packets not appearing in review dashboard

1. Check Google Drive folder permissions
2. Run `initializeFolders()` in Apps Script
3. Look at Apps Script execution logs for errors

### Monday.com item not created

1. Verify API token is valid
2. Check column IDs match your board
3. Run `testConnection()` in Apps Script

### Scheduled task not running

1. Check task is enabled in Task Scheduler
2. Verify PC is on and Outlook is running at scheduled time
3. Check task history for errors

---

## Quick Reference: File Locations

| What | Where |
|------|-------|
| Intake Form | `index.html` |
| Review Dashboard | `review.html` |
| Response Form | `respond.html?packetId=X&requestId=Y` |
| Data Packets | Google Drive > SustainingIntakePackets |
| Email Scripts | `scripts/` folder |
| Configuration | `config/` folder |
| Google Apps Script | script.google.com (your project) |

---

## Checklist Summary

- [ ] Code.gs updated and deployed
- [ ] Google Drive folders initialized
- [ ] JavaScript files have correct API URL
- [ ] PowerShell scripts have correct URLs
- [ ] Test 1: Intake form submission works
- [ ] Test 2: Review dashboard loads packets
- [ ] Test 3: Single packet review works
- [ ] Test 4: Info request creation works
- [ ] Test 5: Response form works
- [ ] Test 6: Monday.com push works
- [ ] Test 7: Daily digest email works
- [ ] Test 8: Info request email works
- [ ] Test 9: Response notification works
- [ ] Test 10: Task assignment email works
- [ ] Scheduled task created and verified
- [ ] Test data cleaned up

---

*Guide created: February 2026*
