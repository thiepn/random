import assert from "node:assert/strict";
import fs from "node:fs";
import {CATEGORIES,TOOLS} from "../src/registry.js";

const read=file=>fs.readFileSync(file,"utf8");
const shell=read("app-shell.css");
const home=read("home-arcade.css");
const design=read("design-system.css");
const app=read("src/app.js");
const doc=read("docs/redesign/R3-SHELL-HOME-ARCADE-COMPOSITION.md");
const contract=JSON.parse(read("docs/redesign/r3-composition-contract.json"));
const ci=read(".github/workflows/ci.yml");

assert.equal(contract.phase,"R3");
assert.equal(contract.direction,"Tactile Chance Arcade");
assert.equal(contract.home.heroMachine,"wheel");
assert.equal(contract.arcade.categoryCount,CATEGORIES.length);
assert.equal(contract.arcade.builtinToolCount,TOOLS.length);
assert.equal(contract.architecture.newRootStylesheets,0);

for(const marker of [
  "background:var(--material-cabinet)",
  "background:var(--material-panel)",
  ".nav-button.active::after",
  "grid-template-columns:var(--shell-rail-width) minmax(0,1fr)",
  "grid-template-columns:var(--shell-sidebar-width) minmax(0,1fr)"
]) assert.ok(shell.includes(marker),"Missing R3 shell contract: "+marker);

assert.equal(shell.includes("backdrop-filter"),false,"R3 shell may not depend on glass blur.");
assert.equal(shell.includes("linear-gradient"),false,"R3 shell may not use decorative gradients.");

for(const marker of [
  ".home-hero-v2",
  'content:"HOUSE MACHINE"',
  ".home-feature-orbit",
  'content:"QUICK BAY"',
  ".home-quick-launch",
  ".tool-card-visual",
  "background:var(--material-inset)",
  ".tool-card-feature",
  ".arcade-category-jumps",
  "position:sticky",
  ".arcade-category-head"
]) assert.ok(home.includes(marker),"Missing R3 composition marker: "+marker);

assert.equal(/(?:linear|radial|conic)-gradient\(/.test(home),false,"Home/Arcade must not use decorative gradients.");

for(const marker of [
  '"Chance cabinet"',
  '"Leave it to chance."',
  '"Pick for me"',
  '"Open the Arcade"',
  '"House machine"',
  '"More machines"',
  '"Machine library"',
  '"Choose a machine."',
  '"Pick the kind of chance you need."'
]) assert.ok(app.includes(marker),"Missing R3 Home/Arcade language: "+marker);

assert.ok(app.includes("state.favorites.includes(tool.id)"));
assert.ok(app.includes("state.sessions"));
assert.ok(app.includes("state.templateSessions"));
assert.ok(app.includes("state.workflowSessions"));
assert.ok(app.includes("const tools = TOOLS.filter("));
assert.ok(app.includes('"arcade-category-" + category.id'));

for(const marker of [
  "--shell-rail-width:78px",
  "--shell-sidebar-width:216px",
  "--shell-topbar-min-height:64px"
]) assert.ok(design.includes(marker),"Missing R3 shell size token: "+marker);

const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);
const appBytes=fs.statSync("src/app.js").size;

assert.ok(cssFiles.length<=19,"R3 added a root stylesheet: "+cssFiles.length);
assert.ok(fs.statSync("home-arcade.css").size<=18000,"R3 Home/Arcade CSS exceeded 18 KB.");
assert.ok(fs.statSync("app-shell.css").size<=10000,"R3 shell CSS exceeded 10 KB.");
assert.ok(cssBytes<=175000,"R3 total CSS exceeded production budget: "+cssBytes);
assert.ok(appBytes<=425000,"R3 app controller exceeded production budget: "+appBytes);

for(const marker of [
  "# R3 — Shell, Home & Arcade Composition",
  "Home — arcade entrance",
  "Arcade — cabinet collection",
  "rewrite in place; do not add an override stylesheet",
  "R4 — Tool Experience 3.0"
]) assert.ok(doc.includes(marker),"Missing R3 documentation marker: "+marker);

assert.ok(ci.includes("R3 Shell, Home & Arcade Composition certification"));

console.log("R3 Shell / Home / Arcade certification passed",JSON.stringify({
  stylesheets:cssFiles.length,
  cssBytes,
  appBytes,
  homeBytes:fs.statSync("home-arcade.css").size,
  shellBytes:fs.statSync("app-shell.css").size
}));
