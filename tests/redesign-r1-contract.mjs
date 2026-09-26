import assert from "node:assert/strict";
import fs from "node:fs";

const read=(file)=>fs.readFileSync(file,"utf8");
const baseline=JSON.parse(read("docs/redesign/r1-visual-baseline.json"));
const audit=read("docs/redesign/R1-VISUAL-AUDIT-ART-DIRECTION.md");
const readme=read("README.md");
const ci=read(".github/workflows/ci.yml");

assert.equal(baseline.schemaVersion,1);
assert.equal(baseline.phase,"R1");
assert.equal(baseline.status,"locked");
assert.equal(baseline.baselineVersion,"1.1.0");
assert.equal(baseline.targetRelease,"1.2.0");
assert.equal(baseline.selectedDirection.id,"tactile-chance-arcade");
assert.equal(baseline.selectedDirection.name,"Tactile Chance Arcade");

for(const key of [
  "object-before-container",
  "one-focal-point",
  "motion-uses-verbs",
  "shell-stays-quiet",
  "light-is-authored",
  "reduced-motion-is-designed",
  "replace-and-consolidate-before-layering",
  "performance-is-visual-quality"
]){
  assert.ok(baseline.laws.includes(key),"Missing R1 design law: "+key);
}

assert.deepEqual(baseline.implementationPhases,["R2","R3","R4","R5","R6","R7","R8"]);
assert.ok(baseline.priorities.P0.includes("coin"));
assert.ok(baseline.priorities.P0.includes("dice"));
assert.ok(baseline.priorities.P0.includes("wheel"));
assert.ok(baseline.priorities.P0.includes("cards"));

for(const marker of [
  "# R1 — Visual Audit & Art Direction Lock",
  "Selected direction: **Tactile Chance Arcade**",
  "The app is the cabinet. Each randomizer is a machine or physical chance object.",
  "# Non-negotiable design laws",
  "# Explicitly forbidden patterns",
  "# Surface priority",
  "# R2–R8 implementation sequence",
  "no production UI/CSS/interaction changes"
]){
  assert.ok(audit.includes(marker),"Missing R1 audit contract: "+marker);
}

assert.ok(
  readme.includes("v1.2 experience redesign"),
  "README must retain the v1.2 redesign section in either active or released lifecycle state."
);
assert.ok(readme.includes("R1 Visual Audit & Art Direction Lock"));
assert.ok(ci.includes("R1 Visual Audit & Art Direction Lock certification"));

console.log("R1 visual audit and art-direction lock certification passed",JSON.stringify({
  direction:baseline.selectedDirection.name,
  baselineVersion:baseline.baselineVersion,
  targetRelease:baseline.targetRelease,
  laws:baseline.laws.length,
  forbidden:baseline.forbiddenPatterns.length
}));
