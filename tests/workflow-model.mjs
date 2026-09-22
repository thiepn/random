import assert from "node:assert/strict";
import {
  createWorkflow,
  createWorkflowNode,
  createWorkflowEdge,
  updateWorkflow,
  validateWorkflow,
  createWorkflowSession,
  provideWorkflowInput,
  recordWorkflowNode,
  evaluateBranchCondition,
  workflowNextNodeId,
  abandonWorkflowSession
} from "../src/workflow-model.js";

function makeBranchingWorkflow() {
  const input = createWorkflowNode("input", {
    name: "Options",
    config: { mode: "prompt" },
    position: { x: 20, y: 20 }
  });
  const pick = createWorkflowNode("tool", {
    name: "Pick one",
    config: { presetId: "preset:pick", inputMode: "previous" },
    position: { x: 260, y: 20 }
  });
  const branch = createWorkflowNode("branch", {
    name: "Was it Pizza?",
    config: {
      condition: {
        kind: "equals",
        value: "Pizza",
        caseSensitive: false
      }
    },
    position: { x: 500, y: 20 }
  });
  const yes = createWorkflowNode("output", {
    name: "Pizza outcome",
    config: { title: "Pizza won" },
    position: { x: 760, y: 0 }
  });
  const no = createWorkflowNode("output", {
    name: "Other outcome",
    config: { title: "Something else won" },
    position: { x: 760, y: 180 }
  });

  return createWorkflow({
    name: "Dinner chooser",
    nodes: [input, pick, branch, yes, no],
    edges: [
      createWorkflowEdge(input.id, pick.id),
      createWorkflowEdge(pick.id, branch.id),
      createWorkflowEdge(branch.id, yes.id, { port: "true" }),
      createWorkflowEdge(branch.id, no.id, { port: "false" })
    ],
    startNodeId: input.id
  });
}

{
  const workflow = makeBranchingWorkflow();
  const validation = validateWorkflow(workflow, {
    presetIds: new Set(["preset:pick"])
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
  assert.equal(workflowNextNodeId(workflow, workflow.startNodeId), workflow.nodes[1].id);
}

{
  const workflow = makeBranchingWorkflow();
  const session = createWorkflowSession(workflow);
  const originalName = workflow.name;
  workflow.name = "Edited after start";
  assert.equal(session.workflowSnapshot.name, originalName);
  assert.equal(session.workflowRevision, session.workflowSnapshot.revision);
}

{
  const workflow = makeBranchingWorkflow();
  const updated = updateWorkflow(workflow, {
    automation: { mode: "step", maxSteps: 8 }
  });
  assert.equal(updated.id, workflow.id);
  assert.equal(updated.revision, workflow.revision + 1);
  assert.equal(updated.automation.mode, "step");
  assert.equal(updated.automation.maxSteps, 8);
}

{
  assert.equal(
    evaluateBranchCondition(
      { kind: "contains", value: "pizza" },
      { items: ["Pizza Margherita"], summary: "" }
    ),
    true
  );
  assert.equal(
    evaluateBranchCondition(
      { kind: "equals", value: "YES", caseSensitive: false },
      { items: [], summary: "yes" }
    ),
    true
  );
  assert.equal(
    evaluateBranchCondition(
      { kind: "count-at-least", count: 3 },
      { items: ["a", "b", "c"] }
    ),
    true
  );
  assert.equal(
    evaluateBranchCondition(
      { kind: "empty" },
      { items: [], summary: "" }
    ),
    true
  );
}

{
  const workflow = makeBranchingWorkflow();
  let session = createWorkflowSession(workflow);
  assert.equal(session.status, "paused");
  assert.equal(session.pauseReason, "input");

  session = provideWorkflowInput(session, ["Pizza", "Sushi"]);
  assert.equal(session.status, "active");

  const input = workflow.nodes.find((node) => node.type === "input");
  session = recordWorkflowNode(session, workflow, input.id);
  assert.deepEqual(session.lastOutputItems, ["Pizza", "Sushi"]);

  const tool = workflow.nodes.find((node) => node.type === "tool");
  session = recordWorkflowNode(session, workflow, tool.id, {
    runId: "run:1",
    resultItems: ["Pizza"],
    summary: "Pizza"
  });
  assert.deepEqual(session.lastOutputItems, ["Pizza"]);
  assert.equal(session.path.at(-1).runId, "run:1");

  const branch = workflow.nodes.find((node) => node.type === "branch");
  session = recordWorkflowNode(session, workflow, branch.id, {
    branchPort: "true"
  });
  const trueOutput = workflow.nodes.find((node) => node.name === "Pizza outcome");
  assert.equal(session.currentNodeId, trueOutput.id);

  session = recordWorkflowNode(session, workflow, trueOutput.id, {
    resultItems: session.lastOutputItems,
    summary: session.lastSummary
  });
  assert.equal(session.status, "completed");
  assert.equal(session.currentNodeId, null);
  assert.equal(session.path.length, 4);
}

{
  const workflow = makeBranchingWorkflow();
  const branch = workflow.nodes.find((node) => node.type === "branch");
  const input = workflow.nodes.find((node) => node.type === "input");
  const cyclic = updateWorkflow(workflow, {
    edges: [
      ...workflow.edges,
      createWorkflowEdge(
        workflow.nodes.find((node) => node.name === "Pizza outcome").id,
        input.id
      )
    ]
  });
  const validation = validateWorkflow(cyclic, {
    presetIds: new Set(["preset:pick"])
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "CYCLE_NOT_ALLOWED"));
  assert.ok(validation.errors.some((error) => error.code === "OUTPUT_HAS_EDGE"));
  assert.ok(branch);
}

{
  const workflow = makeBranchingWorkflow();
  let session = createWorkflowSession(workflow);
  session = provideWorkflowInput(session, ["A", "B"]);
  session = abandonWorkflowSession(session);
  assert.equal(session.status, "abandoned");
  assert.ok(session.completedAt);
}

console.log("workflow-model tests passed");
