import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";

const app = fs.readFileSync("src/app.js", "utf8");
const css = fs.readFileSync("tool-experience.css", "utf8");
const legacy = fs.readFileSync("styles.css", "utf8");
const phase7 = fs.readFileSync("phase7.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

assert.ok(fs.existsSync("docs/design/V6-TOOL-EXPERIENCE.md"));

for (const marker of [
  "function toolVisualFamily(tool)",
  "function toolFamilyLabel(family)",
  'class: "content tool-view-v2"',
  'class: "tool-workspace"',
  'class: "tool-play-column"',
  "function buildToolActionDock(tool, ts)",
  '"tool-action-dock tool-action-"',
  '"controls tool-controls tool-controls-"',
  'class: "tool-controls-head"',
  '"tool-stage tool-stage-v2 stage-family-"',
  'dataset: {',
  "function diceFaceNode(value, sides)",
  "function playingCardVisual(card)",
  'class: "card-stage-visual"'
]) {
  assert.ok(app.includes(marker), "Missing V6 implementation marker: " + marker);
}

assert.ok(
  app.includes('class: "die " + (pipFace ? "die-pips" : "die-number")'),
  "D6 dice must retain the V6 die-pips class while non-D6 dice use die-number."
);

const controlsStart = app.indexOf("function buildControls(tool, ts) {");
const controlsEnd = app.indexOf("\nfunction buildToolActionDock(", controlsStart);
assert.ok(controlsStart >= 0 && controlsEnd > controlsStart);
const controlsSource = app.slice(controlsStart, controlsEnd);

assert.equal(
  controlsSource.includes('onClick: () => runTool(tool.id)'),
  false,
  "Primary randomize action must not remain buried in Setup controls."
);

const dockStart = app.indexOf("function buildToolActionDock(tool, ts) {");
const dockEnd = app.indexOf("\nfunction actionLabel(", dockStart);
assert.ok(dockStart >= 0 && dockEnd > dockStart);
const dockSource = app.slice(dockStart, dockEnd);

for (const behavior of [
  'onClick: () => runTool(tool.id)',
  "shareCurrentResult",
  '"use-result"',
  '"Reset deck"',
  '"Reset elimination"'
]) {
  assert.ok(
    dockSource.includes(behavior),
    "Action Dock lost existing behavior: " + behavior
  );
}

for (const family of [
  "coin",
  "dice",
  "wheel",
  "cards",
  "color",
  "list",
  "people",
  "competition",
  "private",
  "generator"
]) {
  assert.ok(
    css.includes(".stage-family-" + family),
    "Missing V6 stage family style: " + family
  );
}

const familyMapStart = app.indexOf(
  "const BUILTIN_TOOL_VISUAL_FAMILY = Object.freeze({"
);
const familyMapEnd = app.indexOf("\n});", familyMapStart);
assert.ok(familyMapStart >= 0 && familyMapEnd > familyMapStart);
const familyMapSource = app.slice(familyMapStart, familyMapEnd);

for (const tool of TOOLS) {
  const quoted = '"' + tool.id + '":';
  const bare = tool.id + ":";
  assert.ok(
    familyMapSource.includes(quoted) || familyMapSource.includes(bare),
    "Built-in tool missing explicit V6 family: " + tool.id
  );
}

for (const layout of [
  '"wheel"',
  '"dice"',
  '"card"',
  '"list"',
  '"table"',
  '"number"',
  '"text"'
]) {
  assert.ok(
    app.includes("layout === " + layout),
    "Custom layout missing V6 family mapping: " + layout
  );
}

assert.ok(css.includes(".die-pips"));
for (const pip of [1,3,4,5,6,7,9]) {
  assert.ok(css.includes(".pip-" + pip), "Missing D6 pip position " + pip);
}

for (const cardMarker of [
  ".card-stage-visual",
  ".card-deck",
  ".playing-card",
  ".card-corner",
  ".card-suit"
]) {
  assert.ok(css.includes(cardMarker), "Missing physical card style: " + cardMarker);
}

for (const preserved of [
  "reveal-coin",
  "reveal-dice",
  "reveal-wheel",
  "reveal-card",
  "reveal-teams",
  "reveal-tournament",
  "reveal-private",
  "is-reduced-reveal"
]) {
  assert.ok(
    phase7.includes(preserved),
    "Presentation choreography hook was lost: " + preserved
  );
}

for (const removed of [
  ".tool-stage{",
  ".stage-orb{",
  ".wheel-wrap{",
  ".card-deck{",
  ".color-swatch{"
]) {
  assert.equal(
    legacy.includes(removed),
    false,
    "Legacy styles.css still owns V6 surface: " + removed
  );
}

assert.ok(index.includes("./tool-experience.css"));
assert.ok(
  index.indexOf("./tool-experience.css") > index.indexOf("./home-arcade.css"),
  "V6 styles must load after V5 discovery styles."
);
assert.ok(
  sw.includes('"./tool-experience.css"'),
  "V6 stylesheet must be available offline."
);

assert.equal(/https?:\/\//i.test(css), false);
assert.equal(/@import\b/i.test(css), false);

assert.ok(
  fs.statSync("tool-experience.css").size <= 18000,
  "V6 stylesheet exceeded its 18 KB phase budget."
);

for (const media of [
  "@media (min-width:760px)",
  "@media (min-width:1180px)",
  "@media (max-width:620px)",
  "@media (max-width:380px)",
  "@media (prefers-reduced-motion:reduce)",
  "@media (forced-colors:active)"
]) {
  assert.ok(css.includes(media), "Missing V6 responsive/accessibility rule: " + media);
}

console.log(
  "Tool Experience V6 certification passed",
  JSON.stringify({
    tools: TOOLS.length,
    stylesheetBytes: fs.statSync("tool-experience.css").size
  })
);
