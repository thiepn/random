import assert from "node:assert/strict";
import fs from "node:fs";
import {TOOLS} from "../src/registry.js";
import {motionKindForTool} from "../src/motion-system.js";

const read=file=>fs.readFileSync(file,"utf8");
const motion=read("src/motion-system.js");
const app=read("src/app.js");
const phase7=read("phase7.css");
const toolCss=read("tool-experience.css");
const sw=read("sw.js");
const ci=read(".github/workflows/ci.yml");
const doc=read("docs/redesign/R6-PHYSICAL-MOTION-MICROINTERACTIONS.md");
const contract=JSON.parse(read("docs/redesign/r6-motion-contract.json"));

assert.equal(contract.phase,"R6");
assert.equal(contract.renderer,"src/motion-system.js");
assert.equal(contract.behavior.perpetualIdle,false);
assert.equal(contract.cancellation.generationGuard,true);

const expected=new Map();
for(const [kind,ids] of Object.entries(contract.families)){
  for(const id of ids) expected.set(id,kind);
}
for(const tool of TOOLS){
  assert.equal(
    motionKindForTool(tool.id),
    expected.get(tool.id),
    "Wrong R6 motion family for "+tool.id
  );
}
assert.equal(TOOLS.length,25);
assert.equal(motionKindForTool("custom:any","card"),"card");
assert.equal(motionKindForTool("custom:any","wheel"),"wheel");
assert.equal(motionKindForTool("custom:any","generator"),"instrument");

for(const marker of [
  "const ACTIVE = new Map()",
  "const GENERATION = new Map()",
  "function coin(",
  "function dice(",
  "function wheel(",
  "function card(",
  "function tokens(",
  "function tickets(",
  "function instrument(",
  "function envelope(",
  "function trophy(",
  "function palette(",
  "export function cancelPhysicalMotion(",
  "export function playPhysicalMotion(",
  "export function schedulePhysicalMotion(",
  "plan.effects===\"low\"",
  "plan.reducedMotion",
  "GENERATION.set",
  "requestAnimationFrame"
]) assert.ok(motion.includes(marker),"Missing R6 motion primitive: "+marker);

for(const forbidden of [
  /\bhttps?:\/\//i,
  /\bMath\.random\s*\(/,
  /\.innerHTML\s*=/,
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/
]) assert.doesNotMatch(motion,forbidden,"R6 motion engine violates local/safe contract.");

for(const marker of [
  'from "./motion-system.js"',
  "cancelPhysicalMotion(toolId)",
  "schedulePhysicalMotion({ toolId, plan })",
  "await commitRunAndSession({",
  "const plan = beginPresentation("
]) assert.ok(app.includes(marker),"Missing R6 app integration: "+marker);

const commitIndex=app.indexOf("await commitRunAndSession({");
const presentationIndex=app.indexOf("const plan = beginPresentation(",commitIndex);
assert.ok(commitIndex>=0&&presentationIndex>commitIndex,"Result must be committed before R6 presentation begins.");

assert.equal(phase7.includes("animation:coinFlip"),false);
assert.equal(phase7.includes("animation:diceRoll"),false);
assert.equal(phase7.includes("animation:wheelPointerFeel"),false);
assert.equal(phase7.includes("animation:physicalCardDraw"),false);
assert.equal(toolCss.includes("animation:coinFlip"),false);
assert.equal(toolCss.includes("animation:diceRoll"),false);

for(const marker of [
  "coinFaceInk","diceFaceInk","resultReveal","reducedReveal",
  ".tool-stage.is-reduced-reveal *"
]) assert.ok(phase7.includes(marker),"R6 lost V7 reveal behavior: "+marker);

for(const marker of [
  "@media (hover:hover) and (pointer:fine)",
  ".tool-card-v2:hover .machine-art",
  ".home-feature:hover .machine-art",
  ".tool-card-v2:active .machine-art",
  'html[data-motion="reduced"] .tool-card-v2:hover .machine-art'
]) assert.ok(toolCss.includes(marker),"Missing R6 bounded microinteraction: "+marker);

assert.ok(sw.includes('"./src/motion-system.js"'),"R6 motion system must be precached.");
assert.ok(ci.includes("node --check src/motion-system.js"),"R6 motion module must be syntax-checked.");
assert.ok(ci.includes("R6 Physical Motion & Microinteractions certification"));

const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);
const productionJs=fs.readdirSync("src").filter(name=>name.endsWith(".js"));
const jsBytes=productionJs.reduce((sum,name)=>sum+fs.statSync("src/"+name).size,0);
const appBytes=fs.statSync("src/app.js").size;
const motionBytes=fs.statSync("src/motion-system.js").size;

assert.ok(cssFiles.length<=19,"R6 added a root stylesheet.");
assert.ok(cssBytes<=175000,"R6 CSS budget exceeded: "+cssBytes);
assert.ok(fs.statSync("phase7.css").size<=15000,"R6 V7 CSS budget exceeded.");
assert.ok(fs.statSync("tool-experience.css").size<=18000,"R6 Tool Experience CSS budget exceeded.");
assert.ok(jsBytes<=1048576,"R6 production JS exceeded 1 MiB: "+jsBytes);
assert.ok(appBytes<=425000,"R6 app controller exceeded 425 KB: "+appBytes);
assert.ok(motionBytes<=14000,"R6 motion module exceeded 14 KB: "+motionBytes);

for(const marker of [
  "# R6 — Physical Motion & Microinteractions",
  "Cancellation correctness",
  "No perpetual idle animation",
  "R7 — Themes, Personalization & Accessibility Art Pass"
]) assert.ok(doc.includes(marker),"Missing R6 documentation marker: "+marker);

console.log("R6 Physical Motion / Microinteractions certification passed",JSON.stringify({
  tools:TOOLS.length,
  cssBytes,
  jsBytes,
  appBytes,
  motionBytes
}));
