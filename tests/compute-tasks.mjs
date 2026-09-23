import assert from "node:assert/strict";
import { createRng } from "../src/random-core.js";
import { executeTool } from "../src/tool-engine.js";
import {
  createPortablePackage,
  parsePortablePackage
} from "../src/data-portability.js";
import {
  executeComputeTask,
  serializeComputeError
} from "../src/compute-tasks.js";

{
  const config = {
    items: ["A", "B", "C", "D", "E"]
  };
  const direct = executeTool(
    "shuffle",
    config,
    createRng({
      mode: "seeded",
      seed: "worker-equivalence"
    })
  );
  const background = executeComputeTask("tool.execute", {
    toolId: "shuffle",
    config,
    randomSpec: {
      mode: "seeded",
      seed: "worker-equivalence"
    }
  });

  assert.deepEqual(background, direct);
}

{
  const config = {
    items: ["A", "B", "C", "D"],
    teamCount: 2,
    rules: []
  };
  const direct = executeTool(
    "teams",
    config,
    createRng({
      mode: "seeded",
      seed: "worker-teams"
    })
  );
  const background = executeComputeTask("tool.execute", {
    toolId: "teams",
    config,
    randomSpec: {
      mode: "seeded",
      seed: "worker-teams"
    }
  });

  assert.deepEqual(background, direct);
}

{
  const stores = {
    pools: [{ id: "pool:1", revision: 1, updatedAt: 1 }],
    poolViews: [],
    ruleSets: [],
    sessionTemplates: [],
    templateSessions: [],
    partySessions: [],
    customExperiences: [],
    workflows: [],
    workflowSessions: [],
    history: [],
    runs: [],
    sessions: [],
    sessionEvents: [],
    historyPins: [],
    favorites: [],
    presets: [],
    settings: [{ id: "app", value: {} }]
  };

  const portable = createPortablePackage({
    stores,
    scope: "full",
    device: {
      id: "device:test",
      name: "Test device"
    },
    createdAt: "2026-09-23T12:00:00.000Z"
  });

  const serialized = executeComputeTask(
    "portability.serialize",
    { portable }
  );
  assert.deepEqual(
    executeComputeTask("portability.parse", {
      text: serialized
    }),
    parsePortablePackage(serialized)
  );
}

{
  const error = serializeComputeError(
    Object.assign(new Error("boom"), {
      code: "TEST_CODE",
      details: { a: 1 }
    })
  );
  assert.equal(error.message, "boom");
  assert.equal(error.code, "TEST_CODE");
  assert.deepEqual(error.details, { a: 1 });
}

assert.throws(
  () => executeComputeTask("unknown", {}),
  /Unsupported compute task/
);

console.log("compute-task tests passed");
