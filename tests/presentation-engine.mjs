import assert from "node:assert/strict";
import {
  normalizeExperienceSettings,
  shouldReduceMotion,
  effectiveEffectsLevel,
  presentationPlan,
  hapticPattern
} from "../src/presentation-engine.js";

{
  const settings = normalizeExperienceSettings({});
  assert.equal(settings.presentation.mode, "normal");
  assert.equal(settings.presentation.effects, "auto");
  assert.equal(settings.presentation.sound, true);
  assert.equal(settings.presentation.haptics, "standard");
  assert.equal(settings.presentation.motion, "system");
}

{
  const settings = normalizeExperienceSettings({
    sound: false,
    motion: "reduced"
  });
  assert.equal(settings.presentation.sound, false);
  assert.equal(settings.presentation.motion, "reduced");
  assert.equal(shouldReduceMotion(settings, false), true);
}

{
  assert.equal(
    effectiveEffectsLevel(
      { presentation: { effects: "auto" } },
      { hardwareConcurrency: 2, deviceMemory: 2, reducedMotion: false }
    ),
    "low"
  );
  assert.equal(
    effectiveEffectsLevel(
      { presentation: { effects: "auto" } },
      { hardwareConcurrency: 8, deviceMemory: 8, reducedMotion: false }
    ),
    "high"
  );
}

{
  const normal = presentationPlan({
    toolId: "wheel",
    settings: { presentation: { mode: "normal", effects: "high" } },
    capabilities: { reducedMotion: false }
  });
  assert.equal(normal.kind, "wheel");
  assert.equal(normal.duration, 1750);
  assert.ok(normal.particles > 0);
  assert.ok(normal.tickMs > 0);

  const instant = presentationPlan({
    toolId: "wheel",
    settings: { presentation: { mode: "instant", effects: "high" } },
    capabilities: { reducedMotion: false }
  });
  assert.equal(instant.duration, 0);
  assert.equal(instant.tickMs, 0);
}

{
  const reduced = presentationPlan({
    toolId: "teams",
    settings: {
      presentation: {
        mode: "showtime",
        effects: "high",
        motion: "reduced"
      }
    },
    capabilities: { reducedMotion: false }
  });
  assert.equal(reduced.kind, "fade");
  assert.equal(reduced.duration, 180);
  assert.equal(reduced.particles, 0);
}

{
  const winner = presentationPlan({
    toolId: "elimination",
    result: { winner: "Anna" },
    settings: {
      presentation: {
        mode: "showtime",
        effects: "high",
        motion: "full"
      }
    }
  });
  assert.equal(winner.celebration, true);
  assert.equal(winner.cue, "winner");
  assert.ok(winner.duration >= 2200);
}

assert.deepEqual(hapticPattern("coin", "off"), []);
assert.ok(hapticPattern("winner", "strong")[0] > hapticPattern("winner", "light")[0]);

console.log("Presentation engine certification tests passed.");
