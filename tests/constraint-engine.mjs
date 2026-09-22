import assert from "node:assert/strict";
import { SeededRandom } from "../src/random-core.js";
import { createRule } from "../src/rule-model.js";
import {
  solveGrouping,
  solveSecretSanta,
  historyPairKey
} from "../src/constraint-engine.js";

const items = [
  { id: "a", label: "Anna", tags: ["leader"], values: { skill: 5 } },
  { id: "b", label: "Ben", tags: ["member"], values: { skill: 2 } },
  { id: "c", label: "Cara", tags: ["leader"], values: { skill: 4 } },
  { id: "d", label: "Dan", tags: ["member"], values: { skill: 1 } }
];
const fields = [{ id: "skill", name: "Skill", type: "number" }];
const targets = [
  { id: "t1", label: "Team 1", capacity: 2 },
  { id: "t2", label: "Team 2", capacity: 2 }
];

function targetOf(result, itemId) {
  for (const group of result.groups) {
    if (group.items.some((item) => item.id === itemId)) return group.target.id;
  }
  return null;
}

{
  const result = solveGrouping({
    toolId: "teams",
    items,
    targets,
    fields,
    rules: [
      createRule("together", { itemIds: ["a", "b"] }),
      createRule("apart", { itemIds: ["a", "c"] })
    ],
    rng: new SeededRandom("solver-together")
  });
  assert.equal(result.status, "ok");
  assert.equal(targetOf(result, "a"), targetOf(result, "b"));
  assert.notEqual(targetOf(result, "a"), targetOf(result, "c"));
}

{
  const result = solveGrouping({
    toolId: "teams",
    items,
    targets,
    fields,
    rules: [
      createRule("fixed", { itemId: "a", targetId: "t2" }),
      createRule("requiredTag", { tag: "leader", count: 1 }),
      createRule("maxTag", { tag: "leader", count: 1 })
    ],
    rng: new SeededRandom("solver-tags")
  });
  assert.equal(result.status, "ok");
  assert.equal(targetOf(result, "a"), "t2");
  for (const group of result.groups) {
    assert.equal(group.items.filter((item) => item.tags.includes("leader")).length, 1);
  }
}

{
  const result = solveGrouping({
    toolId: "teams",
    items,
    targets,
    fields,
    rules: [
      createRule("balanceField", { fieldId: "skill" }, { strength: "soft", priority: 20 })
    ],
    effort: "thorough",
    rng: new SeededRandom("solver-balance")
  });
  assert.equal(result.status, "ok");
  const sums = result.groups.map((group) =>
    group.items.reduce((sum, item) => sum + item.values.skill, 0)
  );
  assert.ok(Math.abs(sums[0] - sums[1]) <= 2);
}

{
  const history = new Set([historyPairKey("Anna", "Ben")]);
  const result = solveGrouping({
    toolId: "pairs",
    items,
    targets,
    fields,
    rules: [
      createRule("historyAvoid", { depth: 5 }, { strength: "soft", priority: 100 })
    ],
    historyPairs: history,
    effort: "thorough",
    rng: new SeededRandom("solver-history")
  });
  assert.equal(result.status, "ok");
  const together = result.groups.some((group) => {
    const labels = group.items.map((item) => item.label);
    return labels.includes("Anna") && labels.includes("Ben");
  });
  assert.equal(together, false);
}

{
  const history = new Set([historyPairKey("Anna", "Ben")]);
  const result = solveGrouping({
    toolId: "pairs",
    items,
    targets,
    fields,
    rules: [
      createRule("historyAvoid", { depth: 5 }, { strength: "hard" })
    ],
    historyPairs: history,
    effort: "thorough",
    rng: new SeededRandom("solver-history-hard")
  });
  assert.equal(result.status, "ok");
  const together = result.groups.some((group) => {
    const labels = group.items.map((item) => item.label);
    return labels.includes("Anna") && labels.includes("Ben");
  });
  assert.equal(together, false);
}

{
  const result = solveGrouping({
    toolId: "teams",
    items,
    targets,
    fields,
    rules: [
      createRule("together", { itemIds: ["a", "b"] }),
      createRule("apart", { itemIds: ["a", "b"] })
    ],
    rng: new SeededRandom("solver-impossible")
  });
  assert.equal(result.status, "impossible");
}

{
  const result = solveGrouping({
    toolId: "teams",
    items,
    targets,
    fields,
    rules: [
      createRule("together", { itemIds: ["a", "b"] }),
      createRule("historyAvoid", { depth: 5 }, { strength: "hard" })
    ],
    historyPairs: new Set([historyPairKey("Anna", "Ben")]),
    rng: new SeededRandom("solver-history-conflict")
  });
  assert.equal(result.status, "impossible");
  assert.ok(result.errors.some((error) => error.code === "TOGETHER_HISTORY_CONFLICT"));
}

{
  const result = solveSecretSanta({
    items,
    rules: [
      createRule("apart", { itemIds: ["a", "b"] }),
      createRule("fixed", { itemId: "c", targetId: "a" })
    ],
    rng: new SeededRandom("secret-rules")
  });
  assert.equal(result.status, "ok");
  const map = new Map(
    result.assignments.map((entry) => [entry.giver.id, entry.receiver.id])
  );
  assert.notEqual(map.get("a"), "a");
  assert.notEqual(map.get("b"), "b");
  assert.notEqual(map.get("a"), "b");
  assert.notEqual(map.get("b"), "a");
  assert.equal(map.get("c"), "a");
}

console.log("Constraint engine certification tests passed.");
