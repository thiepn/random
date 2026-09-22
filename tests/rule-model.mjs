import assert from "node:assert/strict";
import {
  createRule,
  normalizeRules,
  ruleTypesForTool,
  validateRules,
  summarizeRule
} from "../src/rule-model.js";

const items = [
  { id: "a", label: "Anna", tags: ["leader"], values: { skill: 5 } },
  { id: "b", label: "Ben", tags: ["member"], values: { skill: 2 } },
  { id: "c", label: "Cara", tags: ["leader"], values: { skill: 4 } },
  { id: "d", label: "Dan", tags: ["member"], values: { skill: 1 } }
];
const targets = [
  { id: "t1", label: "Team 1", capacity: 2 },
  { id: "t2", label: "Team 2", capacity: 2 }
];
const fields = [{ id: "skill", name: "Skill", type: "number" }];

{
  assert.ok(ruleTypesForTool("teams").includes("balanceField"));
  assert.ok(!ruleTypesForTool("secret-santa").includes("together"));
}

{
  const rules = normalizeRules([
    createRule("together", { itemIds: ["a", "b"] }),
    createRule("apart", { itemIds: ["a", "b"] })
  ]);
  const result = validateRules({ toolId: "teams", rules, items, targets, fields });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "TOGETHER_APART_CONFLICT"));
}

{
  const rules = [
    createRule("fixed", { itemId: "a", targetId: "t1" }),
    createRule("fixed", { itemId: "a", targetId: "t2" })
  ];
  const result = validateRules({ toolId: "teams", rules, items, targets, fields });
  assert.ok(result.errors.some((error) => error.code === "FIXED_TARGET_CONFLICT"));
}

{
  const rules = [
    createRule("capacity", { max: 1 })
  ];
  const result = validateRules({ toolId: "teams", rules, items, targets, fields });
  assert.ok(result.errors.some((error) => error.code === "INSUFFICIENT_CAPACITY"));
}

{
  const rules = [
    createRule("requiredTag", { tag: "leader", count: 2 })
  ];
  const result = validateRules({ toolId: "teams", rules, items, targets, fields });
  assert.ok(result.errors.some((error) => error.code === "INSUFFICIENT_REQUIRED_TAG"));
}

{
  const rule = createRule("balanceField", { fieldId: "skill" }, { strength: "soft" });
  const result = validateRules({ toolId: "teams", rules: [rule], items, targets, fields });
  assert.equal(result.valid, true);
  assert.match(summarizeRule(rule, { items, targets, fields }), /Balance Skill/);
}

{
  const rule = createRule("balanceField", { fieldId: "skill" }, { strength: "hard" });
  const result = validateRules({ toolId: "teams", rules: [rule], items, targets, fields });
  assert.ok(result.errors.some((error) => error.code === "BALANCE_IS_SOFT_ONLY"));
}

console.log("Rule model certification tests passed.");
