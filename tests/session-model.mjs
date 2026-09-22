import assert from "node:assert/strict";
import {
  createSession,
  createRun,
  appendRunToSession,
  undoSession,
  redoSession,
  completeSession,
  abandonSession,
  sessionCanUndo,
  sessionCanRedo,
  fingerprintSetup,
  groupHistoryRuns,
  isSessionCompleteForTool
} from "../src/session-model.js";

{
  const fingerprintA = fingerprintSetup(
    "cards",
    { deck: "standard" },
    { jokers: false }
  );
  const fingerprintB = fingerprintSetup(
    "cards",
    { deck: "standard" },
    { jokers: false }
  );
  assert.equal(fingerprintA, fingerprintB);
}

{
  const initial = { deck: ["A", "B", "C"], result: null };
  let session = createSession({
    toolId: "cards",
    toolName: "Cards",
    initialState: initial,
    setupFingerprint: "fp"
  });

  const run1 = createRun({
    toolId: "cards",
    toolName: "Cards",
    sessionId: session.id,
    beforeState: initial,
    afterState: { deck: ["B", "C"], result: { card: "A", remaining: 2 } },
    result: { card: "A", remaining: 2 },
    summary: "A"
  });
  session = appendRunToSession(session, run1);

  const run2 = createRun({
    toolId: "cards",
    toolName: "Cards",
    sessionId: session.id,
    beforeState: run1.afterState,
    afterState: { deck: ["C"], result: { card: "B", remaining: 1 } },
    result: { card: "B", remaining: 1 },
    summary: "B"
  });
  session = appendRunToSession(session, run2);

  const runs = new Map([[run1.id, run1], [run2.id, run2]]);

  assert.equal(sessionCanUndo(session), true);
  session = undoSession(session, runs);
  assert.deepEqual(session.currentState.deck, ["B", "C"]);
  assert.equal(sessionCanRedo(session), true);

  session = redoSession(session, runs);
  assert.deepEqual(session.currentState.deck, ["C"]);
  assert.equal(session.cursor, 2);
}

{
  const initial = { deck: ["A", "B", "C"], result: null };
  let session = createSession({
    toolId: "cards",
    toolName: "Cards",
    initialState: initial
  });

  const run1 = createRun({
    toolId: "cards",
    toolName: "Cards",
    sessionId: session.id,
    beforeState: initial,
    afterState: { deck: ["B", "C"], result: { card: "A" } },
    result: { card: "A" },
    summary: "A"
  });
  session = appendRunToSession(session, run1);

  const run2 = createRun({
    toolId: "cards",
    toolName: "Cards",
    sessionId: session.id,
    beforeState: run1.afterState,
    afterState: { deck: ["C"], result: { card: "B" } },
    result: { card: "B" },
    summary: "B"
  });
  session = appendRunToSession(session, run2);

  const runs = new Map([[run1.id, run1], [run2.id, run2]]);
  session = undoSession(session, runs);

  const branch = createRun({
    toolId: "cards",
    toolName: "Cards",
    sessionId: session.id,
    beforeState: session.currentState,
    afterState: { deck: ["B"], result: { card: "C" } },
    result: { card: "C" },
    summary: "C"
  });
  session = appendRunToSession(session, branch);

  assert.deepEqual(session.runIds, [run1.id, branch.id]);
  assert.deepEqual(session.abandonedRunIds, [run2.id]);
  assert.equal(sessionCanRedo(session), false);
}

{
  const completed = completeSession(createSession({
    toolId: "elimination",
    toolName: "Elimination",
    initialState: { eliminationRemaining: ["A", "B"] }
  }));
  assert.equal(completed.status, "completed");

  const abandoned = abandonSession(createSession({
    toolId: "cards",
    toolName: "Cards",
    initialState: { deck: ["A"] }
  }));
  assert.equal(abandoned.status, "abandoned");
}

{
  assert.equal(
    isSessionCompleteForTool("cards", { deck: [] }),
    true
  );
  assert.equal(
    isSessionCompleteForTool(
      "elimination",
      { result: { winner: "Anna" } }
    ),
    true
  );
}

{
  const runs = [
    {
      id: "1",
      toolId: "dice",
      toolName: "Dice",
      icon: "D",
      sessionId: null,
      setupFingerprint: "same",
      timestamp: 3000
    },
    {
      id: "2",
      toolId: "dice",
      toolName: "Dice",
      icon: "D",
      sessionId: null,
      setupFingerprint: "same",
      timestamp: 2000
    },
    {
      id: "3",
      toolId: "cards",
      toolName: "Cards",
      icon: "C",
      sessionId: "s1",
      setupFingerprint: "cards",
      timestamp: 1000
    }
  ];

  const groups = groupHistoryRuns(
    runs,
    new Map([["s1", { id: "s1", title: "Game deck", status: "active" }]])
  );

  assert.equal(groups.length, 2);
  assert.equal(groups[0].kind, "burst");
  assert.equal(groups[0].runs.length, 2);
  assert.equal(groups[1].kind, "session");
  assert.equal(groups[1].title, "Game deck");
}

console.log("Session model certification tests passed.");
