import assert from "node:assert/strict";
import fs from "node:fs";
import { CATEGORIES, TOOLS } from "../src/registry.js";

const app = fs.readFileSync("src/app.js", "utf8");
const css = fs.readFileSync("home-arcade.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

assert.ok(fs.existsSync("docs/design/V5-HOME-ARCADE.md"));

for (const marker of [
  'class: "content home-v2"',
  'class: "home-hero-v2 accent-rainbow"',
  "function recentHomeTools(",
  "function homeContinuations(",
  "function continuationCard(",
  'class: "home-quick-launch"',
  '"Jump back in"',
  '"Favorites"',
  '"Saved & guided"',
  '"More machines"',
  'class: "content arcade-v2"',
  'class: "arcade-category-jumps"',
  '"arcade-category-" + category.id',
  "arcadeCategoryCopy(category.id)",
  'class: "arcade-tool-grid"'
]) {
  assert.ok(app.includes(marker), "Missing V5 composition marker: " + marker);
}

for (const source of [
  "state.sessions",
  "state.templateSessions",
  "state.workflowSessions"
]) {
  assert.ok(
    app.includes(source),
    "Continue must derive from existing session state: " + source
  );
}

assert.ok(
  app.includes("const seenToolSessions = new Set();"),
  "Continue must deduplicate active sessions per stateful tool."
);
assert.ok(
  app.includes("[...state.runs].sort("),
  "Recent tools must derive from existing Runs."
);
assert.ok(
  app.includes("const seen = new Set();"),
  "Recent tools must be deduplicated."
);
assert.ok(
  app.includes("state.favorites.includes(tool.id)"),
  "Favorites must keep using the existing favorites model."
);
assert.ok(
  app.includes("...favoritePresets.map(presetCard)")
    && app.includes("...regularPresets.map(presetCard)"),
  "Home must keep every saved Preset accessible."
);
assert.ok(
  app.includes("templates.map(templateCard)"),
  "Home must keep every Session Template accessible."
);
assert.equal(
  app.includes("favoritePresets.slice("),
  false,
  "V5 must not hide saved Presets behind a preview-only limit."
);
assert.equal(
  app.includes("templates.slice("),
  false,
  "V5 must not hide Session Templates behind a preview-only limit."
);

assert.equal(
  app.includes('sectionHeader("Ready to play"'),
  false,
  "Legacy equal-weight Home ending should be removed."
);
const arcadeStart = app.indexOf("function renderArcade() {");
const arcadeEnd = app.indexOf("\nfunction poolById(", arcadeStart);
assert.ok(arcadeStart >= 0 && arcadeEnd > arcadeStart);
const arcadeSource = app.slice(arcadeStart, arcadeEnd);

assert.equal(
  arcadeSource.includes('class: "creation-page-head"'),
  false,
  "Arcade must not use the old generic creation-page header."
);

for (const variant of [
  "tool-card-standard",
  "tool-card-compact",
  "tool-card-wide",
  "tool-card-feature"
]) {
  assert.ok(
    css.includes("." + variant),
    "Missing V5 card variant style: " + variant
  );
}

for (const marker of [
  ".home-hero-v2",
  ".home-quick-launch",
  ".continue-grid",
  ".favorite-strip",
  ".home-library-layout",
  ".arcade-hero-v2",
  ".arcade-category-jumps",
  ".arcade-category-head"
]) {
  assert.ok(css.includes(marker), "Missing V5 visual surface: " + marker);
}

for (const media of [
  "@media (min-width:640px)",
  "@media (min-width:900px)",
  "@media (min-width:1180px)",
  "@media (max-width:520px)",
  "@media (max-width:360px)",
  "@media (prefers-reduced-motion:reduce)",
  "@media (forced-colors:active)"
]) {
  assert.ok(css.includes(media), "Missing V5 responsive/accessibility rule: " + media);
}

for (const category of CATEGORIES) {
  assert.ok(
    app.includes('"arcade-category-" + category.id')
      || app.includes('"arcade-category-" + category.id'),
    "Arcade category anchors must be generated for all categories."
  );
}

assert.equal(TOOLS.length, 25);
assert.ok(
  app.includes("const tools = TOOLS.filter("),
  "Arcade categories must remain registry-driven."
);

assert.ok(index.includes("./home-arcade.css"));
assert.ok(
  index.indexOf("./home-arcade.css") > index.indexOf("./app-shell.css"),
  "V5 Home/Arcade styles must load after V4 shell styles."
);
assert.ok(
  sw.includes('"./home-arcade.css"'),
  "V5 styles must be available offline."
);

assert.equal(
  /https?:\/\//i.test(css),
  false,
  "V5 styles must not introduce remote assets."
);
assert.equal(
  /@import\b/i.test(css),
  false,
  "V5 styles must not import runtime CSS."
);

assert.ok(
  fs.statSync("home-arcade.css").size <= 18000,
  "V5 stylesheet exceeded its 18 KB phase budget."
);

console.log(
  "Home / Arcade V5 certification passed",
  JSON.stringify({
    tools: TOOLS.length,
    categories: CATEGORIES.length,
    stylesheetBytes: fs.statSync("home-arcade.css").size
  })
);
