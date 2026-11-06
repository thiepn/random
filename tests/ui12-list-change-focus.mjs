import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import { scheduleListChangeRender } from "../src/list-input-assist.js";

assert.equal(TOOLS.length, 25);
const nextFrame = [];
const frame = (fn) => nextFrame.push(fn);
const flushFrame = () => {
  while (nextFrame.length) nextFrame.shift()();
};
const doc = new EventTarget();
const textarea = { isConnected: true };
const events = [];
let focus = "Format", rendered = 0;
const refresh = () => {
  rendered++;
  const previous = focus;
  focus = null;
  focus = previous;
  events.push("render");
};

// Confirming a changed list must NEVER render synchronously during pointerdown.
// The click handler on Format/Run/Source must receive its activation first.
scheduleListChangeRender(textarea, {
  pointerDown: true, doc, requestFrame: frame, refresh
});
assert.equal(rendered, 0, "An immediate root replacement would swallow the first click");
assert.equal(nextFrame.length, 0);
events.push("target click");
doc.dispatchEvent(new Event("click"));
assert.deepEqual(events, ["target click", "render"]);
assert.equal(rendered, 1);
assert.equal(focus, "Format");
doc.dispatchEvent(new Event("click"));
assert.equal(rendered, 1, "One pointer activation must schedule only one refresh");

// If the original textarea disappeared because the clicked action rendered the
// app itself (e.g. starting a randomization), no stale secondary render runs.
textarea.isConnected = true;
scheduleListChangeRender(textarea, {
  pointerDown: true, doc, requestFrame: frame, refresh
});
textarea.isConnected = false;
doc.dispatchEvent(new Event("click"));
assert.equal(rendered, 1);
assert.equal(nextFrame.length, 0);

// Keyboard Tab/Shift+Tab must allow focus to move before restoring the new view.
textarea.isConnected = true;
focus = "Entries";
scheduleListChangeRender(textarea, {
  pointerDown: false, doc, requestFrame: frame, refresh
});
assert.equal(rendered, 1, "Keyboard navigation must not rerender during change/blur");
focus = "Run";
flushFrame();
assert.equal(rendered, 2);
assert.equal(focus, "Run", "The new focused control must survive the re-render");

// Pointer cancel should not strand the UI in a pending state.
textarea.isConnected = true;
scheduleListChangeRender(textarea, {
  pointerDown: true, doc, requestFrame: frame, refresh
});
doc.dispatchEvent(new Event("pointercancel"));
assert.equal(rendered, 2);
assert.equal(nextFrame.length, 1);
flushFrame();
assert.equal(rendered, 3);
doc.dispatchEvent(new Event("click"));
assert.equal(rendered, 3, "Pointer-cancel fallback should not double-render");

// A delayed refresh must not touch an abandoned/unmounted editor.
const detached = { isConnected: true };
scheduleListChangeRender(detached, {
  pointerDown: false, doc, requestFrame: frame, refresh
});
detached.isConnected = false;
flushFrame();
assert.equal(rendered, 3);

// Fail fast on incomplete scheduler integrations.
assert.throws(() => scheduleListChangeRender(null, {
  pointerDown: false, doc, requestFrame: frame, refresh
}), TypeError);
assert.throws(() => scheduleListChangeRender(textarea, {
  pointerDown: true, requestFrame: frame, refresh
}), TypeError);

// Source-level integration guard: the exact native textarea change listener
// must use the deferred click-safe scheduler; focus restore must happen after
// rendering. Prior clipboard and modal safety stays in place.
const app = fs.readFileSync("src/app.js", "utf8");
const helper = fs.readFileSync("src/list-input-assist.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
assert.ok(app.includes('textarea.addEventListener("change", () => {'));
assert.ok(app.includes('scheduleListChangeRender(textarea, {'));
assert.ok(app.includes('pointerDown: listEditPointerDown, doc: document'));
assert.ok(app.includes('requestFrame: (callback) => window.requestAnimationFrame(callback)'));
assert.ok(app.includes('const focus = focusIdentity(document.activeElement);'));
assert.ok(app.includes('matchingFocusable(document, focus)?.focus({ preventScroll: true })'));
assert.equal(app.includes('textarea.addEventListener("change", render);'), false,
  "The synchronous blur render caused the reproduced lost-click defect");
assert.ok(helper.includes('doc.addEventListener("click", onClick, { once: true })'));
assert.ok(app.includes('if (activeReason(t))'),
  "Previously verified active-session handoff guard is preserved");
assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g16";'));
assert.ok(fs.statSync("src/app.js").size <= 423000);
const styles = fs.readdirSync(".").filter(name => name.endsWith(".css"));
assert.equal(styles.length, 19);
assert.ok(styles.reduce((sum, path) => sum + fs.statSync(path).size, 0) <= 174500);
console.log("UI-12 deferred list change: first-click, keyboard focus, cancel and unmount regressions passed");
