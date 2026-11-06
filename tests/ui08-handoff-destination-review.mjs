import assert from "node:assert/strict";
import fs from "node:fs";
import { entriesFromText } from "../src/list-input-assist.js";
import {
  handoffDestinationSnapshot, handoffDestinationUnchanged, handoffEntryPreview,
  planInputHandoff, renderInputHandoffModal, applyInputHandoff
} from "../src/tool-input-handoff.js";

const sourceEntries = ["Anna", "Anna", "Ben"];
const savedPool = Object.freeze({ id: "pool-a", items: ["Old", "Keep"] });
const target = {
  listText: "Old; Keep",
  workingSet: { source: { poolId: "pool-a", revision: 4 }, items: [] },
  workingSetDirty: true,
  activePresetId: "preset-a",
  selectionEntries: [{ key: "Old", weight: 3 }]
};
const snapshot = () => handoffDestinationSnapshot(target, { fallback: "irrelevant" });
const first = snapshot();
assert.equal(first.text, "Old; Keep");
assert.equal(first.poolId, "pool-a");
assert.equal(first.poolRevision, 4);
assert.equal(first.workingSetDirty, true);
assert.equal(first.presetId, "preset-a");
assert.ok(first.poolAttached);
assert.ok(handoffDestinationUnchanged(first, snapshot()));
assert.equal(handoffDestinationUnchanged(null, snapshot()), false);
const rest = { ...target, listText: "Old\nKeep" };
assert.deepEqual(entriesFromText(target.listText), entriesFromText(rest.listText));
assert.equal(planInputHandoff(sourceEntries, target.listText).text,
  planInputHandoff(sourceEntries, rest.listText).text,
  "The old normalized-output comparison was blind to this destination edit");
assert.equal(handoffDestinationUnchanged(first,
  handoffDestinationSnapshot(rest)), false,
  "A raw destination edit must not be silently overwritten");

for (const patch of [
  { activePresetId: "preset-b" },
  { workingSetDirty: false },
  { workingSet: null },
  { workingSet: { source: { poolId: "pool-b", revision: 4 }, items: [] } },
  { workingSet: { source: { poolId: "pool-a", revision: 5 }, items: [] } }
]) assert.equal(handoffDestinationUnchanged(first,
  handoffDestinationSnapshot({ ...target, ...patch })), false,
  "A change to the destination's linked or unsaved data requires re-review");
assert.equal(handoffDestinationUnchanged(first,
  handoffDestinationSnapshot({
    ...target, selectionEntries: [{ key: "Old", weight: 99 }]
  })), false, "Changing selection weights after preview must block Replace");
assert.equal(handoffDestinationUnchanged(first,
  handoffDestinationSnapshot({
    ...target, workingSet: { ...target.workingSet,
      items: [{ id: "unsaved-change", label: "Old" }] }
  })), false, "Edited unsaved working-set contents must not be discarded unseen");
assert.equal(handoffDestinationSnapshot(null, { custom: true,
  fallback: "Option A\nOption B" }).text, "Option A\nOption B");
assert.equal(handoffDestinationSnapshot({ customInputText: "Custom" },
  { custom: true }).text, "Custom");
assert.match(handoffEntryPreview(["x".repeat(150)]), /…/);
assert.equal(handoffEntryPreview(sourceEntries), "Anna · Anna · Ben");

function node(tag, props = {}, children = []) {
  const value = {
    tag, props, value: props.value ?? "", disabled: Boolean(props.disabled),
    textContent: props.text ?? "", children: Array.isArray(children) ? children : [children]
  };
  value.append = (...items) => value.children.push(...items);
  value.walk = (predicate) => {
    if (predicate(value)) return value;
    for (const child of value.children) {
      const found = child?.walk?.(predicate);
      if (found) return found;
    }
    return null;
  };
  return value;
}
let confirmations = 0;
let refreshes = 0;
let cancellations = 0;
const config = {
  sourceToolId: "sampler", sourceKind: "result", sourceEntries,
  targetId: "picker", mode: "replace", error: null
};
const destination = { id: "picker", name: "Pick One" };
const options = {
  node, sourceName: "Pick Several", targets: [destination],
  getInput: () => target.listText,
  getDestinationSnapshot: () => snapshot(),
  activeReason: () => null,
  onCancel: () => { cancellations++; },
  rerender: () => { refreshes++; },
  onConfirm: (tool, plan) => {
    if (!handoffDestinationUnchanged(plan.destinationSnapshot, snapshot())) {
      config.error = "Destination changed. Review its current input and Pool/Preset links first.";
      config.needsReview = true;
      refreshes++;
      return;
    }
    const next = planInputHandoff(config.sourceEntries, target.listText, config.mode);
    assert.equal(next.text, plan.text);
    confirmations++;
    applyInputHandoff(target, next, { selection: true, mode: config.mode });
  }
};
const initialDialog = node("section");
renderInputHandoffModal(initialDialog, config, options);
const visible = initialDialog.walk(x => x.props.text?.startsWith("Destination preview:"));
assert.match(visible?.textContent ?? "", /Old · Keep/);
assert.ok(initialDialog.walk(x => x.props.text?.includes("unsaved working-set changes")));
assert.ok(initialDialog.walk(x => x.props.text?.includes("Preset association")));
assert.equal(confirmations, 0, "Preview never changes state");
const firstButton = initialDialog.walk(x => x.tag === "button" && x.props.class === "primary");
assert.equal(firstButton.disabled, false);

// The destination is edited while the modal is open, without changing parsed items.
target.listText = "Old\nKeep";
firstButton.props.onClick();
assert.equal(confirmations, 0, "Stale preview must fail closed");
assert.equal(target.activePresetId, "preset-a");
assert.equal(target.workingSetDirty, true);
assert.equal(config.needsReview, true);

const staleDialog = node("section");
renderInputHandoffModal(staleDialog, config, options);
const review = staleDialog.walk(x => x.tag === "button"
  && x.children?.includes("Review updated destination"));
assert.ok(review, "Stale transfer should offer an accessible, one-click re-review");
assert.equal(staleDialog.walk(x => x.tag === "button"
  && x.props.class === "primary").disabled, true);
review.props.onClick();
assert.equal(config.needsReview, false);
assert.equal(config.error, null);
assert.ok(refreshes > 0);

const refreshed = node("section");
renderInputHandoffModal(refreshed, config, options);
assert.match(refreshed.walk(x => x.props.text?.startsWith("Destination preview:"))?.textContent,
  /Old · Keep/);
refreshed.walk(x => x.tag === "button" && x.props.class === "primary").props.onClick();
assert.equal(confirmations, 1);
assert.equal(target.listText, "Anna\nAnna\nBen");
assert.equal(target.workingSet, null);
assert.equal(target.activePresetId, null);
assert.deepEqual(target.selectionEntries, []);
assert.deepEqual(savedPool.items, ["Old", "Keep"]);
assert.deepEqual(sourceEntries, ["Anna", "Anna", "Ben"]);

// The current entry-source path shares the same destination confirmation.
const entryDialog = node("section");
renderInputHandoffModal(entryDialog,
  { sourceKind: "entries", sourceEntries: ["A", "B"], targetId: "", mode: "append" },
  options);
assert.ok(entryDialog.walk(x => x.props.text?.startsWith("Source preview:")));
const cancel = entryDialog.walk(x => x.tag === "button"
  && x.children?.includes("Cancel"));
cancel.props.onClick();
assert.equal(cancellations, 1);

const app = fs.readFileSync("src/app.js", "utf8");
const helper = fs.readFileSync("src/tool-input-handoff.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
assert.ok(app.includes("getDestinationSnapshot:targetSnapshot"));
assert.ok(app.includes("handoffDestinationSnapshot(state.tool[t.id]"));
assert.ok(app.includes("handoffDestinationUnchanged(plan.destinationSnapshot,targetSnapshot(t))"));
assert.ok(app.indexOf("handoffDestinationUnchanged(plan.destinationSnapshot,targetSnapshot(t))")
  < app.indexOf("applyInputHandoff(ts, next"), "Verify before touching destination");
assert.ok(helper.includes("Review updated destination"));
assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g13";'));
assert.ok(fs.statSync("src/app.js").size <= 423000);
assert.equal(fs.readdirSync(".").filter(x => x.endsWith(".css")).length, 19);
assert.ok(fs.readdirSync(".").filter(x => x.endsWith(".css"))
  .reduce((n, file) => n + fs.statSync(file).size, 0) <= 174500);
console.log("UI-08 destination review and stale handoff regression passed");
