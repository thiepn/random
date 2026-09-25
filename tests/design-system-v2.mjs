import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("design-system.css", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const activeCoreStyles = [
  styles,
  fs.readFileSync("app-shell.css", "utf8"),
  fs.readFileSync("home-arcade.css", "utf8"),
  fs.readFileSync("tool-experience.css", "utf8")
].join("\n");
const phase14 = fs.readFileSync("phase14.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
const inventory = JSON.parse(
  fs.readFileSync("docs/design/design-tokens-v2.json", "utf8")
);

assert.equal(inventory.schemaVersion, 2);
assert.equal(inventory.direction, "Expressive Utility Arcade");

assert.equal(
  /@import\b/i.test(css),
  false,
  "Design System V2 must not import runtime CSS dependencies."
);
assert.equal(
  /@font-face\b/i.test(css),
  false,
  "V2 must remain on local/system font stacks."
);
assert.equal(
  /https?:\/\//i.test(css),
  false,
  "Design System V2 must not depend on remote URLs."
);

const requiredTokens = [
  "--font-sans",
  "--font-mono",
  "--type-display-size",
  "--type-page-size",
  "--type-result-size",
  "--type-section-size",
  "--type-body-size",
  "--type-support-size",
  "--type-label-size",
  "--type-caption-size",
  "--color-canvas",
  "--color-canvas-raised",
  "--color-surface-1",
  "--color-surface-2",
  "--color-surface-3",
  "--color-surface-interactive",
  "--color-surface-hover",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-disabled",
  "--color-stroke-subtle",
  "--color-stroke-default",
  "--color-stroke-strong",
  "--color-stroke-emphasis",
  "--color-accent-primary",
  "--color-accent-secondary",
  "--color-info",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--radius-control",
  "--radius-component",
  "--radius-card",
  "--radius-feature",
  "--radius-stage",
  "--radius-pill",
  "--radius-circle",
  "--shadow-level-0",
  "--shadow-level-1",
  "--shadow-level-2",
  "--shadow-level-3",
  "--shadow-overlay",
  "--duration-instant",
  "--duration-fast",
  "--duration-standard",
  "--duration-slow",
  "--duration-reveal",
  "--ease-standard",
  "--ease-emphasized",
  "--ease-decelerate",
  "--ease-accelerate",
  "--space-0",
  "--space-13"
];

for (const token of requiredTokens) {
  assert.ok(
    css.includes(token + ":"),
    "Missing Design System V2 token: " + token
  );
}

for (const group of Object.values(inventory.semanticGroups)) {
  for (const token of group) {
    assert.ok(
      css.includes(token + ":"),
      "Token inventory references missing CSS token: " + token
    );
  }
}

for (const alias of [
  "--bg",
  "--bg-2",
  "--surface",
  "--surface-2",
  "--surface-3",
  "--border",
  "--border-strong",
  "--text",
  "--muted",
  "--blue",
  "--cyan",
  "--purple",
  "--pink",
  "--red",
  "--gold",
  "--green",
  "--orange",
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--shadow",
  "--ease"
]) {
  assert.ok(
    css.includes(alias + ":var("),
    "Legacy migration alias must resolve through semantic token: " + alias
  );
}

assert.equal(
  styles.includes("--bg:#090b14"),
  false,
  "Legacy styles.css must no longer own the v1.0 root palette."
);
assert.ok(
  (activeCoreStyles.includes("var(--color-surface-1)")
    || activeCoreStyles.includes("var(--material-panel)"))
    && (activeCoreStyles.includes("var(--type-page-size)")
      || activeCoreStyles.includes("var(--font-display)"))
    && (activeCoreStyles.includes("var(--radius-stage)")
      || activeCoreStyles.includes("var(--shape-stage)"))
    && (activeCoreStyles.includes("var(--shadow-level-")
      || activeCoreStyles.includes("var(--shadow-contact)")
      || activeCoreStyles.includes("var(--shadow-inset)")),
  "Active core styles must consume semantic surface, type, shape and depth roles."
);

assert.ok(
  phase14.includes("--color-stroke-default:")
    && phase14.includes("--color-text-tertiary:"),
  "Higher-contrast mode must override V2 semantic tokens."
);

assert.ok(index.includes('./design-system.css'));
assert.ok(
  index.indexOf('./design-system.css') < index.indexOf('./styles.css'),
  "Design System V2 must load before legacy component styles."
);
assert.ok(
  sw.includes('"./design-system.css"'),
  "Design System V2 must be part of the offline shell."
);

for (const role of [
  ".ds-display",
  ".ds-page-title",
  ".ds-result",
  ".ds-section-title",
  ".ds-body",
  ".ds-support",
  ".ds-label",
  ".ds-caption",
  ".ds-mono"
]) {
  assert.ok(css.includes(role + "{"), "Missing typography role: " + role);
}

for (const surface of [
  ".ds-surface",
  ".ds-surface-raised",
  ".ds-surface-overlay"
]) {
  assert.ok(css.includes(surface + "{"), "Missing depth role: " + surface);
}

assert.match(css, /@media\s*\(prefers-reduced-motion:reduce\)/);
assert.match(css, /@media\s*\(forced-colors:active\)/);

function variableMap(source) {
  const map = new Map();
  for (const match of source.matchAll(
    /(--[\w-]+)\s*:\s*([^;{}]+);/g
  )) {
    if (!map.has(match[1])) map.set(match[1], match[2].trim());
  }
  return map;
}

const variables = variableMap(css);

function resolve(name, seen = new Set()) {
  assert.ok(variables.has(name), "Unknown variable: " + name);
  assert.equal(seen.has(name), false, "Circular variable: " + name);
  seen.add(name);
  const value = variables.get(name);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref ? resolve(ref[1], seen) : value;
}

function rgb(hex) {
  const clean = hex.replace("#", "");
  assert.ok(
    clean.length === 6,
    "Contrast certification requires 6-digit hex: " + hex
  );
  return [0, 2, 4].map(
    (offset) => parseInt(clean.slice(offset, offset + 2), 16) / 255
  );
}

function luminance(hex) {
  const channel = (value) =>
    value <= .04045
      ? value / 12.92
      : ((value + .055) / 1.055) ** 2.4;
  const [r, g, b] = rgb(hex).map(channel);
  return .2126 * r + .7152 * g + .0722 * b;
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + .05) / (low + .05);
}

const canvas = resolve("--color-canvas");
const surface = resolve("--color-surface-1");

for (const token of [
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary"
]) {
  const value = resolve(token);
  assert.ok(
    contrast(value, canvas) >= 4.5,
    token + " must meet 4.5:1 against canvas"
  );
  assert.ok(
    contrast(value, surface) >= 4.5,
    token + " must meet 4.5:1 against surface 1"
  );
}

const forbiddenPhaseCss = fs.readdirSync(".").filter((name) => {
  const match = /^phase(\d+)\.css$/.exec(name);
  return match && Number(match[1]) >= 15;
});
assert.deepEqual(forbiddenPhaseCss, []);

console.log(
  "Design System V2 certification passed",
  JSON.stringify({
    inventoryGroups: Object.keys(inventory.semanticGroups).length,
    requiredTokens: requiredTokens.length
  })
);
