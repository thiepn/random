import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/app.js","utf8");
const core=fs.readFileSync("styles.css","utf8");
const pools=fs.readFileSync("phase4.css","utf8");
const history=fs.readFileSync("phase6.css","utf8");
const presets=fs.readFileSync("phase8.css","utf8");
const builder=fs.readFileSync("phase10.css","utf8");
const studio=fs.readFileSync("phase11.css","utf8");
const containment=fs.readFileSync("phase13.css","utf8");
const brand=fs.readFileSync("brand-icons.css","utf8");
const sw=fs.readFileSync("sw.js","utf8");

for(const marker of [
  "function workbenchHeader({",
  'class: "content workbench-view pools-workbench"',
  'class: "workbench-commandbar pool-library-toolbar"',
  'class: "content workbench-view history-workbench"',
  'class: "workbench-commandbar history-toolbar"',
  'class: "content workbench-view creations-view"',
  'class: "content workbench-view builder-view"',
  'class: "builder-workspace"',
  'class: "builder-editor-stack"',
  'class: "builder-inspector"',
  '"aria-label": "Builder test and validation"',
  'class: "content workbench-view workflow-library-view"',
  'class: "content workbench-view workflow-editor-view"',
  'class: "workflow-editor-workspace"',
  'class: "workflow-editor-sidebar"',
  'class: "workflow-editor-canvas"',
  '"aria-label": "Workflow configuration"',
  'class: "pool-list pool-list-v2 workbench-table"',
  'class: "workbench-table-head pool-table-head"',
  'class: "history-group-list workbench-timeline"',
  'class: "saved-setup-card workbench-row',
  'class: "session-template-card workbench-row"',
  'class: "workbench-commandbar creation-commandbar"',
  'class: "builder-panel workbench-panel"',
  'class: "builder-inspector workbench-inspector"',
  'class: "workflow-card-grid workbench-table"',
  '"workflow-card workbench-row"',
  'class: "workflow-graph workbench-canvas"',
  'class: "workflow-node-summary"',
  'class: "controls workbench-panel workflow-input-gate"',
  'class: "workflow-run-path workbench-panel"'
]){
  assert.ok(app.includes(marker),"Missing V8 structure: "+marker);
}

for(const action of [
  "openPoolEditor(pool.id)",
  "replayStoredRun(latest)",
  "rerunStoredRun(latest)",
  "applyPresetToTool(preset)",
  "persistBuilder(\"draft\")",
  "persistBuilder(\"published\")",
  "saveWorkflowEditor",
  "startWorkflowSession(workflow)"
]){
  assert.ok(app.includes(action),"V8 lost existing action: "+action);
}

for(const marker of [
  ".workbench-view",
  ".workbench-header",
  ".workbench-stats",
  ".workbench-commandbar",
  ".workbench-table{",
  ".workbench-view .workbench-row{",
  ".workbench-panel{",
  ".workbench-inspector{",
  ".workbench-canvas{"
]){
  assert.ok(core.includes(marker),"Missing workbench primitive: "+marker);
}

for(const marker of [
  ".pool-list-v2",
  ".pool-card-v2",
  ".pool-editor-table",
  ".pool-editor-row",
  ".pool-cell-input:focus"
]) assert.ok(pools.includes(marker),"Missing V8 Pools styling: "+marker);

for(const marker of [
  ".history-group-list::before",
  ".history-group-card::before",
  ".history-run-preview-row",
  ".run-detail-meta"
]) assert.ok(history.includes(marker),"Missing V8 History styling: "+marker);

for(const marker of [
  ".saved-setup-card",
  ".session-template-card",
  ".template-step-card.is-current"
]) assert.ok(presets.includes(marker),"Missing V8 Preset/Template styling: "+marker);

for(const marker of [
  ".builder-workspace",
  ".builder-editor-stack",
  ".builder-inspector",
  ".builder-test-panel",
  ".builder-validation"
]) assert.ok(builder.includes(marker),"Missing V8 Builder styling: "+marker);

for(const marker of [
  ".workflow-editor-workspace",
  ".workflow-editor-sidebar",
  ".workflow-graph",
  ".workflow-node-card::after",
  ".workflow-node-card::before",
  ".workflow-node-input::before{display:none}",
  ".workflow-node-output::after{display:none}",
  ".workflow-path-list::before"
]) assert.ok(studio.includes(marker),"Missing V8 Studio styling: "+marker);

const nodeStart=app.indexOf("function workflowNodeEditorCard");
const nodeEnd=app.indexOf("\nasync function saveWorkflowEditor",nodeStart);
assert.ok(nodeStart>=0&&nodeEnd>nodeStart);
const nodeSource=app.slice(nodeStart,nodeEnd);
for(const marker of [
  'tabindex: "0"',
  'event.key === "Enter" || event.key === " "',
  "if (selected) {",
  "card.append(config)",
  'class: "workflow-node-summary"'
]){
  assert.ok(nodeSource.includes(marker),"Missing compact-node contract: "+marker);
}
assert.ok(
  nodeSource.indexOf("if (selected) {")<nodeSource.indexOf("card.append(config)"),
  "Node configuration must expand only after selection."
);

assert.ok(
  containment.includes(".pool-card-v2"),
  "Rendering containment must follow the V8 Pool row class."
);
assert.ok(
  brand.includes(".workflow-node-glyph") && brand.includes("width:32px"),
  "V3 SVG optics must align with V8 Studio nodes."
);

for(const iconMarker of [
  '["wheel", "wheel", "Wheel"]',
  'iconNode(pinned ? "star-filled" : "star")',
  'session.status === "completed" ? "check" : "warning"'
]){
  assert.ok(app.includes(iconMarker),"V8 product chrome must use SVG icons: "+iconMarker);
}

for(const file of ["./phase4.css","./phase6.css","./phase8.css","./phase10.css","./phase11.css"]){
  assert.ok(sw.includes('"'+file+'"'),"V8 workbench CSS must remain offline: "+file);
}

for(const css of [pools,history,presets,builder,studio]){
  assert.equal(/https?:\/\//i.test(css),false);
  assert.ok(css.includes("@media(forced-colors:active)"));
}

assert.equal(
  pools.includes(".pool-list-v2{display:grid;gap:0;border:1px solid"),
  false,
  "Pools should use shared V8 table ownership."
);
assert.equal(
  builder.includes(".creation-grid{display:grid;gap:0;border:1px solid"),
  false,
  "Creations should use shared V8 table ownership."
);
assert.equal(
  studio.includes(".workflow-card-grid{display:grid;gap:0;border:1px solid"),
  false,
  "Studio should use shared V8 table ownership."
);

const rootCss=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const totalCss=rootCss.reduce((sum,name)=>sum+fs.statSync(name).size,0);
assert.ok(totalCss<=175000,"V8 exceeded global CSS budget: "+totalCss);

console.log("Professional Surfaces V8 certification passed",JSON.stringify({
  cssBytes:totalCss,
  remaining:175000-totalCss
}));
