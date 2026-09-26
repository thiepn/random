import assert from "node:assert/strict";
import fs from "node:fs";
import {TOOLS} from "../src/registry.js";
import {toolArtKind} from "../src/hero-art.js";
import {motionKindForTool} from "../src/motion-system.js";

const read=file=>fs.readFileSync(file,"utf8");
const contract=JSON.parse(read("docs/redesign/r8-release-readiness.json"));
const doc=read("docs/redesign/R8-FULL-VISUAL-QA-RELEASE-READINESS.md");
const ci=read(".github/workflows/ci.yml");
const index=read("index.html");
const app=read("src/app.js");
const sw=read("sw.js");
const version=read("VERSION").trim();
const notes=read("RELEASE-NOTES-v1.2.0.md");

assert.equal(contract.phase,"R8");
assert.equal(contract.targetRelease,"1.2.0");
assert.ok(["hold","release"].includes(contract.releaseDecision));
assert.equal(contract.sourceQA.r1ThroughR7,true);
assert.equal(contract.sourceQA.builtinToolArtCoverage,25);
assert.equal(contract.sourceQA.builtinToolMotionCoverage,25);

assert.equal(TOOLS.length,25);
for(const tool of TOOLS){
  assert.ok(toolArtKind(tool.id),"R8 missing art coverage: "+tool.id);
  assert.ok(motionKindForTool(tool.id),"R8 missing motion coverage: "+tool.id);
}

const legacyFiles=["phase1.css","phase3.css","phase5.css","phase12.css"];
const forbiddenLegacy=[
  "#0c0f1d",
  "rgba(9,12,24",
  "rgba(8,11,22",
  "rgba(10,13,26",
  "rgba(18,22,39",
  "#ffd5de",
  "#ffe28a",
  "#ffc2cf",
  "#c7f8dc",
  "#ffd1dc"
];
for(const file of legacyFiles){
  const source=read(file);
  for(const value of forbiddenLegacy){
    assert.equal(source.includes(value),false,file+" retained R8 legacy literal: "+value);
  }
}
assert.equal(read("brand-icons.css").includes(".brand-asset-panel"),false);

for(const marker of [
  ':root[data-theme="dark"]',
  ':root[data-theme="light"]',
  'html[data-contrast="more"]',
  'html[data-motion="reduced"]',
  '@media (forced-colors:active)',
  '@media(max-width:320px)',
  '@media(min-width:1600px)'
]){
  const source=[
    read("design-system.css"),read("phase14.css"),
    read("home-arcade.css"),read("tool-experience.css")
  ].join("\n");
  assert.ok(source.includes(marker),"R8 missing adaptive marker: "+marker);
}

for(const accent of ["violet","cyan","blue","pink","red","gold","green","orange"]){
  assert.ok(read("design-system.css").includes(':root[data-accent="'+accent+'"]'));
}

assert.doesNotMatch(index,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
assert.ok(index.includes('viewport-fit=cover'));
assert.ok(index.includes('<meta name="color-scheme" content="dark light">'));

const runCommit=app.indexOf("await commitRunAndSession({");
const presentation=app.indexOf("const plan = beginPresentation(",runCommit);
assert.ok(runCommit>=0&&presentation>runCommit,"R8 result commit must precede presentation.");
assert.ok(app.includes("cancelPhysicalMotion(toolId)"));
assert.ok(app.includes('document.addEventListener("visibilitychange"'));
assert.ok(app.includes("finishPresentation(state.toolId, null, false)"));

assert.ok(
  app.includes('typeof result.sub === "string"'),
  "Generic result subtitles must only read string sub fields from result objects."
);
assert.equal(
  /result\?\.sub\s*\?\s*node\("div",\s*\{\s*class:\s*"stage-sub"/.test(app),
  false,
  "String results must not expose inherited String.prototype.sub as stage text."
);

assert.ok(sw.includes('"./src/hero-art.js"'));
assert.ok(sw.includes('"./src/motion-system.js"'));

const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);
const productionJs=fs.readdirSync("src").filter(name=>name.endsWith(".js"));
const jsBytes=productionJs.reduce((sum,name)=>sum+fs.statSync("src/"+name).size,0);
const appBytes=fs.statSync("src/app.js").size;

assert.ok(cssFiles.length<=19,"R8 stylesheet count regressed.");
assert.ok(cssBytes<=174500,"R8 release-candidate CSS reserve was consumed: "+cssBytes);
assert.ok(appBytes<=423000,"R8 app controller headroom regressed: "+appBytes);
assert.ok(jsBytes<=1048576,"R8 production JS exceeded 1 MiB.");

assert.ok(notes.includes("Randomizer Arcade v1.2.0"));
assert.ok(notes.includes("Release candidate"));
assert.ok(notes.includes("Tactile Chance Arcade"));

if(contract.releaseDecision==="hold"){
  assert.notEqual(version,"1.2.0","R8 hold may not publish v1.2.0.");
  assert.notEqual(contract.liveVisualQA.status,"verified");
}else{
  assert.equal(version,"1.2.0");
  assert.equal(contract.liveVisualQA.status,"verified");
  assert.equal(contract.liveVisualQA.screenshotsCaptured,true);
}

for(const marker of [
  "# R8 — Full Visual QA, Consolidation & v1.2 Release Readiness",
  "SOURCE-READY / LIVE-VISUAL-QA HOLD",
  "Live visual matrix still required",
  "v1.2.0 — Release & Deployment Finalization"
]){
  assert.ok(doc.includes(marker),"Missing R8 documentation marker: "+marker);
}

assert.ok(ci.includes("R8 Full Visual QA & v1.2 Release Readiness certification"));

console.log("R8 Full Visual QA / v1.2 readiness certification passed",JSON.stringify({
  releaseDecision:contract.releaseDecision,
  liveVisualQA:contract.liveVisualQA.status,
  stylesheets:cssFiles.length,
  cssBytes,
  appBytes,
  jsBytes
}));
