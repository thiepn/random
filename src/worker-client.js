import { WORKER_TIMEOUT_MS } from "./performance-model.js";

let worker = null;
let workerUnavailable = false;
let requestCounter = 0;
const pending = new Map();

export class ComputeWorkerError extends Error {
  constructor(message, {
    code = "COMPUTE_WORKER_ERROR",
    details = null,
    name = "ComputeWorkerError"
  } = {}) {
    super(message);
    this.name = name;
    this.code = code;
    this.details = details;
  }
}

export function computeWorkerSupported() {
  return (
    !workerUnavailable
    && typeof Worker !== "undefined"
    && typeof URL !== "undefined"
  );
}

function rejectPending(error) {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(error);
  }
  pending.clear();
}

function destroyWorker(error = null) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (error) rejectPending(error);
}

function ensureWorker() {
  if (!computeWorkerSupported()) return null;
  if (worker) return worker;

  try {
    worker = new Worker(
      new URL("./compute-worker.js", import.meta.url),
      { type: "module", name: "randomizer-compute" }
    );
  } catch {
    workerUnavailable = true;
    worker = null;
    return null;
  }

  worker.addEventListener("message", (event) => {
    const message = event.data || {};
    const entry = pending.get(message.id);
    if (!entry) return;

    pending.delete(message.id);
    clearTimeout(entry.timer);

    if (message.ok) {
      entry.resolve(message.result);
      return;
    }

    const error = message.error || {};
    entry.reject(new ComputeWorkerError(
      error.message || "Background computation failed.",
      {
        code: error.code || "COMPUTE_TASK_FAILED",
        details: error.details || null,
        name: error.name || "ComputeWorkerError"
      }
    ));
  });

  worker.addEventListener("error", () => {
    destroyWorker(new ComputeWorkerError(
      "Background computation worker crashed.",
      { code: "COMPUTE_WORKER_CRASHED" }
    ));
  });

  return worker;
}

export function runComputeTask(
  type,
  payload,
  { timeoutMs = WORKER_TIMEOUT_MS } = {}
) {
  const target = ensureWorker();
  if (!target) {
    return Promise.reject(new ComputeWorkerError(
      "Background computation is unavailable.",
      { code: "COMPUTE_WORKER_UNAVAILABLE" }
    ));
  }

  requestCounter += 1;
  const id = "compute:" + requestCounter;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      destroyWorker();
      reject(new ComputeWorkerError(
        "Background computation exceeded its time limit.",
        { code: "COMPUTE_WORKER_TIMEOUT" }
      ));
    }, Math.max(1000, Number(timeoutMs) || WORKER_TIMEOUT_MS));

    pending.set(id, {
      resolve,
      reject,
      timer
    });

    try {
      target.postMessage({
        id,
        type,
        payload
      });
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(new ComputeWorkerError(
        error?.message || "Could not send work to the background worker.",
        { code: "COMPUTE_WORKER_POST_FAILED" }
      ));
    }
  });
}

export function terminateComputeWorker() {
  destroyWorker(new ComputeWorkerError(
    "Background computation was cancelled.",
    { code: "COMPUTE_WORKER_CANCELLED" }
  ));
}
