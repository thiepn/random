import {
  executeComputeTask,
  serializeComputeError
} from "./compute-tasks.js";
import {
  validateComputeRequestMessage
} from "./security.js";

self.addEventListener("message", async (event) => {
  const raw = event.data || {};
  const replyId =
    typeof raw.id === "string"
    && /^compute:[1-9][0-9]*$/.test(raw.id)
    && raw.id.length <= 64
      ? raw.id
      : null;

  try {
    const message = validateComputeRequestMessage(raw);
    const result = await executeComputeTask(
      message.type,
      message.payload
    );
    self.postMessage({
      id: message.id,
      ok: true,
      result
    });
  } catch (error) {
    if (!replyId) return;
    self.postMessage({
      id: replyId,
      ok: false,
      error: serializeComputeError(error)
    });
  }
});
