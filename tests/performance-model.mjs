import assert from "node:assert/strict";
import {
  HISTORY_PAGE_SIZE,
  HISTORY_RENDER_CHUNK,
  POOL_RENDER_CHUNK,
  estimateToolWorkload,
  shouldOffloadTool,
  progressiveSlice,
  mergeRecentRecords,
  nextProgressiveLimit
} from "../src/performance-model.js";

{
  const light = estimateToolWorkload("picker", {
    items: Array.from({ length: 20 }, (_, index) => "Item " + index)
  });
  assert.equal(light.itemCount, 20);
  assert.equal(shouldOffloadTool("picker", {
    items: Array.from({ length: 20 }, (_, index) => index)
  }), false);
}

{
  const large = shouldOffloadTool("shuffle", {
    items: Array.from({ length: 900 }, (_, index) => index)
  });
  assert.equal(large, true);
}

{
  const constrained = shouldOffloadTool("teams", {
    items: Array.from({ length: 40 }, (_, index) => index),
    constraintItems: Array.from({ length: 40 }, (_, index) => ({
      id: String(index),
      label: String(index)
    })),
    rules: [
      { id: "rule:1", enabled: true, strength: "hard" }
    ],
    solverEffort: "automatic"
  });
  assert.equal(constrained, true);
}

{
  const compound = shouldOffloadTool(
    "custom:test",
    { items: ["A", "B"] },
    {
      primitive: "compound",
      config: {
        steps: Array.from({ length: 6 }, (_, index) => ({
          id: "step:" + index
        }))
      }
    }
  );
  assert.equal(compound, true);
}

{
  const page = progressiveSlice(
    Array.from({ length: 350 }, (_, index) => index),
    100,
    100
  );
  assert.equal(page.shown, 100);
  assert.equal(page.total, 350);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextLimit, 200);
}

{
  const merged = mergeRecentRecords(
    [
      { id: "a", timestamp: 10 },
      { id: "b", timestamp: 20 }
    ],
    [
      { id: "a", timestamp: 30 },
      { id: "c", timestamp: 15 }
    ]
  );
  assert.deepEqual(
    merged.map((item) => item.id),
    ["a", "b", "c"]
  );
  assert.equal(merged[0].timestamp, 30);
}

assert.equal(
  nextProgressiveLimit(100, 230, 100),
  200
);
assert.equal(
  nextProgressiveLimit(200, 230, 100),
  230
);
assert.ok(HISTORY_PAGE_SIZE > HISTORY_RENDER_CHUNK);
assert.ok(POOL_RENDER_CHUNK >= HISTORY_RENDER_CHUNK);

console.log("performance-model tests passed");
