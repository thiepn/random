import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/app.js", "utf8");
const css = fs.readFileSync("app-shell.css", "utf8");
const design = fs.readFileSync("design-system.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
const tokens = JSON.parse(
  fs.readFileSync("docs/design/design-tokens-v2.json", "utf8")
);

assert.ok(fs.existsSync("docs/design/V4-ADAPTIVE-SHELL.md"));

for (const token of [
  "--content-max-wide",
  "--shell-mobile-nav-height",
  "--shell-rail-width",
  "--shell-sidebar-width",
  "--shell-topbar-min-height"
]) {
  assert.ok(
    design.includes(token + ":"),
    "Missing V4 layout token: " + token
  );
  assert.ok(
    tokens.semanticGroups.layout.includes(token),
    "V4 layout token missing from inventory: " + token
  );
}

for (const media of [
  "@media (min-width:720px)",
  "@media (min-width:1180px)",
  "@media (max-width:719px)",
  "@media (max-width:360px)",
  "@media (prefers-reduced-motion:reduce)",
  "@media (forced-colors:active)",
  "@media print"
]) {
  assert.ok(css.includes(media), "Missing shell media contract: " + media);
}

for (const marker of [
  "grid-template-columns:var(--shell-rail-width) minmax(0,1fr)",
  "grid-template-columns:var(--shell-sidebar-width) minmax(0,1fr)",
  "height:calc(var(--shell-mobile-nav-height) + env(safe-area-inset-bottom))",
  "min-width:0",
  "grid-template-areas:",
  '"nav top"',
  '"nav main"'
]) {
  assert.ok(css.includes(marker), "Missing adaptive shell layout marker: " + marker);
}

for (const safeArea of [
  "env(safe-area-inset-top)",
  "env(safe-area-inset-bottom)",
  "env(safe-area-inset-left)",
  "env(safe-area-inset-right)"
]) {
  assert.ok(css.includes(safeArea), "Missing safe-area support: " + safeArea);
}

for (const marker of [
  "function openSettingsPanel()",
  "function shellViewContext()",
  "function primaryNavigation()",
  'class: "app-nav bottom-nav"',
  'class: "app-nav-items"',
  'class: "app-nav-footer"',
  'class: "topbar-context"',
  'class: "nav-label"',
  'main.classList.add("shell-main")',
  'dataset: { view: state.view }',
  'tool: "play"',
  '"template-session": "play"',
  'creations: "arcade"',
  'builder: "arcade"'
]) {
  assert.ok(app.includes(marker), "Missing V4 shell markup/behavior: " + marker);
}

assert.equal(
  app.includes("function bottomNav()"),
  false,
  "Legacy bottomNav renderer must be replaced by adaptive navigation."
);
assert.equal(
  app.includes('iconButton(\n        "Open Arcade"'),
  false,
  "Top toolbar must not duplicate the Arcade primary-navigation destination."
);

assert.ok(
  index.includes("./app-shell.css"),
  "V4 app-shell CSS must load in index.html."
);
assert.ok(
  index.indexOf("./app-shell.css") > index.indexOf("./brand-icons.css"),
  "V4 shell styles must load after V3 brand styles."
);
assert.ok(
  sw.includes('"./app-shell.css"'),
  "V4 shell CSS must be precached."
);

assert.equal(
  /https?:\/\//i.test(css),
  false,
  "V4 shell must not depend on remote URLs."
);
assert.equal(
  /@import\b/i.test(css),
  false,
  "V4 shell must not import runtime styles."
);

assert.ok(
  fs.statSync("app-shell.css").size <= 20000,
  "V4 shell stylesheet exceeded 20 KB."
);

assert.ok(
  css.includes(".nav-button.active::after"),
  "Active navigation needs a non-color-only structural indicator."
);
assert.ok(
  css.includes('background:Highlight'),
  "Forced-colors active navigation treatment is missing."
);

console.log(
  "Adaptive shell V4 certification passed",
  JSON.stringify({
    stylesheetBytes: fs.statSync("app-shell.css").size,
    layoutTokens: tokens.semanticGroups.layout.length
  })
);
