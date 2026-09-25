import assert from "node:assert/strict";
import fs from "node:fs";
import {TOOLS} from "../src/registry.js";
import {toolArtKind} from "../src/hero-art.js";

const read=file=>fs.readFileSync(file,"utf8");
const art=read("src/hero-art.js");
const app=read("src/app.js");
const css=read("tool-experience.css");
const sw=read("sw.js");
const ci=read(".github/workflows/ci.yml");
const doc=read("docs/redesign/R5-HERO-OBJECTS-GRAPHICS-ART.md");
const contract=JSON.parse(read("docs/redesign/r5-art-contract.json"));

assert.equal(contract.phase,"R5");
assert.equal(contract.renderer,"src/hero-art.js");
assert.equal(contract.architecture.newRootStylesheets,0);

for(const tool of TOOLS){
  assert.ok(toolArtKind(tool.id),"Built-in tool missing R5 art family: "+tool.id);
}
assert.equal(TOOLS.length,25);

for(const marker of [
  "function coinArt(",
  "function dieArt(",
  "function wheelArt(",
  "function cardBackArt(",
  "function cardFaceArt(",
  "function tokenArt(",
  "function ticketArt(",
  "function instrumentArt(",
  "function envelopeArt(",
  "function trophyArt(",
  "function paletteArt(",
  "export function toolArtNode(",
  "export function wheelHardwareNode(",
  "export function playingCardArtNode("
]) assert.ok(art.includes(marker),"Missing R5 art primitive: "+marker);

for(const forbidden of [
  /\bhttps?:\/\//i,
  /\bMath\.random\s*\(/,
  /\.innerHTML\s*=/,
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/
]) assert.doesNotMatch(art,forbidden,"R5 art renderer violates local/safe contract.");

for(const marker of [
  'from "./hero-art.js"',
  'toolArtNode(tool.id, { variant: "thumbnail" })',
  'toolArtNode(featureTool.id, { variant: "featured" })',
  'coinArtNode(',
  'dieArtNode(value, sides)',
  'wheelHardwareNode()',
  'cardBackArtNode()',
  'playingCardArtNode(card)',
  'colorArtNode(color)',
  'toolArtNode(tool.id, { variant: "stage", result })'
]) assert.ok(app.includes(marker),"Missing R5 app integration: "+marker);

for(const marker of [
  ".machine-art{",
  ".art-stage{",
  ".art-thumbnail{",
  ".art-featured{",
  ".stage-orb .machine-art{",
  ".die .machine-art{",
  ".wheel-wrap .art-hardware{",
  ".card-deck .machine-art{",
  ".playing-card .machine-art{",
  ".color-swatch .machine-art{"
]) assert.ok(css.includes(marker),"Missing R5 art layout: "+marker);

assert.equal(css.includes("border:7px double"),false,"Coin must no longer be CSS-painted.");
assert.equal(css.includes("background:linear-gradient(145deg,#fff,#e6e8ef"),false,"Dice must no longer be CSS-painted.");
assert.equal(css.includes("linear-gradient(145deg,#6353d6,#312877)"),false,"Card back must no longer be CSS-painted.");
assert.ok(css.includes(".stage-orb.flipping"));
assert.ok(css.includes(".dice-row.rolling .die"));
assert.ok(css.includes(".wheel-pointer"));
assert.ok(css.includes(".playing-card"));

assert.ok(sw.includes('"./src/hero-art.js"'),"R5 art renderer must be precached.");
assert.ok(ci.includes("node --check src/hero-art.js"),"R5 art renderer must be syntax-checked.");
assert.ok(ci.includes("R5 Hero Objects, Graphics & Art certification"));

const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);
const productionJs=fs.readdirSync("src").filter(name=>name.endsWith(".js"));
const jsBytes=productionJs.reduce((sum,name)=>sum+fs.statSync("src/"+name).size,0);
const appBytes=fs.statSync("src/app.js").size;
const heroBytes=fs.statSync("src/hero-art.js").size;

assert.ok(cssFiles.length<=19,"R5 added a root stylesheet.");
assert.ok(cssBytes<=175000,"R5 CSS budget exceeded: "+cssBytes);
assert.ok(jsBytes<=1048576,"R5 production JS exceeded 1 MiB: "+jsBytes);
assert.ok(appBytes<=425000,"R5 app controller exceeded 425 KB: "+appBytes);
assert.ok(heroBytes<=18000,"R5 hero art module exceeded 18 KB: "+heroBytes);
assert.ok(fs.statSync("tool-experience.css").size<=18000);

for(const marker of [
  "# R5 — Hero Objects, Graphics & Art",
  "Complete built-in coverage",
  "CSS simplification",
  "R6 — Physical Motion & Microinteractions"
]) assert.ok(doc.includes(marker),"Missing R5 documentation marker: "+marker);

console.log("R5 Hero Objects / Graphics / Art certification passed",JSON.stringify({
  tools:TOOLS.length,
  cssBytes,
  jsBytes,
  appBytes,
  heroBytes
}));
