import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import { createListInputAssist } from "../src/list-input-assist.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function node(tag, props = {}, children = []) {
  return {
    tag, props, children: Array.isArray(children) ? children : [children],
    textContent: props.text ?? "",
    find(predicate) {
      if (predicate(this)) return this;
      for (const child of this.children) {
        const found = child?.find?.(predicate);
        if (found) return found;
      }
      return null;
    }
  };
}
const originalDocument = globalThis.document;
const doc = new EventTarget();
let active;
Object.defineProperty(doc, "activeElement", { get: () => active });
globalThis.document = doc;
const otherControl = { tagName: "SELECT" };
const owner = { tagName: "BUTTON" };
function setup(initial = "Saved\nChoices") {
  const notices = [], updates = [];
  const handlers = new Map();
  const input = {
    value: initial, isConnected: true, selected: false, focused: false,
    addEventListener(type, listener) { handlers.set(type, listener); },
    focus() { this.focused = true; active = input; },
    select() { this.selected = true; },
    setSelectionRange() { this.selected = true; }
  };
  const wait = deferred();
  const tree = createListInputAssist({
    toolId: "picker", node, textarea: input,
    clipboard: { readText: () => wait.promise },
    onUpdate: (action, message) => updates.push([action, message]),
    announce: message => notices.push(message)
  });
  const button = name => tree.find(x => x.props.dataset?.inputAction === name).props.onClick;
  return { input, wait, notices, updates, button };
}
function moveFocus(element) {
  active = element;
  doc.dispatchEvent(new Event("focusin"));
}
try {
  // A pending Replace cannot overwrite the unchanged input once the user
  // has moved on to a native source selector.
  active = owner;
  const first = setup();
  const pending = first.button("replace")();
  moveFocus(otherControl);
  first.wait.resolve("Unexpected\nOverwrite");
  await pending;
  assert.equal(first.input.value, "Saved\nChoices");
  assert.deepEqual(first.updates, []);
  assert.equal(first.input.focused, false);
  assert.equal(first.input.selected, false);

  // Focus A→B→A is not proof that the old clipboard operation is still wanted.
  active = owner;
  const aba = setup();
  const abaPending = aba.button("append")();
  moveFocus(otherControl);
  active = owner;
  aba.wait.resolve("Late append");
  await abaPending;
  assert.equal(aba.input.value, "Saved\nChoices");
  assert.deepEqual(aba.updates, []);

  // A denied read must not re-focus or select the old entries after the
  // user starts using a different control.
  active = owner;
  const denied = setup();
  const deniedPending = denied.button("replace")();
  moveFocus(otherControl);
  denied.wait.reject(new Error("Permission denied"));
  await deniedPending;
  assert.equal(denied.input.value, "Saved\nChoices");
  assert.equal(denied.input.selected, false);
  assert.equal(denied.input.focused, false);
  assert.deepEqual(denied.updates, []);

  // Normal clipboard actions still work when their initiating control
  // retains focus, and manual-paste fallback still works on denied reads.
  active = owner;
  const success = setup();
  const successPending = success.button("replace")();
  success.wait.resolve("One; Two");
  await successPending;
  assert.equal(success.input.value, "One\nTwo");
  assert.deepEqual(success.updates.map(([kind]) => kind), ["replace"]);

  active = owner;
  const fallback = setup();
  const fallbackPending = fallback.button("replace")();
  fallback.wait.reject(new Error("Denied"));
  await fallbackPending;
  assert.equal(fallback.input.selected, true);
  assert.equal(fallback.input.focused, true);

  // Returning to the actual editor without visiting another control is safe.
  active = owner;
  const editor = setup();
  const editorPending = editor.button("append")();
  active = editor.input;
  editor.wait.resolve("Keep");
  await editorPending;
  assert.equal(editor.input.value, "Saved\nChoices\nKeep");

  const helper = fs.readFileSync("src/list-input-assist.js", "utf8");
  assert.ok(helper.includes("focusLeft || Boolean("));
  assert.ok(helper.includes('doc?.addEventListener?.("focusin", onFocusIn, true)'));
  assert.ok(helper.includes('doc?.removeEventListener?.("focusin", onFocusIn, true)'));
  assert.ok(helper.includes("superseded() || focusMoved()"));
  const app = fs.readFileSync("src/app.js", "utf8");
  assert.ok(app.includes('runControl.append(createListInputAssist({'));
  const sw = fs.readFileSync("sw.js", "utf8");
  assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g15";'));
  assert.equal(TOOLS.length, 25);
  assert.ok(fs.statSync("src/app.js").size <= 423000);
  assert.ok(fs.readdirSync(".").filter(x => x.endsWith(".css"))
    .reduce((total, x) => total + fs.statSync(x).size, 0) <= 174500);
  console.log("UI-14 clipboard focus ownership: success, denial, ABA focus and data retention PASS");
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
