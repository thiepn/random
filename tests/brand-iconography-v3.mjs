import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CATEGORIES,
  TOOLS
} from "../src/registry.js";
import {
  ICON_DEFINITIONS,
  TOOL_ICON_IDS,
  CATEGORY_ICON_IDS,
  NAV_ICON_IDS,
  hasIcon
} from "../src/icon-system.js";

const app = fs.readFileSync("src/app.js", "utf8");
const css = fs.readFileSync("brand-icons.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
const pwaIcon = fs.readFileSync("icon.svg", "utf8");
const catalog = JSON.parse(
  fs.readFileSync("docs/design/icon-catalog-v3.json", "utf8")
);

assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.grid, 24);
assert.equal(catalog.strokeWidth, 1.8);
assert.equal(catalog.colorModel, "currentColor");

assert.equal(TOOLS.length, 25);
assert.equal(TOOL_ICON_IDS.length, 25);
assert.equal(new Set(TOOL_ICON_IDS).size, 25);

for (const tool of TOOLS) {
  assert.equal(
    tool.iconId,
    tool.id,
    "Built-in tool iconId should remain stable: " + tool.id
  );
  assert.ok(
    hasIcon(tool.iconId),
    "Missing SVG definition for built-in tool: " + tool.id
  );
  assert.equal(
    catalog.tools[tool.id],
    tool.iconId,
    "Catalog tool icon mismatch: " + tool.id
  );
}

assert.equal(CATEGORIES.length, 4);
assert.equal(CATEGORY_ICON_IDS.length, 4);

for (const category of CATEGORIES) {
  assert.ok(
    category.iconId,
    "Category must define iconId: " + category.id
  );
  assert.ok(
    hasIcon(category.iconId),
    "Missing category SVG: " + category.id
  );
  assert.equal(
    catalog.categories[category.id],
    category.iconId
  );
}

for (const iconId of NAV_ICON_IDS) {
  assert.ok(hasIcon(iconId), "Missing nav icon: " + iconId);
}

for (const required of [
  "brand",
  "settings",
  "back",
  "search",
  "star",
  "star-filled",
  "template",
  "lock",
  "input",
  "branch",
  "output"
]) {
  assert.ok(hasIcon(required), "Missing shared icon: " + required);
}

const allowedTags = new Set([
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon"
]);
const forbiddenAttrs = new Set([
  "href",
  "xlink:href",
  "style",
  "src",
  "srcdoc",
  "onload",
  "onclick",
  "onerror"
]);

for (const [name, definition] of Object.entries(ICON_DEFINITIONS)) {
  assert.ok(
    Array.isArray(definition) && definition.length > 0,
    "Icon must contain geometry: " + name
  );
  assert.ok(
    definition.length <= 12,
    "Icon geometry is too complex: " + name
  );

  for (const part of definition) {
    assert.ok(
      allowedTags.has(part.tag),
      "Unsupported SVG primitive in " + name + ": " + part.tag
    );
    for (const key of Object.keys(part.attrs || {})) {
      assert.equal(
        key.toLowerCase().startsWith("on"),
        false,
        "Event handler attributes are forbidden: " + name
      );
      assert.equal(
        forbiddenAttrs.has(key.toLowerCase()),
        false,
        "Unsafe SVG attribute in " + name + ": " + key
      );
    }
  }
}

assert.match(
  fs.readFileSync("src/icon-system.js", "utf8"),
  /viewBox:\s*"0 0 24 24"/
);
assert.match(
  fs.readFileSync("src/icon-system.js", "utf8"),
  /stroke:\s*"currentColor"/
);
assert.match(
  fs.readFileSync("src/icon-system.js", "utf8"),
  /"stroke-width":\s*"1\.8"/
);

assert.equal(
  /https?:\/\//i.test(css),
  false,
  "Brand CSS must not use remote assets."
);
assert.equal(
  /url\(/i.test(css),
  false,
  "Brand CSS must not introduce runtime image dependencies."
);

assert.ok(index.includes("./brand-icons.css"));
assert.ok(
  index.indexOf("./brand-icons.css") > index.indexOf("./phase14.css"),
  "Brand icon styles should load after legacy phase styles."
);
assert.ok(sw.includes('"./brand-icons.css"'));
assert.ok(sw.includes('"./src/icon-system.js"'));
assert.ok(sw.includes('"./assets/brand/random-spark-mark.svg"'));
assert.ok(index.includes("./assets/brand/random-spark-mark.svg"));
assert.equal(
  index.includes('<div class="brand-mark" aria-hidden="true">✦</div>'),
  false,
  "Boot screen must not fall back to the legacy spark glyph."
);

for (const marker of [
  'visualToolIcon(tool, "tool-icon")',
  'iconNode("brand"',
  'iconNode("search"',
  'iconNode("settings")',
  'visualToolIcon(tool, "tool-symbol")',
  'visualToolIcon(tool, "party-tool-icon")'
]) {
  assert.ok(
    app.includes(marker),
    "Primary rendering path missing SVG usage: " + marker
  );
}

assert.equal(
  app.includes('class: "tool-icon", text: tool.icon'),
  false,
  "Built-in tool cards must not render registry Unicode icons."
);
assert.equal(
  app.includes('class: "tool-symbol",\n      text: tool.icon'),
  false,
  "Tool headers must not render registry Unicode icons."
);

assert.match(pwaIcon, /viewBox="0 0 512 512"/);
assert.match(pwaIcon, /<rect width="512" height="512" rx="148"/);
assert.match(pwaIcon, /x="82" y="82" width="348" height="348"/);
assert.doesNotMatch(pwaIcon, /<script|<foreignObject|href=/i);

assert.ok(
  fs.existsSync("assets/brand/random-spark-mark.svg"),
  "Reusable Random Spark brand mark is missing."
);

console.log(
  "Brand and iconography V3 certification passed",
  JSON.stringify({
    icons: Object.keys(ICON_DEFINITIONS).length,
    tools: TOOLS.length,
    categories: CATEGORIES.length
  })
);
