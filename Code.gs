/**
 * Rep Fitness Sustaining Intake Form - Google Apps Script
 *
 * This script receives form data and manages the sustaining engineering workflow:
 * - Saves intake submissions as JSON data packets (not directly to Monday.com)
 * - Provides endpoints for engineer review, info requests, and responses
 * - Pushes approved items to Monday.com with subitems
 *
 * Deploy as Web App: Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
 */

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const MONDAY_API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjYxNTUzNDYxOCwiYWFpIjoxMSwidWlkIjozOTY4Mzg1NSwiaWFkIjoiMjAyNi0wMi0wMlQyMjowNjowOC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6OTI4MTMyMiwicmduIjoidXNlMSJ9.WtmM4PBRkVKfLQC7DkSMQU_TOZPtxmXN2p4H1CC2SA4';
const BOARD_ID = '8281967707';

// GitHub repository configuration for storing data packets
// You'll need to create a Personal Access Token with repo scope
const GITHUB_CONFIG = {
  owner: 'REPLACE_WITH_GITHUB_USERNAME',
  repo: 'REPLACE_WITH_REPO_NAME',
  branch: 'main',
  token: 'REPLACE_WITH_GITHUB_PAT'
};

// Column IDs mapping - Updated with actual board column IDs
const COLUMN_IDS = {
  category: 'color_mknxsk0m',              // "Project Type" - Status column
  problem: 'long_text_mm06yc60',           // "Problem" - Long Text column
  requestedAction: 'long_text_mm061q1s',   // "Requested Action" - Long Text column
  testingRequired: 'color_mm06fc1p',       // "Testing Required?" - Status column
  suppliers: 'dropdown_mm06gqw5',          // "Intake Form Suppliers" - Dropdown (multi-select)
  costImpact: 'long_text_mm064nb3',        // "Intake Form Cost Impact" - Long Text column
  ecoReleaseDate: 'date_mknx8gnr',         // "Est Implementation Date" - Date column
  ecrPriority: 'color_mkq9ez0h',           // "Priority" - Status column
  inventoryDisposition: 'color_mm06d51y',  // "Inventory Disposition" - Status column
  requesterName: 'dropdown_mm07r92s'       // "Requester" - Dropdown column
};

// Monday.com API endpoint
const MONDAY_API_URL = 'https://api.monday.com/v2';

// ============================================
// DATA PACKET STATUS CONSTANTS
// ============================================
const PACKET_STATUS = {
  PENDING: 'pending',
  IN_REVIEW: 'in-review',
  WAITING: 'waiting',
  APPROVED: 'approved',
  PUSHED: 'pushed'
};

// ============================================
// WEB APP ENTRY POINTS
// ============================================

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getPacket':
        return handleGetPacket(e.parameter.id);
      case 'listPackets':
        return handleListPackets(e.parameter.status);
      case 'getConfig':
        return handleGetConfig(e.parameter.type);
      case 'getInfoRequest':
        return handleGetInfoRequest(e.parameter.packetId, e.parameter.requestId);
      default:
        return createResponse(true, null, null, {
          status: 'OK',
          message: 'Sustaining Intake Form API is running',
          version: '2.0'
        });
    }
  } catch (error) {
    console.error('Error handling GET request:', error);
    return createResponse(false, null, error.message);
  }
}

/**
 * Handle POST requests from the form
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'submitIntake';

    switch (action) {
      case 'submitIntake':
        return handleSubmitIntake(payload);
      case 'updatePacket':
        return handleUpdatePacket(payload);
      case 'submitInfoRequest':
        return handleSubmitInfoRequest(payload);
      case 'submitResponse':
        return handleSubmitResponse(payload);
      case 'approveAndPush':
        return handleApproveAndPush(payload);
      default:
        return createResponse(false, null, 'Unknown action: ' + action);
    }

  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(false, null, error.message);
  }
}

// ============================================
// INTAKE SUBMISSION HANDLER
// ============================================

/**
 * Handle new intake form submission
 * Saves as JSON data packet instead of pushing to Monday.com
 */
function handleSubmitIntake(payload) {
  // Validate required fields
  const validation = validateFormData(payload);
  if (!validation.valid) {
    return createResponse(false, null, validation.error);
  }

  // Generate unique packet ID
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const titleSlug = payload.requestTitle.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 30);
  const packetId = `${timestamp}-${titleSlug}`;

  // Create data packet
  const dataPacket = {
    id: packetId,
    status: PACKET_STATUS.PENDING,
    submittedAt: new Date().toISOString(),
    submittedBy: payload.requesterName,
    formData: {
      requesterName: payload.requesterName,
      category: payload.category,
      requestTitle: payload.requestTitle,
      problem: payload.problem,
      requestedAction: payload.requestedAction,
      testingRequired: payload.testingRequired,
      suppliers: payload.suppliers,
      costImpact: payload.costImpact,
      ecoReleaseDate: payload.ecoReleaseDate,
      ecrPriority: payload.ecrPriority,
      inventoryDisposition: payload.inventoryDisposition
    },
    infoRequests: [],
    subitems: [],
    mondayItemId: null,
    history: [
      {
        action: 'created',
        timestamp: new Date().toISOString(),
        by: payload.requesterName,
        details: 'Intake form submitted'
      }
    ]
  };

  // Save to storage
  const saved = saveDataPacket(dataPacket);

  if (saved) {
    return createResponse(true, packetId, null, {
      message: 'Request submitted successfully and is pending review'
    });
  } else {
    return createResponse(false, null, 'Failed to save data packet');
  }
}

// ============================================
// DATA PACKET MANAGEMENT
// ============================================

/**
 * Save data packet to Google Drive (more reliable than GitHub API from Apps Script)
 */
function saveDataPacket(dataPacket) {
  try {
    const folder = getOrCreateFolder('SustainingIntakePackets');
    const statusFolder = getOrCreateFolder(dataPacket.status, folder);

    const fileName = `${dataPacket.id}.json`;
    const content = JSON.stringify(dataPacket, null, 2);

    // Check if file exists and update, or create new
    const existingFiles = statusFolder.getFilesByName(fileName);
    if (existingFiles.hasNext()) {
      const file = existingFiles.next();
      file.setContent(content);
    } else {
      statusFolder.createFile(fileName, content, 'application/json');
    }

    return true;
  } catch (error) {
    console.error('Error saving data packet:', error);
    return false;
  }
}

/**
 * Get data packet by ID
 */
function getDataPacket(packetId) {
  try {
    const mainFolder = getOrCreateFolder('SustainingIntakePackets');
    const statuses = [PACKET_STATUS.PENDING, PACKET_STATUS.IN_REVIEW, PACKET_STATUS.WAITING, PACKET_STATUS.APPROVED, PACKET_STATUS.PUSHED];

    for (const status of statuses) {
      const statusFolder = getOrCreateFolder(status, mainFolder);
      const files = statusFolder.getFilesByName(`${packetId}.json`);
      if (files.hasNext()) {
        const file = files.next();
        return JSON.parse(file.getBlob().getDataAsString());
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting data packet:', error);
    return null;
  }
}

/**
 * Update data packet
 */
function updateDataPacket(packetId, updates, historyEntry) {
  try {
    const packet = getDataPacket(packetId);
    if (!packet) {
      return { success: false, error: 'Packet not found' };
    }

    const oldStatus = packet.status;

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key === 'formData') {
        packet.formData = { ...packet.formData, ...updates.formData };
      } else {
        packet[key] = updates[key];
      }
    });

    // Add history entry
    if (historyEntry) {
      packet.history.push({
        ...historyEntry,
        timestamp: new Date().toISOString()
      });
    }

    // If status changed, move to new folder
    if (updates.status && updates.status !== oldStatus) {
      movePacketToStatus(packetId, oldStatus, updates.status);
    }

    // Save updated packet
    saveDataPacket(packet);

    return { success: true, packet };
  } catch (error) {
    console.error('Error updating data packet:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Move packet from one status folder to another
 */
function movePacketToStatus(packetId, oldStatus, newStatus) {
  try {
    const mainFolder = getOrCreateFolder('SustainingIntakePackets');
    const oldFolder = getOrCreateFolder(oldStatus, mainFolder);
    const newFolder = getOrCreateFolder(newStatus, mainFolder);

    const files = oldFolder.getFilesByName(`${packetId}.json`);
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();

      // Create in new folder
      newFolder.createFile(`${packetId}.json`, content, 'application/json');

      // Remove from old folder
      file.setTrashed(true);
    }
  } catch (error) {
    console.error('Error moving packet:', error);
  }
}

/**
 * List packets by status
 */
function listPacketsByStatus(status) {
  try {
    const mainFolder = getOrCreateFolder('SustainingIntakePackets');
    const statusFolder = getOrCreateFolder(status, mainFolder);

    const packets = [];
    const files = statusFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().endsWith('.json')) {
        const packet = JSON.parse(file.getBlob().getDataAsString());
        packets.push({
          id: packet.id,
          requestTitle: packet.formData.requestTitle,
          requesterName: packet.formData.requesterName,
          category: packet.formData.category,
          ecrPriority: packet.formData.ecrPriority,
          submittedAt: packet.submittedAt,
          status: packet.status
        });
      }
    }

    // Sort by submitted date (newest first)
    packets.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    return packets;
  } catch (error) {
    console.error('Error listing packets:', error);
    return [];
  }
}

// ============================================
// REQUEST HANDLERS
// ============================================

/**
 * Handle get packet request
 */
function handleGetPacket(packetId) {
  const packet = getDataPacket(packetId);
  if (packet) {
    return createResponse(true, null, null, { packet });
  } else {
    return createResponse(false, null, 'Packet not found');
  }
}

/**
 * Handle list packets request
 */
function handleListPackets(status) {
  const packets = status ? listPacketsByStatus(status) : [];
  return createResponse(true, null, null, { packets });
}

/**
 * Handle get config request
 */
function handleGetConfig(type) {
  // Return embedded config data
  const configs = {
    'poc-directory': getPocDirectory(),
    'subitem-owners': getSubitemOwners(),
    'subitem-templates': getSubitemTemplates(),
    'info-request-templates': getInfoRequestTemplates()
  };

  if (type && configs[type]) {
    return createResponse(true, null, null, { config: configs[type] });
  }

  return createResponse(true, null, null, { configs });
}

/**
 * Handle update packet request
 */
function handleUpdatePacket(payload) {
  const { packetId, updates, historyEntry } = payload;
  const result = updateDataPacket(packetId, updates, historyEntry);

  if (result.success) {
    return createResponse(true, packetId, null, { packet: result.packet });
  } else {
    return createResponse(false, null, result.error);
  }
}

/**
 * Handle info request submission from engineer
 */
function handleSubmitInfoRequest(payload) {
  const { packetId, infoRequests } = payload;

  const packet = getDataPacket(packetId);
  if (!packet) {
    return createResponse(false, null, 'Packet not found');
  }

  // Add info requests with unique IDs
  const newRequests = infoRequests.map((req, index) => ({
    id: `${packetId}-req-${Date.now()}-${index}`,
    templateId: req.templateId,
    question: req.question,
    assignedTo: req.assignedTo, // Array of { name, email }
    createdAt: new Date().toISOString(),
    responses: [],
    status: 'pending'
  }));

  packet.infoRequests = [...packet.infoRequests, ...newRequests];
  packet.status = PACKET_STATUS.WAITING;
  packet.history.push({
    action: 'info_requested',
    timestamp: new Date().toISOString(),
    by: 'Engineer',
    details: `Information requested from ${newRequests.length} team member(s)`
  });

  saveDataPacket(packet);
  movePacketToStatus(packetId, PACKET_STATUS.IN_REVIEW, PACKET_STATUS.WAITING);

  return createResponse(true, packetId, null, {
    message: 'Info requests created',
    requests: newRequests
  });
}

/**
 * Handle get info request for response form
 */
function handleGetInfoRequest(packetId, requestId) {
  const packet = getDataPacket(packetId);
  if (!packet) {
    return createResponse(false, null, 'Packet not found');
  }

  const request = packet.infoRequests.find(r => r.id === requestId);
  if (!request) {
    return createResponse(false, null, 'Request not found');
  }

  return createResponse(true, null, null, {
    packet: {
      id: packet.id,
      requestTitle: packet.formData.requestTitle,
      requesterName: packet.formData.requesterName,
      problem: packet.formData.problem,
      requestedAction: packet.formData.requestedAction,
      category: packet.formData.category
    },
    request
  });
}

/**
 * Handle response submission from PoC
 */
function handleSubmitResponse(payload) {
  const { packetId, requestId, responderName, responderEmail, responseText } = payload;

  const packet = getDataPacket(packetId);
  if (!packet) {
    return createResponse(false, null, 'Packet not found');
  }

  const requestIndex = packet.infoRequests.findIndex(r => r.id === requestId);
  if (requestIndex === -1) {
    return createResponse(false, null, 'Request not found');
  }

  // Add response
  packet.infoRequests[requestIndex].responses.push({
    respondedAt: new Date().toISOString(),
    responderName,
    responderEmail,
    responseText
  });

  // Check if all assigned people have responded
  const assignedCount = packet.infoRequests[requestIndex].assignedTo.length;
  const responseCount = packet.infoRequests[requestIndex].responses.length;
  if (responseCount >= assignedCount) {
    packet.infoRequests[requestIndex].status = 'completed';
  }

  // Add history entry
  packet.history.push({
    action: 'response_received',
    timestamp: new Date().toISOString(),
    by: responderName,
    details: `Response received for info request`
  });

  // Check if all info requests are completed
  const allCompleted = packet.infoRequests.every(r => r.status === 'completed');
  if (allCompleted) {
    packet.status = PACKET_STATUS.IN_REVIEW;
    movePacketToStatus(packetId, PACKET_STATUS.WAITING, PACKET_STATUS.IN_REVIEW);
  }

  saveDataPacket(packet);

  return createResponse(true, packetId, null, {
    message: 'Response recorded successfully'
  });
}

/**
 * Handle approve and push to Monday.com
 */
function handleApproveAndPush(payload) {
  const { packetId, subitems } = payload;

  const packet = getDataPacket(packetId);
  if (!packet) {
    return createResponse(false, null, 'Packet not found');
  }

  // Store subitems
  packet.subitems = subitems || [];

  // Create Monday.com item
  const result = createMondayItem(packet.formData);

  if (!result.success) {
    return createResponse(false, null, result.error);
  }

  packet.mondayItemId = result.itemId;

  // Create subitems if any
  if (subitems && subitems.length > 0) {
    const subitemResults = createMondaySubitems(result.itemId, subitems);
    packet.subitemResults = subitemResults;
  }

  // Update status
  packet.status = PACKET_STATUS.PUSHED;
  packet.pushedAt = new Date().toISOString();
  packet.history.push({
    action: 'pushed_to_monday',
    timestamp: new Date().toISOString(),
    by: 'Engineer',
    details: `Item created in Monday.com (ID: ${result.itemId})`
  });

  movePacketToStatus(packetId, PACKET_STATUS.APPROVED, PACKET_STATUS.PUSHED);
  saveDataPacket(packet);

  return createResponse(true, packetId, null, {
    message: 'Item pushed to Monday.com',
    mondayItemId: result.itemId
  });
}

// ============================================
// MONDAY.COM API FUNCTIONS
// ============================================

/**
 * Create a new item in Monday.com board
 */
function createMondayItem(formData) {
  try {
    const columnValues = buildColumnValues(formData);

    const query = `
      mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(
          board_id: $boardId,
          item_name: $itemName,
          column_values: $columnValues
        ) {
          id
        }
      }
    `;

    const variables = {
      boardId: BOARD_ID,
      itemName: formData.requestTitle,
      columnValues: JSON.stringify(columnValues)
    };

    const response = mondayApiRequest(query, variables);

    if (response.data && response.data.create_item) {
      return {
        success: true,
        itemId: response.data.create_item.id
      };
    } else if (response.errors) {
      console.error('Monday.com API errors:', response.errors);
      return {
        success: false,
        error: response.errors[0]?.message || 'Failed to create item'
      };
    } else {
      return {
        success: false,
        error: 'Unexpected API response'
      };
    }

  } catch (error) {
    console.error('Error creating Monday item:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create subitems for a Monday.com item
 */
function createMondaySubitems(parentItemId, subitems) {
  const results = [];

  for (const subitem of subitems) {
    try {
      const query = `
        mutation CreateSubitem($parentId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_subitem(
            parent_item_id: $parentId,
            item_name: $itemName,
            column_values: $columnValues
          ) {
            id
          }
        }
      `;

      // Build subitem column values
      const columnValues = {};

      // Add due date if provided
      if (subitem.dueDate) {
        columnValues['date'] = { date: subitem.dueDate };
      }

      // Add status as "Not Started"
      columnValues['status'] = { label: 'Not Started' };

      const variables = {
        parentId: parentItemId,
        itemName: subitem.name,
        columnValues: JSON.stringify(columnValues)
      };

      const response = mondayApiRequest(query, variables);

      if (response.data && response.data.create_subitem) {
        results.push({
          success: true,
          subitemId: response.data.create_subitem.id,
          name: subitem.name
        });
      } else {
        results.push({
          success: false,
          name: subitem.name,
          error: response.errors?.[0]?.message || 'Failed to create subitem'
        });
      }
    } catch (error) {
      results.push({
        success: false,
        name: subitem.name,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Build column values object for Monday.com API
 */
function buildColumnValues(formData) {
  const columnValues = {};

  if (COLUMN_IDS.category && formData.category) {
    columnValues[COLUMN_IDS.category] = { label: formData.category };
  }

  if (COLUMN_IDS.problem && formData.problem) {
    columnValues[COLUMN_IDS.problem] = { text: formData.problem };
  }

  if (COLUMN_IDS.requestedAction && formData.requestedAction) {
    columnValues[COLUMN_IDS.requestedAction] = { text: formData.requestedAction };
  }

  if (COLUMN_IDS.testingRequired && formData.testingRequired) {
    columnValues[COLUMN_IDS.testingRequired] = { label: formData.testingRequired };
  }

  if (COLUMN_IDS.suppliers && formData.suppliers) {
    const suppliersList = formData.suppliers.split(',').map(s => s.trim());
    columnValues[COLUMN_IDS.suppliers] = { labels: suppliersList };
  }

  if (COLUMN_IDS.costImpact && formData.costImpact) {
    columnValues[COLUMN_IDS.costImpact] = { text: formData.costImpact };
  }

  if (COLUMN_IDS.ecoReleaseDate && formData.ecoReleaseDate) {
    columnValues[COLUMN_IDS.ecoReleaseDate] = { date: formData.ecoReleaseDate };
  }

  if (COLUMN_IDS.ecrPriority && formData.ecrPriority) {
    columnValues[COLUMN_IDS.ecrPriority] = { label: formData.ecrPriority };
  }

  if (COLUMN_IDS.inventoryDisposition && formData.inventoryDisposition) {
    columnValues[COLUMN_IDS.inventoryDisposition] = { label: formData.inventoryDisposition };
  }

  if (COLUMN_IDS.requesterName && formData.requesterName) {
    columnValues[COLUMN_IDS.requesterName] = { labels: [formData.requesterName] };
  }

  return columnValues;
}

/**
 * Make a request to Monday.com GraphQL API
 */
function mondayApiRequest(query, variables = {}) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': MONDAY_API_TOKEN,
      'API-Version': '2024-01'
    },
    payload: JSON.stringify({
      query: query,
      variables: variables
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(MONDAY_API_URL, options);
  return JSON.parse(response.getContentText());
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate form data
 */
function validateFormData(formData) {
  const requiredFields = [
    'category',
    'requestTitle',
    'problem',
    'requestedAction',
    'testingRequired',
    'suppliers',
    'costImpact',
    'ecoReleaseDate',
    'ecrPriority',
    'inventoryDisposition',
    'requesterName'
  ];

  for (const field of requiredFields) {
    if (!formData[field] || formData[field].toString().trim() === '') {
      return {
        valid: false,
        error: `Missing required field: ${field}`
      };
    }
  }

  return { valid: true };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a JSON response
 */
function createResponse(success, itemId = null, error = null, data = null) {
  const response = { success };

  if (itemId) {
    response.itemId = itemId;
  }

  if (error) {
    response.error = error;
  }

  if (data) {
    Object.assign(response, data);
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get or create a folder in Google Drive
 */
function getOrCreateFolder(name, parent = null) {
  const parentFolder = parent || DriveApp.getRootFolder();
  const folders = parentFolder.getFoldersByName(name);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(name);
}

// ============================================
// EMBEDDED CONFIGURATION DATA
// ============================================

function getPocDirectory() {
  return {
    "teams": {
      "Quality": {
        "members": [
          { "name": "Joe Litchford", "email": "joel2@repfitness.com" },
          { "name": "Dan Wells", "email": "danw@repfitness.com" },
          { "name": "Allen Shen", "email": "allens@repfitness.com" },
          { "name": "Shuailei Huang", "email": "ShuaileiS@repfitness.com" },
          { "name": "Ammy Guan", "email": "AmmyG@repfitness.com" },
          { "name": "Gray Li", "email": "GrayL@repfitness.com" },
          { "name": "Leon Zhang", "email": "LeonZ@repfitness.com" },
          { "name": "John Yao", "email": "JohnY@repfitness.com" },
          { "name": "Ryan Shi", "email": "RyanS@repfitness.com" },
          { "name": "Ken Liao", "email": "KenL@repfitness.com" },
          { "name": "Kent Lin", "email": "KentL@repfitness.com" }
        ]
      },
      "Product": {
        "members": [
          { "name": "Jason Lazar", "email": "JasonL@repfitness.com" },
          { "name": "Keenen Peck-Valdivia", "email": "KeenenP@repfitness.com" },
          { "name": "Laura Doody-Bouwer", "email": "LauraD@repfitness.com" }
        ]
      },
      "Sourcing": {
        "members": [
          { "name": "Greg Dahlstrom", "email": "GregD@repfitness.com" },
          { "name": "Joe Lin", "email": "JoeL@repfitness.com" },
          { "name": "Ellan Zhang", "email": "EllanZ@repfitness.com" }
        ]
      },
      "NPI": {
        "members": [
          { "name": "Bryan Hamilton", "email": "BryanH@repfitness.com" },
          { "name": "Joe Larson", "email": "JosephL@repfitness.com" },
          { "name": "Mark Wilding", "email": "MarkW@repfitness.com" },
          { "name": "Jason Fitzwater", "email": "JasonF@repfitness.com" },
          { "name": "Jay Nedrow", "email": "JayN@repfitness.com" },
          { "name": "Chet Roe", "email": "ChetR@repfitness.com" }
        ]
      },
      "Drafting": {
        "members": [
          { "name": "Drew Forsterer", "email": "DrewF@repfitness.com" },
          { "name": "Ron Manzanares", "email": "RonM@repfitness.com" }
        ]
      },
      "Sustaining": {
        "members": [
          { "name": "Jason Morgan", "email": "JasonM@repfitness.com" }
        ]
      },
      "Tech Writing": {
        "members": [
          { "name": "Alex Solome", "email": "alexs2@repfitness.com" }
        ]
      }
    },
    "engineers": [
      { "name": "Jack Hibberts", "email": "JackH@repfitness.com" }
    ]
  };
}

function getSubitemOwners() {
  return {
    "owners": [
      { "name": "Joe Litchford", "email": "joel2@repfitness.com", "team": "Quality" },
      { "name": "Dan Wells", "email": "danw@repfitness.com", "team": "Quality" },
      { "name": "Allen Shen", "email": "allens@repfitness.com", "team": "Quality" },
      { "name": "Shuailei Huang", "email": "ShuaileiS@repfitness.com", "team": "Quality" },
      { "name": "Ammy Guan", "email": "AmmyG@repfitness.com", "team": "Quality" },
      { "name": "Gray Li", "email": "GrayL@repfitness.com", "team": "Quality" },
      { "name": "Leon Zhang", "email": "LeonZ@repfitness.com", "team": "Quality" },
      { "name": "John Yao", "email": "JohnY@repfitness.com", "team": "Quality" },
      { "name": "Ryan Shi", "email": "RyanS@repfitness.com", "team": "Quality" },
      { "name": "Ken Liao", "email": "KenL@repfitness.com", "team": "Quality" },
      { "name": "Kent Lin", "email": "KentL@repfitness.com", "team": "Quality" },
      { "name": "Jason Lazar", "email": "JasonL@repfitness.com", "team": "Product" },
      { "name": "Keenen Peck-Valdivia", "email": "KeenenP@repfitness.com", "team": "Product" },
      { "name": "Laura Doody-Bouwer", "email": "LauraD@repfitness.com", "team": "Product" },
      { "name": "Haley Moe", "email": "HaleyM@repfitness.com", "team": "Product" },
      { "name": "Greg Dahlstrom", "email": "GregD@repfitness.com", "team": "Sourcing" },
      { "name": "Joe Lin", "email": "JoeL@repfitness.com", "team": "Sourcing" },
      { "name": "Ellan Zhang", "email": "EllanZ@repfitness.com", "team": "Sourcing" },
      { "name": "Bryan Hamilton", "email": "BryanH@repfitness.com", "team": "NPI" },
      { "name": "Joe Larson", "email": "JosephL@repfitness.com", "team": "NPI" },
      { "name": "Mark Wilding", "email": "MarkW@repfitness.com", "team": "NPI" },
      { "name": "Jason Fitzwater", "email": "JasonF@repfitness.com", "team": "NPI" },
      { "name": "Jay Nedrow", "email": "JayN@repfitness.com", "team": "NPI" },
      { "name": "Chet Roe", "email": "ChetR@repfitness.com", "team": "NPI" },
      { "name": "Drew Forsterer", "email": "DrewF@repfitness.com", "team": "Drafting" },
      { "name": "Ron Manzanares", "email": "RonM@repfitness.com", "team": "Drafting" },
      { "name": "Jason Morgan", "email": "JasonM@repfitness.com", "team": "Sustaining" },
      { "name": "Alex Solome", "email": "alexs2@repfitness.com", "team": "Tech Writing" }
    ]
  };
}

function getSubitemTemplates() {
  return {
    "templates": [
      { "id": "quote-supplier", "name": "Request quote from supplier", "description": "Get pricing/quote from supplier for the required components or changes", "suggestedTeams": ["Sourcing"] },
      { "id": "create-cad", "name": "Create/update CAD model", "description": "Create new or update existing CAD model for the design change", "suggestedTeams": ["NPI", "Drafting"] },
      { "id": "update-drawing", "name": "Update drawing", "description": "Update engineering drawings to reflect the design change", "suggestedTeams": ["Drafting"] },
      { "id": "test-prototype", "name": "Test prototype", "description": "Conduct testing on prototype to validate the change", "suggestedTeams": ["NPI", "Quality"] },
      { "id": "write-test-report", "name": "Write test report", "description": "Document test results and findings in a formal report", "suggestedTeams": ["NPI", "Quality"] },
      { "id": "update-bom", "name": "Update BOM", "description": "Update Bill of Materials to reflect component changes", "suggestedTeams": ["NPI", "Drafting"] },
      { "id": "quality-inspection", "name": "Quality inspection", "description": "Perform quality inspection on parts or assemblies", "suggestedTeams": ["Quality"] },
      { "id": "supplier-communication", "name": "Supplier communication", "description": "Coordinate with supplier on specifications or requirements", "suggestedTeams": ["Sourcing", "Quality"] },
      { "id": "product-review", "name": "Product review", "description": "Review change for product fit and market impact", "suggestedTeams": ["Product"] },
      { "id": "update-documentation", "name": "Update documentation", "description": "Update user manuals, assembly instructions, or other documentation", "suggestedTeams": ["Tech Writing"] },
      { "id": "create-eco", "name": "Create ECO", "description": "Create Engineering Change Order to formalize the change", "suggestedTeams": ["Sustaining", "NPI"] },
      { "id": "custom", "name": "Custom task", "description": "Custom task - specify details", "suggestedTeams": [] }
    ]
  };
}

function getInfoRequestTemplates() {
  return {
    "templates": [
      { "id": "supplier-quote", "name": "Supplier quote needed", "description": "Please provide a quote for the component/change described. Include pricing, lead time, and MOQ.", "suggestedTeams": ["Sourcing"] },
      { "id": "quality-data", "name": "Quality inspection data required", "description": "Please provide inspection data, defect rates, or quality metrics for the relevant parts.", "suggestedTeams": ["Quality"] },
      { "id": "cad-review", "name": "CAD model review needed", "description": "Please review the CAD model and provide feedback on design feasibility and manufacturability.", "suggestedTeams": ["NPI", "Drafting"] },
      { "id": "product-specs", "name": "Product specifications clarification", "description": "Please clarify the product specifications and requirements for this change.", "suggestedTeams": ["Product"] },
      { "id": "testing-requirements", "name": "Testing requirements clarification", "description": "Please specify the testing requirements, test methods, and acceptance criteria.", "suggestedTeams": ["NPI", "Quality"] },
      { "id": "bom-verification", "name": "BOM verification needed", "description": "Please verify the Bill of Materials accuracy and identify any discrepancies.", "suggestedTeams": ["NPI", "Drafting"] },
      { "id": "cost-breakdown", "name": "Cost breakdown required", "description": "Please provide a detailed cost breakdown including materials, labor, and tooling.", "suggestedTeams": ["Sourcing"] },
      { "id": "timeline-leadtime", "name": "Timeline/lead time information", "description": "Please provide timeline and lead time information for completing this work.", "suggestedTeams": ["Sourcing", "NPI"] },
      { "id": "supplier-capability", "name": "Supplier capability assessment", "description": "Please assess the supplier's capability to meet the specified requirements.", "suggestedTeams": ["Quality", "Sourcing"] },
      { "id": "drawing-review", "name": "Drawing review needed", "description": "Please review the engineering drawings and provide feedback or corrections.", "suggestedTeams": ["Drafting", "NPI"] },
      { "id": "custom", "name": "Custom request", "description": "", "suggestedTeams": [] }
    ]
  };
}

// ============================================
// SETUP HELPERS - Run these from Script Editor
// ============================================

/**
 * Get all column IDs for your board
 */
function getColumnIds() {
  const query = `
    query GetBoardColumns($boardId: ID!) {
      boards(ids: [$boardId]) {
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const variables = { boardId: BOARD_ID };
  const response = mondayApiRequest(query, variables);

  if (response.data && response.data.boards && response.data.boards[0]) {
    const columns = response.data.boards[0].columns;
    console.log('=== Board Columns ===');
    columns.forEach(col => {
      console.log(`ID: "${col.id}" | Title: "${col.title}" | Type: ${col.type}`);
    });
    return columns;
  } else {
    console.error('Failed to get columns:', response);
    return null;
  }
}

/**
 * Test the Monday.com connection
 */
function testConnection() {
  const query = `
    query TestConnection($boardId: ID!) {
      boards(ids: [$boardId]) {
        id
        name
      }
    }
  `;

  const variables = { boardId: BOARD_ID };
  const response = mondayApiRequest(query, variables);

  if (response.data && response.data.boards && response.data.boards[0]) {
    const board = response.data.boards[0];
    console.log('Connection successful!');
    console.log(`Board ID: ${board.id}`);
    console.log(`Board Name: ${board.name}`);
    return true;
  } else {
    console.error('Connection failed:', response);
    return false;
  }
}

/**
 * Initialize folder structure in Google Drive
 */
function initializeFolders() {
  const mainFolder = getOrCreateFolder('SustainingIntakePackets');
  getOrCreateFolder('pending', mainFolder);
  getOrCreateFolder('in-review', mainFolder);
  getOrCreateFolder('waiting', mainFolder);
  getOrCreateFolder('approved', mainFolder);
  getOrCreateFolder('pushed', mainFolder);
  console.log('Folder structure initialized in Google Drive');
}
