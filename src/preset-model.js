export const PRESET_SCHEMA_VERSION = 1;
export const RULE_SET_SCHEMA_VERSION = 1;

export class PresetModelError extends Error {
  constructor(message, code = "PRESET_ERROR") {
    super(message);
    this.name = "PresetModelError";
    this.code = code;
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new PresetModelError("Secure UUID generation is unavailable.", "UUID_UNAVAILABLE");
}

function now() {
  return Date.now();
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

const INPUT_MODES = new Set([
  "none",
  "prompt",
  "frozen",
  "live-pool",
  "live-view"
]);

export function createInputBinding(binding = {}) {
  const mode = INPUT_MODES.has(binding.mode) ? binding.mode : "none";

  if (mode === "frozen") {
    return {
      mode,
      items: Array.isArray(binding.items)
        ? binding.items.map((item) => ({
            id: String(item?.id || uuid()),
            label: String(item?.label ?? item ?? ""),
            weight: Number.isFinite(Number(item?.weight))
              ? Math.max(0, Number(item.weight))
              : 1,
            tags: Array.isArray(item?.tags) ? [...item.tags] : [],
            values: item?.values && typeof item.values === "object"
              ? { ...item.values }
              : {}
          }))
          .filter((item) => item.label.trim())
        : [],
      fields: Array.isArray(binding.fields)
        ? binding.fields.map((field) => ({ ...field }))
        : [],
      sourceLabel: String(binding.sourceLabel || "Frozen input")
    };
  }

  if (mode === "live-pool") {
    if (!binding.poolId) {
      throw new PresetModelError(
        "Live Pool binding requires a Pool.",
        "POOL_BINDING_REQUIRED"
      );
    }
    return {
      mode,
      poolId: String(binding.poolId)
    };
  }

  if (mode === "live-view") {
    if (!binding.poolId || !binding.viewId) {
      throw new PresetModelError(
        "Live View binding requires both Pool and View.",
        "VIEW_BINDING_REQUIRED"
      );
    }
    return {
      mode,
      poolId: String(binding.poolId),
      viewId: String(binding.viewId)
    };
  }

  return { mode };
}

export function createPreset({
  name,
  toolId,
  inputBinding = { mode: "none" },
  configSnapshot = {},
  rulesSnapshot = [],
  ruleSetId = null,
  favorite = false,
  description = ""
}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new PresetModelError("Preset name is required.", "PRESET_NAME_REQUIRED");
  }
  if (!toolId) {
    throw new PresetModelError("Preset tool is required.", "PRESET_TOOL_REQUIRED");
  }

  const timestamp = now();
  return {
    id: uuid(),
    schemaVersion: PRESET_SCHEMA_VERSION,
    revision: 1,
    name: cleanName,
    description: String(description || ""),
    toolId: String(toolId),
    inputBinding: createInputBinding(inputBinding),
    configSnapshot: clone(configSnapshot) || {},
    rulesSnapshot: clone(rulesSnapshot) || [],
    ruleSetId: ruleSetId ? String(ruleSetId) : null,
    favorite: Boolean(favorite),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function updatePreset(preset, patch = {}) {
  const next = clone(preset);
  if (patch.name != null) {
    const clean = String(patch.name).trim();
    if (!clean) throw new PresetModelError("Preset name is required.");
    next.name = clean;
  }
  if (patch.description != null) next.description = String(patch.description);
  if (patch.favorite != null) next.favorite = Boolean(patch.favorite);
  if (patch.inputBinding != null) {
    next.inputBinding = createInputBinding(patch.inputBinding);
  }
  if (patch.configSnapshot != null) {
    next.configSnapshot = clone(patch.configSnapshot) || {};
  }
  if (patch.rulesSnapshot != null) {
    next.rulesSnapshot = clone(patch.rulesSnapshot) || [];
  }
  if (patch.ruleSetId !== undefined) {
    next.ruleSetId = patch.ruleSetId ? String(patch.ruleSetId) : null;
  }
  next.revision = (Number(next.revision) || 0) + 1;
  next.updatedAt = now();
  return next;
}

export function presetNeedsSource(preset) {
  return ["live-pool", "live-view"].includes(preset?.inputBinding?.mode);
}

export function resolvePresetInput(preset, {
  pools = [],
  views = [],
  createWorkingSet,
  resolvePoolView
} = {}) {
  const binding = createInputBinding(preset?.inputBinding || { mode: "none" });

  if (binding.mode === "none") return { mode: "none" };
  if (binding.mode === "prompt") return { mode: "prompt" };

  if (binding.mode === "frozen") {
    return {
      mode: "frozen",
      workingSet: {
        source: {
          kind: "preset-frozen",
          presetId: preset.id,
          presetRevision: preset.revision,
          name: binding.sourceLabel || preset.name
        },
        fields: clone(binding.fields) || [],
        items: clone(binding.items) || [],
        exclusions: [],
        localOverrides: {}
      }
    };
  }

  const pool = pools.find((item) => String(item.id) === binding.poolId);
  if (!pool) {
    throw new PresetModelError(
      "The Pool used by this Preset no longer exists.",
      "PRESET_POOL_MISSING"
    );
  }

  if (binding.mode === "live-pool") {
    if (typeof createWorkingSet !== "function") {
      throw new PresetModelError("WorkingSet resolver unavailable.");
    }
    return {
      mode: binding.mode,
      workingSet: createWorkingSet(pool)
    };
  }

  const view = views.find((item) => String(item.id) === binding.viewId);
  if (!view || String(view.poolId) !== String(pool.id)) {
    throw new PresetModelError(
      "The View used by this Preset no longer exists.",
      "PRESET_VIEW_MISSING"
    );
  }
  if (
    typeof createWorkingSet !== "function"
    || typeof resolvePoolView !== "function"
  ) {
    throw new PresetModelError("View resolver unavailable.");
  }

  const resolved = resolvePoolView(pool, view);
  const workingSet = createWorkingSet(pool, {
    itemIds: resolved.map((item) => item.id)
  });
  workingSet.source.viewId = view.id;
  workingSet.source.viewName = view.name;

  return {
    mode: binding.mode,
    workingSet
  };
}

const POOL_SPECIFIC_RULE_TYPES = new Set([
  "together",
  "apart",
  "fixed",
  "balanceField"
]);

export function inferRuleSetScope(rules = [], sourcePoolId = null) {
  const poolSpecific = rules.some((rule) =>
    POOL_SPECIFIC_RULE_TYPES.has(rule?.type)
  );

  return poolSpecific ? "pool" : "portable";
}

export function createRuleSet({
  name,
  toolId,
  rules,
  sourcePoolId = null,
  sourcePoolRevision = null,
  favorite = false
}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new PresetModelError(
      "Rule Set name is required.",
      "RULE_SET_NAME_REQUIRED"
    );
  }

  const normalizedRules = clone(Array.isArray(rules) ? rules : []);
  if (!normalizedRules.length) {
    throw new PresetModelError(
      "Rule Set needs at least one rule.",
      "RULE_SET_EMPTY"
    );
  }

  const scope = inferRuleSetScope(normalizedRules, sourcePoolId);
  if (scope === "pool" && !sourcePoolId) {
    throw new PresetModelError(
      "This Rule Set references Pool-specific items or fields, so save it from a Pool-backed WorkingSet.",
      "RULE_SET_POOL_REQUIRED"
    );
  }

  const timestamp = now();
  return {
    id: uuid(),
    schemaVersion: RULE_SET_SCHEMA_VERSION,
    revision: 1,
    name: cleanName,
    toolId: String(toolId),
    scope,
    poolId: scope === "pool" ? String(sourcePoolId) : null,
    poolRevision:
      scope === "pool" && Number.isFinite(Number(sourcePoolRevision))
        ? Number(sourcePoolRevision)
        : null,
    rules: normalizedRules,
    favorite: Boolean(favorite),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function ruleSetCompatible(ruleSet, {
  toolId,
  sourcePoolId = null
} = {}) {
  if (!ruleSet || String(ruleSet.toolId) !== String(toolId)) return false;
  if (ruleSet.scope === "portable") return true;
  return Boolean(
    sourcePoolId
    && String(ruleSet.poolId) === String(sourcePoolId)
  );
}

export function applyRuleSet(ruleSet) {
  return clone(ruleSet?.rules || []);
}
