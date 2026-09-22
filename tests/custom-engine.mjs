import assert from "node:assert/strict";
import { SeededRandom } from "../src/random-core.js";
import { createCustomExperience } from "../src/custom-experience-model.js";
import {
  executeCustomExperience,
  customResultItems
} from "../src/custom-engine.js";

{
  const wheel = createCustomExperience({
    name: "Weighted",
    primitive: "pick",
    config: {
      entries: [
        { label: "Never", weight: 0 },
        { label: "Always", weight: 1 }
      ]
    }
  });
  const result = executeCustomExperience(
    wheel,
    {},
    new SeededRandom("custom-pick")
  );
  assert.equal(result.result, "Always");
  assert.equal(result.fairness.eligibleCount, 1);
}

{
  const dice = createCustomExperience({
    name: "Mood Die",
    primitive: "faces",
    config: {
      faces: ["Happy", "Calm", "Wild"],
      count: 4
    }
  });
  const result = executeCustomExperience(
    dice,
    {},
    new SeededRandom("faces")
  );
  assert.equal(result.result.length, 4);
  assert.ok(result.result.every((face) =>
    ["Happy", "Calm", "Wild"].includes(face)
  ));
}

{
  const deck = createCustomExperience({
    name: "Deck",
    primitive: "deck",
    config: {
      cards: ["A", "B", "C", "D"],
      drawCount: 3
    }
  });
  const result = executeCustomExperience(
    deck,
    {},
    new SeededRandom("deck")
  );
  assert.equal(result.result.cards.length, 3);
  assert.equal(new Set(result.result.cards).size, 3);
  assert.equal(result.result.remaining, 1);
}

{
  const prompt = createCustomExperience({
    name: "Prompt Picker",
    primitive: "pick",
    config: {
      source: "prompt"
    }
  });
  const result = executeCustomExperience(
    prompt,
    { inputItems: ["Anna", "Ben", "Cara"] },
    new SeededRandom("prompt")
  );
  assert.ok(["Anna", "Ben", "Cara"].includes(result.result));
}

{
  const compound = createCustomExperience({
    name: "Compound",
    primitive: "compound",
    config: {
      steps: [
        {
          id: "roll",
          name: "Roll",
          primitive: "number",
          config: {
            min: 1,
            max: 6,
            count: 1
          }
        },
        {
          id: "echo",
          name: "Echo",
          primitive: "pick",
          input: {
            kind: "step",
            stepId: "roll"
          },
          config: {
            source: "prompt"
          }
        }
      ],
      finalStepId: "echo"
    }
  });
  const result = executeCustomExperience(
    compound,
    {},
    new SeededRandom("compound")
  );
  assert.equal(result.result.steps.length, 2);
  assert.equal(result.result.items.length, 1);
}

{
  const table = createCustomExperience({
    name: "Table",
    primitive: "table",
    config: {
      rows: [
        { label: "Zero", value: "No", weight: 0 },
        { label: "One", value: "Yes", weight: 1 }
      ]
    }
  });
  const result = executeCustomExperience(
    table,
    {},
    new SeededRandom("table")
  );
  assert.equal(result.result.value, "Yes");
  assert.deepEqual(customResultItems(result.result), ["Yes"]);
}

console.log("Custom Experience engine certification tests passed.");
