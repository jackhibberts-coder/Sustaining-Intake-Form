/**
 * Rep Fitness Sustaining Intake Form - PoC Response Form
 * Handles information request responses from team members
 */
 
// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // N8N Webhook URL
    API_URL: 'https://n8n.repfitness.io/webhook-test/sustaining-api'
};
 
// ============================================
// STATE
// ============================================
let packetId = null;
let requestId = null;
let currentRequest = null;
let packetInfo = null;
 
// ============================================
// DOM ELEMENTS
// ============================================
const loadingContainer = document.getElementById('loadingContainer');
const errorContainer = document.getElementById('errorContainer');
const responseView = document.getElementById('responseView');
const successView = document.getElementById('successView');
const errorText = document.getElementById('errorText');
const responseForm = document.getElementById('responseForm');
const submitBtn = document.getElementById('submitBtn');
 
// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    packetId = urlParams.get('packetId');
    requestId = urlParams.get('requestId');
 
    // Also support email parameter to pre-fill
    const emailParam = urlParams.get('email');
    const nameParam = urlParams.get('name');
 
    if (!packetId || !requestId) {
        showError('Invalid request link. Missing packet or request ID.');
        return;
    }
 
    // Pre-fill if provided in URL
    if (emailParam) {
        document.getElementById('responderEmail').value = decodeURIComponent(emailParam);
    }
    if (nameParam) {
        document.getElementById('responderName').value = decodeURIComponent(nameParam);
    }
 
    await loadInfoRequest();
    setupEventListeners();
});
 
// ============================================
// DATA LOADING
// ============================================
async function loadInfoRequest() {
    loadingContainer.style.display = 'block';
    responseView.style.display = 'none';
 
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getPacket',
                packetId: packetId,
                requestId: requestId
            })
        });
        const data = await response.json();
 
        if (data.success && data.request && data.packet) {
            currentRequest = data.request;
            packetInfo = data.packet;
            renderRequestDetails();
            loadingContainer.style.display = 'none';
            responseView.style.display = 'block';
        } else {
            showError(data.error || 'Information request not found or has already been completed.');
        }
 
    } catch (error) {
        console.error('Error loading info request:', error);
        showError('Unable to load the information request. Please try again or contact the engineer.');
    }
}
 
function renderRequestDetails() {
    // Project context
    document.getElementById('contextTitle').textContent = packetInfo.requestTitle;
    document.getElementById('contextRequester').textContent = packetInfo.requesterName;
    document.getElementById('contextCategory').textContent = packetInfo.category;
    document.getElementById('contextProblem').textContent = packetInfo.problem;
    document.getElementById('contextAction').textContent = packetInfo.requestedAction;
 
    // Information request
    document.getElementById('requestQuestion').textContent = currentRequest.question;
 
    // Assigned to info
    const assignedNames = currentRequest.assignedTo.map(a => a.name).join(', ');
    document.getElementById('requestAssignedTo').innerHTML =
        `<strong>Requested from:</strong> ${escapeHtml(assignedNames)}`;
 
    // Previous responses
    if (currentRequest.responses && currentRequest.responses.length > 0) {
        renderPreviousResponses();
    }
}
 
function renderPreviousResponses() {
    const section = document.getElementById('previousResponsesSection');
    const container = document.getElementById('previousResponses');
 
    container.innerHTML = currentRequest.responses.map(resp => `
        <div class="previous-response">
            <div class="previous-response-header">
                <span class="previous-response-name">${escapeHtml(resp.responderName)}</span>
                <span class="previous-response-date">${formatDate(resp.respondedAt)}</span>
            </div>
            <div class="previous-response-text">${escapeHtml(resp.responseText)}</div>
        </div>
    `).join('');
 
    section.style.display = 'block';
}
 
// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    responseForm.addEventListener('submit', handleSubmit);
 
    // Input validation on blur
    const inputs = responseForm.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearFieldError(input));
    });
}
 
// ============================================
// FORM SUBMISSION
// ============================================
async function handleSubmit(e) {
    e.preventDefault();
 
    // Validate all fields
    if (!validateForm()) {
        return;
    }
 
    setSubmitLoading(true);
 
    const formData = {
        action: 'submitResponse',
        packetId: packetId,
        requestId: requestId,
        responderName: document.getElementById('responderName').value.trim(),
        responderEmail: document.getElementById('responderEmail').value.trim(),
        responseText: document.getElementById('responseText').value.trim()
    };
 
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
 
        const data = await response.json();
 
        if (data.success) {
            showSuccess();
        } else {
            throw new Error(data.error || 'Failed to submit response');
        }
 
    } catch (error) {
        console.error('Error submitting response:', error);
        alert('Error: ' + error.message);
        setSubmitLoading(false);
    }
}
 
// ============================================
// VALIDATION
// ============================================
function validateForm() {
    let isValid = true;
 
    const fields = [
        { id: 'responderName', label: 'Your name' },
        { id: 'responderEmail', label: 'Your email' },
        { id: 'responseText', label: 'Response' }
    ];
 
    fields.forEach(field => {
        const input = document.getElementById(field.id);
        if (!validateField(input)) {
            isValid = false;
        }
    });
 
    // Focus first invalid field
    if (!isValid) {
        const firstError = responseForm.querySelector('.form-group.error input, .form-group.error textarea');
        if (firstError) {
            firstError.focus();
        }
    }
 
    return isValid;
}
 
function validateField(input) {
    const value = input.value.trim();
    const formGroup = input.closest('.form-group');
    const errorElement = document.getElementById(`${input.id}Error`);
 
    let errorMessage = '';
 
    if (!value) {
        errorMessage = 'This field is required';
    } else if (input.type === 'email' && !isValidEmail(value)) {
        errorMessage = 'Please enter a valid email address';
    }
 
    if (errorMessage) {
        formGroup.classList.add('error');
        if (errorElement) {
            errorElement.textContent = errorMessage;
        }
        return false;
    } else {
        formGroup.classList.remove('error');
        if (errorElement) {
            errorElement.textContent = '';
        }
        return true;
    }
}
 
function clearFieldError(input) {
    const formGroup = input.closest('.form-group');
    const errorElement = document.getElementById(`${input.id}Error`);
 
    formGroup.classList.remove('error');
    if (errorElement) {
        errorElement.textContent = '';
    }
}
 
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
 
// ============================================
// UI HELPERS
// ============================================
function showError(message) {
    loadingContainer.style.display = 'none';
    errorText.textContent = message;
    errorContainer.style.display = 'block';
}
 
function showSuccess() {
    responseView.style.display = 'none';
    successView.style.display = 'block';
}
 
function setSubmitLoading(loading) {
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
 
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';
        submitBtn.disabled = true;
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
    }
}
 
// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
 
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
 
