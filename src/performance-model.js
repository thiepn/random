export const HISTORY_PAGE_SIZE = 240;
export const HISTORY_RENDER_CHUNK = 100;
export const POOL_RENDER_CHUNK = 160;
export const LARGE_LIST_THRESHOLD = 600;
export const LARGE_CONSTRAINT_THRESHOLD = 24;
export const WORKER_TIMEOUT_MS = 30000;

const CONSTRAINT_TOOLS = new Set([
  "teams",
  "groups",
  "pairs",
  "assignment",
  "secret-santa",
  "tournament"
]);

function listCount(config = {}) {
  return Math.max(
    Array.isArray(config.items) ? config.items.length : 0,
    Array.isArray(config.constraintItems) ? config.constraintItems.length : 0,
    Array.isArray(config.targets) ? config.targets.length : 0
  );
}

export function estimateToolWorkload(
  toolId,
  config = {},
  customExperience = null
) {
  const count = listCount(config);
  let score = count;

  if (CONSTRAINT_TOOLS.has(toolId)) {
    const ruleCount = Array.isArray(config.rules)
      ? config.rules.filter((rule) => rule?.enabled !== false).length
      : 0;
    const effort = config.solverEffort || "automatic";
    const effortFactor =
      effort === "thorough" ? 6
        : effort === "automatic" ? 3
          : 1.5;
    score = Math.max(score, count * effortFactor * Math.max(1, ruleCount));
  }

  if (toolId === "shuffle" || toolId === "sampler") {
    score = Math.max(score, count * 1.2);
  }

  if (customExperience?.primitive === "compound") {
    const steps = customExperience.config?.steps?.length || 0;
    score = Math.max(score, count + steps * 180);
  }

  return {
    itemCount: count,
    score: Math.round(score),
    constrained: CONSTRAINT_TOOLS.has(toolId)
  };
}

export function shouldOffloadTool(
  toolId,
  config = {},
  customExperience = null
) {
  const workload = estimateToolWorkload(
    toolId,
    config,
    customExperience
  );

  if (
    workload.constrained
    && workload.itemCount >= LARGE_CONSTRAINT_THRESHOLD
  ) {
    return true;
  }

  if (workload.itemCount >= LARGE_LIST_THRESHOLD) return true;

  if (
    customExperience?.primitive === "compound"
    && (customExperience.config?.steps?.length || 0) >= 6
  ) {
    return true;
  }

  return false;
}

export function progressiveSlice(
  items,
  limit,
  chunk = HISTORY_RENDER_CHUNK
) {
  const source = Array.isArray(items) ? items : [];
  const safeChunk = Math.max(1, Number(chunk) || 1);
  const safeLimit = Math.max(
    safeChunk,
    Number.isSafeInteger(limit) ? limit : safeChunk
  );

  return {
    visible: source.slice(0, safeLimit),
    total: source.length,
    shown: Math.min(source.length, safeLimit),
    hasMore: source.length > safeLimit,
    nextLimit: Math.min(source.length, safeLimit + safeChunk)
  };
}

export function mergeRecentRecords(
  current,
  incoming,
  {
    key = "id",
    sortKey = "timestamp",
    limit = Infinity
  } = {}
) {
  const map = new Map();

  for (const record of [...(current || []), ...(incoming || [])]) {
    if (!record || record[key] == null) continue;
    map.set(String(record[key]), record);
  }

  return [...map.values()]
    .sort((a, b) => {
      const av = Number(a?.[sortKey] || 0);
      const bv = Number(b?.[sortKey] || 0);
      return bv - av;
    })
    .slice(0, limit);
}

export function nextProgressiveLimit(
  current,
  total,
  chunk
) {
  return Math.min(
    Math.max(0, Number(total) || 0),
    Math.max(0, Number(current) || 0)
      + Math.max(1, Number(chunk) || 1)
  );
}
