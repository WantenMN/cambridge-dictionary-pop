# Cambridge Dictionary Pop - Browser Extension Usage Guide

## Build Instructions

To build this extension for your browser, follow these steps:

### Prerequisites

1. Ensure you have [Node.js](https://nodejs.org/) installed (LTS version recommended)
2. Install the [pnpm](https://pnpm.io/installation) package manager

### Install Dependencies

```bash
pnpm install
```

### Build for Chrome

To build a production version of the extension for Chrome, run:

```bash
pnpm run build:chrome
```

This will create a `dist_chrome` directory containing the built extension files.

### Build for Firefox

To build a production version of the extension for Firefox, run:

```bash
pnpm run build:firefox
```

This will create a `dist_firefox` directory containing the built extension files.

### Development Mode

If you want to run the extension in development mode (with hot reloading and other development features), use:

For Chrome:
```bash
pnpm run dev:chrome
```

For Firefox:
```bash
pnpm run dev:firefox
```

This will start the development server and generate a development version of the extension in the respective `dist_chrome` or `dist_firefox` directory.

## Loading the Extension

### Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Navigate to the `dist_chrome` directory in your project
5. Select the folder and click "Select Folder"

### Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click the "This Firefox" tab
3. Click the "Load Temporary Add-on..." button
4. Navigate to the `dist_firefox` directory in your project
5. Select the `manifest.json` file and click "Open"

## How to Use

1.  **Install the Extension**: Load the extension in your browser following the instructions above
2.  **Select a Word**: On any webpage, select a word you want to look up
3.  **Activate the Popup**:
    *   A small icon will appear near your selected text. Click this icon
    *   Alternatively, hover over the icon for a brief moment to automatically open the popup
4.  **Explore Definitions**:
    *   The definition will appear in a floating popup
    *   **Search**: Use the search bar at the top of the popup to look up other words
    *   **History**: Use the back and forward buttons to navigate through your recent lookups
    *   **Internal Links**: Click on any word within the definition content to look up its meaning instantly
5.  **Close the Popup**: Click anywhere outside the popup to close it

## Technical Details

- **Build Tools**: Built using Vite and the CRXJS plugin
- **Framework**: Built with React
- **Styling**: Styled with Tailwind CSS
- **Compatibility**: Follows Manifest V3 specification
- **Permissions**:
  - `host_permissions`: Access to https://dictionary.cambridge.org/*

## Notes

1. The extension requires access to https://dictionary.cambridge.org/* to fetch word definitions
2. The extension only activates when selected text consists of ASCII characters or contains specific non-ASCII punctuation
3. To prevent unintended lookups, the extension will not activate when selected text exceeds 15 words or spans more than two lines