# Claude Data Fetcher

Claude Data Fetcher is a Chrome extension designed to enhance Anthropic Claude conversations by providing it access to information on the Internet. This extension uses Jina AI's Reader (scraping) API and OpenAI's GPT-4o-mini model to process search results. 

## Features

- **Side Panel Integration**: Easily accessible side panel for quick interactions.
- **Jina AI Integration**: Fetches additional data from the Internet using Jina AI scraping API.
- **OpenAI Integration**: Leverages OpenAI's GPT-4o-mini model for generating search queries and pre-processing the Jina AI search response.
- **Secure API Key Storage**: API keys are encrypted and stored securely in the browser's local storage.
- **Data Encryption**: Utilizes AES-GCM for encrypting and decrypting data.

## Installation

1. **Clone the Repository**:
    ```sh
    git clone https://github.com/yourusername/claude-data-fetcher.git
    cd claude-data-fetcher
    ```

2. **Load the Extension in Chrome**:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable "Developer mode" using the toggle in the top right corner.
    - Click "Load unpacked" and select the directory where you cloned the repository.

## Usage

1. **Open the Side Panel**:
    - Click on the extension icon in the Chrome toolbar to open the side panel.

2. **Enter OpenAI API Key**:
    - On the first run, you will be prompted to enter your OpenAI API key so that the extension can use GPT-4o-mini for necessary processing. Your key will be encrypted and stored securely. You are responsible for the costs incurred with OpenAI for the API calls you make.

3. **Create a New Query**:
    - Click on the "new prompt" button to create a new query.
    - Enter your prompt and click "Submit".

4. **View and Refine Data**:
    - The extension will process your query using GPT-4o-mini to determine the best search terms to use, and search the Internet for that data using Jina AI's scraping API.
    - The search results will be processed with GPT-4o-mini and return only the data relevant to your query to avoid context bloat in Claude.
    - The processed response is available to preview and to copy/paste for use in Claude.

5. **Settings**:
    - Click on the "settings" button to update your OpenAI API key.

## Development

### File Structure

- `manifest.json`: Configuration file for the Chrome extension.
- `sidepanel.js`: Main JavaScript file for handling side panel interactions.
- `sidepanel.html`: HTML file for the side panel UI.
- `styles.css`: CSS file for styling the side panel.
- `background.js`: Background script for handling extension initialization and messaging.

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

## Potential future improvements
- Use URL instead of search for information retrieval
- Persist query/response history
- Retry-logic for failing API calls
- Missing something? Suggestions are welcome, open up an issue

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.


## Acknowledgements

- [Jina AI](https://www.jina.ai) for their free Reader (scraping) API.
- [Font Awesome](https://fontawesome.com) for the icons used in the extension.

---

Made with ❤️ by [@ralfelfving](https://www.x.com/@ralfelfving)