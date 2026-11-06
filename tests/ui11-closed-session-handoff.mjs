import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import {
  activeTargetReason, linkedSessionBlocksHandoff, planInputHandoff,
  handoffDestinationSnapshot, handoffDestinationUnchanged,
  renderInputHandoffModal, applyInputHandoff
} from "../src/tool-input-handoff.js";

// Reproduction: completed/abandoned Session Template IDs remain attached to
// tool state after a step, even though the old conservative guard blocks them.
const staleTemplateState = {
  listText: "Old\nItems", templateSessionId: "tpl-completed",
  templateStepIndex: 2, templateStepId: "step-3",
  workflowSessionId: null, workflowNodeId: null, workflowSilent: false,
  activeSessionId: "completed-normal", activePresetId: "preset-old",
  workingSet: { source: { poolId: "pool-one", revision: 3 }, items: [] },
  workingSetDirty: true, selectionEntries: [{ key: "Old", weight: 4 }],
  replayRunId: null
};
const templateSessions = new Map([
  ["tpl-completed", { id: "tpl-completed", status: "completed" }],
  ["tpl-abandoned", { id: "tpl-abandoned", status: "abandoned" }],
  ["tpl-active", { id: "tpl-active", status: "active" }]
]);
const workflowSessions = new Map([
  ["wf-completed", { id: "wf-completed", status: "completed" }],
  ["wf-error", { id: "wf-error", status: "error" }],
  ["wf-paused", { id: "wf-paused", status: "paused" }],
  ["wf-active", { id: "wf-active", status: "active" }]
]);
const linkedStatus = (kind, id) => linkedSessionBlocksHandoff(
  (kind === "template" ? templateSessions : workflowSessions).get(id) || null
);
const reason = (state, active = false, busy = false) =>
  activeTargetReason(state, active, busy, linkedStatus);

assert.match(activeTargetReason(staleTemplateState), /active session/,
  "Previous conservative guard did not inspect terminal session status");
for (const status of ["completed", "abandoned", "error"]) {
  assert.equal(linkedSessionBlocksHandoff({ status }), false);
}
for (const status of ["active", "paused", "pending"]) {
  assert.equal(linkedSessionBlocksHandoff({ status }), true);
}
assert.equal(linkedSessionBlocksHandoff(null), true,
  "Unloaded or unknown session records must fail closed");
assert.equal(reason(staleTemplateState), null,
  "A completed Template should not permanently block another tool's handoff");
assert.equal(reason({ templateSessionId: "tpl-abandoned" }), null);
assert.equal(reason({ workflowSessionId: "wf-completed" }), null);
assert.equal(reason({ workflowSessionId: "wf-error" }), null);
assert.match(reason({ templateSessionId: "tpl-active" }), /active session/);
assert.match(reason({ workflowSessionId: "wf-active" }), /active session/);
assert.match(reason({ workflowSessionId: "wf-paused" }), /active session/,
  "Paused workflows are unfinished and must retain their state");
assert.match(reason({ templateSessionId: "missing" }), /active session/,
  "Not-loaded session records must never be treated as completed");
assert.match(reason({ workflowSessionId: "missing" }), /active session/);
assert.match(reason(staleTemplateState, true), /active session/,
  "An unrelated active ordinary tool session still blocks");
assert.match(reason(staleTemplateState, false, true), /still running/);
assert.match(reason({ ...staleTemplateState, replayRunId: "replay" }), /replay/);

const savedTemplate = structuredClone(templateSessions.get("tpl-completed"));
const savedPool = { id: "pool-one", revision: 3, items: ["Old", "Items"] };
const source = ["New", "New", "Entry"];
const oldSnapshot = handoffDestinationSnapshot(staleTemplateState);
assert.equal(reason(staleTemplateState), null);
const plan = planInputHandoff(source, staleTemplateState.listText, "replace");
assert.equal(staleTemplateState.listText, "Old\nItems",
  "Preview/plan must not mutate the destination");
assert.equal(handoffDestinationUnchanged(oldSnapshot,
  handoffDestinationSnapshot(staleTemplateState)), true);
applyInputHandoff(staleTemplateState, plan, { selection: true, mode: "replace" });
assert.equal(staleTemplateState.listText, "New\nNew\nEntry");
for (const key of [
  "templateSessionId", "templateStepId", "templateStepIndex",
  "workflowSessionId", "workflowNodeId", "activeSessionId", "activePresetId",
  "workingSet"
]) assert.equal(staleTemplateState[key], null, key + " must be detached");
assert.equal(staleTemplateState.workflowSilent, false);
assert.equal(staleTemplateState.workingSetDirty, false);
assert.deepEqual(staleTemplateState.selectionEntries, [],
  "Replace must not silently inherit old destination weights");
assert.deepEqual(templateSessions.get("tpl-completed"), savedTemplate,
  "Previously completed Template Session record remains unchanged");
assert.deepEqual(savedPool.items, ["Old", "Items"], "Saved Pool is untouched");
assert.deepEqual(source, ["New", "New", "Entry"]);

// Workflow context can similarly outlive the last run. Confirmed handoff
// must not pollute subsequent ordinary runs with an old workflowNodeId.
const workflowTarget = {
  listText: "W", workflowSessionId: "wf-completed",
  workflowNodeId: "old-node", workflowSilent: true, templateSessionId: null,
  selectionEntries: [{ key: "W", weight: 7 }]
};
assert.equal(reason(workflowTarget), null);
applyInputHandoff(workflowTarget, planInputHandoff(["X"], "W", "append"),
  { mode: "append", selection: true });
assert.equal(workflowTarget.workflowSessionId, null);
assert.equal(workflowTarget.workflowNodeId, null);
assert.equal(workflowTarget.workflowSilent, false);
assert.equal(workflowTarget.selectionEntries[0].weight, 7,
  "Append preserves existing selection rules");

// A real confirmation modal may be opened before another view resumes a
// Session; checking the active status again at confirmation remains required.
function node(tag, props = {}, children = []) {
  const item = { tag, props, children: Array.isArray(children) ? children : [children],
    textContent: props.text ?? "", value: props.value ?? "", disabled: Boolean(props.disabled) };
  item.append = (...items) => item.children.push(...items);
  item.walk = (predicate) => {
    if (predicate(item)) return item;
    for (const child of item.children) {
      const found = child?.walk?.(predicate);
      if (found) return found;
    }
    return null;
  };
  return item;
}
const modalTarget = { id: "picker", name: "Pick One" };
const editable = { listText: "Original", templateSessionId: "tpl-completed" };
const config = {
  sourceToolId: "sampler", sourceEntries: ["A", "B"], sourceKind: "result",
  targetId: "picker", mode: "replace", error: null
};
let applied = 0, blocked = 0;
const liveReason = () => reason(editable);
const options = {
  node, sourceName: "Pick Several", targets: [modalTarget],
  getInput: () => editable.listText,
  getDestinationSnapshot: () => handoffDestinationSnapshot(editable),
  activeReason: liveReason,
  onCancel: () => {}, rerender: () => {},
  onConfirm: (_, p) => {
    if (liveReason()) { blocked++; return; }
    if (!handoffDestinationUnchanged(p.destinationSnapshot,
      handoffDestinationSnapshot(editable))) { blocked++; return; }
    applyInputHandoff(editable, p);
    applied++;
  }
};
const modal = node("section");
renderInputHandoffModal(modal, config, options);
const confirm = modal.walk(x => x.tag === "button" && x.props.class === "primary");
assert.equal(confirm.disabled, false, "Completed Template link allows review and confirmation");
templateSessions.get("tpl-completed").status = "active";
confirm.props.onClick();
assert.equal(applied, 0);
assert.equal(blocked, 1, "Session resumed after preview must block the stale confirmation");
assert.equal(editable.listText, "Original");
templateSessions.get("tpl-completed").status = "completed";
const reviewed = node("section");
renderInputHandoffModal(reviewed, config, options);
reviewed.walk(x => x.tag === "button" && x.props.class === "primary").props.onClick();
assert.equal(applied, 1);
assert.equal(editable.templateSessionId, null);

// Verify real wiring rather than merely duplicating expected status handling.
const app = fs.readFileSync("src/app.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
assert.ok(app.includes("linkedSessionBlocksHandoff(session)"));
assert.ok(app.includes("templateSessionById(id) : workflowSessionById(id)"));
assert.ok(app.includes("state.sessions.some((s) => s.toolId === t.id && s.status === \"active\")"));
assert.ok(app.includes('state.partySessions.some((s) => s.toolId === t.id && s.status === "active")'));
assert.ok(app.includes("state.computeBusy,\n      linkedSessionActive"));
assert.ok(app.includes("if (activeReason(t))"), "Confirmation must recheck status");
assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g12";'));
assert.equal(TOOLS.length, 25);
assert.ok(fs.statSync("src/app.js").size <= 423000);
const sheets = fs.readdirSync(".").filter(name => name.endsWith(".css"));
assert.equal(sheets.length, 19);
assert.ok(sheets.reduce((n, path) => n + fs.statSync(path).size, 0) <= 174500);
console.log("UI-11 closed-session handoff and obsolete Template/Workflow context regression passed");
