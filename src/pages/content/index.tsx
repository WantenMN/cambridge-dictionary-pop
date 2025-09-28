import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import browser from "webextension-polyfill";
import DOMPurify from "dompurify";
import styles from "./style.css?inline";
import scssStyles from "./cdp.scss?inline";

// Constants
const POPUP_ID = "cambridge-dictionary-pop-popup";
const ICON_ID = "cambridge-dictionary-pop-icon";

// Global state
let currentSelectedText = "";
let iconElement: HTMLDivElement | null = null;
let popupRoot: ReactDOM.Root | null = null;
let isPopupOpen = false;
let currentDisplayedWordInPopup = "";
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

// TypeScript interfaces
interface BackgroundResponse {
  response: string;
}

interface HistoryItem {
  word: string;
  htmlContent: string;
}

/**
 * Main popup component for displaying dictionary definitions
 */
const App = ({ initialWord }: { initialWord: string }) => {
  // State management
  const [word, setWord] = useState(initialWord);
  const [searchTerm, setSearchTerm] = useState(initialWord);
  const [htmlContent, setHtmlContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([{ word: initialWord, htmlContent: "" }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [cache, setCache] = useState<Map<string, string>>(new Map());
  const [contentKey, setContentKey] = useState(0); // Key to force re-render and animation

  /**
   * Handle navigation to internal dictionary links
   */
  const handleInternalLinkClick = (newWord: string) => {
    const cleanedWord = newWord.split('?')[0];
    if (cleanedWord === word) return;

    // Create new history item
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ word: cleanedWord, htmlContent: "" });
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSearchTerm(cleanedWord);
    setWord(cleanedWord);
  };

  /**
   * Update navigation button states when history changes
   */
  useEffect(() => {
    setCanGoBack(historyIndex > 0);
    setCanGoForward(historyIndex < history.length - 1);
  }, [history, historyIndex]);

  /**
   * Fetch definition when word changes
   */
  useEffect(() => {
    if (!word) return;

    // If we have cached content for this word, use it
    if (cache.has(word)) {
      setHtmlContent(cache.get(word)!);
      setIsLoading(false);
      currentDisplayedWordInPopup = word;
      return;
    }

    // Update history with loaded content
    const updateHistoryWithContent = (content: string) => {
      const newHistory = [...history];
      newHistory[historyIndex] = { ...newHistory[historyIndex], htmlContent: content };
      setHistory(newHistory);
    };

    // Fetch definition from background script
    const fetchDefinition = async () => {
      setIsLoading(true);
      setHtmlContent("");

      try {
        const response = await browser.runtime.sendMessage({ word }) as BackgroundResponse;
        setHtmlContent(response.response);
        setCache(prev => new Map(prev).set(word, response.response));
        updateHistoryWithContent(response.response);
        currentDisplayedWordInPopup = word;
        setContentKey(prev => prev + 1); // Trigger animation
      } catch (error) {
        const errorMsg = "Error: Could not get definition.";
        setHtmlContent(errorMsg);
        updateHistoryWithContent(errorMsg);
        setContentKey(prev => prev + 1); // Trigger animation even on error
      } finally {
        setIsLoading(false);
        setContentKey(prev => prev + 1); // Trigger animation when loading finishes
      }
    };

    fetchDefinition();
  }, [word, cache, history, historyIndex]);

  /**
   * Handle search submission
   */
  const handleSearch = () => {
    if (searchTerm === word) return;
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ word: searchTerm, htmlContent: "" });
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setWord(searchTerm);
  };

  /**
   * Handle closing the popup
   */
  const handleClose = () => {
    removeElements();
  };

  /**
   * Navigate backward in history
   */
  const goBack = () => {
    if (!canGoBack) return;
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setWord(history[newIndex].word);
    setSearchTerm(history[newIndex].word);
    setHtmlContent(history[newIndex].htmlContent);
  };

  /**
   * Navigate forward in history
   */
  const goForward = () => {
    if (!canGoForward) return;
    
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setWord(history[newIndex].word);
    setSearchTerm(history[newIndex].word);
    setHtmlContent(history[newIndex].htmlContent);
  };

  /**
   * Handle clicks on content links
   */
  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href && href.trim().startsWith('https://dictionary.cambridge.org/dictionary/english/')) {
        event.preventDefault();
        const pathSegments = href.split('/');
        const wordFromLink = pathSegments[pathSegments.length - 1];
        if (wordFromLink) {
          handleInternalLinkClick(wordFromLink);
        }
      }
    }
  };

  return (
    <div className="cdp-popup flex flex-col bg-[#222] text-white/90 fixed top-5 z-[99999] rounded-lg shadow-xl h-[calc(100vh-40px)] w-[calc(100%-40px)] max-w-[600px] left-5">
      <div className="flex flex-col sticky top-0 z-10 border-b border-[#393939]!">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl! m-4! p-0!">
            <a
              href={`https://dictionary.cambridge.org/dictionary/english/${word.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {word}
            </a>
          </h2>
          <div className="flex items-center">
            <NavButton onClick={goBack} disabled={!canGoBack} direction="back" />
            <NavButton onClick={goForward} disabled={!canGoForward} direction="forward" />
            <CloseButton onClick={handleClose} />
          </div>
        </div>
        <div className="flex items-center p-2 pt-0">
          <SearchInput 
            value={searchTerm} 
            onChange={setSearchTerm} 
            onSearch={handleSearch} 
          />
          <SearchButton onClick={handleSearch} />
        </div>
      </div>
      <div key={contentKey} className="p-4 overflow-y-auto flex-grow" onClick={handleContentClick}>
        {isLoading ? (
          <p className="mb-0 leading-relaxed text-sm cdp-content-fade-in">Loading definition...</p>
        ) : (
          <div className="cdp-content-fade-in" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['target'] }) }} />
        )}
      </div>
    </div>
  );
};

// Component for navigation buttons
const NavButton = ({ 
  onClick, 
  disabled, 
  direction 
}: { 
  onClick: () => void; 
  disabled: boolean; 
  direction: "back" | "forward"; 
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`bg-transparent border-none flex justify-center items-center cursor-pointer p-2 m-2! rounded-full w-8 h-8 transition-colors duration-200 ${
      disabled 
        ? 'text-zinc-500 cursor-not-allowed' 
        : 'hover:text-zinc-300 hover:bg-zinc-700'
    }`}
  >
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor" 
      className="w-5 h-5"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d={direction === "back" 
          ? "M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" 
          : "M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"} 
      />
    </svg>
  </button>
);

// Component for close button
const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    className="bg-transparent border-none flex justify-center items-center cursor-pointer hover:text-zinc-300 p-2 m-2! rounded-full w-8 h-8 hover:bg-zinc-700 transition-colors duration-200"
    onClick={onClick}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  </button>
);

// Component for search input
const SearchInput = ({ 
  value, 
  onChange, 
  onSearch 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  onSearch: () => void; 
}) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        onSearch();
      }
    }}
    className="flex-grow h-8 px-2 rounded-md border min-w-0 border-zinc-700! bg-zinc-800! text-white/90! focus:outline-none focus:border-blue-500!"
    placeholder="Search for a new word..."
  />
);

// Component for search button
const SearchButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="ml-2! h-8 px-3 bg-zinc-700 hover:bg-zinc-600 text-white/90 rounded-md transition-colors duration-200"
  >
    Search
  </button>
);

/**
 * Create or get the popup container element
 */
const createPopupContainer = (): HTMLDivElement => {
  let popupContainer = document.getElementById(POPUP_ID) as HTMLDivElement;
  if (!popupContainer) {
    popupContainer = document.createElement("div");
    popupContainer.id = POPUP_ID;
    document.body.appendChild(popupContainer);
  }
  return popupContainer;
};

const injectIconStyles = () => {
  const styleId = 'cambridge-dictionary-pop-icon-styles';
  if (document.getElementById(styleId)) return; // Only inject once

  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = `
    #${ICON_ID} {
      position: absolute;
      z-index: 99999;
      cursor: pointer;
      width: 30px;
      height: 30px;
      border-radius: 9999px; /* rounded-full */
      display: flex; /* flex */
      align-items: center; /* items-center */
      justify-content: center; /* justify-center */
      background-size: cover; /* bg-cover */
      background-repeat: no-repeat; /* bg-no-repeat */
      background-position: center; /* bg-center */
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); /* shadow-md */
      transition-property: all; /* transition-all */
      transition-duration: 300ms; /* duration-300 */
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); /* ease-out */
      color: white; /* text-white */
    }
  `;
  document.head.appendChild(styleEl);
};

/**
 * Create or update the dictionary icon element
 */
const createIcon = (x: number, y: number, rectBottom: number): HTMLDivElement => {
        if (!iconElement) {
          injectIconStyles(); // Inject styles when icon is first created
          iconElement = document.createElement("div");
          iconElement.id = ICON_ID;
          iconElement.style.backgroundImage = `url(${browser.runtime.getURL("icon-128.png")})`;
          document.body.appendChild(iconElement);
    // Handle click event
    iconElement.onclick = (e) => {
      e.stopPropagation();
      showPopup();
    };

    // Handle hover event with delay
    iconElement.onmouseenter = () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(showPopup, 800);
    };

    // Clear hover timer when mouse leaves
    iconElement.onmouseleave = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    };
  }

  const iconHeight = 30; // Assuming a fixed height for the icon from its CSS
  const iconWidth = 30; // Assuming a fixed width for the icon
  const MOBILE_BREAKPOINT = 600; // Breakpoint for mobile devices

  let finalIconTop;

  if (window.innerWidth < MOBILE_BREAKPOINT) {
    // Mobile device: prioritize placing below
    const topPositionIfBelow = rectBottom + window.scrollY + 30; // Original offset for below
    const topPositionIfAbove = y + window.scrollY - 60; // Original offset for above

    if (topPositionIfBelow + iconHeight < window.scrollY + window.innerHeight) {
      finalIconTop = topPositionIfBelow;
    } else if (topPositionIfAbove > window.scrollY) {
      finalIconTop = topPositionIfAbove;
    } else {
      // Fallback if both are problematic, default to below
      finalIconTop = topPositionIfBelow;
    }
  } else {
    // Desktop device: use original logic (prioritize above)
    const topPositionIfAbove = y + window.scrollY - 60;
    const topPositionIfBelow = rectBottom + window.scrollY + 30;

    if (topPositionIfAbove < window.scrollY) {
      finalIconTop = topPositionIfBelow;
    }
    // Check if placing it above would make it go off the bottom of the screen
    else if (topPositionIfAbove + iconHeight > window.scrollY + window.innerHeight) {
      finalIconTop = topPositionIfBelow;
    }
    // Otherwise, place it above
    else {
      finalIconTop = topPositionIfAbove;
    }
  }

  // Animate the icon to the new position
  iconElement.style.transitionProperty = "top, left";
  iconElement.style.transitionDuration = "0.3s";
  iconElement.style.transitionTimingFunction = "ease-out";
  iconElement.style.top = `${finalIconTop}px`;
  iconElement.style.left = `${x + window.scrollX - iconWidth / 2}px`; // Center horizontally
  iconElement.style.display = "block";

  return iconElement;
};

/**
 * Show the dictionary popup
 */
const showPopup = () => {
  // If popup is already open with the same word, do nothing
  if (isPopupOpen && currentSelectedText === currentDisplayedWordInPopup) {
    return;
  }

  const popupHost = createPopupContainer();
  popupHost.style.display = "block";

  let shadowRoot = popupHost.shadowRoot;
  let appContainer: HTMLDivElement;

  if (!shadowRoot) {
    shadowRoot = popupHost.attachShadow({ mode: 'open' });

    const styleSheet = document.createElement('style');
    // Injecting the imported style strings
    styleSheet.textContent = styles + scssStyles;
    shadowRoot.appendChild(styleSheet);

    appContainer = document.createElement('div');
    shadowRoot.appendChild(appContainer);
  } else {
    appContainer = shadowRoot.querySelector('div')!;
  }
  
  if (!popupRoot) {
    popupRoot = ReactDOM.createRoot(appContainer);
  }
  
  popupRoot.render(<App initialWord={currentSelectedText} />);
  isPopupOpen = true;
  iconElement!.style.display = "none";
  hoverTimer = null;
};

/**
 * Remove all popup elements from the DOM
 */
const removeElements = () => {
  isPopupOpen = false;
  iconElement?.remove();
  iconElement = null;
  document.getElementById(POPUP_ID)?.remove();
  popupRoot?.unmount();
  popupRoot = null;
  currentDisplayedWordInPopup = "";
};

/**
 * Check if text contains only ASCII characters
 */
const isAsciiOnly = (text: string): boolean => {
  // Allowed non-ASCII characters
  const allowedNonAscii = new Set(['“', '”', '’', '‘', '…', '–', '—']);

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Check if it's outside ASCII range and not in the allowed non-ASCII set
    if (charCode > 127 && !allowedNonAscii.has(text[i])) {
      return false;
    }
  }
  return true;
};

/**
 * Check if selected text spans more than two lines
 * This function now properly accounts for selections that span HTML elements
 * by checking the actual visual line positions rather than just counting rectangles
 */
const spansMoreThanTwoLines = (range: Range): boolean => {
  const clientRects = range.getClientRects();
  
  // If there are no rectangles, the selection is invalid
  if (clientRects.length === 0) return false;
  
  // If there's only one rectangle, it can't span more than two lines
  if (clientRects.length === 1) return false;
  
  // Get the unique line positions by rounding the top coordinates
  // This accounts for slight differences in positioning that might occur
  // due to inline elements, text decorations, etc.
  const linePositions = new Set<number>();
  for (let i = 0; i < clientRects.length; i++) {
    // Round to nearest pixel to account for sub-pixel differences
    const linePos = Math.round(clientRects[i].top);
    linePositions.add(linePos);
  }
  
  // If we have 2 or fewer unique line positions, it doesn't span more than two lines
  return linePositions.size > 2;
};

/**
 * Count the number of words in a string
 * Splits text on whitespace and filters out empty strings
 */
const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Handle text selection events
 */
document.addEventListener("mouseup", (event) => {
  const popupContainer = document.getElementById(POPUP_ID);
  const isClickInsideIcon = iconElement && (event.target === iconElement || iconElement.contains(event.target as Node));
  const isClickInsidePopup = popupContainer && popupContainer.contains(event.target as Node);

  // If the click originated from the icon or popup, do not re-evaluate selection or close.
  if (isClickInsideIcon || isClickInsidePopup) {
    return;
  }

  // Prevent default browser behavior that might clear selection, but only if it's a left click
  if (event.button === 0) {
    event.preventDefault();
    event.stopPropagation();
  }

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  // Check if selection is valid (not empty, not collapsed, contains only ASCII characters, 
  // doesn't span more than two lines, and doesn't exceed 15 words)
  if (selectedText && selectedText.length > 0 && selection && selection.rangeCount > 0 && !selection.isCollapsed && isAsciiOnly(selectedText)) {
    const range = selection.getRangeAt(0);
    
    // If selected text spans more than two lines, don't show the popup
    if (spansMoreThanTwoLines(range)) {
      removeElements();
      return;
    }
    
    // If selected text exceeds 15 words, don't show the popup
    if (countWords(selectedText) > 15) {
      removeElements();
      return;
    }
    
    // If icon is already displayed for the same selected text, do nothing.
    if (iconElement && iconElement.style.display === "block" && selectedText === currentSelectedText) {
      return;
    }

    // If a new selection is made and icon already exists, animate it to the new position
    if (iconElement && iconElement.style.display === "block" && selectedText !== currentSelectedText) {
      currentSelectedText = selectedText;
      const rect = range.getBoundingClientRect();
      createIcon(event.clientX, rect.top, rect.bottom);
      return;
    }

    // If a new selection is made, and the popup is currently open, close it first.
    if (isPopupOpen) {
      removeElements(); // Close the existing popup and icon
    }
    currentSelectedText = selectedText;
    const rect = range.getBoundingClientRect();
    createIcon(event.clientX, rect.top, rect.bottom);
  } else {
    // No text selected, selection collapsed, contains non-ASCII characters, 
    // spans too many lines, or exceeds word limit. Close popup/icon if they exist.
    removeElements();
  }
});
