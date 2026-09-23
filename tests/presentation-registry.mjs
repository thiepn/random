import assert from "node:assert/strict";
import { TOOLS } from "../src/registry.js";
import {
  presentationPlan,
  normalizeExperienceSettings
} from "../src/presentation-engine.js";

const modes = ["instant", "normal", "showtime"];

for (const tool of TOOLS) {
  for (const mode of modes) {
    const settings = normalizeExperienceSettings({
      presentation: {
        mode,
        effects: "high",
        sound: true,
        haptics: "standard",
        motion: "full"
      }
    });

    const plan = presentationPlan({
      toolId: tool.id,
      settings,
      result: tool.id === "elimination"
        ? { winner: "Winner" }
        : null,
      capabilities: {
        reducedMotion: false,
        hardwareConcurrency: 8,
        deviceMemory: 8
      }
    });

    assert.equal(plan.toolId, tool.id);
    assert.equal(plan.mode, mode);
    assert.ok(Number.isFinite(plan.duration));
    assert.ok(plan.duration >= 0);
    assert.equal(
      plan.anticipationMs + plan.revealMs + plan.settleMs,
      plan.duration
    );
    assert.equal(plan.activeMs, plan.anticipationMs + plan.revealMs);
    assert.ok(plan.impactMs >= 0);
    assert.ok(plan.impactMs <= plan.duration);
    assert.ok(Array.isArray(plan.tickSchedule));

    if (mode === "instant") {
      assert.equal(plan.duration, 0);
      assert.equal(plan.particles, 0);
    } else {
      assert.ok(plan.duration > 0);
    }
  }

  const reduced = presentationPlan({
    toolId: tool.id,
    settings: {
      presentation: {
        mode: "showtime",
        effects: "high",
        sound: true,
        haptics: "standard",
        motion: "reduced"
      }
    },
    capabilities: { reducedMotion: false }
  });

  assert.equal(reduced.kind, "fade");
  assert.equal(reduced.particles, 0);
}

const privatePlan = presentationPlan({
  toolId: "secret-santa",
  settings: {
    presentation: {
      mode: "showtime",
      effects: "high",
      sound: true,
      haptics: "standard",
      motion: "full"
    }
  }
});
assert.equal(privatePlan.particles, 0);

console.log("Presentation registry certification tests passed.");
