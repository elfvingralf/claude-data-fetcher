function generateEncryptionKey() {
    return crypto.getRandomValues(new Uint8Array(32));
}

async function deriveKey(masterKey, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        masterKey,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(data, masterKey) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(masterKey, salt);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(data)
    );
    return {
        salt: Array.from(salt),
        iv: Array.from(iv),
        encryptedData: Array.from(new Uint8Array(encrypted))
    };
}

async function decryptData(encryptedObj, masterKey) {
    const key = await deriveKey(masterKey, new Uint8Array(encryptedObj.salt));
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(encryptedObj.iv) },
        key,
        new Uint8Array(encryptedObj.encryptedData)
    );
    return new TextDecoder().decode(decrypted);
}

function sanitizeResponse(response) {
    // Remove or replace unwanted characters
    return response
        .replace(/["'`]/g, '')  // Remove various types of quotes
        .replace(/[<>]/g, '')   // Remove angle brackets
        .replace(/[{}[\]]/g, '') // Remove braces and brackets
        .trim();
}

async function makeOpenAIRequest(prompt, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                {"role": "system", "content": "You are a helpful assistant, helping to craft Google search queries based on what the user is trying to achieve. Only respond with the words you think should be used in the Google search, not with any other information."},
                {"role": "user", "content": `Please craft a Google search for this: "${prompt}"`}
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

async function queryJinaAI(openaiResponse) {
    // Sanitize the response to remove unwanted characters
    const sanitizedResponse = sanitizeResponse(openaiResponse);
    
    // Continue with the sanitized response
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                action: "fetchJinaData",
                query: sanitizedResponse
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.data);
                }
            }
        );
    });
}

async function refineWithOpenAI(data, apiKey, userPrompt) {
    const refinedResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `You're a helpful assistant that cleans messy scraped website data and extracts information relevant to your colleague's research. Your colleagues use the cleaned text as context when they write research articles about a particular topic. Only respond with cleaned data you think is relevant for the topic and question in mind. Provide the cleaned text in the order it appears, without images, don't add your comment, or any information that isn't in the scraped data. Always include the source and title of all scraped pages, which appears as this in the scraped data: [x] Title: <source x title will be here> [x] URL Source: <url for source x will be here>` },
                { role: "user", content: `Your colleague is answering the question "${userPrompt}", can you please extract the relevant text and source information from this scraped data: ${data}` }
            ]
        })
    });

    if (!refinedResponse.ok) {
        throw new Error(`There was an error calling OpenAI: ${refinedResponse.statusText}`);
    }

    const refinedData = await refinedResponse.json();
    return refinedData.choices[0].message.content.trim();
}


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

    let originalApiKeyMasked = '';

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
        
        // Display the masked API key if available
        chrome.storage.local.get(['encryptedApiKey'], async function(result) {
            if (result.encryptedApiKey) {
                const masterKey = await getMasterKey();
                const decryptedApiKey = await decryptData(result.encryptedApiKey, masterKey);
                originalApiKeyMasked = '*'.repeat(decryptedApiKey.length);
                updateApiKeyInput.value = originalApiKeyMasked;
            } else {
                updateApiKeyInput.value = '';
            }
        });
    }

    chrome.storage.local.get(['encryptedApiKey'], function(result) {
        if (result.encryptedApiKey) {
            showMainSection();
            addNewQueryInput();
        } else {
            showApiKeySection();
        }
    });

    apiKeyInput.addEventListener('input', function() {
        submitBtn.disabled = this.value.length < 10;
    });

    submitBtn.addEventListener('click', async function() {
        const apiKey = apiKeyInput.value;

        try {
            const masterKey = await getMasterKey();
            const encryptedData = await encryptData(apiKey, masterKey);

            chrome.storage.local.set({ encryptedApiKey: encryptedData }, function() {
                if (chrome.runtime.lastError) return;
                showMainSection();
                addNewQueryInput();
            });
        } catch (error) {
            // Handle error silently
        }
    });

    settingsBtn.addEventListener('click', function() {
        showSettingsSection();
    });

    exitSettingsBtn.addEventListener('click', function() {
        showMainSection();
    });

    updateApiKeyInput.addEventListener('input', function() {
        updateBtn.disabled = (updateApiKeyInput.value === originalApiKeyMasked || updateApiKeyInput.value.length < 10);
    });

    updateBtn.addEventListener('click', async function() {
        const newApiKey = updateApiKeyInput.value;

        if (newApiKey === originalApiKeyMasked) {
            return; // No change to the API key
        }

        try {
            const masterKey = await getMasterKey();
            const encryptedData = await encryptData(newApiKey, masterKey);

            chrome.storage.local.set({ encryptedApiKey: encryptedData }, function() {
                if (chrome.runtime.lastError) {
                    console.error('Error updating API key:', chrome.runtime.lastError);
                    return;
                }
                showMainSection();
            });
        } catch (error) {
            console.error('Error updating API key:', error);
        }
    });

    newQueryBtn.addEventListener('click', function() {
        addNewQueryInput();
    });
    
    // Function to re-enable the new query button
    function enableNewQueryButton() {
        newQueryBtn.classList.remove('new-query-btn-disabled');
    }

    function addNewQueryInput() {
        // Check if there's already an open input prompt
        if (document.querySelector('.new-query-input')) {
            return; // Exit if there's already an open input prompt
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
    
        // Disable the new query button
        newQueryBtn.classList.add('new-query-btn-disabled');
    }
    
    async function handleSubmit(queryItem, submitButton, progressIndicator) {
        const textarea = queryItem.querySelector('textarea');
        const prompt = textarea.value;
        if (!prompt.trim()) return;
    
        submitButton.disabled = true;
        submitButton.style.display = 'none'; // Hide the submit button
        progressIndicator.style.display = 'flex';
    
        try {
            const result = await new Promise((resolve) => chrome.storage.local.get(['encryptedApiKey'], resolve));
            if (!result.encryptedApiKey) {
                throw new Error('API key not found');
            }
    
            const masterKey = await getMasterKey();
            const decryptedApiKey = await decryptData(result.encryptedApiKey, masterKey);
    
            // Step 1: Get response from OpenAI
            const openaiResponse = await makeOpenAIRequest(prompt, decryptedApiKey);
            console.log(openaiResponse)
            updateProgress('step1');
    
            // Step 2: Query Jina AI with the OpenAI response
            const jinaData = await queryJinaAI(openaiResponse);
            updateProgress('step2');
    
            // Step 3: Refine the data using OpenAI
            const refinedData = await refineWithOpenAI(jinaData, decryptedApiKey, prompt);
            updateProgress('step3');
    
            // Display the refined data
            displayQueryAndResponse(queryItem, prompt, refinedData);
        } catch (error) {
            displayQueryAndResponse(queryItem, prompt, `There was an error when searching, please try again: ${error.message}`);
        } finally {
            progressIndicator.style.display = 'none';
            queryItem.remove();
            enableNewQueryButton(); // Re-enable the new query button
        }
    }
    
    function updateProgress(stepId) {
        const stepElement = document.getElementById(stepId);
        if (stepElement) {
            stepElement.classList.add('completed');
            stepElement.innerHTML = `<i class="fas fa-check"></i> ${stepElement.textContent}`;
        }
    
        // Show spinner for the next step
        const nextStepElement = stepElement.nextElementSibling;
        if (nextStepElement && !nextStepElement.classList.contains('completed')) {
            nextStepElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${nextStepElement.textContent}`;
        }
    }

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
            // Optionally, provide some visual feedback that the text was copied
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
});

async function getMasterKey() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getMasterKey' }, function (response) {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(new Uint8Array(response.masterKey));
            }
        });
    });
}
