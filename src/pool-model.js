export const POOL_SCHEMA_VERSION = 2;

export class PoolModelError extends Error {
  constructor(message, code = "INVALID_POOL") {
    super(message);
    this.name = "PoolModelError";
    this.code = code;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new PoolModelError("Secure UUID generation is unavailable.", "UUID_UNAVAILABLE");
}

export function normalizeField(field, index = 0) {
  const type = ["text", "number", "boolean", "category"].includes(field?.type)
    ? field.type
    : "text";
  return {
    id: String(field?.id || ("field_" + (index + 1))),
    name: String(field?.name || ("Field " + (index + 1))).trim() || ("Field " + (index + 1)),
    type
  };
}

export function normalizePoolItem(item, index = 0) {
  if (typeof item === "string") {
    return {
      id: uuid(),
      label: item,
      active: true,
      tags: [],
      values: {},
      weight: 1,
      order: index
    };
  }

  const weight = Number(item?.weight ?? 1);
  return {
    id: String(item?.id || uuid()),
    label: String(item?.label ?? "").trim(),
    active: item?.active !== false,
    tags: Array.from(new Set(
      Array.isArray(item?.tags)
        ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : []
    )),
    values: item?.values && typeof item.values === "object" && !Array.isArray(item.values)
      ? { ...item.values }
      : {},
    weight: Number.isFinite(weight) && weight >= 0 ? weight : 1,
    order: Number.isFinite(item?.order) ? Number(item.order) : index
  };
}

export function normalizePool(pool) {
  const createdAt = pool?.createdAt || nowIso();
  const fields = Array.isArray(pool?.fields)
    ? pool.fields.map(normalizeField)
    : [];
  const items = Array.isArray(pool?.items)
    ? pool.items.map(normalizePoolItem)
    : [];

  items.sort((a, b) => a.order - b.order);

  return {
    id: String(pool?.id || uuid()),
    schemaVersion: POOL_SCHEMA_VERSION,
    revision: Number.isSafeInteger(pool?.revision) && pool.revision > 0
      ? pool.revision
      : 1,
    name: String(pool?.name || "Untitled Pool").trim() || "Untitled Pool",
    description: String(pool?.description || ""),
    kind: ["generic", "people", "choices", "tasks", "cards"].includes(pool?.kind)
      ? pool.kind
      : "generic",
    icon: String(pool?.icon || "◎"),
    accent: String(pool?.accent || "cyan"),
    archived: Boolean(pool?.archived),
    fields,
    items,
    weightProfiles: Array.isArray(pool?.weightProfiles)
      ? pool.weightProfiles.map((profile) => ({
          id: String(profile?.id || uuid()),
          name: String(profile?.name || "Weights"),
          weights: profile?.weights && typeof profile.weights === "object"
            ? { ...profile.weights }
            : {}
        }))
      : [],
    createdAt,
    updatedAt: pool?.updatedAt || createdAt
  };
}

export function createPool({
  name,
  description = "",
  kind = "generic",
  labels = [],
  fields = [],
  items = null
}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new PoolModelError("Pool name is required.", "POOL_NAME_REQUIRED");
  }

  const sourceItems = items || labels.map((label) => ({ label }));

  const pool = normalizePool({
    id: uuid(),
    name: cleanName,
    description,
    kind,
    fields,
    items: sourceItems,
    revision: 1,
    createdAt: nowIso()
  });
  pool.updatedAt = pool.createdAt;
  return pool;
}

export function mutatePool(pool, mutator) {
  const next = normalizePool(pool);
  const beforeRevision = next.revision;
  mutator(next);
  next.items = next.items.map((item, index) => ({
    ...normalizePoolItem(item, index),
    order: index
  }));
  next.fields = next.fields.map(normalizeField);
  next.revision = beforeRevision + 1;
  next.updatedAt = nowIso();
  return next;
}

export function createPoolItem(label, extras = {}) {
  const clean = String(label || "").trim();
  if (!clean) {
    throw new PoolModelError("Item label cannot be empty.", "ITEM_LABEL_REQUIRED");
  }
  return normalizePoolItem({
    id: uuid(),
    label: clean,
    active: extras.active !== false,
    tags: extras.tags || [],
    values: extras.values || {},
    weight: extras.weight ?? 1
  });
}

export function createPoolField(name, type = "text") {
  const clean = String(name || "").trim();
  if (!clean) {
    throw new PoolModelError("Field name is required.", "FIELD_NAME_REQUIRED");
  }
  return normalizeField({ id: uuid(), name: clean, type });
}

export function activePoolItems(pool) {
  return normalizePool(pool).items.filter((item) => item.active);
}

export function createWorkingSet(pool, options = {}) {
  const normalized = normalizePool(pool);
  const itemIds = options.itemIds ? new Set(options.itemIds) : null;
  const items = normalized.items
    .filter((item) => item.active)
    .filter((item) => !itemIds || itemIds.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.label,
      weight: item.weight,
      tags: [...item.tags],
      values: { ...item.values }
    }));

  return {
    source: {
      kind: "pool",
      poolId: normalized.id,
      revision: normalized.revision,
      name: normalized.name
    },
    fields: normalized.fields.map((field) => ({ ...field })),
    items,
    exclusions: [],
    localOverrides: {}
  };
}

export function workingSetLabels(workingSet) {
  return (workingSet?.items || []).map((item) => item.label);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

export function filterPoolItems(pool, {
  search = "",
  active = "all",
  tags = [],
  tagMode = "any"
} = {}) {
  const normalized = normalizePool(pool);
  const q = normalizeSearchText(search);
  const wantedTags = tags.map((tag) => String(tag).trim()).filter(Boolean);

  return normalized.items.filter((item) => {
    if (active === "active" && !item.active) return false;
    if (active === "inactive" && item.active) return false;

    if (q) {
      const haystack = normalizeSearchText([
        item.label,
        ...item.tags,
        ...Object.values(item.values || {})
      ].join(" "));
      if (!haystack.includes(q)) return false;
    }

    if (wantedTags.length) {
      const own = new Set(item.tags);
      const match = tagMode === "all"
        ? wantedTags.every((tag) => own.has(tag))
        : wantedTags.some((tag) => own.has(tag));
      if (!match) return false;
    }

    return true;
  });
}

export function duplicateGroups(pool) {
  const groups = new Map();
  for (const item of normalizePool(pool).items) {
    const key = item.label.trim().toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function duplicateSummary(pool) {
  const groups = duplicateGroups(pool);
  return {
    groupCount: groups.length,
    itemCount: groups.reduce((sum, group) => sum + group.length, 0),
    groups
  };
}

export function parseDelimitedText(text, {
  delimiter = null,
  hasHeader = null
} = {}) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  if (!source.trim()) return { headers: ["label"], rows: [], delimiter: "," };

  const firstLine = source.split(/\r?\n/, 1)[0];
  const detected = delimiter || (
    firstLine.includes("\t") ? "\t"
      : firstLine.includes(";") && !firstLine.includes(",") ? ";"
      : ","
  );

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index <= source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else if (char == null) {
        throw new PoolModelError("Unclosed quoted CSV field.", "CSV_UNCLOSED_QUOTE");
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === detected) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char == null) {
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (!rows.length) return { headers: ["label"], rows: [], delimiter: detected };

  const headerGuess = hasHeader == null
    ? rows[0].some((value) => /^(label|name|weight|active|tags?)$/i.test(value.trim()))
    : Boolean(hasHeader);

  let headers;
  let dataRows;
  if (headerGuess) {
    headers = rows[0].map((value, index) =>
      value.trim() || ("column_" + (index + 1))
    );
    dataRows = rows.slice(1);
  } else {
    headers = rows[0].map((_, index) =>
      index === 0 ? "label" : ("column_" + (index + 1))
    );
    dataRows = rows;
  }

  return { headers, rows: dataRows, delimiter: detected };
}

function parseBoolean(value, fallback = true) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (["true", "yes", "1", "active", "on"].includes(text)) return true;
  if (["false", "no", "0", "inactive", "off"].includes(text)) return false;
  return fallback;
}

export function importRowsToPoolItems(parsed, {
  labelColumn = null,
  weightColumn = null,
  activeColumn = null,
  tagsColumn = null,
  fieldColumns = {}
} = {}) {
  const headers = parsed.headers;
  const indexOf = (name) => {
    if (!name) return -1;
    return headers.findIndex((header) =>
      header.toLocaleLowerCase() === String(name).toLocaleLowerCase()
    );
  };

  const preferredLabel = indexOf(labelColumn);
  const inferredLabel = headers.findIndex((header) => /^(label|name)$/i.test(header));
  const labelIndex = preferredLabel >= 0 ? preferredLabel : (inferredLabel >= 0 ? inferredLabel : 0);
  const weightIndex = indexOf(weightColumn || "weight");
  const activeIndex = indexOf(activeColumn || "active");
  const explicitTags = indexOf(tagsColumn);
  const tagsIndex = explicitTags >= 0
    ? explicitTags
    : Math.max(indexOf("tags"), indexOf("tag"));

  return parsed.rows.map((row) => {
    const label = String(row[labelIndex] ?? "").trim();
    if (!label) return null;

    const weightText = weightIndex >= 0 ? row[weightIndex] : "";
    const weight = weightText === "" || weightText == null ? 1 : Number(weightText);
    const tags = tagsIndex >= 0
      ? String(row[tagsIndex] || "")
          .split(/[|,]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    const values = {};
    for (const [fieldId, columnName] of Object.entries(fieldColumns)) {
      const column = indexOf(columnName);
      if (column >= 0) values[fieldId] = row[column] ?? "";
    }

    return createPoolItem(label, {
      weight: Number.isFinite(weight) && weight >= 0 ? weight : 1,
      active: activeIndex >= 0 ? parseBoolean(row[activeIndex], true) : true,
      tags,
      values
    });
  }).filter(Boolean);
}

export function mergeImportedItems(pool, importedItems, mode = "append") {
  const normalized = normalizePool(pool);
  const incoming = importedItems.map((item) => normalizePoolItem(item));

  if (mode === "replace") {
    return mutatePool(normalized, (draft) => {
      draft.items = incoming;
    });
  }

  return mutatePool(normalized, (draft) => {
    draft.items.push(...incoming);
  });
}

export function createPoolView({
  name,
  poolId,
  mode = "dynamic",
  filters = {},
  itemIds = []
}) {
  const clean = String(name || "").trim();
  if (!clean) {
    throw new PoolModelError("View name is required.", "VIEW_NAME_REQUIRED");
  }
  return {
    id: uuid(),
    schemaVersion: 1,
    name: clean,
    poolId: String(poolId),
    mode: mode === "static" ? "static" : "dynamic",
    filters: { ...filters },
    itemIds: Array.from(new Set(itemIds.map(String))),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function resolvePoolView(pool, view) {
  const normalized = normalizePool(pool);
  if (!view || String(view.poolId) !== normalized.id) return [];

  if (view.mode === "static") {
    const ids = new Set(view.itemIds || []);
    return normalized.items.filter((item) => item.active && ids.has(item.id));
  }

  return filterPoolItems(normalized, {
    ...view.filters,
    active: view.filters?.active || "active"
  });
}

export function poolStats(pool) {
  const normalized = normalizePool(pool);
  const tags = new Set();
  let active = 0;
  for (const item of normalized.items) {
    if (item.active) active += 1;
    item.tags.forEach((tag) => tags.add(tag));
  }
  return {
    total: normalized.items.length,
    active,
    inactive: normalized.items.length - active,
    tags: tags.size,
    fields: normalized.fields.length,
    duplicates: duplicateGroups(normalized).length
  };
}
