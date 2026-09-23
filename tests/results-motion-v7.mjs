import assert from "node:assert/strict";
import fs from "node:fs";
import {
  presentationPlan,
  normalizeExperienceSettings
} from "../src/presentation-engine.js";

const app=fs.readFileSync("src/app.js","utf8");
const css=fs.readFileSync("phase7.css","utf8");
const legacy=fs.readFileSync("styles.css","utf8");

const settings=normalizeExperienceSettings({
  presentation:{mode:"normal",effects:"high",sound:true,haptics:"standard",motion:"full"}
});
const wheel=presentationPlan({
  toolId:"wheel",settings,
  capabilities:{reducedMotion:false,hardwareConcurrency:8,deviceMemory:8}
});
assert.equal(wheel.anticipationMs+wheel.revealMs+wheel.settleMs,wheel.duration);
assert.equal(wheel.activeMs,wheel.anticipationMs+wheel.revealMs);
assert.ok(wheel.impactMs>wheel.anticipationMs);
assert.ok(wheel.cueAtMs<=wheel.hapticAtMs);
assert.ok(wheel.tickSchedule.length>=8);
for(let i=2;i<wheel.tickSchedule.length;i++){
  const previous=wheel.tickSchedule[i-1]-wheel.tickSchedule[i-2];
  const current=wheel.tickSchedule[i]-wheel.tickSchedule[i-1];
  assert.ok(current>=previous-2,"Wheel tick schedule must decelerate.");
}

const reduced=presentationPlan({
  toolId:"dice",
  settings:{presentation:{mode:"showtime",effects:"high",motion:"reduced"}},
  capabilities:{reducedMotion:false}
});
assert.equal(reduced.duration,180);
assert.equal(reduced.sourceKind,"dice");
assert.equal(reduced.anticipationMs,0);
assert.equal(reduced.revealMs,120);
assert.equal(reduced.settleMs,60);
assert.equal(reduced.particles,0);
assert.deepEqual(reduced.tickSchedule,[]);

for(const marker of [
  "presentationFeedbackTimers",
  "scheduleFeedback(plan.cueAtMs",
  "scheduleFeedback(plan.hapticAtMs",
  "plan.tickSchedule.map",
  "ts.presentation?.kind === \"wheel\"",
  '"--anticipation-duration"',
  '"--reveal-duration"',
  '"--settle-duration"',
  '"--impact-delay"',
  '" motion-v2"',
  "result-commit-chip"
]){
  assert.ok(app.includes(marker),"Missing V7 runtime marker: "+marker);
}

assert.equal(
  app.includes("setInterval(() => {\n      playWheelTick"),
  false,
  "Wheel presentation must not use constant-interval ticking."
);

const runToolStart=app.indexOf("async function runTool(id) {");
const runToolEnd=app.indexOf("\nfunction finishAnimation(",runToolStart);
assert.ok(runToolStart>=0 && runToolEnd>runToolStart);
const runToolSource=app.slice(runToolStart,runToolEnd);
assert.ok(
  runToolSource.indexOf("await commitRunAndSession({")
    < runToolSource.indexOf("const plan = beginPresentation("),
  "Run must remain committed before V7 presentation begins."
);

for(const marker of [
  "stageEnvelope","stageImpactHalo","resultReveal","resultShowtime",
  "coinFaceInk","diceFaceInk","wheelPointerFeel","physicalCardDraw",
  "teamReveal","winnerImpact","reducedReveal","commitImpact"
]){
  assert.ok(css.includes(marker),"Missing V7 motion primitive: "+marker);
}

assert.ok(css.includes("calc(var(--impact-delay) - 100ms"));
assert.ok(css.includes(".tool-stage.is-reduced-reveal *"));
assert.ok(
  legacy.includes("*:not(.is-reduced-reveal):not(.is-reduced-reveal *)"),
  "Global reduced-motion rule must preserve V7 opacity reveal."
);
assert.ok(
  fs.statSync("phase7.css").size<=15000,
  "V7 presentation CSS exceeded 15 KB."
);

console.log("Results / Motion V7 certification passed",JSON.stringify({
  wheelTicks:wheel.tickSchedule.length,
  cssBytes:fs.statSync("phase7.css").size
}));
