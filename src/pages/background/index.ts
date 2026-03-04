import browser from "webextension-polyfill";
import {
  CAMBRIDGE_HOST,
  CLOUDFLARE_CHALLENGE_TEXT,
  FILTER_SELECTORS,
  parseDefinitionWithDOMParser,
  type ExtractDefinitionResult,
} from "../../shared/cambridge";
import { isValidSelectionText } from "../../shared/text";

// This will be defined by Vite during the build process
declare const process: {
  env: {
    BROWSER: 'chrome' | 'firefox';
  }
};

console.log(`Background script loaded for ${process.env.BROWSER}!`);

interface Message {
  word?: string;
  target?: string;
}

const CONTEXT_MENU_ID = "cdp-open-popup";
const api = typeof browser !== "undefined" ? browser : chrome;
const cambridgeReadyWaiters = new Map<number, () => void>();
type ContextMenusApi = typeof browser.contextMenus & {
  onShown?: {
    addListener: (
      callback: (info: browser.Menus.OnShownInfoType) => void
    ) => void;
  };
  refresh?: () => void;
};
const contextMenusApi = api.contextMenus as ContextMenusApi | undefined;

api.runtime.onMessage.addListener((msg: unknown, sender: browser.Runtime.MessageSender) => {
  const message = msg as { type?: string };
  if (message.type !== "cambridge-ready") return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  const resolveWaiter = cambridgeReadyWaiters.get(tabId);
  if (resolveWaiter) {
    cambridgeReadyWaiters.delete(tabId);
    resolveWaiter();
  }
});

// --- Chrome-specific offscreen document implementation ---
let creating: Promise<void> | null; // A promise that resolves when the offscreen document is created

async function setupOffscreenDocument(path: string) {
  const offscreenUrl = chrome.runtime.getURL(path);
  // @ts-ignore
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creating) {
    await creating;
  } else {
    // @ts-ignore
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_PARSER'],
      justification: 'to parse HTML content from Cambridge Dictionary',
    });
    await creating;
    creating = null;
  }
}

async function parseDefinitionInOffscreen(html: string): Promise<string> {
  await setupOffscreenDocument('offscreen.html');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Offscreen document timed out.'));
    }, 5000);

    const messageListener = (msg: any) => {
      if (msg.type === 'parse-definition-response') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(messageListener);
        if (msg.error) {
          reject(new Error(msg.error));
        } else {
          resolve(msg.payload);
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'parse-definition',
      data: {
        html,
        filterSelectors: FILTER_SELECTORS,
        cambridgeHost: CAMBRIDGE_HOST,
      },
    });
  });
}

async function playAudioInOffscreen(src: string) {
  await setupOffscreenDocument('offscreen.html');
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'play-audio',
    data: { src },
  });
}
// --- End of Chrome-specific implementation ---


const waitForTabLoaded = (tabId: number, timeoutMs = 20000): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error("Timed out while loading Cambridge page."));
    }, timeoutMs);

    const handleUpdated = (
      updatedTabId: number,
      changeInfo: browser.Tabs.OnUpdatedChangeInfoType
    ) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === "complete") {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(handleUpdated);
        resolve();
      }
    };

    browser.tabs.onUpdated.addListener(handleUpdated);
  });

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForCambridgeReady = (tabId: number, timeoutMs = 8000): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cambridgeReadyWaiters.delete(tabId);
      reject(new Error("Timed out waiting for Cambridge ready signal."));
    }, timeoutMs);

    cambridgeReadyWaiters.set(tabId, () => {
      clearTimeout(timeout);
      resolve();
    });
  });

const tryExtractFromTab = async (tabId: number): Promise<ExtractDefinitionResult> => {
  const response = await browser.tabs.sendMessage(tabId, {
    type: "extract-cambridge-definition",
  }) as ExtractDefinitionResult;
  return response;
};

const extractDefinitionFromTabWithRetry = async (
  tabId: number,
  attempts = 20,
  intervalMs = 500
): Promise<string> => {
  let sawChallenge = false;
  for (let i = 0; i < attempts; i++) {
    try {
      const extracted = await tryExtractFromTab(tabId);
      if (extracted?.ok && extracted.html) {
        return extracted.html;
      }
      if (extracted?.reason === "challenge") {
        sawChallenge = true;
      }
    } catch (error) {
      // The content script may not be ready immediately after tab complete.
    }
    await sleep(intervalMs);
  }

  if (sawChallenge) {
    throw new Error("Cloudflare challenge still present after retries.");
  }
  throw new Error("Definition extraction timed out.");
};

const fetchDefinitionFromCambridgeTab = async (word: string): Promise<string> => {
  const url = `${CAMBRIDGE_HOST}/dictionary/english/${word.toLowerCase()}`;
  const createdTab = await browser.tabs.create({ url, active: false });

  if (!createdTab.id) {
    throw new Error("Failed to create background tab for Cambridge.");
  }

  const tabId = createdTab.id;
  try {
    await waitForTabLoaded(tabId);
    try {
      await waitForCambridgeReady(tabId);
      return await extractDefinitionFromTabWithRetry(tabId, 6, 250);
    } catch {
      return await extractDefinitionFromTabWithRetry(tabId, 10, 250);
    }
  } finally {
    cambridgeReadyWaiters.delete(tabId);
    await browser.tabs.remove(tabId).catch(() => undefined);
  }
};

const fetchDefinition = async (word: string): Promise<string> => {
  const url = `${CAMBRIDGE_HOST}/dictionary/english/${word.toLowerCase()}`;
  const response = await fetch(url, {
    credentials: "include",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const html = await response.text();

  if (process.env.BROWSER === 'chrome') {
    return parseDefinitionInOffscreen(html);
  } else {
    if (html.includes(CLOUDFLARE_CHALLENGE_TEXT)) {
      return fetchDefinitionFromCambridgeTab(word);
    }
    return parseDefinitionWithDOMParser(html);
  }
};

const ensureContextMenu = () => {
  if (!contextMenusApi?.create) return;
  try {
    contextMenusApi.create({
      id: CONTEXT_MENU_ID,
      title: "Cambridge Dictionary Pop",
      contexts: ["selection"],
    });
  } catch (error) {
    // Ignore errors if the menu already exists.
  }
};

ensureContextMenu();

api.runtime.onInstalled.addListener(() => {
  ensureContextMenu();
});

api.runtime.onStartup?.addListener(() => {
  ensureContextMenu();
});

contextMenusApi?.onShown?.addListener((info: browser.Menus.OnShownInfoType) => {
  if (!info.menuIds.includes(CONTEXT_MENU_ID)) return;
  const enabled = isValidSelectionText(info.selectionText);
  contextMenusApi.update(CONTEXT_MENU_ID, { enabled });
  contextMenusApi.refresh?.();
});

contextMenusApi?.onClicked?.addListener((info: browser.Menus.OnClickData, tab?: browser.Tabs.Tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  if (!tab?.id) return;
  if (!isValidSelectionText(info.selectionText)) return;
  api.tabs.sendMessage(tab.id, { type: "open-popup-from-context-menu" });
});

browser.runtime.onMessage.addListener(
  async (msg: unknown): Promise<{ response: string } | void> => {
    const message = msg as Message & { type?: string; src?: string };
    
    if (message.target === 'offscreen') { // Ignore messages intended for the offscreen document
      return;
    }

    if (message.type === 'play-audio' && message.src) {
      if (process.env.BROWSER === 'chrome') {
        await playAudioInOffscreen(message.src);
      } else {
        const audio = new Audio(message.src);
        audio.play();
      }
      return;
    }

    if (!message.word) {
      return { response: "No word provided." };
    }

    try {
      const processedHtml = await fetchDefinition(message.word);
      return { response: processedHtml };
    } catch (error) {
      console.error("Error fetching definition:", error);
      const detail = error instanceof Error ? error.message : "Unknown error";
      return { response: `Error fetching definition: ${detail}` };
    }
  }
);

browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});
