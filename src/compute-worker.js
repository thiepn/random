import {
  executeComputeTask,
  serializeComputeError
} from "./compute-tasks.js";

self.addEventListener("message", async (event) => {
  const message = event.data || {};
  const id = message.id;

  try {
    const result = await executeComputeTask(
      message.type,
      message.payload || {}
    );
    self.postMessage({
      id,
      ok: true,
      result
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: serializeComputeError(error)
    });
  }
});
