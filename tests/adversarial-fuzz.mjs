import assert from "node:assert/strict";
import {
  createPortablePackage,
  validatePortablePackage,
  PORTABLE_STORES
} from "../src/data-portability.js";
import {
  assertSafeStructuredData,
  safeRouteToken,
  normalizeAudienceMessage,
  validateComputeRequestMessage
} from "../src/security.js";

function emptyStores() {
  return Object.fromEntries(PORTABLE_STORES.map((name) => [name, []]));
}

function basePackage() {
  return createPortablePackage({
    stores: emptyStores(),
    scope: "full",
    device: {
      id: "fuzz-device",
      name: "Fuzz",
      platform: "Node"
    },
    createdAt: "2026-09-23T14:00:00.000Z"
  });
}

{
  const extraTopLevel = structuredClone(basePackage());
  extraTopLevel.injected = true;
  assert.throws(
    () => validatePortablePackage(extraTopLevel),
    /unexpected field/i
  );

  const missingStore = structuredClone(basePackage());
  delete missingStore.payload.stores.pools;
  assert.throws(
    () => validatePortablePackage(missingStore),
    /missing store/i
  );

  const extraStore = structuredClone(basePackage());
  extraStore.payload.stores.evil = [];
  assert.throws(
    () => validatePortablePackage(extraStore),
    /unexpected field/i
  );

  const unsafeRecord = structuredClone(basePackage());
  unsafeRecord.payload.stores.pools = [
    JSON.parse('{"id":"pool:1","nested":{"__proto__":{"polluted":true}}}')
  ];
  assert.throws(
    () => validatePortablePackage(unsafeRecord),
    /prohibited object key/i
  );
  assert.equal({}.polluted, undefined);
}

{
  for (let depth = 1; depth <= 90; depth += 1) {
    let value = "leaf";
    for (let index = 0; index < depth; index += 1) {
      value = { next: value };
    }

    if (depth <= 20) {
      assert.doesNotThrow(() =>
        assertSafeStructuredData(value, {
          maxDepth: 20,
          maxNodes: 1000,
          maxTotalBytes: 100000
        })
      );
    } else {
      assert.throws(() =>
        assertSafeStructuredData(value, {
          maxDepth: 20,
          maxNodes: 1000,
          maxTotalBytes: 100000
        })
      );
    }
  }
}

{
  for (const value of [
    "picker",
    "custom:1234-abcd",
    "party_1",
    "workflow.session-1",
    "A~B:C"
  ]) {
    assert.equal(safeRouteToken(value), value);
  }

  for (const value of [
    "",
    "../escape",
    "/absolute",
    "white space",
    "line\nbreak",
    "query?x=1",
    "#fragment",
    "x".repeat(257)
  ]) {
    assert.equal(safeRouteToken(value), null);
  }
}

{
  for (const result of [
    ["A → B"],
    { assignments: [{ source: "A", target: "B" }] },
    { summary: "A gives to B" },
    "A → B"
  ]) {
    const normalized = normalizeAudienceMessage({
      schemaVersion: 1,
      partyId: "party-1",
      tool: {
        id: "secret-santa",
        name: "Secret Santa",
        icon: "◈",
        accent: "red"
      },
      round: 1,
      pace: "standard",
      stage: "result",
      countdown: 0,
      private: false,
      statusText: "Result",
      result,
      fairness: {
        kind: "constrained",
        mode: "secure",
        operation: "secret-santa",
        candidateCount: 4,
        eligibleCount: 4,
        hardRuleCount: 0,
        softRuleCount: 0,
        solverEffort: "bounded",
        uniformOverValidResults: null
      },
      updatedAt: 1
    }, "party-1");

    assert.ok(normalized);
    assert.equal(normalized.private, true);
    assert.equal(normalized.result, null);
    assert.equal(normalized.fairness, null);
  }
}

{
  const allowed = [
    "tool.execute",
    "portability.parse",
    "portability.merge",
    "portability.serialize"
  ];

  for (let index = 0; index < allowed.length; index += 1) {
    assert.doesNotThrow(() =>
      validateComputeRequestMessage({
        id: "compute:" + (index + 1),
        type: allowed[index],
        payload: {}
      })
    );
  }

  for (const type of [
    "eval",
    "script.execute",
    "network.fetch",
    "__proto__",
    ""
  ]) {
    assert.throws(() =>
      validateComputeRequestMessage({
        id: "compute:99",
        type,
        payload: {}
      })
    );
  }
}

console.log("adversarial fuzz certification passed");
