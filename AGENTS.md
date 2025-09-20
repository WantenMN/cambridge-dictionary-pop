# Browser Extension Development Plan

This document outlines the steps for developing a browser extension that provides dictionary lookups for selected words on a webpage.

## Project Goal
Develop a browser extension that allows users to select a word on any webpage, trigger a dictionary lookup, and display the definition in a floating popup on the same page.

## Core Features

1.  **Word Selection Detection:** Detect when a user selects text (a word) on a webpage.
2.  **Icon Display:** Upon word selection, display a small, clickable icon near the selected word.
3.  **Content Fetching:** When the icon is hovered over or clicked, fetch the definition of the selected word from `https://dictionary.cambridge.org/dictionary/english/{selected_word}`.
4.  **Popup Rendering:** Render the fetched dictionary content in a floating popup element on the current webpage, positioned near the selected word or icon.

## Implementation Steps for AI Agent

### Phase 1: Setup and Initial Structure

1.  **Review Project Template:** Understand the existing `React + Vite + TypeScript + TailwindCSS` boilerplate structure.
2.  **Identify Relevant Files:** Focus on `src/pages/content/index.tsx`, `src/pages/background/index.ts`, and `manifest.json`.
3.  **Manifest Configuration:** Update `manifest.json` with necessary permissions (`activeTab`, `scripting`, `host_permissions` for `https://dictionary.cambridge.org/*`) and content script declarations.

### Phase 2: Content Script Development (`src/pages/content/index.tsx`)

1.  **Word Selection Listener:** Implement an event listener (e.g., `mouseup` or `selectionchange`) to detect text selection.
2.  **Get Selected Text:** Extract the selected word.
3.  **Icon Injection:** Dynamically create and inject a clickable icon near the selected word.
4.  **Icon Interaction:** Attach event listeners (e.g., `mouseenter`, `click`) to the icon to trigger dictionary lookup via the background script.
5.  **Popup Injection:** Dynamically create and inject a floating popup container for the definition.
6.  **Popup Positioning:** Position the popup near the icon or selected word, ensuring it's within the viewport.
7.  **Popup Visibility:** Manage icon and popup visibility.

### Phase 3: Background Script Development (`src/pages/background/index.ts`)

1.  **Message Listener:** Implement a message listener for lookup requests from the content script.
2.  **API Call:** Fetch dictionary content from `https://dictionary.cambridge.org/dictionary/english/{word}`.
3.  **Content Parsing:** Parse the fetched HTML to extract the definition.
4.  **Send Definition to Content Script:** Send the extracted definition back to the content script.

### Phase 4: Popup Rendering and Styling

1.  **Receive Definition:** In the content script, receive the definition.
2.  **Render in Popup:** Inject the definition HTML into the popup container.
3.  **Styling:** Apply basic styling (Tailwind CSS or custom CSS) to the popup.
4.  **Cleanup:** Implement logic to remove the icon and popup when no longer needed.

### Phase 5: Testing and Refinement

1.  **Local Development:** Use `yarn dev:firefox` for testing.
2.  **Debugging:** Utilize browser developer tools.
3.  **Edge Cases:** Handle no word selected, API errors, network issues, long definitions.
4.  **User Experience:** Ensure smooth interaction and minimal interference.

## Technologies to Use

*   **Frontend:** React, TypeScript, Tailwind CSS
*   **HTTP Requests:** `fetch` API
*   **DOM Manipulation:** Standard JavaScript DOM APIs

## Constraints and Considerations

*   **Manifest V3:** Adhere to Manifest V3 guidelines.
*   **CORS:** Be mindful of CORS policies; background script fetch may be necessary.
*   **Performance:** Ensure lightweight operation.
*   **Error Handling:** Implement robust error handling.
*   **Styling Isolation:** Ensure popup styles do not interfere with the host page.
