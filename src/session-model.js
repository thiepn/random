export const RUN_SCHEMA_VERSION = 1;
export const SESSION_SCHEMA_VERSION = 1;

export const STATEFUL_TOOLS = new Set(["cards", "elimination"]);

export class SessionModelError extends Error {
  constructor(message, code = "SESSION_ERROR") {
    super(message);
    this.name = "SessionModelError";
    this.code = code;
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new SessionModelError("Secure UUID generation is unavailable.", "UUID_UNAVAILABLE");
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function now() {
  return Date.now();
}

function stableNormalize(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value instanceof Set) {
    return [...value].map(stableNormalize).sort();
  }
  if (value instanceof Map) {
    return [...value.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([key, item]) => [key, stableNormalize(item)]);
  }

  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) output[key] = stableNormalize(value[key]);
  }
  return output;
}

export function stableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

export function fingerprintSetup(toolId, inputSnapshot, configSnapshot) {
  const text = stableStringify({
    toolId,
    inputSnapshot,
    configSnapshot
  });

  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return "fp1:" + (hash >>> 0).toString(16).padStart(8, "0");
}

export function isStatefulTool(toolId) {
  return STATEFUL_TOOLS.has(toolId);
}

export function createSession({
  toolId,
  toolName,
  icon = "✦",
  title = null,
  initialState,
  setupFingerprint,
  inputSnapshot = null,
  configSnapshot = null
}) {
  if (!isStatefulTool(toolId)) {
    throw new SessionModelError(
      "Only stateful tools create automatic sessions.",
      "TOOL_NOT_STATEFUL"
    );
  }

  const timestamp = now();
  return {
    id: uuid(),
    schemaVersion: SESSION_SCHEMA_VERSION,
    revision: 1,
    toolId,
    toolName: toolName || toolId,
    icon,
    title: title || (toolName || toolId) + " session",
    status: "active",
    setupFingerprint: setupFingerprint || null,
    inputSnapshot: clone(inputSnapshot),
    configSnapshot: clone(configSnapshot),
    initialState: clone(initialState),
    currentState: clone(initialState),
    runIds: [],
    abandonedRunIds: [],
    cursor: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null
  };
}

export function createRun({
  toolId,
  toolName,
  icon = "✦",
  sessionId = null,
  setupFingerprint = null,
  inputSnapshot = null,
  configSnapshot = null,
  beforeState = null,
  afterState = null,
  result,
  summary,
  detail = null,
  fairness = null,
  randomContext = null,
  origin = "local",
  replayOfRunId = null
}) {
  return {
    id: uuid(),
    schemaVersion: RUN_SCHEMA_VERSION,
    toolId,
    toolName: toolName || toolId,
    icon,
    sessionId,
    setupFingerprint,
    inputSnapshot: clone(inputSnapshot),
    configSnapshot: clone(configSnapshot),
    beforeState: clone(beforeState),
    afterState: clone(afterState),
    result: clone(result),
    summary: String(summary ?? ""),
    detail: clone(detail),
    fairness: clone(fairness),
    randomContext: clone(randomContext),
    origin,
    replayOfRunId,
    timestamp: now()
  };
}

export function createSessionEvent(sessionId, type, payload = null) {
  return {
    id: uuid(),
    sessionId,
    type,
    payload: clone(payload),
    timestamp: now()
  };
}

export function appendRunToSession(session, run) {
  if (!session || session.status !== "active") {
    throw new SessionModelError(
      "Cannot append a run to an inactive session.",
      "SESSION_NOT_ACTIVE"
    );
  }
  if (run.sessionId !== session.id) {
    throw new SessionModelError(
      "Run belongs to a different session.",
      "SESSION_RUN_MISMATCH"
    );
  }

  const next = clone(session);
  const future = next.runIds.slice(next.cursor);
  if (future.length) next.abandonedRunIds.push(...future);

  next.runIds = next.runIds.slice(0, next.cursor);
  next.runIds.push(run.id);
  next.cursor = next.runIds.length;
  next.currentState = clone(run.afterState);
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function sessionCanUndo(session) {
  return Boolean(session && session.status === "active" && session.cursor > 0);
}

export function sessionCanRedo(session) {
  return Boolean(
    session
    && session.status === "active"
    && session.cursor < session.runIds.length
  );
}

export function undoSession(session, runsById) {
  if (!sessionCanUndo(session)) {
    throw new SessionModelError("Nothing to undo.", "NOTHING_TO_UNDO");
  }

  const next = clone(session);
  next.cursor -= 1;

  if (next.cursor === 0) {
    next.currentState = clone(next.initialState);
  } else {
    const run = runsById.get(next.runIds[next.cursor - 1]);
    if (!run) {
      throw new SessionModelError(
        "A session Run required for Undo is missing.",
        "RUN_MISSING"
      );
    }
    next.currentState = clone(run.afterState);
  }

  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function redoSession(session, runsById) {
  if (!sessionCanRedo(session)) {
    throw new SessionModelError("Nothing to redo.", "NOTHING_TO_REDO");
  }

  const next = clone(session);
  const run = runsById.get(next.runIds[next.cursor]);
  if (!run) {
    throw new SessionModelError(
      "A session Run required for Redo is missing.",
      "RUN_MISSING"
    );
  }

  next.cursor += 1;
  next.currentState = clone(run.afterState);
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function completeSession(session) {
  if (!session) {
    throw new SessionModelError("Session is required.", "SESSION_REQUIRED");
  }
  const next = clone(session);
  next.status = "completed";
  next.completedAt = now();
  next.updatedAt = next.completedAt;
  next.revision += 1;
  return next;
}

export function abandonSession(session) {
  if (!session) {
    throw new SessionModelError("Session is required.", "SESSION_REQUIRED");
  }
  const next = clone(session);
  next.status = "abandoned";
  next.completedAt = now();
  next.updatedAt = next.completedAt;
  next.revision += 1;
  return next;
}

export function resumeSessionState(session) {
  if (!session) {
    throw new SessionModelError("Session is required.", "SESSION_REQUIRED");
  }
  return clone(session.currentState);
}

export function sessionAppliedRunIds(session) {
  return session ? session.runIds.slice(0, session.cursor) : [];
}

export function sessionRedoRunIds(session) {
  return session ? session.runIds.slice(session.cursor) : [];
}

export function isSessionCompleteForTool(toolId, afterState) {
  if (toolId === "cards") {
    return Array.isArray(afterState?.deck) && afterState.deck.length === 0;
  }

  if (toolId === "elimination") {
    return Boolean(afterState?.result?.winner);
  }

  return false;
}

export function legacyHistoryToRun(entry) {
  return {
    id: "legacy:" + String(entry.id),
    schemaVersion: 0,
    toolId: entry.toolId,
    toolName: entry.toolName || entry.toolId,
    icon: entry.icon || "✦",
    sessionId: null,
    setupFingerprint: null,
    inputSnapshot: null,
    configSnapshot: null,
    beforeState: null,
    afterState: null,
    result: null,
    summary: entry.resultSummary || "",
    detail: clone(entry.detail),
    fairness: null,
    randomContext: null,
    origin: "legacy",
    replayOfRunId: null,
    timestamp: entry.timestamp || 0
  };
}

export function groupHistoryRuns(runs, sessionsById = new Map()) {
  const sorted = [...runs].sort((a, b) => b.timestamp - a.timestamp);
  const groups = [];

  for (const run of sorted) {
    if (run.sessionId) {
      const existing = groups.find(
        (group) => group.kind === "session" && group.sessionId === run.sessionId
      );

      if (existing) {
        existing.runs.push(run);
        existing.timestamp = Math.max(existing.timestamp, run.timestamp);
      } else {
        const session = sessionsById.get(run.sessionId) || null;
        groups.push({
          kind: "session",
          sessionId: run.sessionId,
          toolId: run.toolId,
          toolName: run.toolName,
          icon: run.icon,
          title: session?.title || run.toolName + " session",
          status: session?.status || "unknown",
          timestamp: run.timestamp,
          runs: [run]
        });
      }
      continue;
    }

    const previous = groups[groups.length - 1];
    const sameBurst = previous
      && previous.kind === "burst"
      && previous.toolId === run.toolId
      && previous.setupFingerprint
      && previous.setupFingerprint === run.setupFingerprint
      && Math.abs(previous.oldestTimestamp - run.timestamp) <= 30 * 60 * 1000;

    if (sameBurst) {
      previous.runs.push(run);
      previous.oldestTimestamp = Math.min(previous.oldestTimestamp, run.timestamp);
    } else {
      groups.push({
        kind: "burst",
        toolId: run.toolId,
        toolName: run.toolName,
        icon: run.icon,
        setupFingerprint: run.setupFingerprint,
        timestamp: run.timestamp,
        oldestTimestamp: run.timestamp,
        runs: [run]
      });
    }
  }

  for (const group of groups) {
    group.runs.sort((a, b) => b.timestamp - a.timestamp);
  }

  return groups.sort((a, b) => b.timestamp - a.timestamp);
}
