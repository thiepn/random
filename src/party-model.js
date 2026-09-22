export const PARTY_SCHEMA_VERSION = 1;

export class PartyModelError extends Error {
  constructor(message, code = "PARTY_ERROR") {
    super(message);
    this.name = "PartyModelError";
    this.code = code;
  }
}

const PACES = new Set(["fast", "standard", "dramatic"]);
const COUNTDOWNS = new Set(["off", "short", "full"]);

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new PartyModelError(
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

export function normalizePartyOptions(options = {}) {
  return {
    pace: PACES.has(options.pace) ? options.pace : "standard",
    countdown: COUNTDOWNS.has(options.countdown)
      ? options.countdown
      : "short",
    hostLocked: Boolean(options.hostLocked),
    wakeLock: options.wakeLock !== false,
    audienceEnabled: Boolean(options.audienceEnabled),
    fullscreen: options.fullscreen !== false
  };
}

export function createPartySession({
  toolId,
  toolName,
  icon = "✦",
  options = {}
}) {
  if (!toolId) {
    throw new PartyModelError("Party tool is required.", "PARTY_TOOL_REQUIRED");
  }

  const timestamp = now();
  return {
    id: uuid(),
    schemaVersion: PARTY_SCHEMA_VERSION,
    revision: 1,
    toolId: String(toolId),
    toolName: String(toolName || toolId),
    icon: String(icon || "✦"),
    status: "active",
    options: normalizePartyOptions(options),
    runIds: [],
    round: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null
  };
}

export function updatePartyOptions(session, patch = {}) {
  const next = clone(session);
  next.options = normalizePartyOptions({
    ...next.options,
    ...patch
  });
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function appendPartyRun(session, runId) {
  if (!session || session.status !== "active") {
    throw new PartyModelError(
      "Party Session is not active.",
      "PARTY_NOT_ACTIVE"
    );
  }
  const next = clone(session);
  next.runIds.push(String(runId));
  next.round = next.runIds.length + 1;
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function completePartySession(session) {
  const next = clone(session);
  next.status = "completed";
  next.completedAt = now();
  next.updatedAt = next.completedAt;
  next.revision += 1;
  return next;
}

export function partyPresentationMode(pace) {
  if (pace === "fast") return "instant";
  if (pace === "dramatic") return "showtime";
  return "normal";
}

export function countdownSeconds(mode) {
  if (mode === "off") return 0;
  if (mode === "full") return 5;
  return 3;
}

export function isPrivatePartyTool(toolId) {
  return toolId === "secret-santa";
}

function stringifyPrimitive(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}

export function publicPartyResult(toolId, result) {
  if (toolId === "secret-santa") return null;
  if (result == null) return null;

  if (typeof result === "string" || typeof result === "number") {
    return String(result);
  }

  if (Array.isArray(result)) {
    if (result.every((item) => typeof item === "string" || typeof item === "number")) {
      return result.map(String);
    }

    if (toolId === "teams" || toolId === "groups" || toolId === "pairs") {
      return result.map((group) =>
        Array.isArray(group)
          ? group.map(String)
          : stringifyPrimitive(group)
      );
    }

    if (toolId === "assignment") {
      return result.map((item) => ({
        source: String(item?.source || ""),
        target: String(item?.target || "")
      }));
    }

    if (toolId === "tournament") {
      return result.map((match) => ({
        a: match?.a ? String(match.a) : null,
        b: match?.b ? String(match.b) : null,
        bye: Boolean(match?.bye)
      }));
    }

    if (toolId === "ladder") {
      return result.map((item) => ({
        source: String(item?.source || ""),
        target: String(item?.target || "")
      }));
    }

    return result.map((item) => stringifyPrimitive(item));
  }

  if (toolId === "dice") {
    if (result.mode === "expression") {
      return {
        total: result.total,
        expression: result.expression
      };
    }
    return {
      total: result.total,
      values: Array.isArray(result.values)
        ? result.values.map(Number)
        : []
    };
  }

  if (toolId === "cards") {
    return {
      card: result.card ? String(result.card) : "",
      remaining: Number(result.remaining || 0)
    };
  }

  if (toolId === "elimination") {
    return {
      eliminated: result.eliminated ? String(result.eliminated) : null,
      winner: result.winner ? String(result.winner) : null,
      remaining: Number(result.remaining || 0)
    };
  }

  if (Array.isArray(result.displayValues)) {
    return result.displayValues.map(String);
  }

  if (result.summary) return String(result.summary);
  if (result.iso) return String(result.iso);
  if (result.x != null && result.y != null) {
    return { x: result.x, y: result.y };
  }

  return null;
}

export function sanitizeFairnessForAudience(fairness) {
  if (!fairness) return null;

  return {
    kind: fairness.kind || null,
    mode: fairness.mode || null,
    operation: fairness.operation || null,
    candidateCount: fairness.candidateCount ?? null,
    eligibleCount: fairness.eligibleCount ?? null,
    hardRuleCount: fairness.hardRuleCount ?? null,
    softRuleCount: fairness.softRuleCount ?? null,
    solverEffort: fairness.solverEffort || null,
    uniformOverValidResults:
      fairness.uniformOverValidResults ?? null
  };
}

export function makeAudienceState({
  party,
  tool,
  run = null,
  stage = "ready",
  countdown = 0,
  privateReveal = false
}) {
  if (!party || !tool) {
    throw new PartyModelError(
      "Party and tool are required for audience state.",
      "AUDIENCE_STATE_INVALID"
    );
  }

  const privateTool = isPrivatePartyTool(tool.id);
  const publicResult =
    privateTool || privateReveal
      ? null
      : publicPartyResult(tool.id, run?.result);

  return {
    schemaVersion: 1,
    partyId: party.id,
    tool: {
      id: tool.id,
      name: tool.name,
      icon: tool.icon,
      accent: tool.accent
    },
    round: party.round,
    pace: party.options.pace,
    stage,
    countdown: Number(countdown || 0),
    private: privateTool || privateReveal,
    statusText:
      privateTool || privateReveal
        ? "Private reveal on host device"
        : stage === "countdown"
          ? "Get ready"
          : run
            ? "Result"
            : "Ready",
    result: publicResult,
    fairness: privateTool
      ? null
      : sanitizeFairnessForAudience(run?.fairness),
    updatedAt: now()
  };
}
