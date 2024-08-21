# Claude Data Fetcher

Claude Data Fetcher is a Chrome extension designed to enhance Anthropic Claude conversations by providing it access to information on the Internet. This extension uses Jina AI's Reader (scraping) API and OpenAI's GPT-4o-mini model to process search results and seamlessly integrate them into Claude's chat interface.

https://github.com/user-attachments/assets/97962be1-79da-42b2-ad27-99070f4d51ea

## Features

- **Claude Chat Integration**: Adds a custom button directly to Claude's chat interface for instant information retrieval.
- **Side Panel Functionality**: Easily accessible side panel for managing settings, or performing searches outside of the Claude Chat interface. 
- **Jina AI Integration**: Fetches additional data from the Internet using Jina AI Reader API.
- **OpenAI Integration**: Leverages OpenAI's GPT-4o-mini model for generating search queries and pre-processing the Jina AI search response to return only relevant data to reduce Claude Chat context bloating.
- **Secure API Key Storage**: API keys are encrypted and stored securely in the browser's local storage.
- **Data Encryption**: Utilizes AES-GCM for encrypting and decrypting data.
- **Real-time Progress Updates**: Visual feedback on the processing stages between submitting your query to getting the final response

## Installation
If you prefer, you can install the plugin from the [Chrome Plugin store](https://chromewebstore.google.com/detail/claude-data-fetcher/eenilhbheldklhbmjeigcibmklghflao). If not, follow the instructions below.

1. **Clone the Repository**:
    ```sh
    git clone https://github.com/elfvingralf/claude-data-fetcher.git
    cd claude-data-fetcher
    ```

    Or download the repo by clicking the <> Code button above, selecting "Download zip", and unzipping it on your computer

2. **Load the Extension in Chrome**:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable "Developer mode" using the toggle in the top right corner.
    - Click "Load unpacked" and select the directory where you cloned the repository.

## Usage

1. **Claude Chat Interface**:
    - When chatting with Claude on https://claude.ai, you'll see a new button next to the input field.
    - Click this button to retrieve additional information related to your current query.
    - If you prefer to not chat from the Claude Chat interface, you can toggle the visibility off in the plugin settings (see below)

2. **Open the Side Panel**:
    - Click on the extension icon in the Chrome toolbar to open the side panel.

3. **Enter OpenAI API Key**:
    - On the first run, you will be prompted to enter your OpenAI API key so that the extension can use GPT-4o-mini for necessary processing. Your key will be encrypted and stored securely. You are responsible for the costs incurred with OpenAI for the API calls you make.

4. **Create a New Query**:
    - In the side panel, click on the "new prompt" button to create a new query.
    - Enter your prompt and click "Submit". 
    - You can use the same prompt you would in Claude, the plugin will use gpt-4o-mini to determine the best Internet search query to find the data relevant to your query.

5. **View and Refine Data**:
    - The search results will be processed with GPT-4o-mini and return only the data relevant to your query to avoid context bloat in Claude.
    - In the Claude chat interface, the processed response will be automatically inserted into the chat.
    - In the side panel, the processed response is available to preview and to copy/paste for use elsewhere.

6. **Settings**:
    - In the side panel, click on the "settings" button to update your OpenAI API key or toggle the visibility of the custom button in Claude's chat interface.

## Development

### File Structure

- `manifest.json`: Configuration file for the Chrome extension.
- `background.js`: Background script for handling extension initialization, API requests, and messaging.
- `content.js`: Content script for integrating the custom button into Claude's chat interface.
- `sidepanel.html`: HTML file for the side panel UI.
- `sidepanel.js`: JavaScript file for handling side panel interactions.
- `styles.css`: CSS file for styling the side panel and Claude chat interface elements.

### Key Functions

- **Encryption and Decryption**:
    - `generateEncryptionKey()`: Generates a random encryption key.
    - `deriveKey()`: Derives a key from the master key and salt.
    - `encryptData()`: Encrypts data using AES-GCM.
    - `decryptData()`: Decrypts data using AES-GCM.

- **OpenAI Integration**:
    - `makeOpenAIRequest()`: Makes a request to OpenAI's API to generate search queries.
    - `refineWithOpenAI()`: Refines data using OpenAI's API.

- **Jina AI Integration**:
    - `queryJinaAI()`: Fetches data from Jina AI based on the generated queries.

- **Claude Chat Integration**:
    - `injectIcon()`: Injects the custom button into Claude's chat interface.
    - `handleIconClick()`: Processes the current query and inserts the result into the chat.

## Potential future improvements
- Use URL to pages/documents as an option for information retrieval
- Persist query/response history in the side panel
- Retry-logic for failing API calls
- Customizable search parameters
- Support for multiple AI models
- Missing something? Suggestions are welcome, open up an issue

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## Acknowledgements

- [Jina AI](https://www.jina.ai) for their free Reader (scraping) API.
- [Font Awesome](https://fontawesome.com) for the icons used in the extension.

---

Made with ❤️ by [@ralfelfving](https://www.x.com/@ralfelfving)