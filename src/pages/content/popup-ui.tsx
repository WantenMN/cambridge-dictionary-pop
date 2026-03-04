import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import browser from "webextension-polyfill";
import DOMPurify from "dompurify";
import { CAMBRIDGE_HOST } from "../../shared/cambridge";

interface BackgroundResponse {
  response: string;
}

interface HistoryItem {
  word: string;
  htmlContent: string;
}

interface AppProps {
  initialWord: string;
  onClose: () => void;
  onDisplayedWordChange: (word: string) => void;
}

const App = ({ initialWord, onClose, onDisplayedWordChange }: AppProps) => {
  const [word, setWord] = useState(initialWord);
  const [searchTerm, setSearchTerm] = useState(initialWord);
  const [htmlContent, setHtmlContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([
    { word: initialWord, htmlContent: "" },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [cache, setCache] = useState<Map<string, string>>(new Map());
  const [contentKey, setContentKey] = useState(0);

  const handleInternalLinkClick = (newWord: string) => {
    const cleanedWord = newWord.split("?")[0];
    if (cleanedWord === word) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ word: cleanedWord, htmlContent: "" });

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSearchTerm(cleanedWord);
    setWord(cleanedWord);
  };

  useEffect(() => {
    setCanGoBack(historyIndex > 0);
    setCanGoForward(historyIndex < history.length - 1);
  }, [history, historyIndex]);

  useEffect(() => {
    if (!word) return;

    if (cache.has(word)) {
      setHtmlContent(cache.get(word)!);
      setIsLoading(false);
      onDisplayedWordChange(word);
      return;
    }

    const updateHistoryWithContent = (content: string) => {
      const newHistory = [...history];
      newHistory[historyIndex] = {
        ...newHistory[historyIndex],
        htmlContent: content,
      };
      setHistory(newHistory);
    };

    const fetchDefinition = async () => {
      setIsLoading(true);
      setHtmlContent("");

      try {
        const response = (await browser.runtime.sendMessage({
          word,
        })) as BackgroundResponse;
        setHtmlContent(response.response);
        setCache((prev) => new Map(prev).set(word, response.response));
        updateHistoryWithContent(response.response);
        onDisplayedWordChange(word);
        setContentKey((prev) => prev + 1);
      } catch (error) {
        const errorMsg = "Error: Could not get definition.";
        setHtmlContent(errorMsg);
        updateHistoryWithContent(errorMsg);
        setContentKey((prev) => prev + 1);
      } finally {
        setIsLoading(false);
        setContentKey((prev) => prev + 1);
      }
    };

    fetchDefinition();
  }, [word, cache, history, historyIndex, onDisplayedWordChange]);

  const handleSearch = () => {
    if (searchTerm === word) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ word: searchTerm, htmlContent: "" });

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setWord(searchTerm);
  };

  const goBack = () => {
    if (!canGoBack) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setWord(history[newIndex].word);
    setSearchTerm(history[newIndex].word);
    setHtmlContent(history[newIndex].htmlContent);
  };

  const goForward = () => {
    if (!canGoForward) return;

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setWord(history[newIndex].word);
    setSearchTerm(history[newIndex].word);
    setHtmlContent(history[newIndex].htmlContent);
  };

  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");

    if (anchor) {
      const href = anchor.getAttribute("href");
      if (href && href.trim().startsWith(`${CAMBRIDGE_HOST}/dictionary/english/`)) {
        event.preventDefault();
        const pathSegments = href.split("/");
        const wordFromLink = pathSegments[pathSegments.length - 1];
        if (wordFromLink) {
          handleInternalLinkClick(wordFromLink);
        }
      }
    }

    if (
      target.classList.contains("i-volume-up") &&
      target.hasAttribute("data-audio-src")
    ) {
      const audioSrc = target.getAttribute("data-audio-src");
      if (audioSrc) {
        browser.runtime.sendMessage({ type: "play-audio", src: audioSrc });
      }
    }
  };

  return (
    <div className="cdp-popup flex flex-col bg-[#222] text-white/90 fixed top-5 z-[99999] rounded-lg shadow-xl h-[calc(100vh-40px)] w-[calc(100%-40px)] max-w-[600px] left-5">
      <div className="flex flex-col sticky top-0 z-10 border-b border-[#393939]!">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl! m-4! p-0!">
            <a
              href={`${CAMBRIDGE_HOST}/dictionary/english/${word.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {word}
            </a>
          </h2>
          <div className="flex items-center">
            <NavButton onClick={goBack} disabled={!canGoBack} direction="back" />
            <NavButton
              onClick={goForward}
              disabled={!canGoForward}
              direction="forward"
            />
            <CloseButton onClick={onClose} />
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
      <div
        key={contentKey}
        className="p-4 overflow-y-auto flex-grow"
        onClick={handleContentClick}
      >
        {isLoading ? (
          <p className="mb-0 leading-relaxed text-sm cdp-content-fade-in">
            Loading definition...
          </p>
        ) : (
          <div
            className="cdp-content-fade-in"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(htmlContent, {
                ADD_ATTR: ["target", "data-audio-src"],
              }),
            }}
          />
        )}
      </div>
    </div>
  );
};

const NavButton = ({
  onClick,
  disabled,
  direction,
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
        ? "text-zinc-500 cursor-not-allowed"
        : "hover:text-zinc-300 hover:bg-zinc-700"
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
        d={
          direction === "back"
            ? "M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            : "M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
        }
      />
    </svg>
  </button>
);

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

const SearchInput = ({
  value,
  onChange,
  onSearch,
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

const SearchButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="ml-2! h-8 px-3 bg-zinc-700 hover:bg-zinc-600 text-white/90 rounded-md transition-colors duration-200"
  >
    Search
  </button>
);

export interface PopupUIManager {
  showPopup: (word: string) => void;
  closePopup: () => void;
  isPopupOpen: () => boolean;
}

interface CreatePopupUIManagerOptions {
  popupId: string;
  stylesText: string;
}

export const createPopupUIManager = ({
  popupId,
  stylesText,
}: CreatePopupUIManagerOptions): PopupUIManager => {
  let popupRoot: ReactDOM.Root | null = null;
  let isPopupOpen = false;
  let currentDisplayedWordInPopup = "";
  const handleDisplayedWordChange = (nextWord: string) => {
    currentDisplayedWordInPopup = nextWord;
  };

  const closePopup = () => {
    isPopupOpen = false;
    document.getElementById(popupId)?.remove();
    popupRoot?.unmount();
    popupRoot = null;
    currentDisplayedWordInPopup = "";
  };

  const createPopupContainer = (): HTMLDivElement => {
    let popupContainer = document.getElementById(popupId) as HTMLDivElement | null;
    if (!popupContainer) {
      popupContainer = document.createElement("div");
      popupContainer.id = popupId;
      document.body.appendChild(popupContainer);
    }
    return popupContainer;
  };

  const showPopup = (word: string) => {
    if (isPopupOpen && word === currentDisplayedWordInPopup) {
      return;
    }
    // Mark immediately so repeated triggers for the same word do not rerun fetch effect.
    currentDisplayedWordInPopup = word;

    const popupHost = createPopupContainer();
    popupHost.style.display = "block";

    let shadowRoot = popupHost.shadowRoot;
    let appContainer: HTMLDivElement;

    if (!shadowRoot) {
      shadowRoot = popupHost.attachShadow({ mode: "open" });

      const styleSheet = document.createElement("style");
      styleSheet.textContent = stylesText;
      shadowRoot.appendChild(styleSheet);

      appContainer = document.createElement("div");
      shadowRoot.appendChild(appContainer);
    } else {
      appContainer = shadowRoot.querySelector("div") as HTMLDivElement;
    }

    if (!popupRoot) {
      popupRoot = ReactDOM.createRoot(appContainer);
    }

    popupRoot.render(
      <App
        initialWord={word}
        onClose={closePopup}
        onDisplayedWordChange={handleDisplayedWordChange}
      />,
    );
    isPopupOpen = true;
  };

  return {
    showPopup,
    closePopup,
    isPopupOpen: () => isPopupOpen,
  };
};
