import {
  pick,
  shuffle,
  weightedPick,
  weightedSample
} from "./random-core.js";
import { rollDiceExpression } from "./dice-engine.js";
import { generateRandomNumbers } from "./number-engine.js";
import {
  normalizeCustomExperience,
  CustomExperienceError
} from "./custom-experience-model.js";

export class CustomExecutionError extends Error {
  constructor(message, code = "CUSTOM_EXECUTION_ERROR") {
    super(message);
    this.name = "CustomExecutionError";
    this.code = code;
  }
}

function promptEntries(runtime = {}) {
  const items = Array.isArray(runtime.inputItems)
    ? runtime.inputItems
    : [];
  return items
    .map((item, index) => ({
      id: "prompt:" + index,
      label: String(item?.label ?? item ?? "").trim(),
      value: String(item?.value ?? item?.label ?? item ?? "").trim(),
      weight: Number.isFinite(Number(item?.weight))
        ? Math.max(0, Number(item.weight))
        : 1
    }))
    .filter((entry) => entry.label);
}

function applyInputRules(entries, rules = {}) {
  let output = [...entries];

  const excluded = new Set(
    (rules.excludedLabels || []).map((value) =>
      rules.caseSensitiveExclusions
        ? String(value)
        : String(value).toLocaleLowerCase()
    )
  );

  if (excluded.size) {
    output = output.filter((entry) => {
      const value = rules.caseSensitiveExclusions
        ? String(entry.label)
        : String(entry.label).toLocaleLowerCase();
      return !excluded.has(value);
    });
  }

  if (rules.deduplicate) {
    const seen = new Set();
    output = output.filter((entry) => {
      const key = String(entry.label).toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const min = Number(rules.minItems || 1);
  const max = Number(rules.maxItems || 500);
  if (output.length < min) {
    throw new CustomExecutionError(
      "Input has fewer than the required " + min + " items after rules.",
      "CUSTOM_INPUT_BELOW_MINIMUM"
    );
  }
  if (output.length > max) {
    throw new CustomExecutionError(
      "Input exceeds the configured maximum of " + max + " items.",
      "CUSTOM_INPUT_ABOVE_MAXIMUM"
    );
  }

  return output;
}

function entriesFor(config, runtime, overrideItems = null, rules = {}) {
  const entries = Array.isArray(overrideItems)
    ? overrideItems.map((item, index) => ({
        id: "derived:" + index,
        label: String(item),
        value: String(item),
        weight: 1
      }))
    : config.source === "prompt"
      ? promptEntries(runtime)
      : config.entries;

  return applyInputRules(entries, rules);
}

export function prepareCustomListEntries(
  definition,
  runtime = {},
  overrideItems = null
) {
  const experience = normalizeCustomExperience(definition);

  if (!["pick", "sample", "shuffle"].includes(experience.primitive)) {
    if (experience.primitive === "table") {
      return applyInputRules(experience.config.rows, experience.rules);
    }
    return [];
  }

  return entriesFor(
    experience.config,
    runtime,
    overrideItems,
    experience.rules
  );
}

function requireEntries(entries, count = 1) {
  if (!Array.isArray(entries) || entries.length < count) {
    throw new CustomExecutionError(
      "This custom randomizer needs at least " + count + " input item"
        + (count === 1 ? "." : "s."),
      "CUSTOM_INPUT_REQUIRED"
    );
  }
}

function entryOutput(entry) {
  return entry.value || entry.label;
}

function resultItems(result) {
  if (result == null) return [];
  if (typeof result === "string" || typeof result === "number") {
    return [String(result)];
  }
  if (Array.isArray(result)) {
    return result.flatMap((item) => resultItems(item));
  }
  if (Array.isArray(result.items)) return result.items.map(String);
  if (Array.isArray(result.values)) return result.values.map(String);
  if (Array.isArray(result.displayValues)) {
    return result.displayValues.map(String);
  }
  if (Array.isArray(result.cards)) return result.cards.map(String);
  if (Array.isArray(result.rolls)) return result.rolls.map(String);
  if (result.output != null) return resultItems(result.output);
  if (result.value != null) return [String(result.value)];
  if (result.summary != null) return [String(result.summary)];
  return [];
}

function executePrimitive(
  primitive,
  config,
  runtime,
  rng,
  overrideItems = null,
  rules = {}
) {
  if (primitive === "pick") {
    const entries = entriesFor(config, runtime, overrideItems, rules);
    requireEntries(entries, 1);
    const chosen = weightedPick(
      entries,
      entries.map((entry) => entry.weight),
      rng
    );
    const selectedIndex = entries.indexOf(chosen);
    const output = entryOutput(chosen);
    return {
      result: output,
      summary: String(output),
      detail: {
        selectedIndex,
        selectedEntryId: chosen.id
      },
      fairness: {
        kind: "custom-selection",
        mode: entries.some((entry) => entry.weight !== 1)
          ? "weighted"
          : "equal",
        candidateCount: entries.length,
        eligibleCount: entries.filter((entry) => entry.weight > 0).length
      }
    };
  }

  if (primitive === "sample") {
    const entries = entriesFor(config, runtime, overrideItems, rules);
    requireEntries(entries, 1);
    const selected = weightedSample(
      entries,
      entries.map((entry) => entry.weight),
      config.count,
      rng,
      { replacement: config.replacement }
    );
    const values = selected.map((entry) => entryOutput(entry.item));
    return {
      result: values,
      summary: values.join(", "),
      fairness: {
        kind: "custom-selection",
        mode: config.replacement
          ? "weighted-with-replacement"
          : "weighted-without-replacement",
        candidateCount: entries.length,
        eligibleCount: entries.filter((entry) => entry.weight > 0).length
      }
    };
  }

  if (primitive === "shuffle") {
    const entries = entriesFor(config, runtime, overrideItems, rules);
    requireEntries(entries, 2);
    const values = shuffle(entries.map(entryOutput), rng);
    return {
      result: values,
      summary: values.join(", "),
      fairness: {
        kind: "custom-shuffle",
        mode: "fisher-yates",
        candidateCount: entries.length
      }
    };
  }

  if (primitive === "number") {
    const generated = generateRandomNumbers(config, rng);
    const result = generated.displayValues.length === 1
      ? generated.displayValues[0]
      : generated.displayValues;
    return {
      result,
      summary: Array.isArray(result) ? result.join(", ") : String(result),
      detail: generated,
      fairness: {
        kind: "custom-number",
        mode: "uniform-discrete-grid",
        candidateCount: generated.max - generated.min + 1
      }
    };
  }

  if (primitive === "dice") {
    const rolled = rollDiceExpression(config.expression, rng);
    return {
      result: {
        total: rolled.total,
        expression: rolled.source,
        canonical: rolled.canonical,
        diceGroups: rolled.diceGroups
      },
      summary: rolled.source + " = " + rolled.total,
      detail: rolled,
      fairness: {
        kind: "custom-dice",
        mode: "uniform-faces",
        randomRollCount: rolled.randomRollCount
      }
    };
  }

  if (primitive === "faces") {
    const rolls = Array.from(
      { length: config.count },
      () => pick(config.faces, rng)
    );
    const result = rolls.length === 1 ? rolls[0] : rolls;
    return {
      result,
      summary: rolls.join(", "),
      fairness: {
        kind: "custom-face-dice",
        mode: "uniform-faces",
        candidateCount: config.faces.length
      }
    };
  }

  if (primitive === "deck") {
    const cards = config.replacement
      ? Array.from(
          { length: config.drawCount },
          () => pick(config.cards, rng)
        )
      : shuffle(config.cards, rng).slice(0, config.drawCount);
    return {
      result: {
        cards,
        remaining: config.replacement
          ? config.cards.length
          : config.cards.length - cards.length
      },
      summary: cards.join(", "),
      fairness: {
        kind: "custom-deck",
        mode: config.replacement
          ? "draw-with-replacement"
          : "draw-without-replacement",
        candidateCount: config.cards.length
      }
    };
  }

  if (primitive === "table") {
    const rows = applyInputRules(config.rows, rules);
    requireEntries(rows, 1);
    const row = weightedPick(
      rows,
      rows.map((entry) => entry.weight),
      rng
    );
    const selectedIndex = rows.indexOf(row);
    const output = entryOutput(row);
    return {
      result: {
        label: row.label,
        value: output
      },
      summary: String(output),
      detail: {
        selectedIndex,
        selectedEntryId: row.id
      },
      fairness: {
        kind: "custom-table",
        mode: rows.some((entry) => entry.weight !== 1)
          ? "weighted"
          : "equal",
        candidateCount: rows.length,
        eligibleCount: rows.filter((entry) => entry.weight > 0).length
      }
    };
  }

  throw new CustomExecutionError(
    "Unsupported custom primitive at runtime.",
    "UNSUPPORTED_CUSTOM_PRIMITIVE"
  );
}

function compoundStepItems(step, outputs, runtime) {
  if (step.input.kind === "prompt") {
    return promptEntries(runtime).map((entry) => entryOutput(entry));
  }
  if (step.input.kind === "step") {
    const source = outputs.get(step.input.stepId);
    return resultItems(source?.result);
  }
  return null;
}

export function executeCustomExperience(definition, runtime = {}, rng) {
  if (!rng || typeof rng.int !== "function") {
    throw new CustomExecutionError(
      "Random source is required.",
      "CUSTOM_RNG_REQUIRED"
    );
  }

  let experience;
  try {
    experience = normalizeCustomExperience(definition);
  } catch (error) {
    if (error instanceof CustomExperienceError) {
      throw new CustomExecutionError(error.message, error.code);
    }
    throw error;
  }

  if (experience.primitive !== "compound") {
    return {
      ...executePrimitive(
        experience.primitive,
        experience.config,
        runtime,
        rng,
        null,
        experience.rules
      ),
      customExperienceId: experience.id,
      customRevision: experience.revision
    };
  }

  const outputs = new Map();
  const detailSteps = [];

  for (const step of experience.config.steps) {
    const overrideItems = compoundStepItems(step, outputs, runtime);
    const executed = executePrimitive(
      step.primitive,
      step.config,
      runtime,
      rng,
      overrideItems,
      experience.rules
    );
    outputs.set(step.id, executed);
    detailSteps.push({
      id: step.id,
      name: step.name,
      primitive: step.primitive,
      summary: executed.summary,
      result: executed.result
    });
  }

  const final = outputs.get(experience.config.finalStepId);
  if (!final) {
    throw new CustomExecutionError(
      "Compound final step did not execute.",
      "CUSTOM_COMPOUND_FINAL_MISSING"
    );
  }

  return {
    result: {
      output: final.result,
      items: resultItems(final.result),
      steps: detailSteps
    },
    summary: final.summary,
    detail: {
      steps: detailSteps,
      finalStepId: experience.config.finalStepId
    },
    fairness: {
      kind: "custom-compound",
      mode: "bounded-linear-pipeline",
      stepCount: experience.config.steps.length
    },
    customExperienceId: experience.id,
    customRevision: experience.revision
  };
}

export function customResultItems(result) {
  return resultItems(result);
}
