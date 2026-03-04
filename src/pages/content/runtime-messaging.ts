import browser from "webextension-polyfill";
import {
  CLOUDFLARE_CHALLENGE_TEXT,
  transformDefinitionBlock,
  type ExtractDefinitionResult,
} from "../../shared/cambridge";

interface RuntimeMessage {
  type?: string;
}

interface RuntimeMessagingOptions {
  onOpenPopupFromContextMenu: () => void;
}

const getExtractReadiness = (): ExtractDefinitionResult => {
  const bodyText = document.body?.innerText ?? "";
  if (bodyText.includes(CLOUDFLARE_CHALLENGE_TEXT)) {
    return { ok: false, reason: "challenge" };
  }

  const definitionBlock = document.querySelector(".page");
  if (!definitionBlock) {
    return { ok: false, reason: "not-ready" };
  }

  return { ok: true };
};

const extractDefinitionFromCurrentDocument = (): ExtractDefinitionResult => {
  const readiness = getExtractReadiness();
  if (!readiness.ok) return readiness;

  const definitionBlock = document.querySelector(".page") as Element;
  const cloned = definitionBlock.cloneNode(true) as HTMLElement;
  transformDefinitionBlock(cloned, cloned);

  return { ok: true, html: cloned.innerHTML };
};

const setupCambridgeReadyNotifier = () => {
  if (!window.location.hostname.includes("dictionary.cambridge.org")) return;

  let cambridgeReadyNotified = false;
  let cambridgeReadyObserver: MutationObserver | null = null;

  const maybeNotifyCambridgeReady = () => {
    if (cambridgeReadyNotified) return;
    const readiness = getExtractReadiness();
    if (!readiness.ok) return;

    cambridgeReadyNotified = true;
    browser.runtime.sendMessage({ type: "cambridge-ready" }).catch(() => {
      // Ignore if background is not available at this moment.
    });
  };

  maybeNotifyCambridgeReady();
  if (cambridgeReadyNotified) return;

  cambridgeReadyObserver = new MutationObserver(() => {
    maybeNotifyCambridgeReady();
    if (cambridgeReadyNotified) {
      cambridgeReadyObserver?.disconnect();
      cambridgeReadyObserver = null;
    }
  });
  cambridgeReadyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
};

export const setupRuntimeMessaging = ({
  onOpenPopupFromContextMenu,
}: RuntimeMessagingOptions) => {
  setupCambridgeReadyNotifier();

  browser.runtime.onMessage.addListener((msg: unknown) => {
    const message = msg as RuntimeMessage;

    if (message.type === "extract-cambridge-definition") {
      try {
        const result = extractDefinitionFromCurrentDocument();
        return Promise.resolve(result);
      } catch (error) {
        return Promise.resolve({
          ok: false,
          reason: "unknown",
        } as ExtractDefinitionResult);
      }
    }

    if (message.type !== "open-popup-from-context-menu") return;
    onOpenPopupFromContextMenu();
  });
};
