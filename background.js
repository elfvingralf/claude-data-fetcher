const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const JINA_AI_URL = 'https://s.jina.ai/';
const OPENAI_MODEL = 'gpt-4o-mini';

// Encryption functions
function generateEncryptionKey() {
    return crypto.getRandomValues(new Uint8Array(32));
}

async function storeMasterKey(masterKey) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ masterKey: Array.from(masterKey) }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

async function getMasterKey() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['masterKey'], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (result.masterKey) {
                resolve(new Uint8Array(result.masterKey));
            } else {
                reject(new Error('Master key not found'));
            }
        });
    });
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

// API interaction functions
async function makeOpenAIRequest(prompt, apiKey) {
    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
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

async function queryJinaAI(query) {
    const response = await fetch(`${JINA_AI_URL}${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`Error fetching data from Jina AI: ${response.statusText}`);
    }
    return response.text();
}

async function refineWithOpenAI(data, apiKey, userPrompt) {
    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
                { role: "system", content: `You're a helpful assistant that cleans messy scraped website data and extracts information relevant to your colleague's research. Your colleagues use the cleaned text as context when they write research articles about a particular topic. Only respond with cleaned data you think is relevant for the topic and question in mind. Provide the cleaned text in the order it appears, without images, don't add your comment, or any information that isn't in the scraped data. Always include the source and title of all scraped pages that are relevant, which appears as this in the scraped data: [x] Title: <source x title will be here> [x] URL Source: <url for source x will be here>` },
                { role: "user", content: `Your colleague is answering the question "${userPrompt}", can you please extract the relevant text and source information from this scraped data: ${data}` }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`There was an error calling OpenAI: ${response.statusText}`);
    }

    const refinedData = await response.json();
    return refinedData.choices[0].message.content.trim();
}

// Main processing function
async function processUserInput(input, sender) {
    try {
        const result = await new Promise((resolve) => chrome.storage.local.get(['encryptedApiKey'], resolve));
        if (!result.encryptedApiKey) {
            throw new Error('API key not found');
        }

        const masterKey = await getMasterKey();
        const decryptedApiKey = await decryptData(result.encryptedApiKey, masterKey);

        // Step 1: Get response from OpenAI
        sendProgressUpdate("step1", sender);
        const openaiResponse = await makeOpenAIRequest(input, decryptedApiKey);
        if (!openaiResponse) {
            throw new Error('Failed to get response from OpenAI');
        }

        // Step 2: Query Jina AI with the OpenAI response
        sendProgressUpdate("step2", sender);
        const jinaData = await queryJinaAI(sanitizeResponse(openaiResponse));
        if (!jinaData) {
            throw new Error('Failed to get data from Jina AI');
        }

        // Step 3: Refine the data using OpenAI
        sendProgressUpdate("step3", sender);
        const refinedData = await refineWithOpenAI(jinaData, decryptedApiKey, input);
        if (!refinedData) {
            throw new Error('Failed to refine data with OpenAI');
        }

        return refinedData;
    } catch (error) {
        console.error("Error processing input:", error);
        throw error;
    }
}

function sendProgressUpdate(step, sender) {
    if (sender && sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, {action: "updateProgress", step: step});
    }
    chrome.runtime.sendMessage({action: "updateProgress", step: step});
}

// Helper functions
function sanitizeResponse(response) {
    return response
        .replace(/["'`]/g, '')
        .replace(/[<>]/g, '')
        .replace(/[{}[\]]/g, '')
        .trim();
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "processInput") {
        processUserInput(request.text, sender)
            .then(result => sendResponse({data: result}))
            .catch(error => sendResponse({error: error.message}));
        return true;  // Indicates an asynchronous response
    } else if (request.action === "setApiKey") {
        (async () => {
            try {
                const masterKey = await getMasterKey();
                const encryptedData = await encryptData(request.apiKey, masterKey);
                await new Promise((resolve, reject) => {
                    chrome.storage.local.set({ encryptedApiKey: encryptedData }, () => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                        else resolve();
                    });
                });
                sendResponse({success: true});
            } catch (error) {
                sendResponse({error: error.message});
            }
        })();
        return true;
    } else if (request.action === "getApiKey") {
        (async () => {
            try {
                const result = await new Promise(resolve => chrome.storage.local.get(['encryptedApiKey'], resolve));
                if (!result.encryptedApiKey) {
                    sendResponse({apiKey: null});
                    return;
                }
                const masterKey = await getMasterKey();
                const decryptedApiKey = await decryptData(result.encryptedApiKey, masterKey);
                sendResponse({apiKey: decryptedApiKey});
            } catch (error) {
                sendResponse({error: error.message});
            }
        })();
        return true;
    } else if (request.action === "setShowIcon") {
        chrome.storage.local.set({ showIcon: request.showIcon }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({error: chrome.runtime.lastError.message});
            } else {
                chrome.tabs.query({url: "https://claude.ai/*"}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {action: "toggleIcon", showIcon: request.showIcon});
                    });
                });
                sendResponse({success: true});
            }
        });
        return true;
    }
});

// Initialization
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        try {
            await getMasterKey();
        } catch (error) {
            const masterKey = generateEncryptionKey();
            await storeMasterKey(masterKey);
        }
    }
});

// Set up the side panel behavior
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Error setting panel behavior:', error));