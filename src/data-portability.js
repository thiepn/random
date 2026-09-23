export const PORTABILITY_SCHEMA_VERSION = 1;
export const PORTABILITY_FORMAT = "randomizer-arcade-portable";

export const LIBRARY_STORES = Object.freeze([
  "pools",
  "poolViews",
  "ruleSets",
  "sessionTemplates",
  "customExperiences",
  "workflows",
  "favorites",
  "presets",
  "settings"
]);

export const RUNTIME_STORES = Object.freeze([
  "templateSessions",
  "partySessions",
  "workflowSessions",
  "history",
  "runs",
  "sessions",
  "sessionEvents",
  "historyPins"
]);

export const PORTABLE_STORES = Object.freeze([
  ...LIBRARY_STORES,
  ...RUNTIME_STORES
]);

export const PORTABILITY_SCOPES = Object.freeze([
  "full",
  "library"
]);

export const MAX_PORTABLE_JSON_BYTES = 32 * 1024 * 1024;
export const MAX_PORTABLE_RECORDS = 100000;
export const MAX_PORTABLE_DEPTH = 80;

const UNION_STORES = new Set([
  "runs",
  "sessionEvents",
  "history",
  "favorites",
  "historyPins"
]);

const IMMUTABLE_STORES = new Set([
  "runs",
  "sessionEvents"
]);

export class PortabilityError extends Error {
  constructor(message, code = "PORTABILITY_ERROR", details = null) {
    super(message);
    this.name = "PortabilityError";
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function stableNormalize(value, depth = 0) {
  if (depth > MAX_PORTABLE_DEPTH) {
    throw new PortabilityError(
      "Portable data is nested too deeply.",
      "PORTABLE_DEPTH_LIMIT"
    );
  }
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item, depth + 1));
  }

  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (["__proto__", "prototype", "constructor"].includes(key)) {
      throw new PortabilityError(
        "Portable data contains a prohibited object key.",
        "PORTABLE_UNSAFE_KEY"
      );
    }
    if (value[key] !== undefined) {
      output[key] = stableNormalize(value[key], depth + 1);
    }
  }
  return output;
}

export function stablePortableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

export function portableChecksum(value) {
  const text = stablePortableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeDevice(device = {}) {
  return {
    id: String(device.id || "unknown"),
    name: String(device.name || "Unknown device").slice(0, 120),
    platform: String(device.platform || "").slice(0, 160)
  };
}

function storesForScope(scope) {
  return scope === "library" ? LIBRARY_STORES : PORTABLE_STORES;
}

function sanitizedStores(stores, scope) {
  const result = {};
  let total = 0;

  for (const store of storesForScope(scope)) {
    const records = Array.isArray(stores?.[store])
      ? stores[store]
      : [];
    total += records.length;
    if (total > MAX_PORTABLE_RECORDS) {
      throw new PortabilityError(
        "Portable package contains too many records.",
        "PORTABLE_RECORD_LIMIT"
      );
    }
    result[store] = records.map((record) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new PortabilityError(
          "Every stored record must be an object.",
          "PORTABLE_RECORD_INVALID",
          { store }
        );
      }
      if (record.id == null || String(record.id).length === 0) {
        throw new PortabilityError(
          "A stored record is missing its id.",
          "PORTABLE_RECORD_ID_REQUIRED",
          { store }
        );
      }
      return clone(record);
    });
  }

  return result;
}

export function createPortablePackage({
  stores,
  scope = "full",
  device = {},
  appVersion = "unknown",
  databaseVersion = null,
  createdAt = new Date().toISOString()
} = {}) {
  if (!PORTABILITY_SCOPES.includes(scope)) {
    throw new PortabilityError(
      "Unsupported portability scope.",
      "PORTABLE_SCOPE_INVALID"
    );
  }

  const data = sanitizedStores(stores, scope);
  const body = {
    format: PORTABILITY_FORMAT,
    schemaVersion: PORTABILITY_SCHEMA_VERSION,
    createdAt: String(createdAt),
    appVersion: String(appVersion || "unknown"),
    databaseVersion:
      Number.isSafeInteger(Number(databaseVersion))
        ? Number(databaseVersion)
        : null,
    device: normalizeDevice(device),
    payload: {
      scope,
      stores: data
    }
  };

  if (!Number.isFinite(Date.parse(body.createdAt))) {
    throw new PortabilityError(
      "Portable package creation time is invalid.",
      "PORTABLE_DATE_INVALID"
    );
  }

  return {
    ...body,
    checksum: portableChecksum(body)
  };
}

export function serializePortablePackage(packageValue) {
  const normalized = validatePortablePackage(packageValue);
  return JSON.stringify(normalized, null, 2);
}

export function parsePortablePackage(text) {
  const source = String(text ?? "");
  const byteLength =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(source).byteLength
      : source.length;

  if (!source.trim()) {
    throw new PortabilityError(
      "Portable package is empty.",
      "PORTABLE_EMPTY"
    );
  }
  if (byteLength > MAX_PORTABLE_JSON_BYTES) {
    throw new PortabilityError(
      "Portable package exceeds the 32 MB safety limit.",
      "PORTABLE_SIZE_LIMIT"
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new PortabilityError(
      "Portable package is not valid JSON.",
      "PORTABLE_JSON_INVALID"
    );
  }
  return validatePortablePackage(parsed);
}

export function validatePortablePackage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PortabilityError(
      "Portable package must be an object.",
      "PORTABLE_INVALID"
    );
  }
  if (value.format !== PORTABILITY_FORMAT) {
    throw new PortabilityError(
      "This file is not a Randomizer Arcade portable package.",
      "PORTABLE_FORMAT_INVALID"
    );
  }
  if (value.schemaVersion !== PORTABILITY_SCHEMA_VERSION) {
    throw new PortabilityError(
      "This portable package version is not supported.",
      "PORTABLE_VERSION_UNSUPPORTED"
    );
  }

  const scope = PORTABILITY_SCOPES.includes(value.payload?.scope)
    ? value.payload.scope
    : null;
  if (!scope) {
    throw new PortabilityError(
      "Portable package has an invalid scope.",
      "PORTABLE_SCOPE_INVALID"
    );
  }

  const stores = sanitizedStores(value.payload?.stores || {}, scope);
  const createdAt = String(value.createdAt || "");
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new PortabilityError(
      "Portable package creation time is invalid.",
      "PORTABLE_DATE_INVALID"
    );
  }

  const body = {
    format: PORTABILITY_FORMAT,
    schemaVersion: PORTABILITY_SCHEMA_VERSION,
    createdAt,
    appVersion: String(value.appVersion || "unknown"),
    databaseVersion:
      Number.isSafeInteger(Number(value.databaseVersion))
        ? Number(value.databaseVersion)
        : null,
    device: normalizeDevice(value.device),
    payload: { scope, stores }
  };
  const checksum = portableChecksum(body);

  if (value.checksum !== checksum) {
    throw new PortabilityError(
      "Portable package integrity check failed.",
      "PORTABLE_CHECKSUM_MISMATCH"
    );
  }

  return {
    ...body,
    checksum
  };
}

function timestampFor(record) {
  const candidates = [
    record?.updatedAt,
    record?.timestamp,
    record?.createdAt,
    record?.completedAt
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    const parsed = Date.parse(String(candidate));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function revisionFor(record) {
  const value = Number(record?.revision);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function chooseMutableRecord(local, incoming) {
  const localRevision = revisionFor(local);
  const incomingRevision = revisionFor(incoming);
  if (incomingRevision !== localRevision) {
    return incomingRevision > localRevision
      ? { record: incoming, source: "incoming" }
      : { record: local, source: "local" };
  }

  const localTime = timestampFor(local);
  const incomingTime = timestampFor(incoming);
  if (incomingTime !== localTime) {
    return incomingTime > localTime
      ? { record: incoming, source: "incoming" }
      : { record: local, source: "local" };
  }

  const localText = stablePortableStringify(local);
  const incomingText = stablePortableStringify(incoming);
  if (localText === incomingText) {
    return { record: local, source: "equal" };
  }

  // Equal revision and timestamp but divergent data is a real conflict.
  // Keep local deterministically instead of silently overwriting it.
  return { record: local, source: "conflict" };
}

function mergeStore(store, localRecords, incomingRecords) {
  const localMap = new Map(
    (localRecords || []).map((record) => [String(record.id), clone(record)])
  );
  const result = new Map(localMap);
  let added = 0;
  let updated = 0;
  let kept = 0;
  let conflicts = 0;

  for (const incoming of incomingRecords || []) {
    const id = String(incoming.id);
    const local = localMap.get(id);

    if (!local) {
      result.set(id, clone(incoming));
      added += 1;
      continue;
    }

    if (IMMUTABLE_STORES.has(store)) {
      const equal =
        stablePortableStringify(local) === stablePortableStringify(incoming);
      if (!equal) conflicts += 1;
      else kept += 1;
      continue;
    }

    if (UNION_STORES.has(store)) {
      const choice = chooseMutableRecord(local, incoming);
      if (choice.source === "incoming") {
        result.set(id, clone(incoming));
        updated += 1;
      } else if (choice.source === "conflict") {
        conflicts += 1;
      } else {
        kept += 1;
      }
      continue;
    }

    const choice = chooseMutableRecord(local, incoming);
    if (choice.source === "incoming") {
      result.set(id, clone(incoming));
      updated += 1;
    } else if (choice.source === "conflict") {
      conflicts += 1;
    } else {
      kept += 1;
    }
  }

  return {
    records: [...result.values()],
    stats: {
      local: localRecords?.length || 0,
      incoming: incomingRecords?.length || 0,
      result: result.size,
      added,
      updated,
      kept,
      conflicts
    }
  };
}

export function mergePortableStores(localStores, incomingPackage) {
  const portable = validatePortablePackage(incomingPackage);
  const output = {};
  const stats = {};
  let conflicts = 0;
  let added = 0;
  let updated = 0;

  for (const store of PORTABLE_STORES) {
    const local = Array.isArray(localStores?.[store])
      ? localStores[store]
      : [];
    const incoming = Array.isArray(portable.payload.stores?.[store])
      ? portable.payload.stores[store]
      : [];

    if (
      portable.payload.scope === "library"
      && !LIBRARY_STORES.includes(store)
    ) {
      output[store] = clone(local);
      stats[store] = {
        local: local.length,
        incoming: 0,
        result: local.length,
        added: 0,
        updated: 0,
        kept: local.length,
        conflicts: 0
      };
      continue;
    }

    const merged = mergeStore(store, local, incoming);
    output[store] = merged.records;
    stats[store] = merged.stats;
    conflicts += merged.stats.conflicts;
    added += merged.stats.added;
    updated += merged.stats.updated;
  }

  return {
    stores: output,
    stats,
    totals: {
      added,
      updated,
      conflicts
    }
  };
}

export function replaceStoresFromPackage(localStores, incomingPackage) {
  const portable = validatePortablePackage(incomingPackage);
  const output = {};

  for (const store of PORTABLE_STORES) {
    if (
      portable.payload.scope === "library"
      && !LIBRARY_STORES.includes(store)
    ) {
      output[store] = clone(
        Array.isArray(localStores?.[store])
          ? localStores[store]
          : []
      );
    } else {
      output[store] = clone(
        Array.isArray(portable.payload.stores?.[store])
          ? portable.payload.stores[store]
          : []
      );
    }
  }

  return output;
}

export function portablePackageSummary(packageValue) {
  const value = validatePortablePackage(packageValue);
  const storeCounts = {};
  let records = 0;

  for (const [store, entries] of Object.entries(value.payload.stores)) {
    storeCounts[store] = entries.length;
    records += entries.length;
  }

  return {
    scope: value.payload.scope,
    records,
    stores: storeCounts,
    createdAt: value.createdAt,
    device: clone(value.device),
    checksum: value.checksum
  };
}

export function safePortableFilename({
  scope = "full",
  createdAt = new Date()
} = {}) {
  const date = createdAt instanceof Date
    ? createdAt
    : new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "backup"
    : date.toISOString().replace(/[:.]/g, "-");
  return "randomizer-" + scope + "-" + stamp + ".json";
}
