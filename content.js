let iconInjected = false;
let iconButton;

function injectIcon() {
    if (iconInjected) return;

    const inputContainer = document.querySelector('fieldset > div > div.flex.gap-2');
    if (inputContainer) {
        iconButton = document.createElement('button');
        iconButton.className = 'inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-bg-300 ring-accent-main-100 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none hover:bg-bg-200 hover:border-border-400 border-0.5 text-text-100 ml-1.5 inline-flex items-start gap-[0.175em] self-start rounded-md border-transparent text-sm opacity-80 transition hover:opacity-100 disabled:!opacity-80 sm:ml-0 sm:pb-1.5 sm:pl-1.5 sm:pr-1 sm:pt-1';
        iconButton.innerHTML = `
        <div class="button-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" class="icon">
                <path d="M224,120v16a8,8,0,0,1-8,8H144v72a8,8,0,0,1-8,8H120a8,8,0,0,1-8-8V144H40a8,8,0,0,1-8-8V120a8,8,0,0,1,8-8h72V40a8,8,0,0,1,8-8h16a8,8,0,0,1,8,8v72h72A8,8,0,0,1,224,120Z"/>
            </svg>
            <div class="loading-content" style="display: none;">
                <div class="spinner"></div>
                <div class="progress-step"></div>
            </div>
        </div>
    `;
        iconButton.style.backgroundColor = '#9b87f5';
        iconButton.style.color = 'white';
        iconButton.style.borderRadius = '10px';
        iconButton.style.marginTop = '0px';
        iconButton.addEventListener('click', handleIconClick);
        
        // Add spinner and progress step styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .button-content {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .loading-content {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .spinner {
                width: 16px;
                height: 16px;
                border: 2px solid #ffffff;
                border-top: 2px solid transparent;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 5px;
            }
            .progress-step {
                font-size: 12px;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
        
        chrome.storage.local.get(['showIcon'], function(result) {
            iconButton.style.display = result.showIcon !== false ? 'inline-flex' : 'none';
        });

        inputContainer.appendChild(iconButton);
        iconInjected = true;
    } else {
        console.log("### ClaudeAI Input container not found");
    }
}

function toggleIconVisibility(show) {
    if (iconButton) {
        iconButton.style.display = show ? 'inline-flex' : 'none';
    }
}

function handleIconClick() {
    console.log("Icon clicked");
    const inputElement = document.querySelector('[contenteditable="true"]');
    if (inputElement) {
        const inputText = inputElement.textContent.trim();
        if (inputText) {
            // Show loading content and hide icon
            const iconElement = iconButton.querySelector('.icon');
            const loadingContent = iconButton.querySelector('.loading-content');
            if (iconElement && loadingContent) {
                iconElement.style.display = 'none';
                loadingContent.style.display = 'flex';
            }
            
            // Reset progress step
            updateProgress('step1');
            
            chrome.runtime.sendMessage({action: "processInput", text: inputText}, function(response) {
                // Hide loading content and show icon
                if (iconElement && loadingContent) {
                    loadingContent.style.display = 'none';
                    iconElement.style.display = 'block';
                }
                
                if (chrome.runtime.lastError) {
                    console.error("Error in chrome.runtime.sendMessage:", chrome.runtime.lastError);
                    insertResponse(inputText, "An error occurred while processing your request. Please try again.");
                } else if (response.error) {
                    console.error("Error processing input:", response.error);
                    insertResponse(inputText, `An error occurred: ${response.error}`);
                } else if (response.data) {
                    insertResponse(inputText, response.data);
                } else {
                    insertResponse(inputText, "No data received. Please try again.");
                }
            });
        }
    } 
}

function updateProgress(step) {
    const progressStep = iconButton.querySelector('.progress-step');
    if (progressStep) {
        switch (step) {
            case 'step1':
                progressStep.textContent = 'Optimizing search terms';
                break;
            case 'step2':
                progressStep.textContent = 'Performing search';
                break;
            case 'step3':
                progressStep.textContent = 'Formatting response data';
                break;
            default:
                progressStep.textContent = '';
        }
    }
}

function insertResponse(originalText, responseText) {
    const inputElement = document.querySelector('[contenteditable="true"]');
    if (inputElement) {
        // Format the response with HTML line breaks
        const formattedResponse = `${originalText}<br><br>----- This is the data ----<br>${responseText}`;

        // Insert new content using innerHTML to preserve line breaks
        inputElement.innerHTML = formattedResponse;

        // Move cursor to the end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(inputElement);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        // Trigger input event to update any listeners
        const event = new Event('input', { bubbles: true, cancelable: true });
        inputElement.dispatchEvent(event);
    }
}

// Add message listener for progress updates and icon visibility toggle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateProgress") {
        updateProgress(message.step);
    } else if (message.action === "toggleIcon") {
        toggleIconVisibility(message.showIcon);
    }
});

// Attempt to inject the icon after a short delay
setTimeout(injectIcon, 1000);

// Retry injection every 5 seconds for up to 30 seconds
let retryCount = 0;
const retryInterval = setInterval(() => {
    if (iconInjected || retryCount >= 6) {
        clearInterval(retryInterval);
    } else {
        injectIcon();
        retryCount++;
    }
}, 5000);