document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const submitBtn = document.getElementById('submitBtn');
    const apiKeySection = document.getElementById('apiKeySection');
    const mainSection = document.getElementById('mainSection');
    const newQueryBtn = document.getElementById('newQueryBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const queriesSection = document.getElementById('queriesSection');
    const settingsSection = document.getElementById('settingsSection');
    const updateApiKeyInput = document.getElementById('updateApiKey');
    const updateBtn = document.getElementById('updateBtn');
    const exitSettingsBtn = document.getElementById('exitSettingsBtn');
    const showIconToggle = document.getElementById('showIconToggle');

    function showMainSection() {
        apiKeySection.style.display = 'none';
        mainSection.style.display = 'block';
        settingsSection.style.display = 'none';
    }

    function showApiKeySection() {
        apiKeySection.style.display = 'block';
        mainSection.style.display = 'none';
        settingsSection.style.display = 'none';
    }

    function showSettingsSection() {
        settingsSection.style.display = 'block';
        mainSection.style.display = 'none';
        apiKeySection.style.display = 'none';
        
        // Load the current toggle state
        chrome.storage.local.get(['showIcon'], function(result) {
            showIconToggle.checked = result.showIcon !== false; // Default to true if not set
        });

        // Display the masked API key if available
        chrome.runtime.sendMessage({action: "getApiKey"}, function(response) {
            if (response.apiKey) {
                updateApiKeyInput.value = '*'.repeat(response.apiKey.length);
            } else {
                updateApiKeyInput.value = '';
            }
        });
    }

    chrome.runtime.sendMessage({action: "getApiKey"}, function(response) {
        if (response.apiKey) {
            showMainSection();
            addNewQueryInput();
        } else {
            showApiKeySection();
        }
    });

    apiKeyInput.addEventListener('input', function() {
        submitBtn.disabled = this.value.length < 10;
    });

    submitBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value;
        chrome.runtime.sendMessage({action: "setApiKey", apiKey: apiKey}, function(response) {
            if (response.success) {
                showMainSection();
                addNewQueryInput();
            } else {
                console.error('Error setting API key:', response.error);
            }
        });
    });

    settingsBtn.addEventListener('click', showSettingsSection);

    exitSettingsBtn.addEventListener('click', function() {
        showMainSection();
    });

    updateApiKeyInput.addEventListener('input', function() {
        updateBtn.disabled = this.value.length < 10;
    });

    updateBtn.addEventListener('click', function() {
        const newApiKey = updateApiKeyInput.value;
        chrome.runtime.sendMessage({action: "setApiKey", apiKey: newApiKey}, function(response) {
            if (response.success) {
                showMainSection();
            } else {
                console.error('Error updating API key:', response.error);
            }
        });
    });

    newQueryBtn.addEventListener('click', function() {
        addNewQueryInput();
    });
    
    function enableNewQueryButton() {
        newQueryBtn.classList.remove('new-query-btn-disabled');
    }

    function addNewQueryInput() {
        if (document.querySelector('.new-query-input')) {
            return;
        }
    
        const queryItem = document.createElement('div');
        queryItem.className = 'new-query-input';
        queryItem.innerHTML = `
            <textarea rows="4" placeholder="Briefly describe what data you're looking for and why"></textarea>
            <div class="submit-btn">
                <div class="progress-indicator" style="display: none;">
                    <div class="progress-step" id="step1">Optimizing search terms</div>
                    <div class="progress-step" id="step2">Performing search</div>
                    <div class="progress-step" id="step3">Formatting response data</div>
                </div>
                <button>Submit</button>
            </div>
        `;
        queriesSection.insertBefore(queryItem, queriesSection.firstChild);
    
        const submitButton = queryItem.querySelector('button');
        const progressIndicator = queryItem.querySelector('.progress-indicator');
        submitButton.addEventListener('click', function() {
            handleSubmit(queryItem, submitButton, progressIndicator);
        });
    
        newQueryBtn.classList.add('new-query-btn-disabled');
    }
    
    function handleSubmit(queryItem, submitButton, progressIndicator) {
        const textarea = queryItem.querySelector('textarea');
        const prompt = textarea.value;
        if (!prompt.trim()) return;
    
        submitButton.disabled = true;
        submitButton.style.display = 'none';
        progressIndicator.style.display = 'flex';
    
        // Reset progress steps
        document.querySelectorAll('.progress-step').forEach(step => {
            step.classList.remove('completed');
            step.innerHTML = step.textContent;
        });
    
        chrome.runtime.sendMessage({action: "processInput", text: prompt}, function(response) {
            if (response.data) {
                // Ensure all steps are marked as completed
                updateProgress('step3');
                displayQueryAndResponse(queryItem, prompt, response.data);
            } else if (response.error) {
                displayQueryAndResponse(queryItem, prompt, `Error: ${response.error}`);
            }
            progressIndicator.style.display = 'none';
            queryItem.remove();
            enableNewQueryButton();
        });
    }
    
    function updateProgress(stepId) {
        const steps = ['step1', 'step2', 'step3'];
        const currentStepIndex = steps.indexOf(stepId);
    
        steps.forEach((step, index) => {
            const stepElement = document.getElementById(step);
            if (stepElement) {
                if (index < currentStepIndex) {
                    // Previous steps are completed
                    stepElement.classList.add('completed');
                    stepElement.innerHTML = `<i class="fas fa-check"></i> ${stepElement.textContent}`;
                } else if (index === currentStepIndex) {
                    // Current step is in progress
                    stepElement.classList.remove('completed');
                    stepElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${stepElement.textContent}`;
                } else {
                    // Future steps are reset
                    stepElement.classList.remove('completed');
                    stepElement.innerHTML = stepElement.textContent;
                }
            }
        });
    }
    
    // Add a message listener for progress updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateProgress") {
            updateProgress(message.step);
        }
    });

    function displayQueryAndResponse(queryItem, prompt, response) {
        const queryResponseItem = document.createElement('div');
        queryResponseItem.className = 'query-item';
        queryResponseItem.innerHTML = `
            <div class="query-text">${prompt}</div>
            <div class="response-container">
                <div class="response-header">
                    <span>Response</span>
                    <div class="copy-icon" title="Copy response">
                        <i class="fas fa-copy"></i> Copy
                    </div>
                </div>
                <div class="response-content">${response.length > 45 ? response.slice(0, 45) + '...' : response}</div>
                <div class="expand-tab">
                    <span>Expand</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
        `;
        queriesSection.insertBefore(queryResponseItem, queryItem.nextSibling);

        const copyIcon = queryResponseItem.querySelector('.copy-icon');
        copyIcon.addEventListener('click', () => copyResponse(response));

        const expandTab = queryResponseItem.querySelector('.expand-tab');
        const responseContent = queryResponseItem.querySelector('.response-content');
        expandTab.addEventListener('click', () => toggleExpand(expandTab, responseContent, response));
    }

    function copyResponse(response) {
        navigator.clipboard.writeText(response).then(function() {
            console.log('Response copied to clipboard');
        });
    }

    function toggleExpand(expandTab, responseContent, fullResponse) {
        responseContent.classList.toggle('expanded');
        if (responseContent.classList.contains('expanded')) {
            expandTab.innerHTML = '<span>Collapse</span><i class="fas fa-chevron-up"></i>';
            responseContent.textContent = fullResponse;
        } else {
            expandTab.innerHTML = '<span>Expand</span><i class="fas fa-chevron-down"></i>';
            responseContent.textContent = fullResponse.length > 45 
                ? fullResponse.slice(0, 45) + '...'
                : fullResponse;
        }
    }

    showIconToggle.addEventListener('change', function() {
        const showIcon = this.checked;
        chrome.runtime.sendMessage({action: "setShowIcon", showIcon: showIcon}, function(response) {
            if (!response.success) {
                console.error('Error setting show icon:', response.error);
            }
        });
    });
});