import browser from "webextension-polyfill";
import styles from "./style.css?inline";
import scssStyles from "./cdp.scss?inline";
import { createPopupUIManager } from "./popup-ui";
import {
  createSelectionController,
  type IconTriggerMode,
} from "./selection-controller";
import { setupRuntimeMessaging } from "./runtime-messaging";

const POPUP_ID = "cambridge-dictionary-pop-popup";
const ICON_ID = "cambridge-dictionary-pop-icon";
const SETTINGS_DEFAULTS = {
  iconTriggerMode: "auto" as IconTriggerMode,
};

let iconTriggerMode: IconTriggerMode = SETTINGS_DEFAULTS.iconTriggerMode;

const loadSettings = async () => {
  try {
    const stored = await browser.storage.sync.get(SETTINGS_DEFAULTS);
    iconTriggerMode = stored.iconTriggerMode as IconTriggerMode;
  } catch (error) {
    console.warn("Failed to load icon trigger settings.", error);
  }
};

const popupManager = createPopupUIManager({
  popupId: POPUP_ID,
  stylesText: styles + scssStyles,
});

const selectionController = createSelectionController({
  popupId: POPUP_ID,
  iconId: ICON_ID,
  isPopupOpen: popupManager.isPopupOpen,
  closePopup: popupManager.closePopup,
  getIconTriggerMode: () => iconTriggerMode,
  onRequestOpenPopup: (selectedText) => {
    popupManager.showPopup(selectedText);
  },
});

selectionController.initialize();

setupRuntimeMessaging({
  onOpenPopupFromContextMenu: () => {
    selectionController.openPopupFromContextMenu();
  },
});

void loadSettings();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  const change = changes.iconTriggerMode;
  if (change && typeof change.newValue === "string") {
    iconTriggerMode = change.newValue as IconTriggerMode;
  }
});
