import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";

const read = (path) => fs.readFileSync(path, "utf8");
const home = read("home-arcade.css");
const tool = read("tool-experience.css");
const shell = read("app-shell.css");
const app = read("src/app.js");
const sw = read("sw.js");

assert.equal(TOOLS.length, 25);

// Tiny mobile icon buttons previously overrode the coarse-pointer 44px rule.
const touch = ".tool-head-actions .icon-button{width:44px;min-height:44px}";
assert.equal(tool.split(touch).length - 1, 2);
assert.doesNotMatch(tool, /\.tool-head-actions \.icon-button\{width:(?:36|38)px;/);

// Keep initial setup nearer to the primary action without visually reordering
// interactive elements away from their actual DOM / keyboard focus sequence.
const compact =
  "@media(max-width:759px){.tool-screen-v2:is("
  + ".tool-family-wheel,.tool-family-list,.tool-family-people,"
  + ".tool-family-competition,.tool-family-private"
  + "):has(.tool-controls[open]) .tool-stage-v2{--tool-stage-min:14rem}";
assert.ok(tool.includes(compact), "Input-oriented tools need compact mobile setup state.");
const compactWheel =
  ".tool-family-wheel:has(.tool-controls[open]) .wheel-wrap"
  + "{width:min(40vw,10rem);margin-bottom:var(--space-3)}";
assert.ok(tool.includes(compactWheel),
  "Wheel artwork itself must shrink while mobile Setup is expanded.");
assert.ok(tool.includes(".wheel-wrap{position:relative;width:min(100%,72vw,21rem)"),
  "Desktop Wheel must respect available stage-content width.");
assert.ok(tool.includes(".wheel-wrap{width:min(100%,78vw,18rem)}"),
  "Very narrow Wheel must respect available stage-content width.");
// At 760px, the 78px navigation rail, 28px side gutters, 12px
// workspace gap and 288px Setup sidebar leave only 326px for the
// play column, before its borders and the stage's own padding.
// A fixed 21rem / 336px Wheel therefore cannot fit.
const desktopPlayColumn = 760 - 78 - 2 * 28 - 12 - 288;
assert.ok(desktopPlayColumn < 21 * 16);

for (const viewport of [320, 360, 390]) {
  // At the default 16px root size, the original artwork alone exceeds
  // the 14rem minimum, making the earlier min-height-only rule ineffective.
  const originalWidth = viewport <= 380
    ? Math.min(viewport * .78, 18 * 16)
    : Math.min(viewport * .72, 21 * 16);
  const compactWidth = Math.min(viewport * .4, 10 * 16);
  assert.ok(originalWidth > 14 * 16);
  assert.ok(compactWidth < originalWidth);
  assert.ok(compactWidth < 14 * 16);
}

assert.match(app, /const setupOpen\s*=\s*Boolean\(ts\.error\)\s*\|\| !ts\.result/);
assert.match(
  app,
  /const workspace = node\("div", \{ class: "tool-workspace" \}, \[\s*node\("div", \{ class: "tool-play-column" \}/
);
assert.ok(tool.includes('html[data-theme="light"] .tool-stage-v2'));
assert.ok(tool.includes('@media (forced-colors:active)'));

// The 320px rule must override the broader 360px rule, not vice versa.
const narrow = "@media(max-width:320px){.home-hero-actions,.home-quick-launch{grid-template-columns:1fr}";
const medium = "@media (max-width:360px){";
assert.ok(home.includes(narrow));
assert.ok(home.indexOf(narrow) > home.indexOf(medium));

// Functional navigation and setup text must no longer be 9-10px.
for (const [css,selector,size] of [
  [shell,".nav-button{",".75rem"],
  [tool,".tool-family-label{",".75rem"],
  [tool,".tool-rule-label{",".75rem"],
  [tool,".rule-chip{",".75rem"],
  [tool,".tool-stage-v2 .stage-label{",".75rem"],
  [tool,".tool-controls-head span{",".75rem"],
  [tool,".tool-controls-head small{",".75rem"],
  [home,".kicker{",".75rem"],
  [home,".home-quick-launch::before{",".75rem"]
]) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, "Missing selector: " + selector);
  const end = css.indexOf("}",start);
  assert.ok(css.slice(start,end).includes("font-size:" + size),
    selector + " must use readable text");
}

assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g3";'));
assert.ok(sw.includes('"./tool-experience.css"'));
assert.ok(sw.includes('"./home-arcade.css"'));
assert.ok(sw.includes('"./app-shell.css"'));

const rootCss = fs.readdirSync(".").filter((name) => name.endsWith(".css"));
const cssBytes = rootCss.reduce((n,name) => n + fs.statSync(name).size,0);
assert.equal(rootCss.length, 19);
assert.ok(cssBytes <= 174500, "R8 CSS budget exceeded: " + cssBytes);
assert.ok(fs.statSync("src/app.js").size <= 423000);

console.log("UI-02 mobile usability certification passed",JSON.stringify({
  tools: TOOLS.length,
  cssBytes,
  appBytes: fs.statSync("src/app.js").size
}));
