import assert from "node:assert/strict";
import fs from "node:fs";

const read=(file)=>fs.readFileSync(file,"utf8");
const design=read("design-system.css");
const styles=read("styles.css");
const a11y=read("phase14.css");
const tool=read("tool-experience.css");
const index=read("index.html");
const sw=read("sw.js");
const tokens=JSON.parse(read("docs/redesign/design-tokens-v3.json"));
const doc=read("docs/redesign/R2-VISUAL-SYSTEM-COMPONENT-MATERIALS.md");
const ci=read(".github/workflows/ci.yml");

assert.equal(tokens.schemaVersion,3);
assert.equal(tokens.direction,"Tactile Chance Arcade");

for(const group of Object.values(tokens.tokenGroups)){
  for(const token of group){
    assert.ok(design.includes(token+":"),"Missing R2 token: "+token);
  }
}

for(const marker of [
  ':root[data-theme="dark"]',
  ':root[data-theme="light"]',
  '--color-canvas:#f3efe6',
  '--color-text-primary:#20211e',
  '--material-tray:#e5ded1',
  '--shadow-control:',
  '--shape-control:',
  '--font-display:'
]) assert.ok(design.includes(marker),"Missing R2 design-system marker: "+marker);

for(const marker of [
  '.primary{',
  'background:linear-gradient(to bottom',
  '.primary:active{transform:translateY(2px)',
  '.secondary{border:1px solid var(--material-rim)',
  '.small-action{',
  '.small-action:active{transform:translateY(1px)',
  '.field,textarea.field,select.field{',
  'background:var(--material-inset)',
  '.segmented{',
  '.segmented button.active{',
  '.stepper{',
  '.notice{border:0;border-left:3px solid currentColor',
  '.workbench-commandbar{'
]) assert.ok(styles.includes(marker),"Missing R2 component contract: "+marker);

assert.ok(a11y.includes('html[data-theme="light"][data-contrast="more"]'));
assert.ok(a11y.includes('html[data-motion="reduced"]'));
assert.ok(a11y.includes('@media (forced-colors:active)'));
assert.ok(tool.includes('html[data-theme="light"] .tool-stage-v2'));

assert.equal(fs.existsSync("visual-resilience.css"),false);
assert.equal(fs.existsSync("phase13.css"),false);
assert.equal(index.includes("visual-resilience.css"),false);
assert.equal(index.includes("phase13.css"),false);
assert.equal(sw.includes('"./visual-resilience.css"'),false);
assert.equal(sw.includes('"./phase13.css"'),false);

const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);
assert.ok(cssFiles.length<=19,"R2 stylesheet consolidation regressed: "+cssFiles.length);
assert.ok(cssBytes<=173500,"R2 CSS budget exceeded: "+cssBytes);

for(const marker of [
  "# R2 — Visual System 3.0 & Component Materials",
  "Night Cabinet",
  "Day Table",
  "Shared component rebuild",
  "21 → 19",
  "R3 must replace/rewrite Home and Arcade styling in place"
]) assert.ok(doc.includes(marker),"Missing R2 documentation marker: "+marker);

assert.ok(ci.includes("R2 Visual System 3.0 & Component Materials certification"));

console.log("R2 Visual System 3.0 certification passed",JSON.stringify({
  stylesheets:cssFiles.length,
  cssBytes,
  headroom:175000-cssBytes
}));
