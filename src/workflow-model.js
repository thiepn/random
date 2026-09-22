export const WORKFLOW_SCHEMA_VERSION = 1;
export const WORKFLOW_SESSION_SCHEMA_VERSION = 1;

export const WORKFLOW_NODE_TYPES = Object.freeze([
  "input",
  "tool",
  "branch",
  "output"
]);

export const WORKFLOW_AUTOMATION_MODES = Object.freeze([
  "step",
  "auto"
]);

export const BRANCH_CONDITION_KINDS = Object.freeze([
  "always",
  "contains",
  "equals",
  "count-at-least",
  "count-at-most",
  "non-empty",
  "empty"
]);

export const MAX_WORKFLOW_NODES = 48;
export const MAX_WORKFLOW_EDGES = 96;
export const MAX_WORKFLOW_AUTO_STEPS = 64;

export class WorkflowModelError extends Error {
  constructor(message, code = "WORKFLOW_ERROR", details = null) {
    super(message);
    this.name = "WorkflowModelError";
    this.code = code;
    this.details = details;
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new WorkflowModelError(
    "Secure UUID generation is unavailable.",
    "UUID_UNAVAILABLE"
  );
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function now() {
  return Date.now();
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizePosition(position = {}, index = 0) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Number.isFinite(x) ? Math.max(0, Math.min(2000, Math.round(x))) : 40 + (index % 3) * 260,
    y: Number.isFinite(y) ? Math.max(0, Math.min(4000, Math.round(y))) : 40 + Math.floor(index / 3) * 180
  };
}

function normalizeCondition(condition = {}) {
  const kind = BRANCH_CONDITION_KINDS.includes(condition.kind)
    ? condition.kind
    : "contains";

  return {
    kind,
    value: cleanText(condition.value),
    count: integer(condition.count, 1, 0, 10000),
    caseSensitive: Boolean(condition.caseSensitive)
  };
}

function defaultNodeName(type) {
  if (type === "input") return "Input";
  if (type === "tool") return "Randomizer";
  if (type === "branch") return "Branch";
  if (type === "output") return "Outcome";
  return "Node";
}

export function createWorkflowNode(type, {
  id = null,
  name = null,
  position = null,
  config = {}
} = {}) {
  if (!WORKFLOW_NODE_TYPES.includes(type)) {
    throw new WorkflowModelError(
      "Unsupported workflow node type.",
      "INVALID_NODE_TYPE"
    );
  }

  const node = {
    id: id || uuid(),
    type,
    name: cleanText(name, defaultNodeName(type)) || defaultNodeName(type),
    position: normalizePosition(position)
  };

  if (type === "input") {
    node.config = {
      mode: config.mode === "fixed" ? "fixed" : "prompt",
      fixedItems: Array.isArray(config.fixedItems)
        ? config.fixedItems.map((item) => String(item).trim()).filter(Boolean).slice(0, 500)
        : []
    };
  } else if (type === "tool") {
    node.config = {
      presetId: cleanText(config.presetId),
      inputMode: config.inputMode === "preset" ? "preset" : "previous"
    };
  } else if (type === "branch") {
    node.config = {
      condition: normalizeCondition(config.condition)
    };
  } else {
    node.config = {
      title: cleanText(config.title, "Workflow result") || "Workflow result"
    };
  }

  return node;
}

export function createWorkflowEdge(from, to, {
  id = null,
  port = "next",
  label = ""
} = {}) {
  const normalizedPort = ["next", "true", "false"].includes(port)
    ? port
    : "next";
  return {
    id: id || uuid(),
    from: String(from || ""),
    to: String(to || ""),
    port: normalizedPort,
    label: cleanText(label)
  };
}

function normalizeNode(node, index) {
  return createWorkflowNode(node?.type || "tool", {
    id: cleanText(node?.id) || uuid(),
    name: node?.name,
    position: normalizePosition(node?.position, index),
    config: node?.config || {}
  });
}

function normalizeEdge(edge) {
  return createWorkflowEdge(edge?.from, edge?.to, {
    id: cleanText(edge?.id) || uuid(),
    port: edge?.port,
    label: edge?.label
  });
}

function normalizeAutomation(automation = {}) {
  return {
    mode: WORKFLOW_AUTOMATION_MODES.includes(automation.mode)
      ? automation.mode
      : "auto",
    maxSteps: integer(
      automation.maxSteps,
      24,
      1,
      MAX_WORKFLOW_AUTO_STEPS
    )
  };
}

export function normalizeWorkflow(workflow = {}) {
  const nodes = Array.isArray(workflow.nodes)
    ? workflow.nodes.slice(0, MAX_WORKFLOW_NODES).map(normalizeNode)
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(workflow.edges)
    ? workflow.edges
        .slice(0, MAX_WORKFLOW_EDGES)
        .map(normalizeEdge)
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    : [];

  const inferredStart = nodes[0]?.id || null;
  const startNodeId = nodeIds.has(workflow.startNodeId)
    ? workflow.startNodeId
    : inferredStart;

  return {
    id: cleanText(workflow.id) || uuid(),
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    revision: integer(workflow.revision, 1, 1, Number.MAX_SAFE_INTEGER),
    name: cleanText(workflow.name, "Untitled workflow") || "Untitled workflow",
    description: cleanText(workflow.description),
    automation: normalizeAutomation(workflow.automation),
    startNodeId,
    nodes,
    edges,
    createdAt: Number.isFinite(Number(workflow.createdAt))
      ? Number(workflow.createdAt)
      : now(),
    updatedAt: Number.isFinite(Number(workflow.updatedAt))
      ? Number(workflow.updatedAt)
      : now()
  };
}

export function createWorkflow({
  name = "Untitled workflow",
  description = "",
  automation = { mode: "auto", maxSteps: 24 },
  nodes = null,
  edges = null,
  startNodeId = null
} = {}) {
  const input = createWorkflowNode("input", {
    name: "Decision input",
    position: { x: 40, y: 80 }
  });
  const output = createWorkflowNode("output", {
    name: "Outcome",
    position: { x: 640, y: 80 }
  });

  const timestamp = now();
  const workflow = normalizeWorkflow({
    id: uuid(),
    revision: 1,
    name,
    description,
    automation,
    nodes: Array.isArray(nodes) && nodes.length ? nodes : [input, output],
    edges: Array.isArray(edges) ? edges : [],
    startNodeId: startNodeId || (Array.isArray(nodes) && nodes.length ? nodes[0].id : input.id),
    createdAt: timestamp,
    updatedAt: timestamp
  });

  if (!Array.isArray(nodes) || !nodes.length) {
    workflow.edges = [];
  }
  return workflow;
}

export function updateWorkflow(workflow, patch = {}) {
  const current = normalizeWorkflow(workflow);
  const next = normalizeWorkflow({
    ...current,
    ...clone(patch),
    id: current.id,
    revision: current.revision + 1,
    createdAt: current.createdAt,
    updatedAt: now()
  });
  return next;
}

function outgoingEdges(workflow, nodeId) {
  return workflow.edges.filter((edge) => edge.from === nodeId);
}

function incomingEdges(workflow, nodeId) {
  return workflow.edges.filter((edge) => edge.to === nodeId);
}

function cycleNodes(workflow) {
  const adjacency = new Map(
    workflow.nodes.map((node) => [node.id, []])
  );
  for (const edge of workflow.edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }

  const visiting = new Set();
  const visited = new Set();
  const cycle = new Set();

  function visit(id, stack = []) {
    if (visiting.has(id)) {
      const index = stack.indexOf(id);
      for (const value of stack.slice(Math.max(0, index))) cycle.add(value);
      cycle.add(id);
      return;
    }
    if (visited.has(id)) return;

    visiting.add(id);
    stack.push(id);
    for (const next of adjacency.get(id) || []) visit(next, stack);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const node of workflow.nodes) visit(node.id, []);
  return cycle;
}

function reachableNodeIds(workflow) {
  const reachable = new Set();
  if (!workflow.startNodeId) return reachable;
  const stack = [workflow.startNodeId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of outgoingEdges(workflow, id)) stack.push(edge.to);
  }
  return reachable;
}

export function validateWorkflow(workflow, {
  presetIds = null,
  allowDraft = false
} = {}) {
  const value = normalizeWorkflow(workflow);
  const errors = [];
  const warnings = [];
  const nodeIds = new Set();

  if (!value.name.trim()) {
    errors.push({ code: "NAME_REQUIRED", message: "Workflow name is required." });
  }
  if (!value.nodes.length) {
    errors.push({ code: "NODE_REQUIRED", message: "Add at least one node." });
  }
  if (!value.startNodeId || !value.nodes.some((node) => node.id === value.startNodeId)) {
    errors.push({ code: "START_REQUIRED", message: "Choose a valid start node." });
  }

  for (const node of value.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({
        code: "DUPLICATE_NODE_ID",
        nodeId: node.id,
        message: "Workflow node IDs must be unique."
      });
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set();
  const edgeKeys = new Set();
  for (const edge of value.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push({
        code: "DUPLICATE_EDGE_ID",
        edgeId: edge.id,
        message: "Workflow edge IDs must be unique."
      });
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push({
        code: "EDGE_ENDPOINT_INVALID",
        edgeId: edge.id,
        message: "Every edge must connect two existing nodes."
      });
    }
    if (edge.from === edge.to) {
      errors.push({
        code: "SELF_EDGE",
        edgeId: edge.id,
        message: "A workflow node cannot connect to itself."
      });
    }

    const key = edge.from + "::" + edge.port;
    if (edgeKeys.has(key)) {
      errors.push({
        code: "DUPLICATE_EDGE_PORT",
        nodeId: edge.from,
        message: "A node can only have one outgoing edge per port."
      });
    }
    edgeKeys.add(key);
  }

  for (const node of value.nodes) {
    const outgoing = outgoingEdges(value, node.id);
    const incoming = incomingEdges(value, node.id);

    if (node.type === "tool") {
      if (!node.config.presetId) {
        errors.push({
          code: "PRESET_REQUIRED",
          nodeId: node.id,
          message: "Randomizer nodes must reference a saved Preset."
        });
      } else if (presetIds && !presetIds.has(node.config.presetId)) {
        errors.push({
          code: "PRESET_MISSING",
          nodeId: node.id,
          message: "This node references a Preset that no longer exists."
        });
      }
    }

    if (node.type === "input" && node.config.mode === "fixed" && !node.config.fixedItems.length) {
      errors.push({
        code: "FIXED_INPUT_EMPTY",
        nodeId: node.id,
        message: "Fixed input nodes need at least one item."
      });
    }

    if (node.type === "branch") {
      const ports = new Set(outgoing.map((edge) => edge.port));
      if (!ports.has("true") || !ports.has("false")) {
        errors.push({
          code: "BRANCH_EDGES_REQUIRED",
          nodeId: node.id,
          message: "Branch nodes need both True and False connections."
        });
      }
      if (outgoing.some((edge) => !["true", "false"].includes(edge.port))) {
        errors.push({
          code: "BRANCH_PORT_INVALID",
          nodeId: node.id,
          message: "Branch nodes may only use True and False connections."
        });
      }
    } else if (node.type === "output") {
      if (outgoing.length) {
        errors.push({
          code: "OUTPUT_HAS_EDGE",
          nodeId: node.id,
          message: "Outcome nodes must be terminal."
        });
      }
    } else {
      if (outgoing.length !== 1) {
        errors.push({
          code: "NEXT_EDGE_REQUIRED",
          nodeId: node.id,
          message: "This node needs exactly one Next connection."
        });
      } else if (outgoing[0].port !== "next") {
        errors.push({
          code: "NEXT_PORT_INVALID",
          nodeId: node.id,
          message: "Input and Randomizer nodes use the Next connection."
        });
      }
    }

    if (node.id !== value.startNodeId && incoming.length === 0) {
      warnings.push({
        code: "UNREACHABLE_NO_INPUT",
        nodeId: node.id,
        message: "This node has no incoming connection."
      });
    }
  }

  const cycles = cycleNodes(value);
  if (cycles.size) {
    errors.push({
      code: "CYCLE_NOT_ALLOWED",
      nodeIds: [...cycles],
      message: "Decision Studio workflows must be acyclic so automation always terminates."
    });
  }

  const reachable = reachableNodeIds(value);
  for (const node of value.nodes) {
    if (!reachable.has(node.id)) {
      warnings.push({
        code: "UNREACHABLE_NODE",
        nodeId: node.id,
        message: "This node is not reachable from the workflow start."
      });
    }
  }

  const reachableOutputs = value.nodes.filter(
    (node) => node.type === "output" && reachable.has(node.id)
  );
  if (!reachableOutputs.length) {
    errors.push({
      code: "OUTCOME_REQUIRED",
      message: "At least one reachable Outcome node is required."
    });
  }

  const effectiveErrors = allowDraft
    ? errors.filter((error) => ![
        "PRESET_REQUIRED",
        "PRESET_MISSING",
        "FIXED_INPUT_EMPTY",
        "BRANCH_EDGES_REQUIRED",
        "NEXT_EDGE_REQUIRED",
        "OUTCOME_REQUIRED"
      ].includes(error.code))
    : errors;

  return {
    valid: effectiveErrors.length === 0,
    errors: effectiveErrors,
    allErrors: errors,
    warnings,
    workflow: value
  };
}

export function workflowNextNodeId(workflow, nodeId, port = "next") {
  const value = normalizeWorkflow(workflow);
  const edge = value.edges.find(
    (candidate) => candidate.from === nodeId && candidate.port === port
  );
  return edge?.to || null;
}

function comparisonText(value, caseSensitive) {
  const text = String(value ?? "");
  return caseSensitive ? text : text.toLocaleLowerCase();
}

export function evaluateBranchCondition(condition, {
  items = [],
  summary = ""
} = {}) {
  const normalized = normalizeCondition(condition);
  const values = Array.isArray(items) ? items.map(String) : [];
  const haystacks = [...values, String(summary ?? "")];
  const needle = comparisonText(normalized.value, normalized.caseSensitive);

  if (normalized.kind === "always") return true;
  if (normalized.kind === "non-empty") return values.length > 0 || Boolean(String(summary).trim());
  if (normalized.kind === "empty") return values.length === 0 && !String(summary).trim();
  if (normalized.kind === "count-at-least") return values.length >= normalized.count;
  if (normalized.kind === "count-at-most") return values.length <= normalized.count;

  if (normalized.kind === "equals") {
    return haystacks.some(
      (value) => comparisonText(value, normalized.caseSensitive) === needle
    );
  }

  return haystacks.some(
    (value) => comparisonText(value, normalized.caseSensitive).includes(needle)
  );
}

function initialPromptState(workflow) {
  const start = workflow.nodes.find((node) => node.id === workflow.startNodeId);
  if (start?.type === "input" && start.config.mode === "prompt") {
    return {
      status: "paused",
      pauseReason: "input",
      pauseNodeId: start.id
    };
  }
  return {
    status: "active",
    pauseReason: null,
    pauseNodeId: null
  };
}

export function createWorkflowSession(workflow, {
  inputItems = []
} = {}) {
  const value = normalizeWorkflow(workflow);
  const validation = validateWorkflow(value);
  if (!validation.valid) {
    throw new WorkflowModelError(
      validation.errors[0]?.message || "Workflow is invalid.",
      validation.errors[0]?.code || "WORKFLOW_INVALID",
      validation
    );
  }

  const prompt = initialPromptState(value);
  const timestamp = now();
  return {
    id: uuid(),
    schemaVersion: WORKFLOW_SESSION_SCHEMA_VERSION,
    revision: 1,
    workflowId: value.id,
    workflowRevision: value.revision,
    workflowName: value.name,
    status: prompt.status,
    pauseReason: prompt.pauseReason,
    pauseNodeId: prompt.pauseNodeId,
    currentNodeId: value.startNodeId,
    inputItems: Array.isArray(inputItems)
      ? inputItems.map((item) => String(item).trim()).filter(Boolean).slice(0, 500)
      : [],
    lastOutputItems: [],
    lastSummary: "",
    path: [],
    stepCount: 0,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null
  };
}

export function provideWorkflowInput(session, items) {
  if (!session || !["paused", "active"].includes(session.status)) {
    throw new WorkflowModelError(
      "Workflow Session cannot accept input.",
      "WORKFLOW_SESSION_NOT_INPUT_READY"
    );
  }

  const normalized = Array.isArray(items)
    ? items.map((item) => String(item).trim()).filter(Boolean).slice(0, 500)
    : [];

  if (!normalized.length) {
    throw new WorkflowModelError(
      "Enter at least one input item.",
      "WORKFLOW_INPUT_REQUIRED"
    );
  }

  const next = clone(session);
  next.inputItems = normalized;
  next.status = "active";
  next.pauseReason = null;
  next.pauseNodeId = null;
  next.error = null;
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function recordWorkflowNode(session, workflow, nodeId, {
  runId = null,
  resultItems = [],
  summary = "",
  branchPort = null
} = {}) {
  const value = normalizeWorkflow(workflow);
  if (!session || !["active", "paused"].includes(session.status)) {
    throw new WorkflowModelError(
      "Workflow Session is not active.",
      "WORKFLOW_SESSION_NOT_ACTIVE"
    );
  }
  if (session.currentNodeId !== nodeId) {
    throw new WorkflowModelError(
      "Workflow Session moved before this node could commit.",
      "WORKFLOW_NODE_STALE"
    );
  }

  const node = value.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new WorkflowModelError(
      "Workflow node no longer exists.",
      "WORKFLOW_NODE_MISSING"
    );
  }

  const items = Array.isArray(resultItems)
    ? resultItems.map((item) => String(item)).slice(0, 500)
    : [];
  const normalizedSummary = String(summary ?? "");
  let port = "next";

  if (node.type === "branch") {
    port = branchPort || (
      evaluateBranchCondition(node.config.condition, {
        items: session.lastOutputItems,
        summary: session.lastSummary
      })
        ? "true"
        : "false"
    );
  }

  const next = clone(session);
  next.path.push({
    nodeId: node.id,
    nodeType: node.type,
    nodeName: node.name,
    runId: runId ? String(runId) : null,
    branchPort: node.type === "branch" ? port : null,
    resultItems: clone(items),
    summary: normalizedSummary,
    timestamp: now()
  });
  next.stepCount += 1;

  if (node.type === "input") {
    next.lastOutputItems = node.config.mode === "fixed"
      ? [...node.config.fixedItems]
      : [...next.inputItems];
    next.lastSummary = next.lastOutputItems.join(", ");
  } else if (node.type === "tool") {
    next.lastOutputItems = items;
    next.lastSummary = normalizedSummary;
  }

  if (node.type === "output") {
    next.status = "completed";
    next.currentNodeId = null;
    next.pauseReason = null;
    next.pauseNodeId = null;
    next.completedAt = now();
  } else {
    const destination = workflowNextNodeId(value, node.id, port);
    if (!destination) {
      throw new WorkflowModelError(
        "Workflow path has no destination.",
        "WORKFLOW_PATH_BROKEN",
        { nodeId: node.id, port }
      );
    }
    next.currentNodeId = destination;
    next.status = "active";
    next.pauseReason = null;
    next.pauseNodeId = null;
  }

  next.error = null;
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function pauseWorkflowSession(session, reason = "manual", nodeId = null) {
  if (!session || session.status !== "active") return clone(session);
  const next = clone(session);
  next.status = "paused";
  next.pauseReason = reason;
  next.pauseNodeId = nodeId || session.currentNodeId || null;
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function resumeWorkflowSession(session) {
  if (!session || session.status !== "paused") return clone(session);
  const next = clone(session);
  next.status = "active";
  next.pauseReason = null;
  next.pauseNodeId = null;
  next.error = null;
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function failWorkflowSession(session, error) {
  const next = clone(session);
  next.status = "error";
  next.error = String(error?.message || error || "Workflow failed.");
  next.pauseReason = null;
  next.pauseNodeId = next.currentNodeId || null;
  next.revision += 1;
  next.updatedAt = now();
  return next;
}

export function abandonWorkflowSession(session) {
  const next = clone(session);
  next.status = "abandoned";
  next.pauseReason = null;
  next.pauseNodeId = null;
  next.completedAt = now();
  next.revision += 1;
  next.updatedAt = now();
  return next;
}
