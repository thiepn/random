import { shuffle } from "./random-core.js";
import { validateRules, pairRuleKey } from "./rule-model.js";

const EFFORT = {
  fast: { nodeLimit: 5000, solutionLimit: 1 },
  automatic: { nodeLimit: 50000, solutionLimit: 40 },
  thorough: { nodeLimit: 250000, solutionLimit: 200 }
};

export class ConstraintSolverError extends Error {
  constructor(message, code = "SOLVER_ERROR", details = null) {
    super(message);
    this.name = "ConstraintSolverError";
    this.code = code;
    this.details = details;
  }
}

function effortConfig(mode) {
  return EFFORT[mode] || EFFORT.automatic;
}

function makeUnionFind(items) {
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

  return { parent, find, union };
}

function buildBundles(items, rules) {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const uf = makeUnionFind(items);

  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "hard" || rule.type !== "together") continue;
    const ids = Array.from(new Set((rule.params.itemIds || []).map(String)));
    for (let index = 1; index < ids.length; index += 1) {
      if (byId.has(ids[0]) && byId.has(ids[index])) uf.union(ids[0], ids[index]);
    }
  }

  const groups = new Map();
  for (const item of items) {
    const root = uf.find(String(item.id));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  }

  return [...groups.values()].map((members) => ({
    id: members.map((item) => String(item.id)).sort().join("+"),
    members
  }));
}

function hardApartSet(rules) {
  const set = new Set();
  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "hard" || rule.type !== "apart") continue;
    const ids = Array.from(new Set((rule.params.itemIds || []).map(String)));
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        set.add(pairRuleKey(ids[left], ids[right]));
      }
    }
  }
  return set;
}

function hardFixedMap(rules) {
  const map = new Map();
  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "hard" || rule.type !== "fixed") continue;
    map.set(String(rule.params.itemId), String(rule.params.targetId));
  }
  return map;
}

function computeCapacities(items, targets, rules) {
  const capacities = new Map(
    targets.map((target) => [
      String(target.id),
      Number.isSafeInteger(target.capacity) ? target.capacity : items.length
    ])
  );

  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "hard" || rule.type !== "capacity") continue;
    const max = Number(rule.params.max);
    if (!Number.isSafeInteger(max) || max < 1) continue;

    if (rule.params.targetId != null) {
      const key = String(rule.params.targetId);
      if (capacities.has(key)) {
        capacities.set(key, Math.min(capacities.get(key), max));
      }
    } else {
      for (const key of capacities.keys()) {
        capacities.set(key, Math.min(capacities.get(key), max));
      }
    }
  }

  return capacities;
}

function tagCount(items, tag) {
  return items.reduce(
    (count, item) => count + (item.tags?.includes(tag) ? 1 : 0),
    0
  );
}

function hardRequiredTags(rules) {
  return rules.filter((rule) =>
    rule.enabled && rule.strength === "hard" && rule.type === "requiredTag"
  );
}

function hardMaxTags(rules) {
  return rules.filter((rule) =>
    rule.enabled && rule.strength === "hard" && rule.type === "maxTag"
  );
}

function bundleFixedTarget(bundle, fixed) {
  const targets = new Set(
    bundle.members
      .map((item) => fixed.get(String(item.id)))
      .filter(Boolean)
  );
  return targets.size === 1 ? [...targets][0] : null;
}

function bundleConflictsWithTarget(bundle, assignedItems, apart) {
  for (const item of bundle.members) {
    for (const existing of assignedItems) {
      if (apart.has(pairRuleKey(item.id, existing.id))) return true;
    }
  }
  return false;
}

function canPlaceBundle({
  bundle,
  targetId,
  targetMembers,
  capacities,
  apart,
  maxTagRules
}) {
  const current = targetMembers.get(targetId) || [];
  if (current.length + bundle.members.length > (capacities.get(targetId) ?? 0)) {
    return false;
  }

  if (bundleConflictsWithTarget(bundle, current, apart)) return false;

  for (const rule of maxTagRules) {
    const tag = String(rule.params.tag || "").trim();
    const max = Number(rule.params.count);
    const after = tagCount(current, tag) + tagCount(bundle.members, tag);
    if (after > max) return false;
  }

  return true;
}

function requiredTagsSatisfied(targetMembers, targets, rules) {
  for (const rule of rules) {
    const tag = String(rule.params.tag || "").trim();
    const min = Number(rule.params.count);
    for (const target of targets) {
      const members = targetMembers.get(String(target.id)) || [];
      if (tagCount(members, tag) < min) return false;
    }
  }
  return true;
}

function labelHistoryKey(a, b) {
  return [String(a).toLocaleLowerCase(), String(b).toLocaleLowerCase()]
    .sort()
    .join("\u001f");
}

function softScore({ targetMembers, targets, rules, fields, historyPairs }) {
  let score = 0;
  const itemTarget = new Map();

  for (const target of targets) {
    const targetId = String(target.id);
    for (const item of targetMembers.get(targetId) || []) {
      itemTarget.set(String(item.id), targetId);
    }
  }

  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "soft") continue;
    const priority = Number(rule.priority) || 10;

    if (rule.type === "together") {
      const targetIds = new Set(
        (rule.params.itemIds || [])
          .map((itemId) => itemTarget.get(String(itemId)))
          .filter(Boolean)
      );
      if (targetIds.size > 1) score += priority * (targetIds.size - 1);
    }

    if (rule.type === "apart") {
      const ids = (rule.params.itemIds || []).map(String);
      for (let left = 0; left < ids.length; left += 1) {
        for (let right = left + 1; right < ids.length; right += 1) {
          if (
            itemTarget.get(ids[left])
            && itemTarget.get(ids[left]) === itemTarget.get(ids[right])
          ) {
            score += priority;
          }
        }
      }
    }

    if (rule.type === "fixed") {
      if (
        itemTarget.get(String(rule.params.itemId))
        !== String(rule.params.targetId)
      ) {
        score += priority;
      }
    }

    if (rule.type === "requiredTag") {
      const tag = String(rule.params.tag || "").trim();
      const min = Number(rule.params.count);
      for (const target of targets) {
        const count = tagCount(
          targetMembers.get(String(target.id)) || [],
          tag
        );
        if (count < min) score += priority * (min - count);
      }
    }

    if (rule.type === "maxTag") {
      const tag = String(rule.params.tag || "").trim();
      const max = Number(rule.params.count);
      for (const target of targets) {
        const count = tagCount(
          targetMembers.get(String(target.id)) || [],
          tag
        );
        if (count > max) score += priority * (count - max);
      }
    }

    if (rule.type === "capacity") {
      const max = Number(rule.params.max);
      const targetIds = rule.params.targetId != null
        ? [String(rule.params.targetId)]
        : targets.map((target) => String(target.id));
      for (const targetId of targetIds) {
        const count = (targetMembers.get(targetId) || []).length;
        if (count > max) score += priority * (count - max);
      }
    }

    if (rule.type === "balanceField") {
      const fieldId = String(rule.params.fieldId || "");
      const averages = [];
      for (const target of targets) {
        const values = (targetMembers.get(String(target.id)) || [])
          .map((item) => Number(item.values?.[fieldId]))
          .filter(Number.isFinite);
        if (values.length) {
          averages.push(values.reduce((sum, value) => sum + value, 0) / values.length);
        }
      }
      if (averages.length > 1) {
        score += priority * (Math.max(...averages) - Math.min(...averages));
      }
    }

    if (rule.type === "historyAvoid") {
      for (const target of targets) {
        const members = targetMembers.get(String(target.id)) || [];
        for (let left = 0; left < members.length; left += 1) {
          for (let right = left + 1; right < members.length; right += 1) {
            if (
              historyPairs.has(
                labelHistoryKey(members[left].label, members[right].label)
              )
            ) {
              score += priority;
            }
          }
        }
      }
    }
  }

  return score;
}

function cloneTargetMembers(targetMembers, targets) {
  return new Map(
    targets.map((target) => [
      String(target.id),
      [...(targetMembers.get(String(target.id)) || [])]
    ])
  );
}

function bundleDifficulty(bundle, apart, fixed) {
  let degree = 0;
  for (const member of bundle.members) {
    if (fixed.has(String(member.id))) degree += 1000;
    for (const key of apart) {
      if (key.includes(String(member.id))) degree += 1;
    }
  }
  return degree + bundle.members.length * 10;
}

export function solveGrouping({
  toolId,
  items,
  targets,
  rules = [],
  fields = [],
  historyPairs = new Set(),
  effort = "automatic",
  rng
}) {
  const validation = validateRules({ toolId, rules, items, targets, fields });
  if (!validation.valid) {
    return {
      status: "impossible",
      reason: "validation",
      errors: validation.errors,
      warnings: validation.warnings,
      diagnostics: { nodes: 0, solutions: 0 }
    };
  }

  const activeRules = validation.activeRules;
  const hardApart = hardApartSet(activeRules);
  const fixed = hardFixedMap(activeRules);
  const capacities = computeCapacities(items, targets, activeRules);
  const requiredTagRules = hardRequiredTags(activeRules);
  const maxTagRules = hardMaxTags(activeRules);
  let bundles = buildBundles(items, activeRules);

  for (const bundle of bundles) {
    for (let left = 0; left < bundle.members.length; left += 1) {
      for (let right = left + 1; right < bundle.members.length; right += 1) {
        if (
          hardApart.has(
            pairRuleKey(bundle.members[left].id, bundle.members[right].id)
          )
        ) {
          return {
            status: "impossible",
            reason: "together-apart",
            errors: [{
              code: "TOGETHER_APART_COMPONENT",
              message: "A required together-group contains items that must be apart."
            }],
            warnings: validation.warnings,
            diagnostics: { nodes: 0, solutions: 0 }
          };
        }
      }
    }
  }

  bundles = shuffle(bundles, rng).sort(
    (a, b) =>
      bundleDifficulty(b, hardApart, fixed)
      - bundleDifficulty(a, hardApart, fixed)
  );

  const targetIds = targets.map((target) => String(target.id));
  const targetMembers = new Map(targetIds.map((targetId) => [targetId, []]));
  const limits = effortConfig(effort);
  let nodes = 0;
  let solutions = 0;
  let hitLimit = false;
  let best = null;
  let stop = false;

  function visit(index) {
    if (stop) return;
    if (nodes >= limits.nodeLimit) {
      hitLimit = true;
      return;
    }
    nodes += 1;

    if (index >= bundles.length) {
      if (
        !requiredTagsSatisfied(
          targetMembers,
          targets,
          requiredTagRules
        )
      ) {
        return;
      }

      solutions += 1;
      const score = softScore({
        targetMembers,
        targets,
        rules: activeRules,
        fields,
        historyPairs
      });

      if (!best || score < best.score) {
        best = {
          score,
          targetMembers: cloneTargetMembers(targetMembers, targets)
        };
      }

      if (
        effort === "fast"
        || score === 0
        || solutions >= limits.solutionLimit
      ) {
        stop = true;
      }
      return;
    }

    const bundle = bundles[index];
    const forced = bundleFixedTarget(bundle, fixed);
    const candidates = forced
      ? [forced]
      : shuffle(targetIds, rng);

    for (const targetId of candidates) {
      if (stop) break;
      if (!targetMembers.has(targetId)) continue;

      if (!canPlaceBundle({
        bundle,
        targetId,
        targetMembers,
        capacities,
        apart: hardApart,
        maxTagRules
      })) {
        continue;
      }

      targetMembers.get(targetId).push(...bundle.members);
      visit(index + 1);
      targetMembers.get(targetId).splice(
        targetMembers.get(targetId).length - bundle.members.length,
        bundle.members.length
      );
    }
  }

  visit(0);

  if (!best) {
    return {
      status: hitLimit ? "search_limit" : "impossible",
      reason: hitLimit ? "search-limit" : "exhausted",
      errors: [],
      warnings: validation.warnings,
      diagnostics: { nodes, solutions, hitLimit }
    };
  }

  const groups = targets.map((target) => ({
    target: { ...target },
    items: best.targetMembers.get(String(target.id)) || []
  }));

  return {
    status: "ok",
    groups,
    score: best.score,
    optimal: best.score === 0 && !hitLimit,
    warnings: validation.warnings,
    diagnostics: { nodes, solutions, hitLimit }
  };
}

function secretPairForbidden(a, b, rules) {
  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "hard" || rule.type !== "apart") continue;
    const ids = new Set((rule.params.itemIds || []).map(String));
    if (ids.has(String(a.id)) && ids.has(String(b.id))) return true;
  }
  return false;
}

function secretSoftScore(assignments, rules) {
  let score = 0;
  const byGiver = new Map(
    assignments.map((entry) => [String(entry.giver.id), String(entry.receiver.id)])
  );

  for (const rule of rules) {
    if (!rule.enabled || rule.strength !== "soft") continue;
    const priority = Number(rule.priority) || 10;

    if (rule.type === "apart") {
      const ids = (rule.params.itemIds || []).map(String);
      for (let left = 0; left < ids.length; left += 1) {
        for (let right = left + 1; right < ids.length; right += 1) {
          if (
            byGiver.get(ids[left]) === ids[right]
            || byGiver.get(ids[right]) === ids[left]
          ) {
            score += priority;
          }
        }
      }
    }

    if (rule.type === "fixed") {
      if (
        byGiver.get(String(rule.params.itemId))
        !== String(rule.params.targetId)
      ) {
        score += priority;
      }
    }
  }

  return score;
}

export function solveSecretSanta({
  items,
  rules = [],
  effort = "automatic",
  rng
}) {
  const targets = items.map((item) => ({
    id: String(item.id),
    label: item.label,
    capacity: 1
  }));
  const validation = validateRules({
    toolId: "secret-santa",
    rules,
    items,
    targets,
    fields: []
  });

  if (!validation.valid) {
    return {
      status: "impossible",
      reason: "validation",
      errors: validation.errors,
      warnings: validation.warnings,
      diagnostics: { nodes: 0, solutions: 0 }
    };
  }

  const fixed = hardFixedMap(validation.activeRules);
  const givers = shuffle(items, rng).sort((a, b) => {
    const af = fixed.has(String(a.id)) ? 1 : 0;
    const bf = fixed.has(String(b.id)) ? 1 : 0;
    return bf - af;
  });

  const used = new Set();
  const current = [];
  const limits = effortConfig(effort);
  let nodes = 0;
  let solutions = 0;
  let hitLimit = false;
  let stop = false;
  let best = null;

  function visit(index) {
    if (stop) return;
    if (nodes >= limits.nodeLimit) {
      hitLimit = true;
      return;
    }
    nodes += 1;

    if (index >= givers.length) {
      solutions += 1;
      const score = secretSoftScore(current, validation.activeRules);
      if (!best || score < best.score) {
        best = {
          score,
          assignments: current.map((entry) => ({ ...entry }))
        };
      }
      if (
        effort === "fast"
        || score === 0
        || solutions >= limits.solutionLimit
      ) {
        stop = true;
      }
      return;
    }

    const giver = givers[index];
    const hardTarget = fixed.get(String(giver.id));
    const candidates = hardTarget
      ? items.filter((item) => String(item.id) === hardTarget)
      : shuffle(items, rng);

    for (const receiver of candidates) {
      const receiverId = String(receiver.id);
      if (stop) break;
      if (receiverId === String(giver.id)) continue;
      if (used.has(receiverId)) continue;
      if (secretPairForbidden(giver, receiver, validation.activeRules)) continue;

      used.add(receiverId);
      current.push({ giver, receiver });
      visit(index + 1);
      current.pop();
      used.delete(receiverId);
    }
  }

  visit(0);

  if (!best) {
    return {
      status: hitLimit ? "search_limit" : "impossible",
      reason: hitLimit ? "search-limit" : "exhausted",
      errors: [],
      warnings: validation.warnings,
      diagnostics: { nodes, solutions, hitLimit }
    };
  }

  return {
    status: "ok",
    assignments: best.assignments,
    score: best.score,
    optimal: best.score === 0 && !hitLimit,
    warnings: validation.warnings,
    diagnostics: { nodes, solutions, hitLimit }
  };
}

export function solverEffortInfo(mode) {
  const value = effortConfig(mode);
  return {
    mode: EFFORT[mode] ? mode : "automatic",
    nodeLimit: value.nodeLimit,
    solutionLimit: value.solutionLimit
  };
}

export function historyPairKey(labelA, labelB) {
  return labelHistoryKey(labelA, labelB);
}
