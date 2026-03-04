export const CAMBRIDGE_HOST = "https://dictionary.cambridge.org";

export const CLOUDFLARE_CHALLENGE_TEXT =
  "Enable JavaScript and cookies to continue";

export const FILTER_SELECTORS: string[] = [
  ".pr.x.lbb.lb-cm",
  ".dwl.hax",
  ".i.i-plus.ca_hi",
  ".i.i-comment.fs14",
  ".lmt-10.hax",
  ".meta.dmeta",
  ".daccord",
  ".smartt.daccord",
  ".fixed.top-0.left-0.w-full ",
];

export type ExtractDefinitionReason =
  | "not-ready"
  | "challenge"
  | "not-found"
  | "unknown";

export interface ExtractDefinitionResult {
  ok: boolean;
  html?: string;
  reason?: ExtractDefinitionReason;
}

export const transformDefinitionBlock = (
  definitionBlock: Element,
  audioLookupRoot: ParentNode,
): void => {
  FILTER_SELECTORS.forEach((selector) => {
    definitionBlock.querySelectorAll(selector).forEach((element) => element.remove());
  });

  definitionBlock.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.startsWith("/")) {
      link.setAttribute("href", CAMBRIDGE_HOST + href);
    }
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

  definitionBlock.querySelectorAll("span.daud div[onclick]").forEach((div) => {
    div.className = "i-volume-up";
    const onclickAttr = div.getAttribute("onclick");
    if (onclickAttr) {
      const match = onclickAttr.match(/(audio\d+)\./);
      if (match && match[1]) {
        const audioId = match[1];
        const audioEl = audioLookupRoot.querySelector(`#${audioId}`);
        if (audioEl) {
          const sourceEl = audioEl.querySelector('source[type="audio/mpeg"]');
          if (sourceEl) {
            let src = sourceEl.getAttribute("src");
            if (src && src.startsWith("/")) {
              src = CAMBRIDGE_HOST + src;
            }
            if (src) {
              div.setAttribute("data-audio-src", src);
            }
          }
        }
      }
    }
    div.removeAttribute("onclick");
  });

  definitionBlock.querySelectorAll("audio.hdn").forEach((el) => el.remove());
};

export const parseDefinitionWithDOMParser = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const definitionBlock = doc.querySelector(".page");

  if (!definitionBlock) {
    throw new Error("Definition not found");
  }

  transformDefinitionBlock(definitionBlock, doc);
  return definitionBlock.innerHTML;
};
