// Function to generate encryption key
function generateEncryptionKey() {
    return crypto.getRandomValues(new Uint8Array(32));
}

// Function to store the master key securely
function storeMasterKey(masterKey) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ masterKey: Array.from(masterKey) }, function() {
            if (chrome.runtime.lastError) {
                console.error('Error storing master key:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                console.log('Master key generated and stored securely');
                resolve();
            }
        });
    });
}

// Function to check if master key exists
function checkMasterKeyExists() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['masterKey'], function(result) {
            resolve(!!result.masterKey);
        });
    });
}

// Initialize the extension
async function initializeExtension() {
    try {
        const masterKeyExists = await checkMasterKeyExists();
        if (!masterKeyExists) {
            const masterKey = generateEncryptionKey();
            await storeMasterKey(masterKey);
        }
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

// Listen for installation or update events
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install' || details.reason === 'update') {
        initializeExtension();
    }
});

// Set up the side panel behavior
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Error setting panel behavior:', error));

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getMasterKey') {
        chrome.storage.local.get(['masterKey'], function(result) {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError });
            } else {
                sendResponse({ masterKey: result.masterKey });
            }
        });
        return true; // Indicates that the response is sent asynchronously
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchJinaData") {
        fetch(`https://s.jina.ai/${encodeURIComponent(request.query)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error fetching data from Jina AI: ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => sendResponse({ data }))
            .catch(error => sendResponse({ error: error.message }));

        // Indicate that we will respond asynchronously
        return true;
    }
});
