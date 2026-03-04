import browser from "webextension-polyfill";
import { isValidSelectionText } from "../../shared/text";

export type IconTriggerMode = "auto" | "alt" | "ctrl" | "doubleClick";

interface SelectionControllerOptions {
  popupId: string;
  iconId: string;
  isPopupOpen: () => boolean;
  closePopup: () => void;
  getIconTriggerMode: () => IconTriggerMode;
  onRequestOpenPopup: (selectedText: string) => void;
}

interface SelectionController {
  initialize: () => void;
  openPopupFromContextMenu: () => void;
}

const IS_TOUCH_LIKE_DEVICE =
  "ontouchstart" in window ||
  (typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches);

export const createSelectionController = ({
  popupId,
  iconId,
  isPopupOpen,
  closePopup,
  getIconTriggerMode,
  onRequestOpenPopup,
}: SelectionControllerOptions): SelectionController => {
  const POPUP_OPEN_GUARD_MS = 450;
  let currentSelectedText = "";
  let iconElement: HTMLDivElement | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let isClickInsidePopupOrIcon = false;
  let selectionChangeTriggerTimer: ReturnType<typeof setTimeout> | null = null;
  let popupGuardUntil = 0;

  const removeIcon = (clearSelectedText: boolean) => {
    iconElement?.remove();
    iconElement = null;
    if (clearSelectedText) {
      currentSelectedText = "";
    }
  };

  const removeAll = () => {
    closePopup();
    removeIcon(false);
  };

  const openPopupForCurrentSelection = () => {
    if (!currentSelectedText) return;
    if (selectionChangeTriggerTimer) {
      clearTimeout(selectionChangeTriggerTimer);
      selectionChangeTriggerTimer = null;
    }
    popupGuardUntil = Date.now() + POPUP_OPEN_GUARD_MS;
    onRequestOpenPopup(currentSelectedText);
    if (iconElement) {
      iconElement.style.display = "none";
    }
    hoverTimer = null;
  };

  const injectIconStyles = () => {
    const styleId = "cambridge-dictionary-pop-icon-styles";
    if (document.getElementById(styleId)) return;

    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = `
      #${iconId} {
        position: absolute;
        z-index: 99999;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-size: cover;
        background-repeat: no-repeat;
        background-position: center;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        transition-property: all;
        transition-duration: 300ms;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        color: white;
      }
    `;
    document.head.appendChild(styleEl);
  };

  const createIcon = (
    x: number,
    y: number,
    rectBottom: number,
  ): HTMLDivElement => {
    if (!iconElement) {
      injectIconStyles();
      iconElement = document.createElement("div");
      iconElement.id = iconId;
      iconElement.style.backgroundImage = `url(${browser.runtime.getURL("icon-128.png")})`;
      document.body.appendChild(iconElement);

      iconElement.onclick = (event) => {
        event.stopPropagation();
        openPopupForCurrentSelection();
      };

      iconElement.onmouseenter = () => {
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(openPopupForCurrentSelection, 800);
      };

      iconElement.onmouseleave = () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
      };
    }

    const iconHeight = 30;
    const iconWidth = 30;
    const MOBILE_BREAKPOINT = 600;

    let finalIconTop: number;

    if (window.innerWidth < MOBILE_BREAKPOINT) {
      const topPositionIfBelow = rectBottom + window.scrollY + 30;
      const topPositionIfAbove = y + window.scrollY - 60;

      if (topPositionIfBelow + iconHeight < window.scrollY + window.innerHeight) {
        finalIconTop = topPositionIfBelow;
      } else if (topPositionIfAbove > window.scrollY) {
        finalIconTop = topPositionIfAbove;
      } else {
        finalIconTop = topPositionIfBelow;
      }
    } else {
      const topPositionIfAbove = y + window.scrollY - 60;
      const topPositionIfBelow = rectBottom + window.scrollY + 30;

      if (topPositionIfAbove < window.scrollY) {
        finalIconTop = topPositionIfBelow;
      } else if (
        topPositionIfAbove + iconHeight >
        window.scrollY + window.innerHeight
      ) {
        finalIconTop = topPositionIfBelow;
      } else {
        finalIconTop = topPositionIfAbove;
      }
    }

    iconElement.style.transitionProperty = "top, left";
    iconElement.style.transitionDuration = "0.3s";
    iconElement.style.transitionTimingFunction = "ease-out";
    iconElement.style.top = `${finalIconTop}px`;
    iconElement.style.left = `${x + window.scrollX - iconWidth / 2}px`;
    iconElement.style.display = "block";

    return iconElement;
  };

  const spansMoreThanTwoLines = (range: Range): boolean => {
    const clientRects = range.getClientRects();
    if (clientRects.length <= 1) return false;

    const linePositions = new Set<number>();
    for (let i = 0; i < clientRects.length; i++) {
      linePositions.add(Math.round(clientRects[i].top));
    }

    return linePositions.size > 2;
  };

  const getValidSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (
      selectedText &&
      selectedText.length > 0 &&
      selection &&
      selection.rangeCount > 0 &&
      !selection.isCollapsed &&
      isValidSelectionText(selectedText)
    ) {
      const range = selection.getRangeAt(0);
      if (spansMoreThanTwoLines(range)) {
        return null;
      }
      return { selectedText, range };
    }

    return null;
  };

  const isInsidePopupOrIcon = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Node)) return false;
    const popupContainer = document.getElementById(popupId);
    const isInsideIcon =
      iconElement && (target === iconElement || iconElement.contains(target));
    const isInsidePopup =
      popupContainer &&
      (target === popupContainer || popupContainer.contains(target));

    return !!(isInsideIcon || isInsidePopup);
  };

  const handleSelection = (
    target: EventTarget | null,
    anchorClientX?: number,
  ) => {
    if (isInsidePopupOrIcon(target)) {
      return;
    }

    const selectionResult = getValidSelection();

    if (selectionResult) {
      const { selectedText, range } = selectionResult;
      if (
        iconElement &&
        iconElement.style.display === "block" &&
        selectedText === currentSelectedText
      ) {
        return;
      }

      if (
        iconElement &&
        iconElement.style.display === "block" &&
        selectedText !== currentSelectedText
      ) {
        currentSelectedText = selectedText;
        const rect = range.getBoundingClientRect();
        const iconX = anchorClientX ?? rect.left + rect.width / 2;
        createIcon(iconX, rect.top, rect.bottom);
        return;
      }

      if (isPopupOpen()) {
        removeAll();
      }

      currentSelectedText = selectedText;
      const rect = range.getBoundingClientRect();
      const iconX = anchorClientX ?? rect.left + rect.width / 2;
      createIcon(iconX, rect.top, rect.bottom);
    } else {
      removeAll();
    }
  };

  const initialize = () => {
    document.addEventListener("mouseup", (event) => {
      if (isInsidePopupOrIcon(event.target)) {
        return;
      }

      const iconTriggerMode = getIconTriggerMode();
      if (iconTriggerMode === "doubleClick") return;
      if (iconTriggerMode === "alt" && !event.altKey) {
        if (isPopupOpen()) {
          removeIcon(true);
        } else {
          removeAll();
        }
        return;
      }
      if (iconTriggerMode === "ctrl" && !event.ctrlKey) {
        if (isPopupOpen()) {
          removeIcon(true);
        } else {
          removeAll();
        }
        return;
      }

      handleSelection(event.target, event.clientX);
    });

    document.addEventListener("dblclick", (event) => {
      if (getIconTriggerMode() !== "doubleClick") return;
      handleSelection(event.target, event.clientX);
    });

    document.addEventListener("touchend", (event) => {
      if (isInsidePopupOrIcon(event.target)) {
        return;
      }

      const iconTriggerMode = getIconTriggerMode();
      if (iconTriggerMode === "doubleClick") return;
      if (iconTriggerMode === "alt" || iconTriggerMode === "ctrl") return;

      const touchPoint = event.changedTouches[0];
      handleSelection(event.target, touchPoint?.clientX);
    });

    document.addEventListener(
      "mousedown",
      (event) => {
        isClickInsidePopupOrIcon = isInsidePopupOrIcon(event.target);
      },
      true,
    );
    document.addEventListener(
      "touchstart",
      (event) => {
        isClickInsidePopupOrIcon = isInsidePopupOrIcon(event.target);
      },
      { capture: true, passive: true },
    );

    document.addEventListener("selectionchange", () => {
      if (isClickInsidePopupOrIcon) {
        isClickInsidePopupOrIcon = false;
        return;
      }
      if (Date.now() < popupGuardUntil) {
        return;
      }

      const selection = window.getSelection();

      if (
        !isPopupOpen() &&
        (!selection ||
          selection.isCollapsed ||
          selection.rangeCount === 0 ||
          selection.toString().trim().length === 0)
      ) {
        removeAll();
        if (selectionChangeTriggerTimer) {
          clearTimeout(selectionChangeTriggerTimer);
          selectionChangeTriggerTimer = null;
        }
        return;
      }

      if (!IS_TOUCH_LIKE_DEVICE || getIconTriggerMode() !== "auto") return;
      if (isPopupOpen()) return;
      if (selectionChangeTriggerTimer) {
        clearTimeout(selectionChangeTriggerTimer);
      }
      selectionChangeTriggerTimer = setTimeout(() => {
        if (Date.now() < popupGuardUntil || isPopupOpen()) {
          return;
        }
        handleSelection(null);
      }, 120);
    });
  };

  const openPopupFromContextMenu = () => {
    const selectionResult = getValidSelection();
    if (!selectionResult) return;

    currentSelectedText = selectionResult.selectedText;
    removeIcon(false);
    openPopupForCurrentSelection();
  };

  return {
    initialize,
    openPopupFromContextMenu,
  };
};
