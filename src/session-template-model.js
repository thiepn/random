export const SESSION_TEMPLATE_SCHEMA_VERSION = 1;
export const TEMPLATE_SESSION_SCHEMA_VERSION = 1;

export class SessionTemplateError extends Error {
  constructor(message, code = "SESSION_TEMPLATE_ERROR") {
    super(message);
    this.name = "SessionTemplateError";
    this.code = code;
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new SessionTemplateError(
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

function normalizeInput(input = {}, index = 0) {
  const kind = ["preset", "previous", "prompt", "frozen"].includes(input.kind)
    ? input.kind
    : index === 0
      ? "prompt"
      : "previous";

  if (kind === "preset") {
    return {
      kind,
      presetId: input.presetId ? String(input.presetId) : null
    };
  }

  if (kind === "previous") {
    return {
      kind,
      sourceStepId: input.sourceStepId
        ? String(input.sourceStepId)
        : null
    };
  }

  if (kind === "frozen") {
    return {
      kind,
      items: Array.isArray(input.items)
        ? input.items.map((item) => String(item))
        : []
    };
  }

  return { kind: "prompt" };
}

export function createSessionTemplate({
  name,
  description = "",
  steps = [],
  favorite = false,
  builtinKey = null
}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new SessionTemplateError(
      "Template name is required.",
      "TEMPLATE_NAME_REQUIRED"
    );
  }

  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 20) {
    throw new SessionTemplateError(
      "A Session Template needs 1–20 steps.",
      "INVALID_STEP_COUNT"
    );
  }

  const normalized = steps.map((step, index) => ({
    id: String(step?.id || uuid()),
    name: String(step?.name || ("Step " + (index + 1))).trim()
      || ("Step " + (index + 1)),
    toolId: String(step?.toolId || ""),
    presetId: step?.presetId ? String(step.presetId) : null,
    input: normalizeInput(step?.input || {}, index)
  }));

  if (normalized.some((step) => !step.toolId)) {
    throw new SessionTemplateError(
      "Every step needs a tool.",
      "STEP_TOOL_REQUIRED"
    );
  }

  const seen = new Set();
  for (let index = 0; index < normalized.length; index += 1) {
    const step = normalized[index];
    if (seen.has(step.id)) {
      throw new SessionTemplateError(
        "Template step IDs must be unique.",
        "DUPLICATE_STEP_ID"
      );
    }

    if (step.input.kind === "previous") {
      const sourceId = step.input.sourceStepId
        || normalized[index - 1]?.id
        || null;
      if (!sourceId || !seen.has(sourceId)) {
        throw new SessionTemplateError(
          "Previous-result input must reference an earlier step.",
          "INVALID_STEP_DEPENDENCY"
        );
      }
      step.input.sourceStepId = sourceId;
    }

    seen.add(step.id);
  }

  const timestamp = now();
  return {
    id: builtinKey ? "builtin:" + String(builtinKey) : uuid(),
    schemaVersion: SESSION_TEMPLATE_SCHEMA_VERSION,
    revision: 1,
    name: cleanName,
    description: String(description || ""),
    favorite: Boolean(favorite),
    builtinKey: builtinKey ? String(builtinKey) : null,
    steps: normalized,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createTemplateSession(template) {
  const timestamp = now();
  return {
    id: uuid(),
    schemaVersion: TEMPLATE_SESSION_SCHEMA_VERSION,
    revision: 1,
    templateId: template.id,
    templateRevision: template.revision,
    templateName: template.name,
    status: "active",
    currentIndex: 0,
    steps: template.steps.map((step) => ({
      stepId: step.id,
      name: step.name,
      toolId: step.toolId,
      status: "pending",
      runId: null,
      resultItems: [],
      locked: false,
      invalidatedAt: null
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null
  };
}

export function completeTemplateStep(
  session,
  stepIndex,
  runId,
  resultItems = []
) {
  if (!session || session.status !== "active") {
    throw new SessionTemplateError(
      "Template Session is not active.",
      "TEMPLATE_SESSION_NOT_ACTIVE"
    );
  }
  if (
    !Number.isSafeInteger(stepIndex)
    || stepIndex < 0
    || stepIndex >= session.steps.length
  ) {
    throw new SessionTemplateError(
      "Invalid template step.",
      "INVALID_TEMPLATE_STEP"
    );
  }

  const next = clone(session);
  const step = next.steps[stepIndex];
  step.status = "complete";
  step.runId = String(runId);
  step.resultItems = Array.isArray(resultItems)
    ? resultItems.map((item) => String(item))
    : [];
  step.invalidatedAt = null;

  let nextIndex = stepIndex + 1;
  while (
    nextIndex < next.steps.length
    && next.steps[nextIndex].status === "complete"
  ) {
    nextIndex += 1;
  }

  next.currentIndex = Math.min(nextIndex, next.steps.length);
  if (next.currentIndex >= next.steps.length) {
    next.status = "completed";
    next.completedAt = now();
  }

  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function setTemplateStepLocked(session, stepIndex, locked) {
  if (!session?.steps?.[stepIndex]) {
    throw new SessionTemplateError(
      "Invalid template step.",
      "INVALID_TEMPLATE_STEP"
    );
  }

  const next = clone(session);
  next.steps[stepIndex].locked = Boolean(locked);
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function rerunTemplateFrom(session, stepIndex) {
  if (session.status === "abandoned") {
    throw new SessionTemplateError(
      "Abandoned Session cannot be rerun.",
      "TEMPLATE_SESSION_ABANDONED"
    );
  }
  if (
    !Number.isSafeInteger(stepIndex)
    || stepIndex < 0
    || stepIndex >= session.steps.length
  ) {
    throw new SessionTemplateError(
      "Invalid template step.",
      "INVALID_TEMPLATE_STEP"
    );
  }
  if (session.steps[stepIndex].locked) {
    throw new SessionTemplateError(
      "Unlock this step before rerunning it.",
      "STEP_LOCKED"
    );
  }

  const next = clone(session);
  next.status = "active";
  next.completedAt = null;

  for (let index = stepIndex; index < next.steps.length; index += 1) {
    const step = next.steps[index];

    if (index > stepIndex && step.locked && step.status === "complete") {
      // A locked output is an explicit dependency boundary.
      break;
    }

    if (!step.locked) {
      step.status = "pending";
      step.runId = null;
      step.resultItems = [];
      step.invalidatedAt = now();
    }
  }

  next.currentIndex = stepIndex;
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function previousStepItems(session, template, stepIndex) {
  const definition = template.steps[stepIndex];
  if (!definition) return [];

  const sourceId = definition.input?.sourceStepId;
  if (!sourceId) return [];

  const sourceIndex = template.steps.findIndex((step) => step.id === sourceId);
  if (sourceIndex < 0) return [];

  return clone(session.steps[sourceIndex]?.resultItems || []);
}

export function abandonTemplateSession(session) {
  const next = clone(session);
  next.status = "abandoned";
  next.completedAt = now();
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function resultToItems(toolId, result) {
  if (result == null) return [];

  if (typeof result === "string" || typeof result === "number") {
    return [String(result)];
  }

  if (Array.isArray(result)) {
    if (result.every((item) => typeof item === "string" || typeof item === "number")) {
      return result.map(String);
    }

    if (
      result.every(
        (item) =>
          Array.isArray(item)
          && item.every((value) => typeof value === "string" || typeof value === "number")
      )
    ) {
      if (toolId === "teams") {
        return result.map(
          (group, index) =>
            "Team " + (index + 1) + " · " + group.map(String).join(", ")
        );
      }
      if (toolId === "groups") {
        return result.map(
          (group, index) =>
            "Group " + (index + 1) + " · " + group.map(String).join(", ")
        );
      }
      if (toolId === "pairs") {
        return result.map((group) => group.map(String).join(" & "));
      }
      return result.flat().map(String);
    }

    if (toolId === "assignment") {
      return result.map((item) => String(item.source));
    }

    if (toolId === "tournament") {
      return result
        .flatMap((match) => [match?.a, match?.b])
        .filter(Boolean)
        .map(String);
    }

    if (toolId === "ladder") {
      return result.map((item) => String(item.source));
    }

    return result.map((item) =>
      item?.label
      || item?.source
      || item?.summary
      || JSON.stringify(item)
    );
  }

  if (Array.isArray(result.items)) {
    return result.items.map(String);
  }
  if (result.output != null) {
    return resultToItems(toolId, result.output);
  }
  if (Array.isArray(result.values)) {
    return result.values.map(String);
  }
  if (Array.isArray(result.displayValues)) {
    return result.displayValues.map(String);
  }
  if (result.card) return [String(result.card)];
  if (result.winner) return [String(result.winner)];
  if (result.eliminated) return [String(result.eliminated)];
  if (result.iso) return [String(result.iso)];
  if (result.summary) return [String(result.summary)];

  return [];
}

export const BUILTIN_SESSION_TEMPLATES = Object.freeze([
  createSessionTemplate({
    name: "Game Night",
    description: "Shuffle players, split teams, then draw first-round matchups.",
    builtinKey: "game-night",
    steps: [
      {
        id: "game-night-shuffle",
        name: "Shuffle Players",
        toolId: "shuffle",
        input: { kind: "prompt" }
      },
      {
        id: "game-night-teams",
        name: "Make Teams",
        toolId: "teams",
        input: {
          kind: "previous",
          sourceStepId: "game-night-shuffle"
        }
      },
      {
        id: "game-night-tournament",
        name: "Tournament Draw",
        toolId: "tournament",
        input: {
          kind: "previous",
          sourceStepId: "game-night-teams"
        }
      }
    ]
  }),
  createSessionTemplate({
    name: "Classroom Mixer",
    description: "Randomize students, create groups, then pick one group.",
    builtinKey: "classroom-mixer",
    steps: [
      {
        id: "classroom-shuffle",
        name: "Shuffle Students",
        toolId: "shuffle",
        input: { kind: "prompt" }
      },
      {
        id: "classroom-groups",
        name: "Create Groups",
        toolId: "groups",
        input: {
          kind: "previous",
          sourceStepId: "classroom-shuffle"
        }
      },
      {
        id: "classroom-presenter",
        name: "Pick Group",
        toolId: "picker",
        input: {
          kind: "previous",
          sourceStepId: "classroom-groups"
        }
      }
    ]
  }),
  createSessionTemplate({
    name: "Tournament Night",
    description: "Randomize entrants and create a tournament draw.",
    builtinKey: "tournament-night",
    steps: [
      {
        id: "tournament-shuffle",
        name: "Shuffle Entrants",
        toolId: "shuffle",
        input: { kind: "prompt" }
      },
      {
        id: "tournament-draw",
        name: "Draw Bracket",
        toolId: "tournament",
        input: {
          kind: "previous",
          sourceStepId: "tournament-shuffle"
        }
      }
    ]
  })
]);
