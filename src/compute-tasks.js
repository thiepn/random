import { createRng } from "./random-core.js";
import { executeTool } from "./tool-engine.js";
import { executeCustomExperience } from "./custom-engine.js";
import {
  parsePortablePackage,
  mergePortableStores,
  serializePortablePackage
} from "./data-portability.js";

export function executeComputeTask(type, payload = {}) {
  if (type === "tool.execute") {
    const rng = createRng(payload.randomSpec || { mode: "secure" });
    return payload.customExperience
      ? executeCustomExperience(
          payload.customExperience,
          {
            inputItems: payload.customInputItems || []
          },
          rng
        )
      : executeTool(payload.toolId, payload.config || {}, rng);
  }

  if (type === "portability.parse") {
    return parsePortablePackage(payload.text || "");
  }

  if (type === "portability.merge") {
    return mergePortableStores(
      payload.localStores || {},
      payload.portable
    );
  }

  if (type === "portability.serialize") {
    return serializePortablePackage(payload.portable);
  }

  throw new Error("Unsupported compute task: " + type);
}

export function serializeComputeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error || "Unknown worker error"),
    code: error?.code || null,
    details: error?.details || null
  };
}
