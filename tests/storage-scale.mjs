import assert from "node:assert/strict";
import fs from "node:fs";

const storage = fs.readFileSync("src/storage.js", "utf8");
const app = fs.readFileSync("src/app.js", "utf8");

const versionMatch = storage.match(
  /export const DATABASE_VERSION = (\d+);/
);
assert.ok(versionMatch, "DATABASE_VERSION must be exported.");
assert.ok(
  Number(versionMatch[1]) >= 11,
  "Phase 13 grouped session indexes require IndexedDB schema v11+."
);

for (const required of [
  '["recent", ["timestamp", "id"]',
  '["toolRecent", ["toolId", "timestamp"]',
  '["templateRecent", ["templateId", "updatedAt"]',
  '["workflowRecent", ["workflowId", "updatedAt"]'
]) {
  assert.ok(
    storage.includes(required),
    "Missing large-scale IndexedDB index: " + required
  );
}

for (const required of [
  "getRecentPage",
  "getRecentForTool",
  "getLatestByCompoundPrefix",
  "getMany",
  "deleteMatching"
]) {
  assert.ok(
    storage.includes("export async function " + required),
    "Missing scalable storage primitive: " + required
  );
}

assert.ok(
  app.includes(
    'getAllByIndex("sessions", "status", "active")'
  ),
  "Startup must hydrate active stateful Sessions through the status index."
);
assert.ok(
  app.includes(
    'getLatestByCompoundPrefix(\n      "templateSessions"'
  ),
  "Startup must hydrate only latest Template Sessions per template."
);
assert.ok(
  app.includes(
    'getLatestByCompoundPrefix(\n      "workflowSessions"'
  ),
  "Startup must hydrate only latest Workflow Sessions per workflow."
);
assert.equal(
  app.includes('getAll("sessions")'),
  false,
  "Startup must not load the complete stateful Session store."
);
assert.equal(
  app.includes('getAll("templateSessions")'),
  false,
  "Startup must not load the complete Template Session store."
);
assert.equal(
  app.includes('getAll("partySessions")'),
  false,
  "Startup must not load the complete Party Session store."
);
assert.equal(
  app.includes('getAll("workflowSessions")'),
  false,
  "Startup must not load the complete Workflow Session store."
);

{
  const renderPoolsStart = app.indexOf("function renderPools()");
  const renderPoolsEnd = app.indexOf(
    "function historyGroupPinKey",
    renderPoolsStart
  );
  assert.ok(renderPoolsStart >= 0 && renderPoolsEnd > renderPoolsStart);
  const renderPoolsSource = app.slice(
    renderPoolsStart,
    renderPoolsEnd
  );
  assert.equal(
    renderPoolsSource.includes("editor.visibleLimit"),
    false,
    "Pool library search must not reference the Pool editor state."
  );
}

assert.ok(
  app.includes("async function openRunDetailById"),
  "Evicted Runs must be hydrated lazily before opening details."
);

for (const code of [
  "COMPUTE_WORKER_UNAVAILABLE",
  "COMPUTE_WORKER_POST_FAILED",
  "COMPUTE_WORKER_CRASHED"
]) {
  assert.ok(
    app.includes(code),
    "Tool execution must fall back safely for " + code
  );
}
assert.ok(
  app.includes('state.performance.lastComputeMode = "main-fallback"'),
  "Worker fallback diagnostics must identify main-thread fallback."
);

console.log("storage-scale regression tests passed");
