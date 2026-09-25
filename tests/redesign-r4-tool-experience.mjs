import assert from "node:assert/strict";
import fs from "node:fs";
import {TOOLS} from "../src/registry.js";

const read=file=>fs.readFileSync(file,"utf8");
const app=read("src/app.js");
const css=read("tool-experience.css");
const rules=read("phase2.css");
const a11y=read("phase14.css");
const motion=read("phase7.css");
const doc=read("docs/redesign/R4-TOOL-EXPERIENCE-3.md");
const contract=JSON.parse(read("docs/redesign/r4-tool-experience-contract.json"));
const ci=read(".github/workflows/ci.yml");

assert.equal(contract.phase,"R4");
assert.equal(contract.direction,"Tactile Chance Arcade");
assert.equal(contract.setup.element,"details");
assert.equal(contract.architecture.newRootStylesheets,0);

for(const marker of [
  'const controls = node("details"',
  '"Machine controls"',
  'node("strong", { text: "Setup" })',
  '|| !ts.result',
  '"(min-width:760px)"',
  '"tool-action-dock tool-action-"',\n  '+ " tool-machine-console"',
  '"aria-label": "Machine action console"',
  'class: "tool-play-column"',
  'class: "tool-rule-label", text: "Rules"'
]) assert.ok(app.includes(marker),"Missing R4 runtime contract: "+marker);

for(const marker of [
  ".tool-play-column{",
  "background:var(--material-panel)",
  ".tool-rule-strip{",
  ".rule-chip{",
  ".tool-stage-v2{",
  "background:var(--material-tray)",
  "text-shadow:none",
  ".tool-machine-console{",
  ".tool-controls-head::after{content:\"+\"",
  '.tool-controls[open]>.tool-controls-head::after{content:"−"}',
  ".tool-controls .selection-rules,.tool-controls .fairness-panel{",
  ".tool-controls .weight-input{background:var(--material-inset)"
]) assert.ok(css.includes(marker),"Missing R4 Tool Experience styling: "+marker);

for(const family of contract.stage.familyHooks){
  assert.ok(css.includes(".stage-family-"+family+"{--machine-accent:"),"R4 family hook missing: "+family);
}

for(const family of contract.stage.familyHooks){
  const match=css.match(new RegExp("\\.stage-family-"+family+"\\{([^}]*)\\}"));
  assert.ok(match,"Missing family rule: "+family);
  assert.equal(/background\s*:/.test(match[1]),false,"R4 family stage background must be object-neutral: "+family);
}

assert.equal(css.includes("backdrop-filter:blur"),false,"R4 result surfaces may not use backdrop blur.");
assert.equal(rules.includes(".tool-rule-strip{"),false,"Legacy Phase 2 may not own R4 rule instrumentation.");
assert.equal(rules.includes("#ffe59b"),false,"Legacy yellow rule-pill color must be removed.");
assert.ok(rules.includes("background:var(--material-inset)"));
assert.ok(rules.includes("color:var(--color-accent-primary)"));

assert.ok(a11y.includes("*:not(.is-reduced-reveal):not(.is-reduced-reveal *)"));
assert.ok(motion.includes(".tool-stage.is-reduced-reveal *"));
assert.ok(motion.includes("@keyframes reducedReveal"));

for(const marker of [
  "reveal-coin","reveal-dice","reveal-wheel","reveal-card",
  "reveal-teams","reveal-tournament","reveal-private"
]) assert.ok(motion.includes(marker),"R4 lost V7 motion hook: "+marker);

assert.equal(TOOLS.length,25);

const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);
const appBytes=fs.statSync("src/app.js").size;
assert.ok(cssFiles.length<=19,"R4 added a root stylesheet.");
assert.ok(fs.statSync("tool-experience.css").size<=18000,"R4 Tool Experience exceeded 18 KB.");
assert.ok(cssBytes<=175000,"R4 CSS exceeded production budget: "+cssBytes);
assert.ok(appBytes<=425000,"R4 app controller exceeded production budget: "+appBytes);

for(const marker of [
  "# R4 — Tool Experience 3.0",
  "Progressive Setup",
  "Reduced Motion repair",
  "R5 — Hero Objects, Graphics & Art"
]) assert.ok(doc.includes(marker),"Missing R4 documentation marker: "+marker);

assert.ok(ci.includes("R4 Tool Experience 3.0 certification"));

console.log("R4 Tool Experience 3.0 certification passed",JSON.stringify({
  tools:TOOLS.length,
  stylesheets:cssFiles.length,
  cssBytes,
  appBytes,
  toolCssBytes:fs.statSync("tool-experience.css").size
}));
