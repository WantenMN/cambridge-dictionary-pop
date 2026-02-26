import "./style.css";

const api = typeof browser !== "undefined" ? browser : chrome;
const DEFAULTS = { iconTriggerMode: "auto" } as const;

const app = document.getElementById("app");
if (!app) {
  throw new Error("Options root not found");
}

document.body.className =
  "min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased";

app.innerHTML = `
  <div class="mx-auto max-w-2xl px-6 py-8">
    <h1 class="text-2xl font-semibold tracking-tight">Cambridge Dictionary Pop</h1>
    <p class="mt-1 text-sm text-neutral-400">Choose how the pop icon appears</p>

    <form id="icon-form" class="mt-6 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-xl shadow-black/40">
      <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-neutral-700 hover:bg-neutral-800/60">
        <input class="accent-sky-300" type="radio" name="iconTriggerMode" value="auto" />
        <span class="text-sm text-neutral-100">Auto (show after selection)</span>
      </label>
      <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-neutral-700 hover:bg-neutral-800/60">
        <input class="accent-sky-300" type="radio" name="iconTriggerMode" value="alt" />
        <span class="text-sm text-neutral-100">Hold Alt while selecting</span>
      </label>
      <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-neutral-700 hover:bg-neutral-800/60">
        <input class="accent-sky-300" type="radio" name="iconTriggerMode" value="ctrl" />
        <span class="text-sm text-neutral-100">Hold Ctrl while selecting</span>
      </label>
      <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-neutral-700 hover:bg-neutral-800/60">
        <input class="accent-sky-300" type="radio" name="iconTriggerMode" value="doubleClick" />
        <span class="text-sm text-neutral-100">Only on double click</span>
      </label>
    </form>

    <p id="status" class="mt-4 min-h-5 text-sm text-sky-300" aria-live="polite"></p>
  </div>
`;

const statusEl = document.getElementById("status");

const showStatus = (text: string) => {
  if (!statusEl) return;
  statusEl.textContent = text;
  window.clearTimeout((showStatus as any)._timerId);
  (showStatus as any)._timerId = window.setTimeout(() => {
    if (statusEl) statusEl.textContent = "";
  }, 1500);
};

const selectRadio = (value: string) => {
  const input = document.querySelector<HTMLInputElement>(
    `input[name="iconTriggerMode"][value="${value}"]`
  );
  if (input) {
    input.checked = true;
  }
};

const loadSettings = async () => {
  try {
    const stored = await api.storage.sync.get(DEFAULTS);
    selectRadio(stored.iconTriggerMode || DEFAULTS.iconTriggerMode);
  } catch (error) {
    showStatus("Failed to load. Try again.");
    console.warn("Failed to load settings", error);
  }
};

const saveSettings = async (value: string) => {
  try {
    await api.storage.sync.set({ iconTriggerMode: value });
    showStatus("Saved");
  } catch (error) {
    showStatus("Failed to save. Try again.");
    console.warn("Failed to save settings", error);
  }
};

loadSettings();

const form = document.getElementById("icon-form");
form?.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | null;
  if (target && target.name === "iconTriggerMode") {
    saveSettings(target.value);
  }
});
