import assert from "node:assert/strict";
import fs from "node:fs";

const baselinePath = "docs/design/visual-baseline.json";
const auditPath = "docs/design/V1-VISUAL-AUDIT.md";
const contractPath = "docs/design/REDESIGN-CONTRACT.md";

for (const path of [baselinePath, auditPath, contractPath]) {
  assert.ok(fs.existsSync(path), "Missing V1 design artifact: " + path);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const audit = fs.readFileSync(auditPath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");
const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");

assert.equal(baseline.schemaVersion, 1);
assert.equal(baseline.baselineRelease, "1.0.0");
assert.equal(baseline.product.builtInTools, 25);
assert.equal(baseline.product.categories, 4);
assert.equal(baseline.product.primaryViews.length, 11);
assert.equal(
  baseline.targetDirection.name,
  "Expressive Utility Arcade"
);

for (const metric of [
  "hexColorOccurrences",
  "rgbOrRgbaOccurrences",
  "borderRadiusDeclarations",
  "borderDeclarations",
  "gradientOccurrences",
  "mediaQueryBlocks",
  "keyframeBlocks"
]) {
  assert.ok(
    Number.isSafeInteger(baseline.cssBaseline[metric])
      && baseline.cssBaseline[metric] > 0,
    "Missing/invalid CSS baseline metric: " + metric
  );
}

for (const viewport of [
  "small-mobile",
  "mobile",
  "large-mobile",
  "mobile-landscape",
  "tablet",
  "tablet-landscape",
  "desktop",
  "desktop-large",
  "desktop-wide"
]) {
  assert.ok(
    baseline.requiredViewports.some((item) => item.name === viewport),
    "Missing required redesign viewport: " + viewport
  );
}

for (const state of [
  "default",
  "hover",
  "focus-visible",
  "pressed",
  "selected",
  "disabled",
  "loading",
  "empty",
  "error",
  "offline",
  "reduced-motion",
  "higher-contrast"
]) {
  assert.ok(
    baseline.requiredInteractionStates.includes(state),
    "Missing required interaction state: " + state
  );
}

for (const required of [
  "Ranked visual problems",
  "Art-direction exploration",
  "Expressive Utility Arcade",
  "Surface audit",
  "Responsive verification matrix",
  "Exit criteria for V1"
]) {
  assert.ok(
    audit.includes(required),
    "Visual audit is missing required section: " + required
  );
}

for (const required of [
  "No phase-CSS proliferation",
  "Token-first rule",
  "Hierarchy before decoration",
  "Play vs workbench modes",
  "Responsive contract",
  "Interaction-state contract",
  "Motion contract",
  "Accessibility contract",
  "Performance contract",
  "Data/privacy contract",
  "State preservation",
  "Screenshot and browser QA contract"
]) {
  assert.ok(
    contract.includes(required),
    "Redesign contract is missing rule: " + required
  );
}

const forbiddenPhaseCss = fs.readdirSync(".").filter((name) => {
  const match = /^phase(\d+)\.css$/.exec(name);
  return match && Number(match[1]) >= 15;
});
assert.deepEqual(
  forbiddenPhaseCss,
  [],
  "Do not add new chronological phase CSS files; use semantic redesign styles"
);

assert.ok(
  ci.includes("Visual redesign contract certification"),
  "CI must certify the V1 redesign contract"
);

console.log(
  "visual redesign contract certification passed",
  JSON.stringify({
    direction: baseline.targetDirection.name,
    viewports: baseline.requiredViewports.length,
    interactionStates: baseline.requiredInteractionStates.length
  })
);
