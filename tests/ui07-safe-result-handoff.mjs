import assert from "node:assert/strict";
import fs from "node:fs";
import { resultToItems } from "../src/session-template-model.js";
import {
  planInputHandoff, activeTargetReason, renderInputHandoffModal, applyInputHandoff
} from "../src/tool-input-handoff.js";

function node(tag, props = {}, children = []) {
  const item = {
    tag, props, children: Array.isArray(children) ? children : [children],
    textContent: props.text ?? "", value: props.value ?? "", disabled: !!props.disabled
  };
  item.append = (...children) => item.children.push(...children);
  item.walk = (predicate) => {
    if (predicate(item)) return item;
    for (const child of item.children) {
      if (child?.walk) {
        const result = child.walk(predicate);
        if (result) return result;
      }
    }
    return null;
  };
  return item;
}
const committedResult = ["Ada", "Ada", "Bea"];
const items = resultToItems("picker", committedResult);
assert.deepEqual(items, committedResult);
assert.notEqual(items, committedResult, "A committed result is copied, not mutated");
assert.deepEqual(resultToItems("teams", [["Ada", "Bea"], ["Cy", "Dee"]]),
  ["Team 1 · Ada, Bea", "Team 2 · Cy, Dee"]);

const targets = [{ id: "picker", name: "Pick One" }, { id: "teams", name: "Teams" }];
const config = {
  sourceKind: "result", sourceToolId: "sampler",
  sourceEntries: items, targetId: "picker", mode: "replace", error: null
};
const savedSource = [...items];
let confirmCount = 0;
const args = {
  node, sourceName: "Pick Several", targets,
  getInput: () => "Old; Keep",
  activeReason: (tool) => tool.id === "teams"
    ? "Finish the destination's active session first." : null,
  onConfirm: (tool, plan) => {
    confirmCount++;
    assert.equal(tool.id, "picker");
    assert.equal(plan.text, config.mode === "replace"
      ? "Ada\nAda\nBea" : "Old\nKeep\nAda\nAda\nBea");
  },
  onCancel: () => {}, rerender: () => {}
};
const dialog = node("section");
renderInputHandoffModal(dialog, config, args);
assert.equal(dialog.walk(x => x.tag === "h2").textContent, "Use result in another tool");
assert.match(dialog.walk(x => x.props.text?.startsWith("Result preview:"))?.textContent ?? "",
  /Ada · Ada · Bea/);
assert.equal(confirmCount, 0, "Opening a result transfer must never modify a target");
const destination = dialog.walk(x => x.tag === "select"
  && x.props["aria-label"] === "Destination randomizer");
const method = dialog.walk(x => x.tag === "select"
  && x.props["aria-label"] === "How to copy the entries");
assert.ok(destination && method, "Result transfers must use keyboard-native selectors");
assert.equal(destination.children.find(x => x.props.value === "teams").disabled, true,
  "An active session must not be offered as a destination");
const confirm = dialog.walk(x => x.tag === "button" && x.props.class === "primary");
assert.equal(confirm.disabled, false);
assert.ok(confirm.children.includes("Replace entries"));
confirm.props.onClick();
assert.equal(confirmCount, 1);
assert.deepEqual(items, savedSource, "Result labels must remain intact");

config.mode = "append";
const appendDialog = node("section");
renderInputHandoffModal(appendDialog, config, args);
assert.match(appendDialog.walk(x => x.tag === "button"
  && x.props.class === "primary").children.join(""), /Append/);
appendDialog.walk(x => x.tag === "button" && x.props.class === "primary")
  .props.onClick();
assert.equal(confirmCount, 2);
const appended = planInputHandoff(items, "Old; Keep", "append");
const draft = {
  listText: "Old; Keep", selectionEntries: [{ key: "Old", weight: 4 }],
  workingSet: { source: { poolId: "pool-1" } }, activePresetId: "preset-1"
};
applyInputHandoff(draft, appended, { selection: true, mode: "append" });
assert.equal(draft.selectionEntries[0].weight, 4, "Append retains existing weights");
assert.equal(draft.activePresetId, null);
assert.equal(draft.workingSet, null);
assert.deepEqual(committedResult, ["Ada", "Ada", "Bea"]);
assert.match(activeTargetReason({}, true), /active session/);
assert.match(activeTargetReason({ replayRunId: "r" }), /replay mode/);

const blocked = node("section");
renderInputHandoffModal(blocked, { ...config, mode: "replace",
  sourceEntries: ["invalid;label"] }, args);
assert.equal(blocked.walk(x => x.tag === "button" && x.props.class === "primary").disabled, true,
  "Unrepresentable result labels must not be silently split");
const empty = node("section");
renderInputHandoffModal(empty, { ...config, sourceEntries: [] }, args);
assert.equal(empty.walk(x => x.tag === "button" && x.props.class === "primary").disabled, true);

const app = fs.readFileSync("src/app.js", "utf8");
const helper = fs.readFileSync("src/tool-input-handoff.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
assert.ok(app.includes('sourceEntries: resultToItems(tool.id, cloneData(ts.result))'));
assert.ok(app.includes('sourceKind: "result", targetId: "", mode: "replace"'));
assert.ok(app.includes('state.modal?.type === "input-handoff"'));
assert.ok(app.includes('state.partySessions.some((s) => s.toolId === t.id && s.status === "active")'));
assert.ok(app.includes("if (activeReason(t))"));
assert.ok(app.includes("planInputHandoff(config.sourceEntries,ts[field],config.mode)"));
assert.ok(app.includes("applyInputHandoff(ts, next"));
assert.ok(app.includes("reconcileToolSelection(t.id,ts)"));
assert.equal(app.includes("renderUseResultModal"), false,
  "The old unconfirmed result-replacement path must be removed");
assert.equal(app.includes('type: "use-result"'), false);
assert.ok(helper.includes('? "Use result in another tool" : "Copy current entries to another tool"'));
assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g11";'));
assert.ok(fs.statSync("src/app.js").size <= 423000);
assert.ok(fs.readdirSync(".").filter(x => x.endsWith(".css"))
  .reduce((size, x) => size + fs.statSync(x).size, 0) <= 174500);
console.log("UI-07 guarded result-transfer regression passed");
