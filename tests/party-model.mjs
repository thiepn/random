import assert from "node:assert/strict";
import {
  createPartySession,
  updatePartyOptions,
  appendPartyRun,
  completePartySession,
  partyPresentationMode,
  countdownSeconds,
  publicPartyResult,
  makeAudienceState
} from "../src/party-model.js";

{
  let party = createPartySession({
    toolId: "wheel",
    toolName: "Wheel"
  });
  assert.equal(party.options.pace, "standard");
  assert.equal(party.round, 1);

  party = updatePartyOptions(party, {
    pace: "dramatic",
    countdown: "full",
    hostLocked: true
  });
  assert.equal(party.options.pace, "dramatic");
  assert.equal(party.options.hostLocked, true);

  party = updatePartyOptions(party, { paused: true });
  assert.equal(party.options.paused, true);

  party = appendPartyRun(party, "run-1");
  assert.deepEqual(party.runIds, ["run-1"]);
  assert.equal(party.round, 2);

  party = completePartySession(party);
  assert.equal(party.status, "completed");
}

assert.equal(partyPresentationMode("fast"), "instant");
assert.equal(partyPresentationMode("standard"), "normal");
assert.equal(partyPresentationMode("dramatic"), "showtime");
assert.equal(countdownSeconds("off"), 0);
assert.equal(countdownSeconds("short"), 3);
assert.equal(countdownSeconds("full"), 5);

assert.deepEqual(
  publicPartyResult("teams", [["A", "B"], ["C", "D"]]),
  [["A", "B"], ["C", "D"]]
);
assert.deepEqual(
  publicPartyResult("assignment", [
    { source: "A", target: "Setup" }
  ]),
  [{ source: "A", target: "Setup" }]
);
assert.equal(
  publicPartyResult("secret-santa", {
    summary: "ASSIGNMENTS READY"
  }),
  null
);

{
  const party = createPartySession({
    toolId: "secret-santa",
    toolName: "Secret Santa"
  });
  const audience = makeAudienceState({
    party,
    tool: {
      id: "secret-santa",
      name: "Secret Santa",
      icon: "◈",
      accent: "red"
    },
    run: {
      result: {
        summary: "ASSIGNMENTS READY",
        assignments: [
          { source: "A", target: "B" }
        ]
      },
      fairness: {
        kind: "constrained",
        diagnostics: { privateThing: "never send" }
      }
    }
  });
  assert.equal(audience.private, true);
  assert.equal(audience.result, null);
  assert.equal(audience.fairness, null);
  assert.equal(JSON.stringify(audience).includes("assignments"), false);
  assert.equal(JSON.stringify(audience).includes("privateThing"), false);
}

{
  const party = createPartySession({
    toolId: "wheel",
    toolName: "Wheel"
  });
  const audience = makeAudienceState({
    party,
    tool: {
      id: "wheel",
      name: "Wheel",
      icon: "◉",
      accent: "rainbow"
    },
    run: {
      result: "Pizza",
      fairness: {
        kind: "selection",
        mode: "weighted",
        candidateCount: 4,
        eligibleCount: 3,
        probabilities: [{ label: "Pizza", probability: 0.5 }]
      }
    }
  });
  assert.equal(audience.result, "Pizza");
  assert.equal(audience.fairness.candidateCount, 4);
  assert.equal("probabilities" in audience.fairness, false);
}

console.log("Party model certification tests passed.");
