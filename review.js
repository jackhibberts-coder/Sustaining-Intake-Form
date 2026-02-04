/**
 * Rep Fitness Sustaining Intake Form - Engineer Review Interface
 * Handles data packet review, info requests, and Monday.com push
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    API_URL: 'https://n8n.repfitness.io/webhook-test/sustaining-api',
    MONDAY_BOARD_URL: 'https://rep-fitness.monday.com/boards/8281967707/views/200096331'
};

// ============================================
// STATE
// ============================================
let currentPacket = null;
let pocDirectory = null;
let subitemOwners = null;
let subitemTemplates = null;
let infoRequestTemplates = null;
let infoRequestCount = 0;
let subitemCount = 0;

// ============================================
// DOM ELEMENTS
// ============================================
const loadingContainer = document.getElementById('loadingContainer');
const errorContainer = document.getElementById('errorContainer');
const dashboardView = document.getElementById('dashboardView');
const reviewView = document.getElementById('reviewView');
const errorText = document.getElementById('errorText');

// Navigation Elements
const reviewNav = document.getElementById('reviewNav');
const navContent = document.getElementById('navContent');

// Review View Elements
const statusBadge = document.getElementById('statusBadge');
const proceedBtn = document.getElementById('proceedBtn');
const requestInfoBtn = document.getElementById('requestInfoBtn');
const requestInfoPanel = document.getElementById('requestInfoPanel');
const proceedPanel = document.getElementById('proceedPanel');
const infoRequestBuilder = document.getElementById('infoRequestBuilder');
const subitemBuilder = document.getElementById('subitemBuilder');
const infoRequestsSection = document.getElementById('infoRequestsSection');
const infoRequestsList = document.getElementById('infoRequestsList');

// Modals
const successModal = document.getElementById('successModal');
const confirmModal = document.getElementById('confirmModal');

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load configuration data
    await loadConfigurations();

    // Check for packet ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const packetId = urlParams.get('id');

    if (packetId) {
        await loadPacket(packetId);
    } else {
        await loadDashboard();
    }

    setupEventListeners();
});

async function loadConfigurations() {
    try {
        const data = await fetchAPI('getConfig');

        if (data.success && data.configs) {
            pocDirectory = data.configs['poc-directory'];
            subitemOwners = data.configs['subitem-owners'];
            subitemTemplates = data.configs['subitem-templates'];
            infoRequestTemplates = data.configs['info-request-templates'];
        }
    } catch (error) {
        console.error('Error loading configurations:', error);
        // Use embedded defaults if fetch fails
        pocDirectory = getDefaultPocDirectory();
        subitemOwners = getDefaultSubitemOwners();
        subitemTemplates = getDefaultSubitemTemplates();
        infoRequestTemplates = getDefaultInfoRequestTemplates();
    }
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================
async function loadDashboard() {
    loadingContainer.style.display = 'block';
    dashboardView.style.display = 'none';

    try {
        // Load packets for each status
        const [pending, waiting, inReview] = await Promise.all([
            fetchPackets('pending'),
            fetchPackets('waiting'),
            fetchPackets('in-review')
        ]);

        renderPacketsList('pendingPacketsList', pending);
        renderPacketsList('waitingPacketsList', waiting);
        renderPacketsList('inReviewPacketsList', inReview);

        loadingContainer.style.display = 'none';
        dashboardView.style.display = 'block';

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showError('Unable to load dashboard. Please try again.');
    }
}

async function fetchPackets(status) {
    try {
        const data = await fetchAPI('listPackets', { status });
        return data.success ? data.packets : [];
    } catch (error) {
        console.error(`Error fetching ${status} packets:`, error);
        return [];
    }
}

function renderPacketsList(containerId, packets) {
    const container = document.getElementById(containerId);

    if (!packets || packets.length === 0) {
        container.innerHTML = '<p class="empty-state">No requests in this status</p>';
        return;
    }

    container.innerHTML = packets.map(packet => `
        <div class="packet-card">
            <div class="packet-card-info">
                <div class="packet-card-title">${escapeHtml(packet.requestTitle)}</div>
                <div class="packet-card-meta">
                    <span><strong>Requester:</strong> ${escapeHtml(packet.requesterName)}</span>
                    <span><strong>Category:</strong> ${escapeHtml(packet.category)}</span>
                    <span><strong>Priority:</strong> <span class="priority-${packet.ecrPriority?.toLowerCase()}">${escapeHtml(packet.ecrPriority)}</span></span>
                    <span><strong>Submitted:</strong> ${formatDate(packet.submittedAt)}</span>
                </div>
            </div>
            <div class="packet-card-actions">
                <a href="review.html?id=${encodeURIComponent(packet.id)}" class="btn btn-primary btn-review">Review</a>
            </div>
        </div>
    `).join('');
}

// ============================================
// PACKET LOADING
// ============================================
async function loadPacket(packetId) {
    loadingContainer.style.display = 'block';
    reviewView.style.display = 'none';

    try {
        const data = await fetchAPI('getPacket', { id: packetId });

        if (data.success && data.packet) {
            currentPacket = data.packet;
            renderPacketReview();
            loadingContainer.style.display = 'none';
            reviewView.style.display = 'block';
        } else {
            showError(data.error || 'Packet not found');
        }

    } catch (error) {
        console.error('Error loading packet:', error);
        showError('Unable to load request. Please try again.');
    }
}

function renderPacketReview() {
    const form = currentPacket.formData;

    // Update navigation bar for packet view
    updateNavigation(form.requestTitle);

    // Update status badge
    statusBadge.textContent = formatStatus(currentPacket.status);
    statusBadge.className = `status-badge ${currentPacket.status}`;

    // Summary
    document.getElementById('summaryTitle').textContent = form.requestTitle;
    document.getElementById('summaryRequester').textContent = form.requesterName;
    document.getElementById('summaryCategory').textContent = form.category;
    document.getElementById('summaryPriority').textContent = form.ecrPriority;
    document.getElementById('summaryPriority').className = `value priority-${form.ecrPriority?.toLowerCase()}`;
    document.getElementById('summarySubmitted').textContent = formatDate(currentPacket.submittedAt);
    document.getElementById('summaryEcoDate').textContent = formatDate(form.ecoReleaseDate);

    // Full Details
    document.getElementById('detailProblem').textContent = form.problem;
    document.getElementById('detailAction').textContent = form.requestedAction;
    document.getElementById('detailTesting').textContent = form.testingRequired;
    document.getElementById('detailSuppliers').textContent = form.suppliers;
    document.getElementById('detailDisposition').textContent = form.inventoryDisposition;
    document.getElementById('detailCost').textContent = form.costImpact;

    // Info Requests
    if (currentPacket.infoRequests && currentPacket.infoRequests.length > 0) {
        renderInfoRequests();
        infoRequestsSection.style.display = 'block';
        document.getElementById('decisionSectionNum').textContent = '4';
    } else {
        infoRequestsSection.style.display = 'none';
        document.getElementById('decisionSectionNum').textContent = '3';
    }

    // Update button states based on status
    if (currentPacket.status === 'pushed') {
        proceedBtn.disabled = true;
        requestInfoBtn.disabled = true;
        proceedBtn.textContent = 'Already Pushed to Monday.com';
    }
}

function renderInfoRequests() {
    infoRequestsList.innerHTML = currentPacket.infoRequests.map(req => `
        <div class="info-request-card">
            <div class="info-request-header">
                <div class="info-request-question">${escapeHtml(req.question)}</div>
                <span class="info-request-status ${req.status}">${req.status === 'completed' ? 'Completed' : 'Pending'}</span>
            </div>
            <div class="info-request-assigned">
                <strong>Assigned to:</strong> ${req.assignedTo.map(a => escapeHtml(a.name)).join(', ')}
            </div>
            ${req.responses && req.responses.length > 0 ? `
                <div class="info-request-responses">
                    <strong>Responses:</strong>
                    ${req.responses.map(resp => `
                        <div class="response-item">
                            <div class="response-header">
                                <span>${escapeHtml(resp.responderName)}</span>
                                <span>${formatDate(resp.respondedAt)}</span>
                            </div>
                            <div class="response-text">${escapeHtml(resp.responseText)}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.collapsible');
            section.classList.toggle('collapsed');
        });
    });

    // Decision buttons
    proceedBtn.addEventListener('click', showProceedPanel);
    requestInfoBtn.addEventListener('click', showRequestInfoPanel);

    // Info Request Panel
    document.getElementById('addInfoRequestBtn').addEventListener('click', addInfoRequestItem);
    document.getElementById('cancelInfoRequestBtn').addEventListener('click', hideAllPanels);
    document.getElementById('submitInfoRequestBtn').addEventListener('click', submitInfoRequests);

    // Proceed Panel
    document.getElementById('addSubitemBtn').addEventListener('click', addSubitemItem);
    document.getElementById('cancelProceedBtn').addEventListener('click', hideAllPanels);
    document.getElementById('pushToMondayBtn').addEventListener('click', confirmPushToMonday);

    // Modal close buttons
    document.getElementById('closeSuccessModal').addEventListener('click', () => {
        closeModal(successModal);
        window.location.reload();
    });
    document.getElementById('cancelConfirmBtn').addEventListener('click', () => closeModal(confirmModal));
}

// ============================================
// INFO REQUEST PANEL
// ============================================
function showRequestInfoPanel() {
    hideAllPanels();
    requestInfoPanel.style.display = 'block';

    // Add initial info request item if empty
    if (infoRequestBuilder.children.length === 0) {
        addInfoRequestItem();
    }

    requestInfoPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addInfoRequestItem() {
    infoRequestCount++;
    const itemHtml = `
        <div class="info-request-item" data-index="${infoRequestCount}">
            <div class="item-header">
                <span class="item-number">${infoRequestCount}</span>
                <button type="button" class="btn-remove" onclick="removeInfoRequestItem(this)">&times;</button>
            </div>
            <div class="item-fields">
                <div class="item-row">
                    <div class="item-field">
                        <label>Information Request Template</label>
                        <select class="template-select" onchange="handleTemplateChange(this)">
                            <option value="">Select a template or choose Custom...</option>
                            ${infoRequestTemplates.templates.map(t =>
        `<option value="${t.id}" data-description="${escapeHtml(t.description)}" data-teams="${t.suggestedTeams.join(',')}">${escapeHtml(t.name)}</option>`
    ).join('')}
                        </select>
                    </div>
                </div>
                <div class="item-field">
                    <label>Question / Information Needed</label>
                    <textarea class="question-input" placeholder="Describe what information you need..."></textarea>
                </div>
                <div class="item-field">
                    <label>Assign Team Members</label>
                    <div class="team-selector">
                        ${renderTeamSelector()}
                    </div>
                    <div class="selected-members"></div>
                </div>
            </div>
        </div>
    `;

    infoRequestBuilder.insertAdjacentHTML('beforeend', itemHtml);
    renumberInfoRequestItems();
}

function renderTeamSelector() {
    if (!pocDirectory || !pocDirectory.teams) return '';

    return Object.entries(pocDirectory.teams).map(([teamName, teamData]) => `
        <div class="team-group">
            <div class="team-header">${teamName}</div>
            ${teamData.members.map(member => `
                <label class="team-member">
                    <input type="checkbox" value="${escapeHtml(member.email)}" data-name="${escapeHtml(member.name)}" onchange="handleMemberSelect(this)">
                    <span>${escapeHtml(member.name)}</span>
                </label>
            `).join('')}
        </div>
    `).join('');
}

function handleTemplateChange(select) {
    const item = select.closest('.info-request-item');
    const questionInput = item.querySelector('.question-input');
    const selectedOption = select.options[select.selectedIndex];

    if (selectedOption.value && selectedOption.value !== 'custom') {
        const description = selectedOption.dataset.description;
        if (description) {
            questionInput.value = description;
        }

        // Highlight suggested teams
        const suggestedTeams = selectedOption.dataset.teams?.split(',') || [];
        const checkboxes = item.querySelectorAll('.team-member input[type="checkbox"]');
        // Clear previous highlights (but don't uncheck)
        item.querySelectorAll('.team-group').forEach(g => g.classList.remove('suggested'));

        suggestedTeams.forEach(team => {
            const teamGroup = Array.from(item.querySelectorAll('.team-header'))
                .find(h => h.textContent.trim() === team);
            if (teamGroup) {
                teamGroup.closest('.team-group').classList.add('suggested');
            }
        });
    }
}

function handleMemberSelect(checkbox) {
    const item = checkbox.closest('.info-request-item');
    const selectedContainer = item.querySelector('.selected-members');

    updateSelectedMembers(item, selectedContainer);
}

function updateSelectedMembers(item, container) {
    const checkboxes = item.querySelectorAll('.team-member input[type="checkbox"]:checked');
    const members = Array.from(checkboxes).map(cb => ({
        name: cb.dataset.name,
        email: cb.value
    }));

    container.innerHTML = members.map(m => `
        <span class="member-tag">
            ${escapeHtml(m.name)}
            <span class="remove" onclick="removeMember(this, '${escapeHtml(m.email)}')">&times;</span>
        </span>
    `).join('');
}

function removeMember(element, email) {
    const item = element.closest('.info-request-item');
    const checkbox = item.querySelector(`input[type="checkbox"][value="${email}"]`);
    if (checkbox) {
        checkbox.checked = false;
        handleMemberSelect(checkbox);
    }
}

function removeInfoRequestItem(button) {
    const item = button.closest('.info-request-item');
    item.remove();
    renumberInfoRequestItems();
}

function renumberInfoRequestItems() {
    const items = infoRequestBuilder.querySelectorAll('.info-request-item');
    items.forEach((item, index) => {
        item.querySelector('.item-number').textContent = index + 1;
    });
    infoRequestCount = items.length;
}

async function submitInfoRequests() {
    const items = infoRequestBuilder.querySelectorAll('.info-request-item');

    if (items.length === 0) {
        alert('Please add at least one information request.');
        return;
    }

    const infoRequests = [];

    for (const item of items) {
        const templateSelect = item.querySelector('.template-select');
        const questionInput = item.querySelector('.question-input');
        const checkboxes = item.querySelectorAll('.team-member input[type="checkbox"]:checked');

        const question = questionInput.value.trim();
        const assignedTo = Array.from(checkboxes).map(cb => ({
            name: cb.dataset.name,
            email: cb.value
        }));

        if (!question) {
            alert('Please fill in the question for all info requests.');
            questionInput.focus();
            return;
        }

        if (assignedTo.length === 0) {
            alert('Please assign at least one team member to each info request.');
            return;
        }

        infoRequests.push({
            templateId: templateSelect.value,
            question,
            assignedTo
        });
    }

    // Submit to server
    try {
        document.getElementById('submitInfoRequestBtn').disabled = true;
        document.getElementById('submitInfoRequestBtn').textContent = 'Sending...';

        const data = await fetchAPI('submitInfoRequest', {
            packetId: currentPacket.id,
            infoRequests
        });

        if (data.success) {
            showSuccess('Information requests sent successfully!', 'Emails will be sent to the assigned team members.');
        } else {
            throw new Error(data.error || 'Failed to send info requests');
        }

    } catch (error) {
        console.error('Error submitting info requests:', error);
        alert('Error: ' + error.message);
        document.getElementById('submitInfoRequestBtn').disabled = false;
        document.getElementById('submitInfoRequestBtn').textContent = 'Send Information Requests';
    }
}

// ============================================
// PROCEED PANEL
// ============================================
function showProceedPanel() {
    hideAllPanels();
    proceedPanel.style.display = 'block';

    // Add initial subitem if empty
    if (subitemBuilder.children.length === 0) {
        addSubitemItem();
    }

    proceedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addSubitemItem() {
    subitemCount++;
    const itemHtml = `
        <div class="subitem-item" data-index="${subitemCount}">
            <div class="item-header">
                <span class="item-number">${subitemCount}</span>
                <button type="button" class="btn-remove" onclick="removeSubitemItem(this)">&times;</button>
            </div>
            <div class="item-fields">
                <div class="item-row">
                    <div class="item-field">
                        <label>Task Template</label>
                        <select class="subitem-template-select" onchange="handleSubitemTemplateChange(this)">
                            <option value="">Select a template or choose Custom...</option>
                            ${subitemTemplates.templates.map(t =>
        `<option value="${t.id}" data-description="${escapeHtml(t.description)}">${escapeHtml(t.name)}</option>`
    ).join('')}
                        </select>
                    </div>
                    <div class="item-field">
                        <label>Due Date</label>
                        <input type="date" class="subitem-due-date" min="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="item-field">
                    <label>Task Name</label>
                    <input type="text" class="subitem-name" placeholder="Enter task name...">
                </div>
                <div class="item-field">
                    <label>Assign Owner</label>
                    <select class="subitem-owner">
                        <option value="">Select owner...</option>
                        ${renderOwnerOptions()}
                    </select>
                </div>
            </div>
        </div>
    `;

    subitemBuilder.insertAdjacentHTML('beforeend', itemHtml);
    renumberSubitemItems();
}

function renderOwnerOptions() {
    if (!subitemOwners || !subitemOwners.owners) return '';

    // Group by team
    const byTeam = {};
    subitemOwners.owners.forEach(owner => {
        if (!byTeam[owner.team]) {
            byTeam[owner.team] = [];
        }
        byTeam[owner.team].push(owner);
    });

    return Object.entries(byTeam).map(([team, owners]) => `
        <optgroup label="${team}">
            ${owners.map(o => `<option value="${escapeHtml(o.email)}" data-name="${escapeHtml(o.name)}">${escapeHtml(o.name)}</option>`).join('')}
        </optgroup>
    `).join('');
}

function handleSubitemTemplateChange(select) {
    const item = select.closest('.subitem-item');
    const nameInput = item.querySelector('.subitem-name');
    const selectedOption = select.options[select.selectedIndex];

    if (selectedOption.value && selectedOption.value !== 'custom') {
        nameInput.value = selectedOption.text;
    }
}

function removeSubitemItem(button) {
    const item = button.closest('.subitem-item');
    item.remove();
    renumberSubitemItems();
}

function renumberSubitemItems() {
    const items = subitemBuilder.querySelectorAll('.subitem-item');
    items.forEach((item, index) => {
        item.querySelector('.item-number').textContent = index + 1;
    });
    subitemCount = items.length;
}

function confirmPushToMonday() {
    const items = subitemBuilder.querySelectorAll('.subitem-item');
    const count = items.length;

    document.getElementById('confirmTitle').textContent = 'Push to Monday.com?';
    document.getElementById('confirmMessage').textContent =
        `This will create the request in Monday.com${count > 0 ? ` with ${count} subitem(s)` : ''}. This action cannot be undone.`;

    document.getElementById('confirmActionBtn').onclick = pushToMonday;
    openModal(confirmModal);
}

async function pushToMonday() {
    closeModal(confirmModal);

    const items = subitemBuilder.querySelectorAll('.subitem-item');
    const subitems = [];

    for (const item of items) {
        const nameInput = item.querySelector('.subitem-name');
        const ownerSelect = item.querySelector('.subitem-owner');
        const dueDateInput = item.querySelector('.subitem-due-date');

        const name = nameInput.value.trim();
        if (!name) continue;

        subitems.push({
            name,
            ownerEmail: ownerSelect.value,
            ownerName: ownerSelect.options[ownerSelect.selectedIndex]?.dataset?.name || '',
            dueDate: dueDateInput.value || null
        });
    }

    try {
        document.getElementById('pushToMondayBtn').disabled = true;
        document.getElementById('pushToMondayBtn').textContent = 'Pushing...';

        const data = await fetchAPI('approveAndPush', {
            packetId: currentPacket.id,
            subitems
        });

        if (data.success) {
            const mondayLink = `${CONFIG.MONDAY_BOARD_URL}/pulses/${data.mondayItemId}`;
            showSuccess(
                'Pushed to Monday.com!',
                `<a href="${mondayLink}" target="_blank" class="monday-link">View in Monday.com &rarr;</a>`
            );
        } else {
            throw new Error(data.error || 'Failed to push to Monday.com');
        }

    } catch (error) {
        console.error('Error pushing to Monday:', error);
        alert('Error: ' + error.message);
        document.getElementById('pushToMondayBtn').disabled = false;
        document.getElementById('pushToMondayBtn').textContent = 'Push to Monday.com';
    }
}

// ============================================
// NAVIGATION FUNCTIONS
// ============================================
function updateNavigation(packetTitle = null) {
    if (packetTitle) {
        // Viewing a specific packet - show back link and title
        navContent.innerHTML = `
            <a href="review.html" class="nav-back-link">
                <span class="back-arrow">&larr;</span>
                Back to Dashboard
            </a>
            <span class="nav-separator">/</span>
            <span class="nav-packet-title" title="${escapeHtml(packetTitle)}">${escapeHtml(packetTitle)}</span>
        `;
    } else {
        // Dashboard view
        navContent.innerHTML = '<span class="nav-title">Review Dashboard</span>';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function hideAllPanels() {
    requestInfoPanel.style.display = 'none';
    proceedPanel.style.display = 'none';
}

function showError(message) {
    loadingContainer.style.display = 'none';
    errorText.textContent = message;
    errorContainer.style.display = 'block';
}

function showSuccess(title, message) {
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').innerHTML = message;
    openModal(successModal);
}

function openModal(modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending Review',
        'in-review': 'In Review',
        'waiting': 'Waiting for Info',
        'approved': 'Approved',
        'pushed': 'Pushed to Monday'
    };
    return statusMap[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// DEFAULT CONFIGURATIONS (fallback)
// ============================================
function getDefaultPocDirectory() {
    return {
        teams: {
            "Quality": { members: [{ name: "Joe Litchford", email: "joel2@repfitness.com" }] },
            "Product": { members: [{ name: "Jason Lazar", email: "JasonL@repfitness.com" }] },
            "Sourcing": { members: [{ name: "Greg Dahlstrom", email: "GregD@repfitness.com" }] },
            "NPI": { members: [{ name: "Bryan Hamilton", email: "BryanH@repfitness.com" }] },
            "Drafting": { members: [{ name: "Drew Forsterer", email: "DrewF@repfitness.com" }] }
        }
    };
}

function getDefaultSubitemOwners() {
    return {
        owners: [
            { name: "Joe Litchford", email: "joel2@repfitness.com", team: "Quality" },
            { name: "Jason Lazar", email: "JasonL@repfitness.com", team: "Product" },
            { name: "Greg Dahlstrom", email: "GregD@repfitness.com", team: "Sourcing" }
        ]
    };
}

function getDefaultSubitemTemplates() {
    return {
        templates: [
            { id: "quote-supplier", name: "Request quote from supplier", description: "Get pricing quote" },
            { id: "update-drawing", name: "Update drawing", description: "Update engineering drawings" },
            { id: "custom", name: "Custom task", description: "" }
        ]
    };
}

function getDefaultInfoRequestTemplates() {
    return {
        templates: [
            { id: "supplier-quote", name: "Supplier quote needed", description: "Please provide a quote.", suggestedTeams: ["Sourcing"] },
            { id: "quality-data", name: "Quality inspection data required", description: "Please provide inspection data.", suggestedTeams: ["Quality"] },
            { id: "custom", name: "Custom request", description: "", suggestedTeams: [] }
        ]
    };
}

// ============================================
// SHARED API HELPER
// ============================================
async function fetchAPI(action, payload = {}) {
    if (!CONFIG.API_URL) {
        throw new Error('API URL not configured');
    }

    const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action,
            ...payload
        })
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
    }

    return await response.json();
}