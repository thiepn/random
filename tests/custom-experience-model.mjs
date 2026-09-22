import assert from "node:assert/strict";
import {
  createCustomExperience,
  updateCustomExperience,
  publishCustomExperience,
  validateCustomExperience,
  exportCustomExperience,
  importCustomExperience,
  customToolId,
  customIdFromToolId,
  experienceAsTool
} from "../src/custom-experience-model.js";

{
  const experience = createCustomExperience({
    name: "Dinner Wheel",
    primitive: "pick",
    config: {
      entries: [
        { label: "Pizza", weight: 1 },
        { label: "Sushi", weight: 3 }
      ]
    },
    appearance: {
      accent: "gold",
      layout: "wheel",
      actionLabel: "SPIN"
    }
  });

  assert.equal(experience.status, "draft");
  assert.equal(experience.config.entries[1].weight, 3);
  assert.equal(experience.appearance.layout, "wheel");

  const published = publishCustomExperience(experience);
  assert.equal(published.status, "published");
  assert.equal(published.revision, 2);

  const updated = updateCustomExperience(published, {
    favorite: true
  });
  assert.equal(updated.favorite, true);
  assert.equal(updated.revision, 3);

  const tool = experienceAsTool(updated);
  assert.equal(tool.custom, true);
  assert.equal(customIdFromToolId(tool.id), updated.id);
  assert.equal(customToolId(updated.id), tool.id);
}

{
  const compound = createCustomExperience({
    name: "Quest Generator",
    primitive: "compound",
    config: {
      steps: [
        {
          id: "hero",
          name: "Hero",
          primitive: "pick",
          config: {
            entries: ["Wizard", "Rogue"]
          }
        },
        {
          id: "reward",
          name: "Reward",
          primitive: "pick",
          input: {
            kind: "step",
            stepId: "hero"
          },
          config: {
            source: "prompt"
          }
        }
      ],
      finalStepId: "reward"
    }
  });
  assert.equal(compound.config.steps.length, 2);
}

assert.equal(
  validateCustomExperience({
    name: "Bad Cycle",
    primitive: "compound",
    config: {
      steps: [
        {
          id: "a",
          primitive: "pick",
          input: { kind: "step", stepId: "b" },
          config: { entries: ["A"] }
        },
        {
          id: "b",
          primitive: "pick",
          config: { entries: ["B"] }
        }
      ]
    }
  }).valid,
  false
);

assert.equal(
  validateCustomExperience({
    name: "Unsafe",
    primitive: "pick",
    config: {
      entries: ["A", "B"]
    },
    html: "<img src=x>"
  }).valid,
  false
);

{
  const safe = createCustomExperience({
    name: "Lookup",
    primitive: "table",
    config: {
      rows: [
        { label: "Common", value: "1 coin", weight: 8 },
        { label: "Rare", value: "10 coins", weight: 1 }
      ]
    }
  });
  const exported = exportCustomExperience(safe);
  const imported = importCustomExperience(exported);
  assert.equal(imported.status, "draft");
  assert.notEqual(imported.id, safe.id);
  assert.equal(imported.primitive, "table");
}

assert.throws(
  () => importCustomExperience(JSON.stringify({
    type: "randomizer-arcade-custom-experience",
    version: 1,
    experience: {
      name: "Attack",
      primitive: "pick",
      config: { entries: ["A"] },
      onClick: "javascript:alert(1)"
    }
  })),
  /not allowed/
);

console.log("Custom Experience model certification tests passed.");
