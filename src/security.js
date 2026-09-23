export const SECURITY_LIMITS = Object.freeze({
  portableFileBytes: 32 * 1024 * 1024,
  maxRouteTokenChars: 256,
  maxStorageRecordBytes: 32 * 1024 * 1024,
  maxWorkerMessageBytes: 96 * 1024 * 1024,
  maxAudienceMessageBytes: 512 * 1024
});

const FORBIDDEN_OBJECT_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor"
]);

const SAFE_ROUTE_TOKEN = /^[A-Za-z0-9._~:-]+$/;

const AUDIENCE_STAGES = new Set([
  "ready",
  "countdown",
  "result",
  "paused",
  "ended"
]);

const AUDIENCE_ACCENTS = new Set([
  "cyan",
  "purple",
  "gold",
  "red",
  "green",
  "blue",
  "pink",
  "orange",
  "rainbow"
]);

const COMPUTE_TASK_TYPES = new Set([
  "tool.execute",
  "portability.parse",
  "portability.merge",
  "portability.serialize"
]);

export class SecurityBoundaryError extends Error {
  constructor(message, code = "SECURITY_BOUNDARY_ERROR", details = null) {
    super(message);
    this.name = "SecurityBoundaryError";
    this.code = code;
    this.details = details;
  }
}

export function utf8ByteLength(value) {
  const text = String(value ?? "");
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).byteLength;
  }
  return unescape(encodeURIComponent(text)).length;
}

function securityError(message, code, details = null) {
  throw new SecurityBoundaryError(message, code, details);
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, allowed) {
  if (!plainObject(value)) return false;
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

export function assertSafeStructuredData(value, {
  label = "Structured data",
  maxDepth = 80,
  maxNodes = 1000000,
  maxArrayLength = 100000,
  maxObjectKeys = 4096,
  maxStringBytes = 8 * 1024 * 1024,
  maxKeyBytes = 1024,
  maxTotalBytes = 64 * 1024 * 1024,
  allowUndefined = false
} = {}) {
  const active = new Set();
  let nodes = 0;
  let bytes = 0;

  function accountBytes(amount, path) {
    bytes += amount;
    if (bytes > maxTotalBytes) {
      securityError(
        label + " exceeds the allowed data size.",
        "STRUCTURED_DATA_SIZE_LIMIT",
        { path, maxTotalBytes }
      );
    }
  }

  function visit(current, depth, path) {
    nodes += 1;
    if (nodes > maxNodes) {
      securityError(
        label + " contains too many values.",
        "STRUCTURED_DATA_NODE_LIMIT",
        { path, maxNodes }
      );
    }
    if (depth > maxDepth) {
      securityError(
        label + " is nested too deeply.",
        "STRUCTURED_DATA_DEPTH_LIMIT",
        { path, maxDepth }
      );
    }

    if (current === null) {
      accountBytes(4, path);
      return;
    }

    const type = typeof current;

    if (type === "string") {
      const size = utf8ByteLength(current);
      if (size > maxStringBytes) {
        securityError(
          label + " contains an oversized string.",
          "STRUCTURED_DATA_STRING_LIMIT",
          { path, maxStringBytes }
        );
      }
      accountBytes(size, path);
      return;
    }

    if (type === "number") {
      if (!Number.isFinite(current)) {
        securityError(
          label + " contains a non-finite number.",
          "STRUCTURED_DATA_NUMBER_INVALID",
          { path }
        );
      }
      accountBytes(8, path);
      return;
    }

    if (type === "boolean") {
      accountBytes(4, path);
      return;
    }

    if (type === "undefined") {
      if (allowUndefined) return;
      securityError(
        label + " contains undefined data.",
        "STRUCTURED_DATA_UNDEFINED",
        { path }
      );
    }

    if (type !== "object") {
      securityError(
        label + " contains a non-data value.",
        "STRUCTURED_DATA_TYPE_INVALID",
        { path, type }
      );
    }

    if (active.has(current)) {
      securityError(
        label + " contains a cyclic reference.",
        "STRUCTURED_DATA_CYCLE",
        { path }
      );
    }
    active.add(current);

    if (Array.isArray(current)) {
      if (current.length > maxArrayLength) {
        active.delete(current);
        securityError(
          label + " contains an oversized array.",
          "STRUCTURED_DATA_ARRAY_LIMIT",
          { path, maxArrayLength }
        );
      }
      for (let index = 0; index < current.length; index += 1) {
        visit(current[index], depth + 1, path + "[" + index + "]");
      }
      active.delete(current);
      return;
    }

    if (!plainObject(current)) {
      active.delete(current);
      securityError(
        label + " contains an unsupported object type.",
        "STRUCTURED_DATA_OBJECT_INVALID",
        { path }
      );
    }

    const keys = Reflect.ownKeys(current);
    if (keys.length > maxObjectKeys) {
      active.delete(current);
      securityError(
        label + " contains an object with too many properties.",
        "STRUCTURED_DATA_KEY_LIMIT",
        { path, maxObjectKeys }
      );
    }

    for (const key of keys) {
      if (typeof key !== "string") {
        active.delete(current);
        securityError(
          label + " contains a symbol property.",
          "STRUCTURED_DATA_SYMBOL_KEY",
          { path }
        );
      }
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        active.delete(current);
        securityError(
          label + " contains a prohibited object key.",
          "STRUCTURED_DATA_UNSAFE_KEY",
          { path, key }
        );
      }
      const keyBytes = utf8ByteLength(key);
      if (keyBytes > maxKeyBytes) {
        active.delete(current);
        securityError(
          label + " contains an oversized object key.",
          "STRUCTURED_DATA_KEY_SIZE_LIMIT",
          { path, maxKeyBytes }
        );
      }
      accountBytes(keyBytes, path);
      visit(current[key], depth + 1, path + "." + key);
    }

    active.delete(current);
  }

  visit(value, 0, label);
  return value;
}

export function assertSafeStorageRecord(record, {
  store = "storage"
} = {}) {
  if (!plainObject(record) || record.id == null) {
    securityError(
      "Storage record is missing a valid id.",
      "STORAGE_RECORD_INVALID",
      { store }
    );
  }

  const id = String(record.id);
  if (!id || utf8ByteLength(id) > 1024) {
    securityError(
      "Storage record id is invalid.",
      "STORAGE_RECORD_ID_INVALID",
      { store }
    );
  }

  assertSafeStructuredData(record, {
    label: store + " record",
    maxDepth: 80,
    maxNodes: 2000000,
    maxArrayLength: 200000,
    maxObjectKeys: 4096,
    maxStringBytes: SECURITY_LIMITS.maxStorageRecordBytes,
    maxTotalBytes: SECURITY_LIMITS.maxStorageRecordBytes,
    allowUndefined: true
  });

  return record;
}

export function assertJsonImportFile(file, {
  maxBytes = SECURITY_LIMITS.portableFileBytes
} = {}) {
  if (!file || typeof file !== "object") {
    securityError(
      "No import file was provided.",
      "IMPORT_FILE_MISSING"
    );
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size < 0) {
    securityError(
      "Import file size is invalid.",
      "IMPORT_FILE_SIZE_INVALID"
    );
  }
  if (size === 0) {
    securityError(
      "Import file is empty.",
      "IMPORT_FILE_EMPTY"
    );
  }
  if (size > maxBytes) {
    securityError(
      "Import file exceeds the 32 MB safety limit.",
      "IMPORT_FILE_SIZE_LIMIT",
      { maxBytes }
    );
  }

  const name = String(file.name || "");
  const type = String(file.type || "").toLowerCase();
  if (
    name
    && !/\.json$/i.test(name)
    && !type.includes("json")
  ) {
    securityError(
      "Import file must be JSON.",
      "IMPORT_FILE_TYPE_INVALID"
    );
  }

  return file;
}

export function safeRouteToken(value, {
  maxLength = SECURITY_LIMITS.maxRouteTokenChars
} = {}) {
  if (value == null) return null;
  const token = String(value);
  if (
    !token
    || token.length > maxLength
    || !SAFE_ROUTE_TOKEN.test(token)
  ) {
    return null;
  }
  return token;
}

export function sanitizeDownloadFilename(
  value,
  fallback = "randomizer-download.json"
) {
  let name = String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\\/<>:"|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .replace(/[. ]+$/g, "");

  if (!name) name = fallback;
  if (name.length > 180) name = name.slice(0, 180).replace(/[. ]+$/g, "");

  const base = name.split(".")[0].toUpperCase();
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base)) {
    name = "_" + name;
  }

  return name || fallback;
}

function boundedCount(value, fallback = null) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1000000000, Math.trunc(number)));
}

function boundedText(value, max, fallback = "") {
  const text = String(value == null ? fallback : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();
  return text.slice(0, max);
}

export function isPartyStateRequest(value, expectedPartyId) {
  try {
    assertSafeStructuredData(value, {
      label: "Party channel request",
      maxDepth: 3,
      maxNodes: 16,
      maxArrayLength: 4,
      maxObjectKeys: 4,
      maxStringBytes: 512,
      maxTotalBytes: 2048
    });
  } catch {
    return false;
  }

  return (
    hasOnlyKeys(value, ["type", "partyId"])
    && value.type === "party-state-request"
    && safeRouteToken(value.partyId) === expectedPartyId
  );
}

export function normalizeAudienceMessage(value, expectedPartyId) {
  try {
    assertSafeStructuredData(value, {
      label: "Audience message",
      maxDepth: 20,
      maxNodes: 20000,
      maxArrayLength: 5000,
      maxObjectKeys: 64,
      maxStringBytes: 128 * 1024,
      maxTotalBytes: SECURITY_LIMITS.maxAudienceMessageBytes
    });

    if (
      !hasOnlyKeys(value, [
        "schemaVersion",
        "partyId",
        "tool",
        "round",
        "pace",
        "stage",
        "countdown",
        "private",
        "statusText",
        "result",
        "fairness",
        "updatedAt"
      ])
      || value.schemaVersion !== 1
    ) {
      return null;
    }

    const partyId = safeRouteToken(value.partyId);
    if (!partyId || partyId !== expectedPartyId) return null;

    if (
      !hasOnlyKeys(value.tool, ["id", "name", "icon", "accent"])
    ) {
      return null;
    }

    const toolId = safeRouteToken(value.tool.id);
    if (!toolId) return null;

    const stage = AUDIENCE_STAGES.has(value.stage)
      ? value.stage
      : "ready";
    const privateResult =
      Boolean(value.private) || toolId === "secret-santa";
    const accent = AUDIENCE_ACCENTS.has(value.tool.accent)
      ? value.tool.accent
      : "cyan";

    let fairness = null;
    if (!privateResult && value.fairness != null) {
      if (
        !hasOnlyKeys(value.fairness, [
          "kind",
          "mode",
          "operation",
          "candidateCount",
          "eligibleCount",
          "hardRuleCount",
          "softRuleCount",
          "solverEffort",
          "uniformOverValidResults"
        ])
      ) {
        return null;
      }
      fairness = {
        kind: boundedText(value.fairness.kind, 48, "") || null,
        mode: boundedText(value.fairness.mode, 48, "") || null,
        operation: boundedText(value.fairness.operation, 48, "") || null,
        candidateCount: boundedCount(value.fairness.candidateCount),
        eligibleCount: boundedCount(value.fairness.eligibleCount),
        hardRuleCount: boundedCount(value.fairness.hardRuleCount),
        softRuleCount: boundedCount(value.fairness.softRuleCount),
        solverEffort:
          boundedText(value.fairness.solverEffort, 48, "") || null,
        uniformOverValidResults:
          typeof value.fairness.uniformOverValidResults === "boolean"
            ? value.fairness.uniformOverValidResults
            : null
      };
    }

    return {
      schemaVersion: 1,
      partyId,
      tool: {
        id: toolId,
        name: boundedText(value.tool.name, 120, "Randomizer Arcade"),
        icon: boundedText(value.tool.icon, 12, "✦") || "✦",
        accent
      },
      round: Math.max(1, boundedCount(value.round, 1)),
      pace: boundedText(value.pace, 24, "standard"),
      stage,
      countdown: Math.min(60, boundedCount(value.countdown, 0)),
      private: privateResult,
      statusText: boundedText(value.statusText, 160, "Ready"),
      result:
        privateResult
          ? null
          : structuredClone(value.result ?? null),
      fairness: privateResult ? null : fairness,
      updatedAt:
        Number.isFinite(Number(value.updatedAt))
          ? Number(value.updatedAt)
          : 0
    };
  } catch {
    return null;
  }
}

export function validateComputeRequestMessage(value) {
  assertSafeStructuredData(value, {
    label: "Compute worker request",
    maxDepth: 90,
    maxNodes: 6000000,
    maxArrayLength: 200000,
    maxObjectKeys: 4096,
    maxStringBytes: SECURITY_LIMITS.portableFileBytes,
    maxTotalBytes: SECURITY_LIMITS.maxWorkerMessageBytes,
    allowUndefined: true
  });

  if (!hasOnlyKeys(value, ["id", "type", "payload"])) {
    securityError(
      "Compute worker request has an invalid envelope.",
      "COMPUTE_REQUEST_ENVELOPE_INVALID"
    );
  }
  if (
    typeof value.id !== "string"
    || !/^compute:[1-9][0-9]*$/.test(value.id)
    || value.id.length > 64
  ) {
    securityError(
      "Compute worker request id is invalid.",
      "COMPUTE_REQUEST_ID_INVALID"
    );
  }
  if (!COMPUTE_TASK_TYPES.has(value.type)) {
    securityError(
      "Compute worker task type is not allowed.",
      "COMPUTE_REQUEST_TYPE_INVALID"
    );
  }
  if (!plainObject(value.payload)) {
    securityError(
      "Compute worker payload must be an object.",
      "COMPUTE_REQUEST_PAYLOAD_INVALID"
    );
  }

  return value;
}

export function validateComputeResponseMessage(value, expectedId) {
  assertSafeStructuredData(value, {
    label: "Compute worker response",
    maxDepth: 90,
    maxNodes: 6000000,
    maxArrayLength: 200000,
    maxObjectKeys: 4096,
    maxStringBytes: SECURITY_LIMITS.portableFileBytes,
    maxTotalBytes: SECURITY_LIMITS.maxWorkerMessageBytes,
    allowUndefined: true
  });

  if (
    typeof value.id !== "string"
    || value.id !== expectedId
    || typeof value.ok !== "boolean"
  ) {
    securityError(
      "Compute worker response envelope is invalid.",
      "COMPUTE_RESPONSE_ENVELOPE_INVALID"
    );
  }

  const allowed = value.ok
    ? ["id", "ok", "result"]
    : ["id", "ok", "error"];
  if (!hasOnlyKeys(value, allowed)) {
    securityError(
      "Compute worker response contains unexpected fields.",
      "COMPUTE_RESPONSE_FIELDS_INVALID"
    );
  }

  if (!value.ok && !plainObject(value.error)) {
    securityError(
      "Compute worker error payload is invalid.",
      "COMPUTE_RESPONSE_ERROR_INVALID"
    );
  }

  return value;
}
