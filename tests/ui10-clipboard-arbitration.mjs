import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import { createListInputAssist, entriesFromText } from "../src/list-input-assist.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function node(tag, options = {}, children = []) {
  const item = { tag, options, children: Array.isArray(children) ? children : [children],
    textContent: options.text ?? "", value: options.value ?? "" };
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
function textarea(initial) {
  const listeners = new Map();
  return { value: initial, isConnected: true, focused: false, selected: false,
    addEventListener(key, fn) { listeners.set(key, fn); },
    fire(key) { listeners.get(key)?.(); },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    setSelectionRange() { this.selected = true; }
  };
}
function assist(input, clipboard) {
  const updates = [], announcements = [];
  const view = createListInputAssist({
    toolId: "picker", node, textarea: input, clipboard,
    onUpdate: (action, message) => updates.push([action, message]),
    announce: (message) => announcements.push(message)
  });
  return {
    updates, announcements,
    button: (name) => view.find(x => x.options.dataset?.inputAction === name).options.onClick
  };
}

// Regression 1: A later Replace click must win over an earlier Append,
// regardless of the order in which Clipboard API reads finish.
const oldRead = deferred(), newestRead = deferred();
let readCount = 0;
const input = textarea("Existing");
const ui = assist(input, {
  readText: () => ++readCount === 1 ? oldRead.promise : newestRead.promise
});
const pendingAppend = ui.button("append")();
const pendingReplace = ui.button("replace")();
oldRead.resolve("Older contents");
await pendingAppend;
assert.equal(input.value, "Existing", "Superseded Append must never modify input");
assert.equal(ui.updates.length, 0);
newestRead.resolve("Newer contents");
await pendingReplace;
assert.equal(input.value, "Newer contents");
assert.deepEqual(ui.updates.map(([action]) => action), ["replace"]);
assert.equal(ui.announcements.length, 0, "Ignored old completions must not announce success");

// Regression 2: Even if the most recent operation fails with a permission
// error, an older request must not apply or select the textarea afterward.
const firstFailure = deferred(), secondFailure = deferred();
let failReads = 0;
const failedInput = textarea("Keep me");
const failureUI = assist(failedInput, {
  readText: () => ++failReads === 1 ? firstFailure.promise : secondFailure.promise
});
const stale = failureUI.button("replace")();
const newest = failureUI.button("append")();
secondFailure.reject(new Error("Clipboard denied"));
await newest;
assert.equal(failedInput.selected, true, "Latest denied Append offers manual paste fallback");
const beforeOldRejection = failureUI.announcements.length;
firstFailure.reject(new Error("Older clipboard denied"));
await stale;
assert.equal(failedInput.value, "Keep me");
assert.equal(failureUI.announcements.length, beforeOldRejection,
  "Older rejected reads must not replace the current permission message");
assert.equal(failureUI.updates.length, 0);

// Regression 3: Detect an edit-and-revert while the read is pending, even
// when the final text exactly equals the original string.
const delayed = deferred();
const edited = textarea("Ada\nBea");
const editedUI = assist(edited, { readText: () => delayed.promise });
const pending = editedUI.button("replace")();
edited.value = "Ada\nBea\nCy";
edited.fire("input");
edited.value = "Ada\nBea";
edited.fire("input");
delayed.resolve("Replace illegally");
await pending;
assert.equal(edited.value, "Ada\nBea");
assert.deepEqual(editedUI.updates, []);
assert.match(editedUI.announcements.at(-1), /Entries changed while reading/);
assert.equal(edited.selected, false, "Edit-then-revert cannot trigger a stale manual selection");

// Regression 4: Formatting while a clipboard read is pending supersedes it,
// including when the input is already formatted and needs no mutation.
const formatRead = deferred();
const formattedInput = textarea("A; B");
const formattedUI = assist(formattedInput, { readText: () => formatRead.promise });
const waiting = formattedUI.button("append")();
formattedUI.button("format")();
assert.equal(formattedInput.value, "A\nB");
formatRead.resolve("Stale C");
await waiting;
assert.equal(formattedInput.value, "A\nB");
assert.deepEqual(formattedUI.updates.map(([action]) => action), ["format"]);
assert.equal(entriesFromText(formattedInput.value).length, 2);

const unchangedRead = deferred();
const alreadyFormatted = textarea("A\nB");
const unchangedUI = assist(alreadyFormatted, { readText: () => unchangedRead.promise });
const waitingUnchanged = unchangedUI.button("replace")();
unchangedUI.button("format")();
unchangedRead.resolve("Stale D");
await waitingUnchanged;
assert.equal(alreadyFormatted.value, "A\nB");
assert.deepEqual(unchangedUI.updates, []);
assert.match(unchangedUI.announcements.at(-1), /already formatted/);

// Regression 5: A second request can finish first and the outdated first
// read is subsequently discarded without duplicate appends.
const slow = deferred(), fast = deferred();
let n = 0;
const double = textarea("A");
const doubleUI = assist(double, { readText: () => ++n === 1 ? slow.promise : fast.promise });
const waitSlow = doubleUI.button("append")();
const waitFast = doubleUI.button("append")();
fast.resolve("B");
await waitFast;
slow.resolve("B");
await waitSlow;
assert.equal(double.value, "A\nB");
assert.equal(doubleUI.updates.length, 1, "No repeated append after mobile double tap");

const helper = fs.readFileSync("src/list-input-assist.js", "utf8");
assert.ok(helper.includes("requestId !== clipboardRequest"));
assert.ok(helper.includes("textarea.value !== initialValue || editRevision !== initialRevision"));
assert.ok(helper.includes("clipboardRequest += 1;"), "Format invalidates queued requests");
const sw = fs.readFileSync("sw.js", "utf8");
assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g16";'));
assert.equal(TOOLS.length, 25);
assert.ok(fs.statSync("src/app.js").size <= 423000);
assert.equal(fs.readdirSync(".").filter(name => name.endsWith(".css")).length, 19);
assert.ok(fs.readdirSync(".").filter(name => name.endsWith(".css"))
  .reduce((sum, name) => sum + fs.statSync(name).size, 0) <= 174500);
console.log("UI-10 clipboard arbitration: latest intent, ABA edits, errors, format and double taps passed");
