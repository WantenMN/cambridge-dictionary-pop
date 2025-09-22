import browser from "webextension-polyfill";

// This will be defined by Vite during the build process
declare const process: {
  env: {
    BROWSER: 'chrome' | 'firefox';
  }
};

console.log(`Background script loaded for ${process.env.BROWSER}!`);

const FILTER_SELECTORS: string[] = [
  ".pr.x.lbb.lb-cm",
  ".dwl.hax",
  ".daud",
  ".i.i-plus.ca_hi",
  ".i.i-comment.fs14",
  ".lmt-10.hax",
  ".meta.dmeta",
];

interface Message {
  word?: string;
  target?: string;
}

const CAMBRIDGE_HOST = 'https://dictionary.cambridge.org';

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
// --- End of Chrome-specific implementation ---


// --- Firefox-specific DOMParser implementation ---
const parseDefinitionWithDOMParser = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  FILTER_SELECTORS.forEach(selector => {
    doc.querySelectorAll(selector).forEach(element => element.remove());
  });

  const definitionBlock = doc.querySelector(".page");
  if (!definitionBlock) {
    throw new Error("Definition not found");
  }

  // The original implementation re-parsed the HTML. We can optimize this by processing the links on the found element directly.
  const links = definitionBlock.querySelectorAll('a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/')) {
      link.setAttribute('href', CAMBRIDGE_HOST + href);
    }
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  return definitionBlock.innerHTML;
};
// --- End of Firefox-specific implementation ---


const fetchDefinition = async (word: string): Promise<string> => {
  const url = `${CAMBRIDGE_HOST}/dictionary/english/${word.toLowerCase()}`;
  const response = await fetch(url);
  const html = await response.text();

  if (process.env.BROWSER === 'chrome') {
    return parseDefinitionInOffscreen(html);
  } else {
    return parseDefinitionWithDOMParser(html);
  }
};

browser.runtime.onMessage.addListener(
  async (msg: unknown): Promise<{ response: string } | void> => {
    const message = msg as Message;
    
    if (message.target === 'offscreen') { // Ignore messages intended for the offscreen document
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
      return { response: "Error fetching definition." };
    }
  }
);