import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import { mergeClipboardEntries, createListInputAssist, entriesFromText } from "../src/list-input-assist.js";
import { planInputHandoff } from "../src/tool-input-handoff.js";

assert.equal(TOOLS.length, 25);
const nearLimit = Array(4999).fill("A").join("\n");
assert.equal(mergeClipboardEntries(nearLimit, "B", "append").added, 1);
assert.throws(() => mergeClipboardEntries(nearLimit, "B;C", "append"),
  /combined list exceeds 5,000 entries/);
assert.throws(() => mergeClipboardEntries(Array(5000).fill("A").join("\n"), "B", "append"),
  /combined list exceeds 5,000 entries/);
assert.deepEqual(mergeClipboardEntries(Array(5000).fill("A").join("\n"), "B", "replace"),
  { value: "B", added: 1 }, "Replace can recover an oversized preexisting list");
assert.throws(() => mergeClipboardEntries("A".repeat(199990), "B".repeat(15), "append"),
  /combined list exceeds 200,000 characters/);
assert.deepEqual(mergeClipboardEntries("One\nOne", "One", "append"),
  { value: "One\nOne\nOne", added: 1 }, "Intentional duplicates are retained");
assert.equal(entriesFromText(mergeClipboardEntries("A", "B;C", "append").value).length, 3);
assert.equal(planInputHandoff(["A"], "B\nC", "append").total, 3);
assert.throws(() => planInputHandoff(["B", "C"], nearLimit, "append"), /5,000/);

function node(tag, options = {}, children = []) {
  const item = { tag, options, children: Array.isArray(children) ? children : [children],
    value: options.value ?? "", textContent: options.text ?? "" };
  item.find = (predicate) => {
    if (predicate(item)) return item;
    for (const child of item.children) {
      const found = child?.find?.(predicate);
      if (found) return found;
    }
    return null;
  };
  return item;
}
function makeTextarea(initial) {
  const listeners = new Map();
  return { value: initial, isConnected: true, focused: false, selected: false,
    addEventListener: (type, handler) => listeners.set(type, handler),
    focus() { this.focused = true; },
    select() { this.selected = true; },
    setSelectionRange() { this.selected = true; },
    fire(type) { listeners.get(type)?.(); }
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const updates = [], notices = [];
const text = makeTextarea("First");
const pending = deferred();
const view = createListInputAssist({ toolId: "picker", node, textarea: text,
  clipboard: { readText: () => pending.promise },
  onUpdate: (action, message) => updates.push({ action, message }),
  announce: (message) => notices.push(message)
});
const button = (name) => view.find((item) => item.options.dataset?.inputAction === name);
const waitingReplace = button("replace").options.onClick();
text.value = "Manual changes";
text.fire("input");
pending.resolve("Clipboard data");
await waitingReplace;
assert.equal(text.value, "Manual changes", "Clipboard read must not replace edits made meanwhile");
assert.equal(updates.length, 0, "Rejected asynchronous clipboard result must not trigger a state update");
assert.match(notices.at(-1), /Entries changed while reading/);
assert.equal(text.selected, false, "Stale read must not select manual edits for accidental replacement");

const delayedFailure = deferred();
const errorText = makeTextarea("Original");
const errors = [];
const errorView = createListInputAssist({ toolId: "teams", node, textarea: errorText,
  clipboard: { readText: () => delayedFailure.promise },
  onUpdate: () => { throw new Error("Unexpected mutation"); },
  announce: (m) => errors.push(m)
});
const errorReplace = errorView.find(x => x.options.dataset?.inputAction === "replace");
const waitingFailure = errorReplace.options.onClick();
errorText.value = "New work";
delayedFailure.reject(new Error("Clipboard access denied"));
await waitingFailure;
assert.equal(errorText.value, "New work");
assert.equal(errorText.selected, false, "Stale denied clipboard access must not select edited contents");
assert.match(errors.at(-1), /Entries changed while reading/);

const attached = makeTextarea("A");
const detachedRead = deferred();
const detachedView = createListInputAssist({ toolId: "wheel", node, textarea: attached,
  clipboard: { readText: () => detachedRead.promise },
  onUpdate: () => { throw new Error("Detached view mutated"); },
  announce: () => {}
});
const detached = detachedView.find(x => x.options.dataset?.inputAction === "replace")
  .options.onClick();
attached.isConnected = false;
detachedRead.resolve("B");
await detached;
assert.equal(attached.value, "A");

const limited = makeTextarea(nearLimit);
const limitedMessages = [];
let limitedChanges = 0;
const limitView = createListInputAssist({ toolId: "picker", node, textarea: limited,
  clipboard: { readText: async () => "B; C" },
  onUpdate: () => limitedChanges++,
  announce: (m) => limitedMessages.push(m)
});
await limitView.find(x => x.options.dataset?.inputAction === "append").options.onClick();
assert.equal(limited.value, nearLimit, "Oversized append must be all-or-nothing");
assert.equal(limitedChanges, 0);
assert.match(limitedMessages.at(-1), /combined list exceeds 5,000 entries/);
assert.equal(limited.selected, false, "Invalid append should not select an existing large list");

await limitView.find(x => x.options.dataset?.inputAction === "replace").options.onClick();
assert.equal(limited.value, "B\nC", "Replace remains usable after an append is refused");
assert.equal(limitedChanges, 1);

const app = fs.readFileSync("src/app.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
assert.ok(app.includes("createListInputAssist({"), "All built-in list tools keep input-assist integration");
assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g16";'));
assert.equal(fs.readdirSync(".").filter(name => name.endsWith(".css")).length, 19);
assert.ok(fs.readdirSync(".").filter(name => name.endsWith(".css"))
  .reduce((n, file) => n + fs.statSync(file).size, 0) <= 174500);
assert.ok(fs.statSync("src/app.js").size <= 423000);
console.log("UI-09 race-safe clipboard and combined input limits passed");
