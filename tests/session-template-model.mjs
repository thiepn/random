import assert from "node:assert/strict";
import {
  createSessionTemplate,
  createTemplateSession,
  completeTemplateStep,
  setTemplateStepLocked,
  rerunTemplateFrom,
  previousStepItems,
  resultToItems,
  BUILTIN_SESSION_TEMPLATES
} from "../src/session-template-model.js";

const template = createSessionTemplate({
  name: "Linear",
  steps: [
    {
      id: "s1",
      name: "Shuffle",
      toolId: "shuffle",
      input: { kind: "prompt" }
    },
    {
      id: "s2",
      name: "Teams",
      toolId: "teams",
      input: { kind: "previous", sourceStepId: "s1" }
    },
    {
      id: "s3",
      name: "Pick",
      toolId: "picker",
      input: { kind: "previous", sourceStepId: "s2" }
    }
  ]
});

{
  let session = createTemplateSession(template);
  session = completeTemplateStep(
    session,
    0,
    "run-1",
    ["A", "B", "C", "D"]
  );
  assert.equal(session.currentIndex, 1);
  assert.deepEqual(previousStepItems(session, template, 1), ["A", "B", "C", "D"]);

  session = completeTemplateStep(
    session,
    1,
    "run-2",
    ["A", "B", "C", "D"]
  );
  session = setTemplateStepLocked(session, 1, true);
  session = completeTemplateStep(session, 2, "run-3", ["A"]);
  assert.equal(session.status, "completed");

  const rerun = rerunTemplateFrom(session, 0);
  assert.equal(rerun.steps[0].status, "pending");
  assert.equal(rerun.steps[1].status, "complete");
  assert.equal(rerun.steps[2].status, "complete");
}

assert.deepEqual(
  resultToItems("teams", [["A", "B"], ["C", "D"]]),
  ["A", "B", "C", "D"]
);
assert.deepEqual(
  resultToItems("assignment", [
    { source: "A", target: "X" },
    { source: "B", target: "Y" }
  ]),
  ["A", "B"]
);
assert.deepEqual(
  resultToItems("tournament", [
    { a: "A", b: "B" },
    { a: "C", b: null }
  ]),
  ["A", "B", "C"]
);

assert.ok(BUILTIN_SESSION_TEMPLATES.length >= 3);
assert.ok(BUILTIN_SESSION_TEMPLATES.every((item) => item.steps.length >= 2));

assert.throws(
  () => createSessionTemplate({
    name: "Bad",
    steps: [
      {
        id: "s1",
        toolId: "picker",
        input: { kind: "previous", sourceStepId: "missing" }
      }
    ]
  }),
  /earlier step/
);

console.log("Session Template certification tests passed.");
