// Local-only bulk entry helpers for the twelve list-based randomizers.
const GUIDES = Object.freeze({
  wheel: "Enter choices on separate lines (or separate them with semicolons). Adjust weights in Setup.",
  picker: "Enter the choices you want to pick between. Selection rules control repeat picks.",
  sampler: "Enter the candidate pool, then choose the number of winners below.",
  shuffle: "Enter the items to rearrange. Every entry appears in the shuffled order.",
  teams: "Enter one participant per line, then choose the number of teams.",
  groups: "Enter participants, then set how many groups to make.",
  pairs: "Enter participants to match. Check the pairing rules before drawing.",
  assignment: "Enter participants here, and enter tasks or destinations in Targets / tasks below.",
  elimination: "Enter contestants. Elimination rounds will use this list.",
  ladder: "Enter players here, then add outcomes or prizes in the field below.",
  "secret-santa": "Enter participants. Private assignments are revealed separately.",
  tournament: "Enter contestants; the draw creates matchups."
});

export function entriesFromText(value) {
  return String(value ?? "").split(/\r?\n|;/).map((entry) => entry.trim()).filter(Boolean);
}

export function formatEntryText(value) {
  return entriesFromText(value).join("\n");
}

export function mergeClipboardEntries(existing, pasted, mode = "replace") {
  if (mode !== "replace" && mode !== "append") throw new TypeError("Unknown clipboard mode");
  if (typeof pasted !== "string" || pasted.length > 200000) {
    throw new RangeError("Clipboard text must be at most 200,000 characters");
  }
  const incoming = entriesFromText(pasted);
  if (!incoming.length) return { value: String(existing ?? ""), added: 0 };
  if (incoming.length > 5000) throw new RangeError("Clipboard list exceeds 5,000 entries");
  const current = String(existing ?? "");
  const appended = current.trim() ? current.trimEnd() + "\n" : "";
  return {
    value: mode === "append" ? appended + incoming.join("\n") : incoming.join("\n"),
    added: incoming.length
  };
}

export function createListInputAssist({ toolId, node, textarea, onUpdate, announce, clipboard } = {}) {
  if (typeof node !== "function" || !textarea || typeof onUpdate !== "function") {
    throw new TypeError("List input assistant needs a node factory, textarea and update handler");
  }
  const guide = GUIDES[toolId] || "Enter one item per line. Separate multiple items with semicolons.";
  const guideId = "list-guide-" + String(toolId).replace(/[^a-z0-9_-]/gi, "-");
  textarea.setAttribute?.("aria-describedby", guideId);
  const count = node("span", { class: "control-hint", role: "status", "aria-live": "polite",
    text: entriesFromText(textarea.value).length + " entries" });
  const refresh = () => {
    const n = entriesFromText(textarea.value).length;
    count.textContent = n + (n === 1 ? " entry" : " entries");
  };
  textarea.addEventListener("input", refresh);

  const action = (label, key, handler) => node("button", {
    class: "small-action", type: "button", dataset: { inputAction: key },
    onClick: handler
  }, label);

  const manualPaste = (mode) => {
    textarea.focus();
    if (mode === "replace") textarea.select?.();
    else textarea.setSelectionRange?.(textarea.value.length, textarea.value.length);
  };

  const paste = (mode) => async () => {
    const api = clipboard || globalThis.navigator?.clipboard;
    if (!api?.readText) {
      announce?.("Clipboard access is unavailable. Paste into the entries field instead.");
      manualPaste(mode);
      return;
    }
    try {
      const value = await api.readText();
      if (textarea.isConnected === false) return;
      const result = mergeClipboardEntries(textarea.value, value, mode);
      if (!result.added) {
        announce?.("No entries found on the clipboard.");
        return;
      }
      textarea.value = result.value;
      refresh();
      onUpdate(mode, result.added + " entries " + (mode === "append" ? "appended" : "imported") + ".");
    } catch (error) {
      announce?.(error instanceof RangeError ? error.message :
        "Clipboard could not be read. Paste into the entries field instead.");
      manualPaste(mode);
    }
  };

  const format = () => {
    const next = formatEntryText(textarea.value);
    if (next === textarea.value) {
      announce?.("Entries are already formatted.");
      return;
    }
    textarea.value = next;
    refresh();
    onUpdate("format", "Blank lines removed and separators normalized. Duplicate entries kept.");
  };

  return node("div", { class: "control list-input-assist" }, [
    node("p", { id: guideId, class: "control-hint", text: guide }),
    node("div", { class: "control-label-row" }, [
      count,
      node("div", { class: "working-set-actions" }, [
        action("Replace from clipboard", "replace", paste("replace")),
        action("Append", "append", paste("append")),
        action("Format", "format", format)
      ])
    ])
  ]);
}

export function defaultListEntries(toolId) {
  const lists = {
    wheel: ["Pizza", "Sushi", "Korean", "Burgers", "Indian", "Tacos"],
    picker: ["Anna", "Ben", "David", "Sarah"],
    sampler: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    shuffle: ["Anna", "Ben", "David", "Sarah", "Luke"],
    teams: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"],
    groups: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"],
    pairs: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    assignment: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    elimination: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    ladder: ["Anna", "Ben", "David", "Sarah"],
    "secret-santa": ["Anna", "Ben", "David", "Sarah", "Luke", "Maria"],
    tournament: ["Anna", "Ben", "David", "Sarah", "Luke", "Maria", "Peter", "Nina"]
  };
  return (lists[toolId] || ["Option A", "Option B", "Option C"]).join("\n");
}

