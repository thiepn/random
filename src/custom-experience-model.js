import { parseDiceExpression } from "./dice-engine.js";
export const CUSTOM_EXPERIENCE_SCHEMA_VERSION = 1;
export const CUSTOM_EXPORT_VERSION = 1;

export const CUSTOM_PRIMITIVES = Object.freeze([
  "pick",
  "sample",
  "shuffle",
  "number",
  "dice",
  "faces",
  "deck",
  "table",
  "compound"
]);

export const CUSTOM_ACCENTS = Object.freeze([
  "cyan",
  "purple",
  "gold",
  "red",
  "green",
  "blue",
  "pink",
  "orange"
]);

export const CUSTOM_LAYOUTS = Object.freeze([
  "auto",
  "wheel",
  "card",
  "dice",
  "list",
  "number",
  "table",
  "text"
]);

const MAX_DEFINITION_BYTES = 100000;
const MAX_ENTRIES = 500;
const MAX_COMPOUND_STEPS = 8;
const SIMPLE_COMPOUND_PRIMITIVES = new Set([
  "pick",
  "sample",
  "shuffle",
  "number",
  "dice",
  "faces",
  "table"
]);

export class CustomExperienceError extends Error {
  constructor(message, code = "CUSTOM_EXPERIENCE_ERROR") {
    super(message);
    this.name = "CustomExperienceError";
    this.code = code;
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new CustomExperienceError(
    "Secure UUID generation is unavailable.",
    "UUID_UNAVAILABLE"
  );
}

function now() {
  return Date.now();
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function cleanText(value, label, max = 200, { required = false } = {}) {
  const text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();

  if (required && !text) {
    throw new CustomExperienceError(
      label + " is required.",
      "CUSTOM_TEXT_REQUIRED"
    );
  }
  if (text.length > max) {
    throw new CustomExperienceError(
      label + " is too long.",
      "CUSTOM_TEXT_TOO_LONG"
    );
  }
  return text;
}

function assertSafeSerializable(value, path = "experience", seen = new Set()) {
  if (value == null) return;
  const type = typeof value;

  if (["function", "symbol", "bigint"].includes(type)) {
    throw new CustomExperienceError(
      "Unsupported executable or non-JSON value at " + path + ".",
      "UNSAFE_CUSTOM_VALUE"
    );
  }
  if (type !== "object") {
    if (
      typeof value === "string"
      && (/javascript\s*:/i.test(value) || /<\s*script/i.test(value))
    ) {
      throw new CustomExperienceError(
        "Executable markup is not allowed.",
        "UNSAFE_CUSTOM_TEXT"
      );
    }
    return;
  }

  if (seen.has(value)) {
    throw new CustomExperienceError(
      "Cyclic custom definitions are not allowed.",
      "CYCLIC_CUSTOM_DEFINITION"
    );
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeSerializable(item, path + "[" + index + "]", seen)
    );
    seen.delete(value);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const lower = String(key).toLowerCase();
    if (
      /^on[a-z]/.test(lower)
      || [
        "html",
        "innerhtml",
        "outerhtml",
        "srcdoc",
        "css",
        "script",
        "javascript",
        "code",
        "eval",
        "function",
        "style"
      ].includes(lower)
    ) {
      throw new CustomExperienceError(
        "Custom code, HTML, CSS, and event handlers are not allowed.",
        "FORBIDDEN_CUSTOM_KEY"
      );
    }
    assertSafeSerializable(child, path + "." + key, seen);
  }

  seen.delete(value);
}

function definitionBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function normalizeEntry(entry, index = 0) {
  const source = typeof entry === "string"
    ? { label: entry }
    : entry || {};

  const label = cleanText(
    source.label,
    "Entry label",
    120,
    { required: true }
  );
  const weight = Number(source.weight == null ? 1 : source.weight);

  if (!Number.isFinite(weight) || weight < 0 || weight > 1000000) {
    throw new CustomExperienceError(
      "Entry weight must be between 0 and 1,000,000.",
      "INVALID_CUSTOM_WEIGHT"
    );
  }

  return {
    id: String(source.id || ("entry:" + index)),
    label,
    weight,
    value: source.value == null
      ? label
      : cleanText(source.value, "Entry value", 240)
  };
}

function normalizeEntries(entries, {
  min = 1,
  max = MAX_ENTRIES,
  label = "entries"
} = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length < min || list.length > max) {
    throw new CustomExperienceError(
      label + " must contain " + min + "–" + max + " items.",
      "INVALID_CUSTOM_ENTRY_COUNT"
    );
  }
  return list.map(normalizeEntry);
}

function normalizeSource(source, entries, min = 1) {
  const mode = source === "prompt" ? "prompt" : "embedded";
  return {
    source: mode,
    entries: mode === "embedded"
      ? normalizeEntries(entries, { min })
      : []
  };
}

function normalizePrimitiveConfig(primitive, config = {}, {
  compoundStep = false
} = {}) {
  if (!CUSTOM_PRIMITIVES.includes(primitive)) {
    throw new CustomExperienceError(
      "Unsupported custom primitive.",
      "UNSUPPORTED_CUSTOM_PRIMITIVE"
    );
  }

  if (compoundStep && !SIMPLE_COMPOUND_PRIMITIVES.has(primitive)) {
    throw new CustomExperienceError(
      "This primitive cannot be nested in a compound generator.",
      "UNSUPPORTED_COMPOUND_PRIMITIVE"
    );
  }

  if (["pick", "sample", "shuffle"].includes(primitive)) {
    const source = normalizeSource(
      config.source,
      config.entries,
      primitive === "shuffle" ? 2 : 1
    );

    if (
      source.source === "embedded"
      && primitive !== "shuffle"
      && !source.entries.some((entry) => entry.weight > 0)
    ) {
      throw new CustomExperienceError(
        "At least one embedded entry must have positive weight.",
        "CUSTOM_NO_ELIGIBLE_ENTRIES"
      );
    }

    if (primitive === "sample") {
      const count = Number(config.count == null ? 2 : config.count);
      const replacement = Boolean(config.replacement);
      if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
        throw new CustomExperienceError(
          "Sample count must be from 1 to 100.",
          "INVALID_CUSTOM_SAMPLE_COUNT"
        );
      }

      if (source.source === "embedded" && !replacement) {
        const eligible = source.entries.filter(
          (entry) => entry.weight > 0
        ).length;
        if (count > eligible) {
          throw new CustomExperienceError(
            "Sample count exceeds the number of eligible embedded entries.",
            "CUSTOM_SAMPLE_EXCEEDS_ELIGIBLE"
          );
        }
      }

      return {
        ...source,
        count,
        replacement
      };
    }

    return source;
  }

  if (primitive === "number") {
    const mode = config.mode === "decimal" ? "decimal" : "integer";
    const min = Number(config.min == null ? 1 : config.min);
    const max = Number(config.max == null ? 100 : config.max);
    const count = Number(config.count == null ? 1 : config.count);
    const precision = Number(config.precision == null ? 2 : config.precision);
    const unique = Boolean(config.unique);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new CustomExperienceError(
        "Number bounds are invalid.",
        "INVALID_CUSTOM_NUMBER_RANGE"
      );
    }
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
      throw new CustomExperienceError(
        "Number count must be from 1 to 100.",
        "INVALID_CUSTOM_NUMBER_COUNT"
      );
    }

    let scaledMin;
    let scaledMax;

    if (mode === "integer") {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
        throw new CustomExperienceError(
          "Integer mode requires whole-number bounds.",
          "INVALID_CUSTOM_INTEGER_BOUND"
        );
      }
      scaledMin = min;
      scaledMax = max;
    } else {
      if (!Number.isSafeInteger(precision) || precision < 1 || precision > 6) {
        throw new CustomExperienceError(
          "Decimal precision must be from 1 to 6.",
          "INVALID_CUSTOM_NUMBER_PRECISION"
        );
      }
      const scale = 10 ** precision;
      const rawMin = min * scale;
      const rawMax = max * scale;
      scaledMin = Math.round(rawMin);
      scaledMax = Math.round(rawMax);
      if (
        !Number.isSafeInteger(scaledMin)
        || !Number.isSafeInteger(scaledMax)
        || Math.abs(rawMin - scaledMin) > 1e-7
        || Math.abs(rawMax - scaledMax) > 1e-7
      ) {
        throw new CustomExperienceError(
          "Number bounds do not match the selected decimal precision.",
          "CUSTOM_NUMBER_PRECISION_MISMATCH"
        );
      }
    }

    const size = scaledMax - scaledMin + 1;
    if (
      !Number.isSafeInteger(size)
      || size < 1
      || size > 0x100000000
    ) {
      throw new CustomExperienceError(
        "Custom number range can contain at most 4,294,967,296 distinct values.",
        "CUSTOM_NUMBER_RANGE_TOO_LARGE"
      );
    }
    if (unique && count > size) {
      throw new CustomExperienceError(
        "Unique number count exceeds the available values.",
        "CUSTOM_UNIQUE_COUNT_TOO_LARGE"
      );
    }

    return {
      mode,
      min,
      max,
      count,
      precision,
      unique
    };
  }

  if (primitive === "dice") {
    const expression = cleanText(
      config.expression || "1d6",
      "Dice expression",
      300,
      { required: true }
    );

    try {
      parseDiceExpression(expression);
    } catch (error) {
      throw new CustomExperienceError(
        "Invalid dice expression: " + (error?.message || "could not parse."),
        "INVALID_CUSTOM_DICE_EXPRESSION"
      );
    }

    return { expression };
  }

  if (primitive === "faces") {
    const faces = (Array.isArray(config.faces) ? config.faces : [])
      .map((face) => cleanText(face, "Die face", 80, { required: true }));
    if (faces.length < 2 || faces.length > 100) {
      throw new CustomExperienceError(
        "Custom Dice need 2–100 faces.",
        "INVALID_CUSTOM_DIE_FACES"
      );
    }
    const count = Number(config.count == null ? 1 : config.count);
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
      throw new CustomExperienceError(
        "Custom Dice count must be from 1 to 100.",
        "INVALID_CUSTOM_DIE_COUNT"
      );
    }
    return { faces, count };
  }

  if (primitive === "deck") {
    const cards = (Array.isArray(config.cards) ? config.cards : [])
      .map((card) => cleanText(card, "Card", 120, { required: true }));
    if (cards.length < 1 || cards.length > MAX_ENTRIES) {
      throw new CustomExperienceError(
        "Custom Deck needs 1–500 cards.",
        "INVALID_CUSTOM_DECK"
      );
    }
    const drawCount = Number(config.drawCount == null ? 1 : config.drawCount);
    if (
      !Number.isSafeInteger(drawCount)
      || drawCount < 1
      || drawCount > Math.min(100, cards.length)
    ) {
      throw new CustomExperienceError(
        "Deck draw count is invalid.",
        "INVALID_CUSTOM_DECK_DRAW"
      );
    }
    return {
      cards,
      drawCount,
      replacement: Boolean(config.replacement)
    };
  }

  if (primitive === "table") {
    const rows = normalizeEntries(config.rows, {
      min: 1,
      label: "Table rows"
    });
    if (!rows.some((row) => row.weight > 0)) {
      throw new CustomExperienceError(
        "At least one table row must have positive weight.",
        "CUSTOM_NO_ELIGIBLE_ROWS"
      );
    }
    return { rows };
  }

  if (primitive === "compound") {
    const steps = Array.isArray(config.steps) ? config.steps : [];
    if (steps.length < 2 || steps.length > MAX_COMPOUND_STEPS) {
      throw new CustomExperienceError(
        "Compound generators need 2–8 steps.",
        "INVALID_COMPOUND_STEP_COUNT"
      );
    }

    const normalized = [];
    const seen = new Set();

    steps.forEach((step, index) => {
      const id = cleanText(
        step?.id || ("step:" + index),
        "Step ID",
        60,
        { required: true }
      );
      if (seen.has(id)) {
        throw new CustomExperienceError(
          "Compound step IDs must be unique.",
          "DUPLICATE_COMPOUND_STEP"
        );
      }

      const stepPrimitive = String(step?.primitive || "pick");
      const input = step?.input?.kind === "step"
        ? {
            kind: "step",
            stepId: String(step.input.stepId || "")
          }
        : step?.input?.kind === "prompt"
          ? { kind: "prompt" }
          : { kind: "config" };

      if (input.kind === "step" && !seen.has(input.stepId)) {
        throw new CustomExperienceError(
          "Compound dependencies may reference only earlier steps.",
          "INVALID_COMPOUND_DEPENDENCY"
        );
      }

      if (
        input.kind !== "config"
        && !["pick", "sample", "shuffle"].includes(stepPrimitive)
      ) {
        throw new CustomExperienceError(
          "Only pick, sample, and shuffle steps can consume prompt or previous-step items.",
          "INVALID_COMPOUND_INPUT_TYPE"
        );
      }

      normalized.push({
        id,
        name: cleanText(
          step?.name || ("Step " + (index + 1)),
          "Step name",
          80,
          { required: true }
        ),
        primitive: stepPrimitive,
        input,
        config: normalizePrimitiveConfig(
          stepPrimitive,
          step?.config || {},
          { compoundStep: true }
        )
      });
      seen.add(id);
    });

    const finalStepId = String(
      config.finalStepId || normalized[normalized.length - 1].id
    );
    if (!seen.has(finalStepId)) {
      throw new CustomExperienceError(
        "Compound final step does not exist.",
        "INVALID_COMPOUND_FINAL_STEP"
      );
    }

    return {
      steps: normalized,
      finalStepId
    };
  }

  throw new CustomExperienceError(
    "Unsupported custom primitive.",
    "UNSUPPORTED_CUSTOM_PRIMITIVE"
  );
}

function normalizeCustomRules(rules = {}) {
  const minItems = Number(rules.minItems == null ? 1 : rules.minItems);
  const maxItems = Number(rules.maxItems == null ? MAX_ENTRIES : rules.maxItems);

  if (
    !Number.isSafeInteger(minItems)
    || !Number.isSafeInteger(maxItems)
    || minItems < 1
    || maxItems < minItems
    || maxItems > MAX_ENTRIES
  ) {
    throw new CustomExperienceError(
      "Input rule bounds must be whole numbers with 1 ≤ minimum ≤ maximum ≤ 500.",
      "INVALID_CUSTOM_INPUT_RULE_BOUNDS"
    );
  }

  const excludedLabels = Array.from(new Set(
    (Array.isArray(rules.excludedLabels) ? rules.excludedLabels : [])
      .map((value) => cleanText(value, "Excluded label", 120))
      .filter(Boolean)
  )).slice(0, 100);

  return {
    deduplicate: Boolean(rules.deduplicate),
    excludedLabels,
    caseSensitiveExclusions: Boolean(rules.caseSensitiveExclusions),
    minItems,
    maxItems
  };
}

function normalizeAppearance(appearance = {}) {
  const accent = CUSTOM_ACCENTS.includes(appearance.accent)
    ? appearance.accent
    : "cyan";
  const layout = CUSTOM_LAYOUTS.includes(appearance.layout)
    ? appearance.layout
    : "auto";

  return {
    accent,
    layout,
    resultLabel: cleanText(
      appearance.resultLabel || "Result",
      "Result label",
      60
    ) || "Result",
    actionLabel: cleanText(
      appearance.actionLabel || "GENERATE",
      "Action label",
      40
    ) || "GENERATE"
  };
}

export function normalizeCustomExperience(definition, {
  preserveId = true
} = {}) {
  assertSafeSerializable(definition);

  if (definitionBytes(definition) > MAX_DEFINITION_BYTES) {
    throw new CustomExperienceError(
      "Custom Experience exceeds the 100 KB definition limit.",
      "CUSTOM_DEFINITION_TOO_LARGE"
    );
  }

  const primitive = String(definition?.primitive || "pick");
  const id = preserveId && definition?.id
    ? String(definition.id)
    : uuid();
  const status = definition?.status === "published" ? "published" : "draft";
  const createdAt = Number(definition?.createdAt) || now();

  const value = {
    id,
    schemaVersion: CUSTOM_EXPERIENCE_SCHEMA_VERSION,
    revision:
      Number.isSafeInteger(definition?.revision) && definition.revision > 0
        ? definition.revision
        : 1,
    status,
    name: cleanText(
      definition?.name,
      "Experience name",
      80,
      { required: true }
    ),
    description: cleanText(
      definition?.description || "",
      "Description",
      300
    ),
    icon: cleanText(definition?.icon || "✦", "Icon", 8) || "✦",
    primitive,
    config: normalizePrimitiveConfig(primitive, definition?.config || {}),
    rules: normalizeCustomRules(definition?.rules || {}),
    appearance: normalizeAppearance(definition?.appearance || {}),
    tags: Array.from(new Set(
      (Array.isArray(definition?.tags) ? definition.tags : [])
        .map((tag) => cleanText(tag, "Tag", 30))
        .filter(Boolean)
    )).slice(0, 12),
    favorite: Boolean(definition?.favorite),
    createdAt,
    updatedAt: Number(definition?.updatedAt) || createdAt
  };

  if (definitionBytes(value) > MAX_DEFINITION_BYTES) {
    throw new CustomExperienceError(
      "Normalized Custom Experience exceeds the size limit.",
      "CUSTOM_DEFINITION_TOO_LARGE"
    );
  }

  return value;
}

export function validateCustomExperience(definition) {
  try {
    return {
      valid: true,
      value: normalizeCustomExperience(definition),
      errors: []
    };
  } catch (error) {
    return {
      valid: false,
      value: null,
      errors: [{
        code: error?.code || "CUSTOM_VALIDATION_ERROR",
        message: error?.message || "Invalid Custom Experience."
      }]
    };
  }
}

export function createCustomExperience(definition) {
  return normalizeCustomExperience({
    ...definition,
    id: definition?.id || uuid(),
    revision: 1,
    status: definition?.status || "draft",
    createdAt: now(),
    updatedAt: now()
  });
}

export function updateCustomExperience(experience, patch = {}) {
  const next = normalizeCustomExperience({
    ...clone(experience),
    ...clone(patch),
    id: experience.id,
    revision: experience.revision + 1,
    createdAt: experience.createdAt,
    updatedAt: now()
  });
  return next;
}

export function publishCustomExperience(experience) {
  return updateCustomExperience(experience, {
    status: "published"
  });
}

export function customToolId(experienceId) {
  return "custom:" + String(experienceId);
}

export function customIdFromToolId(toolId) {
  const text = String(toolId || "");
  return text.startsWith("custom:") ? text.slice(7) : null;
}

export function experienceAsTool(experience) {
  return {
    id: customToolId(experience.id),
    name: experience.name,
    icon: experience.icon,
    category: "custom",
    blurb: experience.description || "User-created randomizer.",
    accent: experience.appearance.accent,
    aliases: [...experience.tags],
    custom: true,
    customExperienceId: experience.id,
    primitive: experience.primitive
  };
}

export function exportCustomExperience(experience) {
  const normalized = normalizeCustomExperience(experience);
  return JSON.stringify({
    type: "randomizer-arcade-custom-experience",
    version: CUSTOM_EXPORT_VERSION,
    experience: {
      ...normalized,
      status: "published"
    }
  }, null, 2);
}

export function importCustomExperience(text) {
  const source = String(text || "");
  if (new TextEncoder().encode(source).length > MAX_DEFINITION_BYTES * 2) {
    throw new CustomExperienceError(
      "Import is too large.",
      "CUSTOM_IMPORT_TOO_LARGE"
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new CustomExperienceError(
      "Import is not valid JSON.",
      "CUSTOM_IMPORT_JSON"
    );
  }

  assertSafeSerializable(parsed);

  if (
    parsed?.type !== "randomizer-arcade-custom-experience"
    || parsed?.version !== CUSTOM_EXPORT_VERSION
  ) {
    throw new CustomExperienceError(
      "Unsupported Custom Experience export format.",
      "CUSTOM_IMPORT_FORMAT"
    );
  }

  const normalized = normalizeCustomExperience(
    parsed.experience,
    { preserveId: false }
  );

  return {
    ...normalized,
    id: uuid(),
    revision: 1,
    status: "draft",
    favorite: false,
    createdAt: now(),
    updatedAt: now()
  };
}

export const CUSTOM_LIMITS = Object.freeze({
  maxDefinitionBytes: MAX_DEFINITION_BYTES,
  maxEntries: MAX_ENTRIES,
  maxCompoundSteps: MAX_COMPOUND_STEPS
});
