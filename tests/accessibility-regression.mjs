import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("src/app.js", "utf8");
const css = fs.readFileSync("phase14.css", "utf8");

assert.ok(
  index.includes('class="skip-link" href="#main-content"'),
  "A keyboard skip link must target the dynamic main landmark."
);
assert.ok(
  index.includes('role="status"') && index.includes('id="announcer"'),
  "The announcement region must expose status semantics."
);
assert.equal(
  /user-scalable\s*=\s*no/i.test(index),
  false,
  "The viewport must not disable browser zoom."
);
assert.ok(
  index.includes('./phase14.css'),
  "Phase 14 styles must load from index.html."
);

for (const required of [
  "finalizeModalAccessibility",
  'role: "dialog"',
  '"aria-modal": "true"',
  'modal.setAttribute("aria-labelledby"',
  'root.toggleAttribute("inert"',
  'main.id = "main-content"',
  'root.setAttribute("aria-busy"',
  'button.setAttribute(\n      "aria-pressed"',
  'tabindex: "0"',
  'event.key === "Enter" || event.key === " "'
]) {
  assert.ok(
    app.includes(required),
    "Missing accessibility interaction contract: " + required
  );
}

assert.equal(
  app.includes("new Intl.DateTimeFormat(undefined"),
  false,
  "Date formatting must honor the selected regional format."
);
assert.equal(
  app.includes('behavior: "smooth"'),
  false,
  "Navigation scrolling must respect reduced-motion preferences."
);
assert.equal(
  app.includes("Math.random"),
  false,
  "Accessibility IDs must not introduce Math.random."
);


for (const label of [
  '"aria-label": "Open settings"',
  '"Unpin History group"',
  '"Favorite creation"',
  '"Remove compound step "',
  '"Remove template step "'
]) {
  assert.ok(
    app.includes(label),
    "Icon-only interaction requires a spoken label: " + label
  );
}

assert.ok(
  app.includes("localizedNumberResultValues"),
  "Number-tool presentation must use the selected regional format."
);

for (const required of [
  ".skip-link",
  '[data-contrast="more"]',
  '[data-control-size="large"]',
  "@media (pointer:coarse)",
  "@media (forced-colors:active)",
  "@media (prefers-reduced-motion:reduce)"
]) {
  assert.ok(
    css.includes(required),
    "Missing Phase 14 CSS contract: " + required
  );
}

console.log("accessibility interaction regression tests passed");
