/**
 * Rep Fitness Sustaining Intake Form
 * Client-side validation, draft auto-save, and Google Apps Script integration
 */

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const CONFIG = {
    // Google Apps Script Web App URL (deployed as web app)
    // Replace with your actual deployment URL after deploying Code.gs
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxPURU2dD3o13f-SiCSZcZcBTjjw3NjwBzLIyBgsDnSP6Om4g1GpNWYXvyW-QnQ726C/exec',

    // Monday.com board URL base (for success link)
    MONDAY_BOARD_URL: 'https://rep-fitness.monday.com/boards/8281967707/views/200096331',

    // Local storage key for draft
    DRAFT_KEY: 'repfitness_intake_draft',

    // Auto-save debounce delay (ms)
    AUTOSAVE_DELAY: 1000,

    // Total number of required fields
    TOTAL_FIELDS: 11
};

// ============================================
// DOM ELEMENTS
// ============================================
const form = document.getElementById('intakeForm');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const draftStatus = document.getElementById('draftStatus');
const draftMessage = document.getElementById('draftMessage');
const submitBtn = document.getElementById('submitBtn');
const clearDraftBtn = document.getElementById('clearDraftBtn');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const packetIdDisplay = document.getElementById('packetIdDisplay');
const errorMessage = document.getElementById('errorMessage');

// Multi-select elements
const suppliersDisplay = document.getElementById('suppliersDisplay');
const suppliersDropdown = document.getElementById('suppliersDropdown');
const suppliersContainer = document.getElementById('suppliersContainer');
const suppliersHidden = document.getElementById('suppliersHidden');

// ============================================
// FORM FIELD DEFINITIONS
// ============================================
const REQUIRED_FIELDS = [
    { id: 'requesterName', type: 'select', label: 'Requester Name' },
    { id: 'category', type: 'select', label: 'Category' },
    { id: 'requestTitle', type: 'text', label: 'Request Title' },
    { id: 'problem', type: 'textarea', label: 'Problem' },
    { id: 'requestedAction', type: 'textarea', label: 'Requested Action' },
    { id: 'testingRequired', type: 'select', label: 'Testing Required' },
    { id: 'suppliers', type: 'multiselect', label: 'Suppliers' },
    { id: 'costImpact', type: 'textarea', label: 'Cost Impact' },
    { id: 'ecoReleaseDate', type: 'date', label: 'ECO Release Date' },
    { id: 'ecrPriority', type: 'select', label: 'ECR Priority' },
    { id: 'inventoryDisposition', type: 'select', label: 'Inventory Disposition' }
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    loadDraft();
    setupEventListeners();
    updateProgress();
});

function initializeForm() {
    // Set minimum date for ECO Release Date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('ecoReleaseDate').setAttribute('min', today);
}

function setupEventListeners() {
    // Form submission
    form.addEventListener('submit', handleSubmit);

    // Input changes for validation and auto-save
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('input', debounce(handleInputChange, CONFIG.AUTOSAVE_DELAY));
        input.addEventListener('change', handleInputChange);
        input.addEventListener('blur', () => validateField(input.id));
    });

    // Multi-select dropdown
    suppliersDisplay.addEventListener('click', toggleSuppliersDropdown);
    suppliersDisplay.addEventListener('keydown', handleSuppliersKeydown);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!suppliersContainer.contains(e.target)) {
            closeSuppliersDropdown();
        }
    });

    // Supplier checkbox changes
    const supplierCheckboxes = suppliersDropdown.querySelectorAll('input[type="checkbox"]');
    supplierCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleSupplierChange);
    });

    // Clear draft button
    clearDraftBtn.addEventListener('click', clearDraft);

    // Modal close buttons
    document.getElementById('closeSuccessModal').addEventListener('click', () => {
        closeModal(successModal);
        resetForm();
    });

    document.getElementById('closeErrorModal').addEventListener('click', () => {
        closeModal(errorModal);
    });

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(successModal);
            closeModal(errorModal);
        }
    });

    // Close modals on backdrop click
    [successModal, errorModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });
}

// ============================================
// MULTI-SELECT DROPDOWN
// ============================================
function toggleSuppliersDropdown() {
    const isOpen = suppliersDropdown.classList.contains('open');
    if (isOpen) {
        closeSuppliersDropdown();
    } else {
        openSuppliersDropdown();
    }
}

function openSuppliersDropdown() {
    suppliersDropdown.classList.add('open');
    suppliersDisplay.classList.add('open');
    suppliersDisplay.setAttribute('aria-expanded', 'true');
}

function closeSuppliersDropdown() {
    suppliersDropdown.classList.remove('open');
    suppliersDisplay.classList.remove('open');
    suppliersDisplay.setAttribute('aria-expanded', 'false');
}

function handleSuppliersKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSuppliersDropdown();
    }
}

function handleSupplierChange() {
    updateSuppliersDisplay();
    updateProgress();
    saveDraft();
}

function updateSuppliersDisplay() {
    const checkboxes = suppliersDropdown.querySelectorAll('input[type="checkbox"]:checked');
    const selectedValues = Array.from(checkboxes).map(cb => cb.value);

    // Update hidden input
    suppliersHidden.value = selectedValues.join(',');

    // Update display
    suppliersDisplay.innerHTML = '';

    if (selectedValues.length === 0) {
        suppliersDisplay.innerHTML = '<span class="placeholder">Select suppliers...</span>';
    } else {
        selectedValues.forEach(value => {
            const tag = document.createElement('span');
            tag.className = 'multi-select-tag';
            tag.innerHTML = `
                ${value}
                <span class="multi-select-tag-remove" data-value="${value}" title="Remove">&times;</span>
            `;
            suppliersDisplay.appendChild(tag);
        });

        // Add click handlers for remove buttons
        suppliersDisplay.querySelectorAll('.multi-select-tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                const checkbox = suppliersDropdown.querySelector(`input[value="${value}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                    handleSupplierChange();
                }
            });
        });
    }

    // Clear error if suppliers selected
    if (selectedValues.length > 0) {
        clearFieldError('suppliers');
    }
}

// ============================================
// VALIDATION
// ============================================
function validateField(fieldId) {
    const fieldDef = REQUIRED_FIELDS.find(f => f.id === fieldId);
    if (!fieldDef) return true;

    let value;
    let isValid = true;
    let errorText = '';

    if (fieldDef.type === 'multiselect') {
        value = suppliersHidden.value;
        isValid = value.trim() !== '';
        errorText = isValid ? '' : `Please select at least one ${fieldDef.label.toLowerCase()}`;
    } else {
        const element = document.getElementById(fieldId);
        value = element.value.trim();
        isValid = value !== '';
        errorText = isValid ? '' : `${fieldDef.label} is required`;
    }

    setFieldError(fieldId, errorText);
    return isValid;
}

function validateForm() {
    let isValid = true;

    REQUIRED_FIELDS.forEach(field => {
        if (!validateField(field.id)) {
            isValid = false;
        }
    });

    // Focus first invalid field
    if (!isValid) {
        const firstError = form.querySelector('.form-group.error input, .form-group.error textarea, .form-group.error select');
        if (firstError) {
            firstError.focus();
        }
    }

    return isValid;
}

function setFieldError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const formGroup = errorElement?.closest('.form-group');

    if (errorElement) {
        errorElement.textContent = message;
    }

    if (formGroup) {
        if (message) {
            formGroup.classList.add('error');
        } else {
            formGroup.classList.remove('error');
        }
    }
}

function clearFieldError(fieldId) {
    setFieldError(fieldId, '');
}

function clearAllErrors() {
    REQUIRED_FIELDS.forEach(field => {
        clearFieldError(field.id);
    });
}

// ============================================
// PROGRESS TRACKING
// ============================================
function updateProgress() {
    let completedCount = 0;

    REQUIRED_FIELDS.forEach(field => {
        let hasValue = false;

        if (field.type === 'multiselect') {
            hasValue = suppliersHidden.value.trim() !== '';
        } else {
            const element = document.getElementById(field.id);
            hasValue = element && element.value.trim() !== '';
        }

        if (hasValue) {
            completedCount++;
        }
    });

    const percentage = (completedCount / CONFIG.TOTAL_FIELDS) * 100;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${completedCount} of ${CONFIG.TOTAL_FIELDS} fields completed`;
}

// ============================================
// AUTO-SAVE DRAFT
// ============================================
function saveDraft() {
    const formData = getFormData();

    try {
        localStorage.setItem(CONFIG.DRAFT_KEY, JSON.stringify({
            data: formData,
            timestamp: new Date().toISOString()
        }));

        showDraftStatus('Draft auto-saved');
    } catch (e) {
        console.warn('Failed to save draft:', e);
    }
}

function loadDraft() {
    try {
        const saved = localStorage.getItem(CONFIG.DRAFT_KEY);
        if (!saved) return;

        const { data, timestamp } = JSON.parse(saved);

        // Populate form fields
        Object.keys(data).forEach(key => {
            if (key === 'suppliers') {
                // Handle multi-select
                const values = data[key] ? data[key].split(',') : [];
                values.forEach(value => {
                    const checkbox = suppliersDropdown.querySelector(`input[value="${value}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
                updateSuppliersDisplay();
            } else {
                const element = document.getElementById(key);
                if (element) {
                    element.value = data[key] || '';
                }
            }
        });

        updateProgress();

        // Show draft restored message
        const savedDate = new Date(timestamp);
        const timeAgo = getTimeAgo(savedDate);
        showDraftStatus(`Draft restored from ${timeAgo}`);

    } catch (e) {
        console.warn('Failed to load draft:', e);
    }
}

function clearDraft() {
    if (confirm('Are you sure you want to clear your draft? This cannot be undone.')) {
        localStorage.removeItem(CONFIG.DRAFT_KEY);
        resetForm();
        showDraftStatus('Draft cleared');
    }
}

function showDraftStatus(message) {
    draftMessage.textContent = message;
    draftStatus.classList.add('visible');

    // Hide after 3 seconds
    setTimeout(() => {
        draftStatus.classList.remove('visible');
    }, 3000);
}

// ============================================
// FORM SUBMISSION
// ============================================
async function handleSubmit(e) {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
        return;
    }

    // Show loading state
    setSubmitLoading(true);

    // Get form data
    const formData = getFormData();

    try {
        // Submit to Google Apps Script
        const response = await submitToGoogleScript(formData);

        if (response.success) {
            // Clear draft
            localStorage.removeItem(CONFIG.DRAFT_KEY);

            // Display packet ID
            if (response.itemId) {
                packetIdDisplay.textContent = response.itemId;
            } else {
                packetIdDisplay.textContent = 'Saved';
            }

            // Show success modal
            openModal(successModal);
        } else {
            throw new Error(response.error || 'Submission failed');
        }
    } catch (error) {
        console.error('Submission error:', error);
        errorMessage.textContent = error.message || 'An error occurred while submitting your request. Please try again.';
        openModal(errorModal);
    } finally {
        setSubmitLoading(false);
    }
}

async function submitToGoogleScript(formData) {
    // Check if URL is configured
    if (CONFIG.GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
        throw new Error('Google Apps Script URL not configured. Please update CONFIG.GOOGLE_SCRIPT_URL in script.js');
    }

    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(formData),
            redirect: 'follow'
        });

        // Google Apps Script redirects to googleusercontent.com for the response
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Fetch error:', error);
        throw new Error('Failed to connect to server. Please try again.');
    }
}

function getFormData() {
    return {
        requesterName: document.getElementById('requesterName').value,
        category: document.getElementById('category').value,
        requestTitle: document.getElementById('requestTitle').value.trim(),
        problem: document.getElementById('problem').value.trim(),
        requestedAction: document.getElementById('requestedAction').value.trim(),
        testingRequired: document.getElementById('testingRequired').value,
        suppliers: suppliersHidden.value,
        costImpact: document.getElementById('costImpact').value.trim(),
        ecoReleaseDate: document.getElementById('ecoReleaseDate').value,
        ecrPriority: document.getElementById('ecrPriority').value,
        inventoryDisposition: document.getElementById('inventoryDisposition').value
    };
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

function resetForm() {
    form.reset();

    // Reset multi-select
    const checkboxes = suppliersDropdown.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateSuppliersDisplay();

    // Clear errors
    clearAllErrors();

    // Update progress
    updateProgress();
}

// ============================================
// INPUT HANDLERS
// ============================================
function handleInputChange(e) {
    const fieldId = e.target.id || e.target.name;

    // Clear error on input
    if (fieldId) {
        clearFieldError(fieldId);
    }

    // Update progress
    updateProgress();

    // Save draft
    saveDraft();
}

// ============================================
// MODAL FUNCTIONS
// ============================================
function openModal(modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    const focusable = modal.querySelector('button, [href], input');
    if (focusable) {
        focusable.focus();
    }
}

function closeModal(modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}
