const RULE_TYPES = new Set([
  "together",
  "apart",
  "fixed",
  "capacity",
  "requiredTag",
  "maxTag",
  "balanceField",
  "historyAvoid"
]);

const TOOL_RULES = {
  teams: new Set(["together", "apart", "fixed", "capacity", "requiredTag", "maxTag", "balanceField", "historyAvoid"]),
  groups: new Set(["together", "apart", "fixed", "capacity", "requiredTag", "maxTag", "balanceField", "historyAvoid"]),
  pairs: new Set(["together", "apart", "fixed", "historyAvoid"]),
  assignment: new Set(["together", "apart", "fixed", "capacity", "requiredTag", "maxTag", "balanceField", "historyAvoid"]),
  "secret-santa": new Set(["apart", "fixed"]),
  tournament: new Set(["apart", "fixed", "historyAvoid"])
};

export class RuleModelError extends Error {
  constructor(message, code = "INVALID_RULE") {
    super(message);
    this.name = "RuleModelError";
    this.code = code;
  }
}

function id() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "rule_" + Date.now().toString(36);
}

export function createRule(type, params = {}, options = {}) {
  if (!RULE_TYPES.has(type)) {
    throw new RuleModelError("Unknown rule type: " + type, "UNKNOWN_RULE_TYPE");
  }

  return {
    id: options.id || id(),
    type,
    enabled: options.enabled !== false,
    strength: options.strength === "soft" ? "soft" : "hard",
    priority: Number.isFinite(Number(options.priority))
      ? Math.max(1, Math.min(100, Number(options.priority)))
      : 10,
    params: { ...params }
  };
}

export function normalizeRules(rules = []) {
  return (Array.isArray(rules) ? rules : []).map((rule) =>
    createRule(rule.type, rule.params || {}, {
      id: rule.id,
      enabled: rule.enabled,
      strength: rule.strength,
      priority: rule.priority
    })
  );
}

export function ruleTypesForTool(toolId) {
  return [...(TOOL_RULES[toolId] || [])];
}

export function ruleSupportedByTool(toolId, type) {
  return Boolean(TOOL_RULES[toolId]?.has(type));
}

function itemMap(items) {
  return new Map(items.map((item) => [String(item.id), item]));
}

function targetMap(targets) {
  return new Map(targets.map((target) => [String(target.id), target]));
}

function pairKey(a, b) {
  return [String(a), String(b)].sort().join("\u001f");
}

function hardTogetherComponents(rules, items) {
  const parent = new Map(items.map((item) => [String(item.id), String(item.id)]));

  const find = (value) => {
    let root = value;
    while (parent.get(root) !== root) root = parent.get(root);
    let current = value;
    while (parent.get(current) !== current) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  };

  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "hard" || rule.type !== "together") continue;
    const ids = (rule.params.itemIds || []).map(String);
    for (let index = 1; index < ids.length; index += 1) {
      if (parent.has(ids[0]) && parent.has(ids[index])) {
        union(ids[0], ids[index]);
      }
    }
  }

  const groups = new Map();
  for (const key of parent.keys()) {
    const root = find(key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(key);
  }
  return [...groups.values()];
}

export function validateRules({
  toolId,
  rules = [],
  items = [],
  targets = [],
  fields = []
}) {
  const normalized = normalizeRules(rules);
  const errors = [];
  const warnings = [];
  const itemsById = itemMap(items);
  const targetsById = targetMap(targets);
  const fieldsById = new Map(fields.map((field) => [String(field.id), field]));

  const active = normalized.filter((rule) => rule.enabled);

  for (const rule of active) {
    if (!ruleSupportedByTool(toolId, rule.type)) {
      errors.push({
        code: "RULE_NOT_SUPPORTED",
        ruleId: rule.id,
        message: rule.type + " is not supported by " + toolId + "."
      });
      continue;
    }

    if (rule.type === "together" || rule.type === "apart") {
      const ids = Array.from(new Set((rule.params.itemIds || []).map(String)));
      if (ids.length < 2) {
        errors.push({
          code: "RULE_NEEDS_ITEMS",
          ruleId: rule.id,
          message: "This rule needs at least two items."
        });
      }
      const missing = ids.filter((value) => !itemsById.has(value));
      if (missing.length) {
        errors.push({
          code: "RULE_ITEM_MISSING",
          ruleId: rule.id,
          message: "A referenced item is no longer available."
        });
      }
    }

    if (rule.type === "fixed") {
      const itemId = String(rule.params.itemId || "");
      const targetId = String(rule.params.targetId || "");
      if (!itemsById.has(itemId)) {
        errors.push({
          code: "FIXED_ITEM_MISSING",
          ruleId: rule.id,
          message: "Fixed rule item is no longer available."
        });
      }
      if (!targetsById.has(targetId)) {
        errors.push({
          code: "FIXED_TARGET_MISSING",
          ruleId: rule.id,
          message: "Fixed rule target is no longer available."
        });
      }
    }

    if (rule.type === "capacity") {
      const max = Number(rule.params.max);
      if (!Number.isSafeInteger(max) || max < 1) {
        errors.push({
          code: "INVALID_CAPACITY",
          ruleId: rule.id,
          message: "Capacity must be a whole number of at least 1."
        });
      }
      if (rule.params.targetId != null && !targetsById.has(String(rule.params.targetId))) {
        errors.push({
          code: "CAPACITY_TARGET_MISSING",
          ruleId: rule.id,
          message: "Capacity target is no longer available."
        });
      }
    }

    if (rule.type === "requiredTag" || rule.type === "maxTag") {
      const tag = String(rule.params.tag || "").trim();
      const count = Number(rule.params.count);
      if (!tag) {
        errors.push({
          code: "TAG_REQUIRED",
          ruleId: rule.id,
          message: "Tag rule needs a tag."
        });
      }
      if (!Number.isSafeInteger(count) || count < 0) {
        errors.push({
          code: "INVALID_TAG_COUNT",
          ruleId: rule.id,
          message: "Tag count must be a non-negative whole number."
        });
      }
    }

    if (rule.type === "balanceField") {
      const fieldId = String(rule.params.fieldId || "");
      if (!fieldsById.has(fieldId)) {
        errors.push({
          code: "BALANCE_FIELD_MISSING",
          ruleId: rule.id,
          message: "Balance field is no longer available."
        });
      } else if (fieldsById.get(fieldId).type !== "number") {
        errors.push({
          code: "BALANCE_FIELD_NOT_NUMERIC",
          ruleId: rule.id,
          message: "Balance rules require a numeric field."
        });
      }
    }

    if (rule.type === "historyAvoid") {
      const depth = Number(rule.params.depth ?? 5);
      if (!Number.isSafeInteger(depth) || depth < 1 || depth > 100) {
        errors.push({
          code: "INVALID_HISTORY_DEPTH",
          ruleId: rule.id,
          message: "History depth must be from 1 to 100."
        });
      }
      if (rule.strength === "hard") {
        warnings.push({
          code: "HARD_HISTORY_AVOIDANCE",
          ruleId: rule.id,
          message: "Hard history avoidance can make otherwise valid setups impossible."
        });
      }
    }
  }

  const hardTogether = active.filter((rule) =>
    rule.strength === "hard" && rule.type === "together"
  );
  const hardApart = active.filter((rule) =>
    rule.strength === "hard" && rule.type === "apart"
  );

  const togetherPairs = new Set();
  for (const rule of hardTogether) {
    const ids = Array.from(new Set((rule.params.itemIds || []).map(String)));
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        togetherPairs.add(pairKey(ids[left], ids[right]));
      }
    }
  }

  for (const rule of hardApart) {
    const ids = Array.from(new Set((rule.params.itemIds || []).map(String)));
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        if (togetherPairs.has(pairKey(ids[left], ids[right]))) {
          errors.push({
            code: "TOGETHER_APART_CONFLICT",
            ruleId: rule.id,
            message: "The same items are required both together and apart."
          });
        }
      }
    }
  }

  const fixedByItem = new Map();
  for (const rule of active) {
    if (rule.strength !== "hard" || rule.type !== "fixed") continue;
    const itemId = String(rule.params.itemId || "");
    const targetId = String(rule.params.targetId || "");
    if (fixedByItem.has(itemId) && fixedByItem.get(itemId) !== targetId) {
      errors.push({
        code: "FIXED_TARGET_CONFLICT",
        ruleId: rule.id,
        message: "An item is fixed to more than one target."
      });
    }
    fixedByItem.set(itemId, targetId);
  }

  const components = hardTogetherComponents(active, items);
  for (const component of components) {
    const fixedTargets = new Set(
      component.map((itemId) => fixedByItem.get(itemId)).filter(Boolean)
    );
    if (fixedTargets.size > 1) {
      errors.push({
        code: "TOGETHER_FIXED_CONFLICT",
        message: "Items that must stay together are fixed to different targets."
      });
    }
  }

  if (targets.length) {
    const hardCapRules = active.filter((rule) =>
      rule.strength === "hard" && rule.type === "capacity"
    );
    const capacities = new Map(targets.map((target) => [
      String(target.id),
      Number.isSafeInteger(target.capacity) ? target.capacity : items.length
    ]));

    for (const rule of hardCapRules) {
      const max = Number(rule.params.max);
      if (!Number.isSafeInteger(max) || max < 1) continue;
      if (rule.params.targetId != null) {
        const key = String(rule.params.targetId);
        if (capacities.has(key)) capacities.set(key, Math.min(capacities.get(key), max));
      } else {
        for (const key of capacities.keys()) {
          capacities.set(key, Math.min(capacities.get(key), max));
        }
      }
    }

    const totalCapacity = [...capacities.values()].reduce((sum, value) => sum + value, 0);
    if (totalCapacity < items.length) {
      errors.push({
        code: "INSUFFICIENT_CAPACITY",
        message: "Configured capacities cannot hold all items."
      });
    }

    for (const component of components) {
      if (component.length > Math.max(...capacities.values(), 0)) {
        errors.push({
          code: "TOGETHER_EXCEEDS_CAPACITY",
          message: "A together-group is larger than every available target capacity."
        });
      }
    }

    for (const rule of active) {
      if (rule.strength !== "hard" || rule.type !== "requiredTag") continue;
      const tag = String(rule.params.tag || "").trim();
      const count = Number(rule.params.count);
      if (!tag || !Number.isSafeInteger(count) || count < 0) continue;
      const supply = items.filter((item) => item.tags?.includes(tag)).length;
      const demand = count * targets.length;
      if (supply < demand) {
        errors.push({
          code: "INSUFFICIENT_REQUIRED_TAG",
          ruleId: rule.id,
          message:
            "Required tag “" + tag + "” needs " + demand
            + " matching items but only " + supply + " are available."
        });
      }
    }
  }

  return {
    rules: normalized,
    activeRules: active,
    errors,
    warnings,
    valid: errors.length === 0
  };
}

export function summarizeRule(rule, context = {}) {
  const items = new Map((context.items || []).map((item) => [String(item.id), item.label]));
  const targets = new Map((context.targets || []).map((target) => [String(target.id), target.label]));
  const fields = new Map((context.fields || []).map((field) => [String(field.id), field.name]));
  const itemLabels = (rule.params.itemIds || [])
    .map((idValue) => items.get(String(idValue)) || "Missing item");

  switch (rule.type) {
    case "together":
      return "Together · " + itemLabels.join(" + ");
    case "apart":
      return "Apart · " + itemLabels.join(" / ");
    case "fixed":
      return (items.get(String(rule.params.itemId)) || "Missing item")
        + " → "
        + (targets.get(String(rule.params.targetId)) || "Missing target");
    case "capacity":
      return rule.params.targetId
        ? (targets.get(String(rule.params.targetId)) || "Target")
          + " max " + rule.params.max
        : "Max " + rule.params.max + " per target";
    case "requiredTag":
      return "Each target needs " + rule.params.count + " × #" + rule.params.tag;
    case "maxTag":
      return "Max " + rule.params.count + " × #" + rule.params.tag + " per target";
    case "balanceField":
      return "Balance " + (fields.get(String(rule.params.fieldId)) || "numeric field");
    case "historyAvoid":
      return "Avoid recent pairings · last " + (rule.params.depth || 5) + " runs";
    default:
      return rule.type;
  }
}

export function ruleStrengthLabel(rule) {
  return rule.strength === "soft" ? "Prefer" : "Required";
}

export function pairRuleKey(a, b) {
  return pairKey(a, b);
}
