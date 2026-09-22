import assert from "node:assert/strict";
import {
  createPreset,
  createInputBinding,
  resolvePresetInput,
  createRuleSet,
  inferRuleSetScope,
  ruleSetCompatible
} from "../src/preset-model.js";

{
  const preset = createPreset({
    name: "Weighted Dinner",
    toolId: "wheel",
    inputBinding: {
      mode: "frozen",
      items: [
        { id: "a", label: "Pizza", weight: 1 },
        { id: "b", label: "Sushi", weight: 3 }
      ]
    },
    configSnapshot: { selectionEntries: [] },
    favorite: true
  });

  assert.equal(preset.favorite, true);
  assert.equal(preset.inputBinding.mode, "frozen");
  assert.equal(preset.inputBinding.items[1].weight, 3);
}

{
  const binding = createInputBinding({
    mode: "live-view",
    poolId: "p",
    viewId: "v"
  });
  assert.equal(binding.poolId, "p");
  assert.equal(binding.viewId, "v");
}

{
  const preset = createPreset({
    name: "Live",
    toolId: "picker",
    inputBinding: { mode: "live-pool", poolId: "p1" }
  });
  const pool = { id: "p1", name: "People" };
  const result = resolvePresetInput(preset, {
    pools: [pool],
    views: [],
    createWorkingSet: (source) => ({
      source: { poolId: source.id },
      fields: [],
      items: [{ id: "a", label: "Anna" }]
    })
  });
  assert.equal(result.workingSet.items[0].label, "Anna");
}

assert.equal(
  inferRuleSetScope([
    { type: "capacity" },
    { type: "requiredTag" }
  ]),
  "portable"
);
assert.equal(
  inferRuleSetScope(
    [{ type: "capacity" }],
    "pool-1"
  ),
  "portable"
);
assert.equal(
  inferRuleSetScope([{ type: "apart" }], "pool-1"),
  "pool"
);

{
  const set = createRuleSet({
    name: "Balanced Leaders",
    toolId: "teams",
    sourcePoolId: "pool-1",
    rules: [{ id: "r1", type: "balanceField", params: { fieldId: "skill" } }]
  });
  assert.equal(set.scope, "pool");
  assert.equal(
    ruleSetCompatible(set, {
      toolId: "teams",
      sourcePoolId: "pool-1"
    }),
    true
  );
  assert.equal(
    ruleSetCompatible(set, {
      toolId: "teams",
      sourcePoolId: "pool-2"
    }),
    false
  );
}

console.log("Preset and Rule Set certification tests passed.");
