import assert from "node:assert/strict";
import fs from "node:fs";

const read=file=>fs.readFileSync(file,"utf8");
const design=read("design-system.css");
const art=read("src/hero-art.js");
const tool=read("tool-experience.css");
const home=read("home-arcade.css");
const a11y=read("phase14.css");
const visual=read("src/visual-preferences.js");
const boot=read("src/visual-boot.js");
const index=read("index.html");
const manifest=JSON.parse(read("manifest.webmanifest"));
const ci=read(".github/workflows/ci.yml");
const doc=read("docs/redesign/R7-THEMES-PERSONALIZATION-ACCESSIBILITY-ART.md");
const contract=JSON.parse(read("docs/redesign/r7-accessibility-art-contract.json"));

assert.equal(contract.phase,"R7");
assert.equal(contract.direction,"Tactile Chance Arcade");
assert.equal(contract.architecture.newRootStylesheets,0);

for(const token of [
  "--art-metal-hi","--art-metal-mid","--art-metal-low","--art-metal-deep","--art-metal-ink",
  "--art-enamel-hi","--art-enamel-mid","--art-enamel-low","--art-enamel-stroke","--art-enamel-ink",
  "--art-paper-hi","--art-paper","--art-paper-mid","--art-paper-low","--art-paper-stroke","--art-paper-ink",
  "--art-card-back","--art-card-back-deep","--art-card-mark",
  "--art-hardware-stroke","--art-hardware-dark","--art-glass-hi","--art-glass",
  "--art-wax","--art-trophy"
]) assert.ok(design.includes(token+":"),"Missing R7 art token: "+token);

for(const marker of [
  '--art-enamel-mid:#f1eee7',
  '--art-paper:#f3e8d2',
  '--art-hardware-stroke:#6b655b',
  '--art-glass:#171712'
]) assert.ok(design.includes(marker),"Missing Day Table art tuning: "+marker);

for(const oldLiteral of [
  "#fff4c8","#ece8df","#c9c2b4","#efe4cc","#e3d4b6","#a94b52","#d8c7ff"
]) assert.equal(art.includes(oldLiteral),false,"R7 physical material remained hard-coded: "+oldLiteral);

for(const marker of [
  'var(--art-metal-hi)','var(--art-enamel-mid)','var(--art-paper)',
  'var(--art-card-back)','var(--art-hardware-stroke)','var(--art-glass)',
  'var(--art-wax)','var(--art-trophy)',
  'var(--machine-accent,var(--accent,var(--color-accent-primary)))'
]) assert.ok(art.includes(marker),"Missing adaptive R7 art usage: "+marker);

assert.ok(
  tool.includes('html[data-theme="light"] .tool-stage-v2{background:var(--material-tray)'),
  "Day Table Tool stage must remain light/material-driven."
);
assert.equal(
  tool.includes('--color-canvas-raised:#151410'),
  false,
  "Light theme must not force the Tool stage back to a dark local palette."
);

for(const marker of [
  'html[data-contrast="more"] .machine-art{filter:contrast(1.16)',
  'html[data-control-size="large"] .tool-primary-action{min-height:68px}',
  'html[data-control-size="large"] .tool-controls-head{min-height:64px}',
  '.machine-art *{fill:Canvas!important;stroke:CanvasText!important}',
  '.machine-art text{fill:CanvasText!important;stroke:none!important}',
  '.machine-art ellipse{display:none}'
]) assert.ok(a11y.includes(marker),"Missing R7 accessibility art contract: "+marker);

for(const marker of [
  '@media(max-width:320px)',
  '.art-stage{width:min(56vw,8.5rem)}',
  '@media(min-width:1600px)',
  '.art-stage{width:clamp(9rem,9vw,12.5rem)}',
  '@media(hover:none)',
  'html[data-motion="reduced"] .machine-art'
]) assert.ok(tool.includes(marker),"Missing R7 adaptive Tool art rule: "+marker);

for(const marker of [
  '@media(max-width:320px)',
  '.home-hero-actions,.home-quick-launch{grid-template-columns:1fr}',
  'grid-template-columns:repeat(4,minmax(7rem,1fr));overflow-x:auto'
]) assert.ok(home.includes(marker),"Missing R7 extreme-width Home/Arcade rule: "+marker);

assert.equal(index.includes("user-scalable=no"),false);
assert.equal(index.includes("maximum-scale=1"),false);
assert.ok(index.includes('<meta name="color-scheme" content="dark light">'));

assert.equal(manifest.background_color,"#11110e");
assert.equal(manifest.theme_color,"#11110e");
assert.ok(visual.includes('theme === "light" ? "#f3efe6" : "#11110e"'));
assert.ok(boot.includes('theme === "light" ? "#f3efe6" : "#11110e"'));

for(const accent of ["violet","cyan","blue","pink","red","gold","green","orange"]){
  assert.ok(design.includes(':root[data-accent="'+accent+'"]'),"Missing accent contract: "+accent);
}

assert.equal(home.includes(".tool-card-aura{"),false);
assert.equal(home.includes(".home-feature-ring{"),false);

const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);
const productionJs=fs.readdirSync("src").filter(name=>name.endsWith(".js"));
const jsBytes=productionJs.reduce((sum,name)=>sum+fs.statSync("src/"+name).size,0);

assert.ok(cssFiles.length<=19,"R7 added a root stylesheet.");
assert.ok(cssBytes<=175000,"R7 CSS budget exceeded: "+cssBytes);
assert.ok(fs.statSync("home-arcade.css").size<=18000);
assert.ok(fs.statSync("tool-experience.css").size<=18000);
assert.ok(fs.statSync("src/app.js").size<=425000);
assert.ok(fs.statSync("src/hero-art.js").size<=18000);
assert.ok(jsBytes<=1048576);

for(const marker of [
  "# R7 — Themes, Personalization & Accessibility Art Pass",
  "Day Table is genuinely light",
  "Forced Colors",
  "320px / text-zoom resilience",
  "R8 — Full Visual QA, Consolidation & v1.2 Release Readiness"
]) assert.ok(doc.includes(marker),"Missing R7 documentation marker: "+marker);

assert.ok(ci.includes("R7 Themes, Personalization & Accessibility Art certification"));

console.log("R7 Themes / Personalization / Accessibility Art certification passed",JSON.stringify({
  stylesheets:cssFiles.length,
  cssBytes,
  jsBytes,
  homeBytes:fs.statSync("home-arcade.css").size,
  toolBytes:fs.statSync("tool-experience.css").size
}));
