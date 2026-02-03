# Sustaining Intake Form - Technical Documentation

## Project Overview

A web-based intake form system for Rep Fitness's Sustaining Engineering team. The system now includes a complete workflow automation that:

1. Allows users to submit engineering requests via the intake form
2. Saves requests as data packets for engineer review (not immediately to Monday.com)
3. Enables engineers to request additional information from team members
4. Allows team members to respond via a dedicated form
5. Pushes approved requests to Monday.com with subitems

**Live Form URL:** (Add hosting URL here after deployment)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Requester fills out intake form (index.html)                       │
│           ↓                                                                 │
│  STEP 2: Data Packet saved to Google Drive (Code.gs)                        │
│           ↓                                                                 │
│  STEP 3: Daily digest email sent to Engineer (PowerShell + Outlook)         │
│           ↓                                                                 │
│  STEP 4: Engineer reviews in review.html                                    │
│           │                                                                 │
│     ┌─────┴─────┐                                                           │
│     │           │                                                           │
│  PROCEED    REQUEST INFO                                                    │
│     │           │                                                           │
│     │     STEP 5: Info request emails sent (PowerShell + Outlook)           │
│     │           ↓                                                           │
│     │     STEP 6: PoC responds via respond.html                             │
│     │           ↓                                                           │
│     │     STEP 7: Notification email to engineer                            │
│     │           │ (loops back to Step 4)                                    │
│     ↓───────────┘                                                           │
│  STEP 8: Engineer creates subitems in review.html                           │
│           ↓                                                                 │
│  STEP 9: Item + subitems pushed to Monday.com                               │
│           ↓                                                                 │
│  STEP 10: Task assignment emails sent to subitem owners                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Core Files

| File | Purpose |
|------|---------|
| `index.html` | Main intake form interface |
| `review.html` | Engineer review/triage interface |
| `respond.html` | PoC information response form |
| `styles.css` | Base styling (Rep Fitness branding) |
| `review.css` | Review interface styles |
| `respond.css` | Response form styles |
| `script.js` | Intake form client-side logic |
| `review.js` | Review interface client-side logic |
| `respond.js` | Response form client-side logic |
| `Code.gs` | Google Apps Script backend |

### Configuration Files

| File | Purpose |
|------|---------|
| `config/poc-directory.json` | Team members organized by team (27 PoCs) |
| `config/subitem-owners.json` | Task assignees (28 people: all PoCs + Haley Moe) |
| `config/subitem-templates.json` | Predefined subitem task templates |
| `config/info-request-templates.json` | Predefined info request templates |

### PowerShell Scripts

| File | Purpose |
|------|---------|
| `scripts/send-daily-digest.ps1` | Sends morning digest email to engineer |
| `scripts/send-info-request.ps1` | Sends info request emails to PoCs |
| `scripts/send-response-notification.ps1` | Notifies engineer of PoC responses |
| `scripts/send-task-assignment.ps1` | Notifies owners of assigned tasks |
| `scripts/setup-scheduled-task.ps1` | Sets up Windows Task Scheduler |
| `scripts/DailyDigestTask.xml` | Task Scheduler configuration |

### Data Storage

| Location | Purpose |
|----------|---------|
| `data-packets/pending/` | Unreviewed intake submissions |
| `data-packets/in-review/` | Packets being triaged |
| `data-packets/waiting/` | Packets with pending info requests |
| `data-packets/approved/` | Ready to push to Monday.com |

**Note:** Data packets are stored in Google Drive under `SustainingIntakePackets/[status]/`

---

## Setup Instructions

### 1. Google Apps Script Setup

1. Open Google Apps Script (script.google.com)
2. Create a new project
3. Copy contents of `Code.gs` into the editor
4. Run `initializeFolders()` once to create Google Drive folder structure
5. Run `testConnection()` to verify Monday.com API works
6. Deploy as Web App:
   - Deploy > New deployment > Web app
   - Execute as: Me
   - Who has access: Anyone
7. Copy the deployment URL to all JavaScript files' `CONFIG.GOOGLE_SCRIPT_URL`

### 2. Frontend Hosting

Host these files on a web server (GitHub Pages, internal server, etc.):
- `index.html`, `review.html`, `respond.html`
- `styles.css`, `review.css`, `respond.css`
- `script.js`, `review.js`, `respond.js`
- `REP_Logo_White_*.webp`

Update all JavaScript files with the correct URLs:
- `CONFIG.GOOGLE_SCRIPT_URL` - Your Google Apps Script deployment URL
- Review/respond form URLs in PowerShell scripts

### 3. PowerShell Scripts Setup

1. Update URLs in all PowerShell scripts:
   - `$Config.GoogleScriptUrl` - Google Apps Script URL
   - `$Config.ReviewFormUrl` - URL to review.html
   - `$Config.EngineerEmail` - Engineer's email address

2. Ensure Outlook is installed and configured on the machine running scripts

3. Set up the scheduled task:
   ```powershell
   cd "path\to\scripts"
   .\setup-scheduled-task.ps1
   ```

   Or import manually via Task Scheduler using `DailyDigestTask.xml`

### 4. Monday.com Setup

1. Ensure the board has subitems enabled
2. Verify column IDs match in `Code.gs` COLUMN_IDS mapping
3. Run `getColumnIds()` if column IDs need updating

---

## Code.gs Functions

### Entry Points

| Function | Purpose |
|----------|---------|
| `doGet(e)` | Handles GET requests (packet retrieval, config, etc.) |
| `doPost(e)` | Handles POST requests (submissions, updates, etc.) |

### GET Actions (`?action=`)

| Action | Parameters | Purpose |
|--------|------------|---------|
| `getPacket` | `id` | Retrieve a single data packet |
| `listPackets` | `status` | List packets by status |
| `getConfig` | `type` | Get configuration data |
| `getInfoRequest` | `packetId`, `requestId` | Get info request for response form |

### POST Actions (`action` in body)

| Action | Purpose |
|--------|---------|
| `submitIntake` | Save new intake form submission |
| `updatePacket` | Update existing packet |
| `submitInfoRequest` | Engineer creates info requests |
| `submitResponse` | PoC submits response |
| `approveAndPush` | Push item to Monday.com |

### Data Packet Storage

| Function | Purpose |
|----------|---------|
| `saveDataPacket(packet)` | Save packet to Google Drive |
| `getDataPacket(packetId)` | Retrieve packet by ID |
| `updateDataPacket(id, updates, history)` | Update packet with history |
| `movePacketToStatus(id, old, new)` | Move packet between status folders |
| `listPacketsByStatus(status)` | List all packets in a status |

### Monday.com Functions

| Function | Purpose |
|----------|---------|
| `createMondayItem(formData)` | Creates item in Monday.com |
| `createMondaySubitems(parentId, subitems)` | Creates subitems under item |
| `buildColumnValues(formData)` | Maps form data to column formats |

---

## Data Packet Structure

```json
{
  "id": "2026-02-03T09-00-00-000Z-request-title",
  "status": "pending|in-review|waiting|approved|pushed",
  "submittedAt": "2026-02-03T09:00:00.000Z",
  "submittedBy": "Requester Name",
  "formData": {
    "requesterName": "...",
    "category": "...",
    "requestTitle": "...",
    "problem": "...",
    "requestedAction": "...",
    "testingRequired": "...",
    "suppliers": "...",
    "costImpact": "...",
    "ecoReleaseDate": "...",
    "ecrPriority": "...",
    "inventoryDisposition": "..."
  },
  "infoRequests": [
    {
      "id": "request-id",
      "templateId": "template-id",
      "question": "Information needed",
      "assignedTo": [{"name": "...", "email": "..."}],
      "createdAt": "...",
      "responses": [
        {
          "respondedAt": "...",
          "responderName": "...",
          "responderEmail": "...",
          "responseText": "..."
        }
      ],
      "status": "pending|completed"
    }
  ],
  "subitems": [
    {
      "name": "Task name",
      "ownerEmail": "...",
      "ownerName": "...",
      "dueDate": "2026-02-15"
    }
  ],
  "mondayItemId": "12345678",
  "history": [
    {
      "action": "created|info_requested|response_received|pushed_to_monday",
      "timestamp": "...",
      "by": "...",
      "details": "..."
    }
  ]
}
```

---

## Team Points of Contact

### Quality (11 people)
Joe Litchford, Dan Wells, Allen Shen, Shuailei Huang, Ammy Guan, Gray Li, Leon Zhang, John Yao, Ryan Shi, Ken Liao, Kent Lin

### Product (3 people)
Jason Lazar, Keenen Peck-Valdivia, Laura Doody-Bouwer

### Sourcing (3 people)
Greg Dahlstrom, Joe Lin, Ellan Zhang

### NPI (6 people)
Bryan Hamilton, Joe Larson, Mark Wilding, Jason Fitzwater, Jay Nedrow, Chet Roe

### Drafting (2 people)
Drew Forsterer, Ron Manzanares

### Sustaining (1 person)
Jason Morgan

### Tech Writing (1 person)
Alex Solome

### Additional Subitem Owner
Haley Moe (Product)

---

## Troubleshooting

### Daily digest not sending

1. Check that Outlook is running
2. Verify Google Apps Script URL is accessible
3. Check Task Scheduler task is enabled
4. Run script manually to see error output

### Info request emails not sending

1. Verify Outlook COM object can be created
2. Check recipient email addresses are valid
3. Run PowerShell script manually with verbose output

### Form submission fails

1. Check browser console for errors
2. Verify Google Apps Script deployment URL
3. Check Google Apps Script execution logs

### Packet not appearing in review dashboard

1. Verify Google Drive folder structure exists
2. Run `initializeFolders()` in Apps Script
3. Check packet was saved successfully

---

## Configuration

### script.js / review.js / respond.js CONFIG

```javascript
const CONFIG = {
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/.../exec',
    MONDAY_BOARD_URL: 'https://rep-fitness.monday.com/boards/8281967707/views/200096331',
    DRAFT_KEY: 'repfitness_intake_draft',
    AUTOSAVE_DELAY: 1000,
    TOTAL_FIELDS: 11
};
```

### Code.gs Configuration

```javascript
const MONDAY_API_TOKEN = 'eyJ...';  // Monday.com API token
const BOARD_ID = '8281967707';       // Monday.com board ID
```

### PowerShell Configuration

Each script has a `$Config` hashtable with:
- `GoogleScriptUrl` - API endpoint
- `ReviewFormUrl` / `ResponseFormUrl` - Form URLs
- `EngineerEmail` - Recipient for notifications
- `MondayBoardUrl` - Monday.com board for links

---

## Redeploying Google Apps Script

After making changes to `Code.gs`:

1. Open Google Apps Script editor
2. Go to Deploy > Manage deployments
3. Click the pencil (edit) icon
4. Change Version to "New version"
5. Click Deploy
6. The URL stays the same

---

## Monday.com Column Mapping

| Form Field | Monday.com Column | Column ID |
|------------|-------------------|-----------|
| category | Project Type | `color_mknxsk0m` |
| problem | Problem | `long_text_mm06yc60` |
| requestedAction | Requested Action | `long_text_mm061q1s` |
| testingRequired | Testing Required? | `color_mm06fc1p` |
| suppliers | Intake Form Suppliers | `dropdown_mm06gqw5` |
| costImpact | Intake Form Cost Impact | `long_text_mm064nb3` |
| ecoReleaseDate | Est Implementation Date | `date_mknx8gnr` |
| ecrPriority | Priority | `color_mkq9ez0h` |
| inventoryDisposition | Inventory Disposition | `color_mm06d51y` |
| requesterName | Requester | `dropdown_mm07r92s` |

---

*Last updated: February 2026*
