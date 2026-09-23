import assert from "node:assert/strict";
import fs from "node:fs";
import {
  HISTORY_PAGE_SIZE,
  HISTORY_RENDER_CHUNK,
  POOL_RENDER_CHUNK,
  RESULT_RENDER_LIMIT,
  FAIRNESS_RENDER_LIMIT,
  WORKER_TIMEOUT_MS
} from "../src/performance-model.js";

const appBytes = fs.statSync("src/app.js").size;
const cssFiles = fs.readdirSync(".")
  .filter((name) => /^phase\d+\.css$/.test(name) || name === "styles.css");
const cssBytes = cssFiles.reduce(
  (sum, file) => sum + fs.statSync(file).size,
  0
);

assert.ok(
  appBytes <= 425000,
  "src/app.js exceeded the 425 KB Phase 13 guardrail: " + appBytes
);
assert.ok(
  cssBytes <= 175000,
  "CSS exceeded the 175 KB Phase 13 guardrail: " + cssBytes
);
assert.ok(HISTORY_PAGE_SIZE <= 500);
assert.ok(HISTORY_RENDER_CHUNK <= HISTORY_PAGE_SIZE);
assert.ok(POOL_RENDER_CHUNK <= 250);
assert.ok(RESULT_RENDER_LIMIT <= 400);
assert.ok(FAIRNESS_RENDER_LIMIT <= 400);
assert.ok(WORKER_TIMEOUT_MS <= 60000);

console.log(
  "performance budget tests passed",
  JSON.stringify({ appBytes, cssBytes })
);
