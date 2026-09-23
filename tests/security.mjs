import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SecurityBoundaryError,
  assertSafeStructuredData,
  assertSafeStorageRecord,
  assertJsonImportFile,
  safeRouteToken,
  sanitizeDownloadFilename,
  isPartyStateRequest,
  normalizeAudienceMessage,
  validateComputeRequestMessage,
  validateComputeResponseMessage
} from "../src/security.js";

{
  const safe = {
    id: "record:1",
    nested: {
      values: ["A", "B", 3, true, null]
    }
  };
  assert.equal(assertSafeStructuredData(safe), safe);
  assert.equal(assertSafeStorageRecord(safe), safe);
}

{
  const unsafe = JSON.parse(
    '{"id":"record:1","nested":{"__proto__":{"polluted":true}}}'
  );
  assert.throws(
    () => assertSafeStructuredData(unsafe),
    (error) =>
      error instanceof SecurityBoundaryError
      && error.code === "STRUCTURED_DATA_UNSAFE_KEY"
  );
  assert.equal({}.polluted, undefined);
}

{
  let value = "leaf";
  for (let index = 0; index < 8; index += 1) {
    value = { child: value };
  }
  assert.throws(
    () => assertSafeStructuredData(value, { maxDepth: 4 }),
    /nested too deeply/i
  );
  assert.throws(
    () => assertSafeStructuredData({ value: Infinity }),
    /non-finite/i
  );
  assert.throws(
    () => assertSafeStorageRecord({ value: "missing id" }),
    /valid id/i
  );
}

{
  assert.equal(safeRouteToken("custom:abc-123"), "custom:abc-123");
  assert.equal(safeRouteToken("../evil"), null);
  assert.equal(safeRouteToken("a b"), null);
  assert.equal(safeRouteToken("x".repeat(300)), null);

  assert.equal(
    sanitizeDownloadFilename("../My: Randomizer?.json"),
    "-My- Randomizer-.json"
  );
  assert.equal(
    sanitizeDownloadFilename("CON"),
    "_CON"
  );
}

{
  assert.equal(
    assertJsonImportFile({
      name: "backup.json",
      type: "application/json",
      size: 1024
    }).name,
    "backup.json"
  );
  assert.throws(
    () => assertJsonImportFile({
      name: "huge.json",
      type: "application/json",
      size: 33 * 1024 * 1024
    }),
    /32 MB/i
  );
  assert.throws(
    () => assertJsonImportFile({
      name: "backup.exe",
      type: "application/octet-stream",
      size: 100
    }),
    /must be JSON/i
  );
}

{
  assert.equal(
    isPartyStateRequest(
      { type: "party-state-request", partyId: "party-1" },
      "party-1"
    ),
    true
  );
  assert.equal(
    isPartyStateRequest(
      { type: "party-state-request", partyId: "party-2" },
      "party-1"
    ),
    false
  );

  const message = normalizeAudienceMessage({
    schemaVersion: 1,
    partyId: "party-1",
    tool: {
      id: "secret-santa",
      name: "Secret Santa",
      icon: "🎁",
      accent: "red"
    },
    round: 2,
    pace: "standard",
    stage: "result",
    countdown: 0,
    private: false,
    statusText: "Result",
    result: ["Alice → Bob"],
    fairness: {
      kind: "assignment",
      mode: "secure",
      operation: "secret-santa",
      candidateCount: 8,
      eligibleCount: 8,
      hardRuleCount: 0,
      softRuleCount: 0,
      solverEffort: "bounded",
      uniformOverValidResults: null
    },
    updatedAt: 123
  }, "party-1");

  assert.equal(message.private, true);
  assert.equal(message.result, null);
  assert.equal(message.fairness, null);

  assert.equal(
    normalizeAudienceMessage({
      schemaVersion: 1,
      partyId: "other",
      tool: {
        id: "picker",
        name: "Picker",
        icon: "✦",
        accent: "cyan"
      },
      round: 1,
      pace: "standard",
      stage: "ready",
      countdown: 0,
      private: false,
      statusText: "Ready",
      result: null,
      fairness: null,
      updatedAt: 0
    }, "party-1"),
    null
  );
}

{
  const request = {
    id: "compute:1",
    type: "tool.execute",
    payload: {
      toolId: "picker",
      config: {},
      randomSpec: { mode: "seeded", seed: "test" }
    }
  };
  assert.equal(validateComputeRequestMessage(request), request);
  assert.throws(
    () => validateComputeRequestMessage({
      ...request,
      type: "arbitrary.execute"
    }),
    /not allowed/i
  );

  const response = {
    id: "compute:1",
    ok: true,
    result: { value: "A" }
  };
  assert.equal(
    validateComputeResponseMessage(response, "compute:1"),
    response
  );
  assert.throws(
    () => validateComputeResponseMessage(response, "compute:2"),
    /envelope is invalid/i
  );
}

{
  const index = fs.readFileSync("index.html", "utf8");
  const sw = fs.readFileSync("sw.js", "utf8");

  assert.match(index, /Content-Security-Policy/);
  assert.match(index, /script-src 'self'/);
  assert.doesNotMatch(index, /script-src[^>]*unsafe-eval/i);
  assert.match(index, /name="referrer" content="no-referrer"/);

  assert.match(sw, /SHELL_URLS/);
  assert.match(sw, /isScopedSameOriginUrl/);
  assert.match(sw, /SHELL_URLS\.has\(requestUrl\.href\)/);
}

console.log("security hardening tests passed");
