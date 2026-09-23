import assert from "node:assert/strict";
import {
  createPortablePackage,
  serializePortablePackage,
  parsePortablePackage,
  validatePortablePackage,
  mergePortableStores,
  replaceStoresFromPackage,
  portablePackageSummary,
  portableChecksum,
  safePortableFilename,
  LIBRARY_STORES,
  PORTABLE_STORES
} from "../src/data-portability.js";

function stores() {
  return {
    pools: [
      { id: "pool:1", revision: 2, updatedAt: 200, name: "Local pool" }
    ],
    poolViews: [],
    ruleSets: [],
    sessionTemplates: [],
    templateSessions: [],
    partySessions: [],
    customExperiences: [],
    workflows: [],
    workflowSessions: [],
    history: [],
    runs: [
      { id: "run:1", timestamp: 100, result: "A" }
    ],
    sessions: [],
    sessionEvents: [],
    historyPins: [],
    favorites: [{ id: "picker", createdAt: 100 }],
    presets: [
      { id: "preset:1", revision: 1, updatedAt: 100, name: "Picker" }
    ],
    settings: [{ id: "app", value: { randomness: { mode: "secure" } } }]
  };
}

{
  const source = stores();
  const pkg = createPortablePackage({
    stores: source,
    scope: "full",
    device: {
      id: "device:a",
      name: "Laptop",
      platform: "Test"
    },
    appVersion: "12",
    databaseVersion: 8,
    createdAt: "2026-09-23T02:00:00.000Z"
  });

  assert.equal(pkg.format, "randomizer-arcade-portable");
  assert.equal(pkg.schemaVersion, 1);
  assert.equal(pkg.payload.scope, "full");
  assert.equal(pkg.payload.stores.pools.length, 1);
  assert.match(pkg.checksum, /^fnv1a32:[0-9a-f]{8}$/);

  const text = serializePortablePackage(pkg);
  const parsed = parsePortablePackage(text);
  assert.deepEqual(parsed, pkg);

  const summary = portablePackageSummary(parsed);
  assert.equal(summary.scope, "full");
  assert.equal(summary.device.name, "Laptop");
  assert.ok(summary.records >= 4);
}

{
  const source = stores();
  const pkg = createPortablePackage({
    stores: source,
    scope: "library",
    device: { id: "device:a", name: "Laptop" }
  });
  assert.deepEqual(
    Object.keys(pkg.payload.stores).sort(),
    [...LIBRARY_STORES].sort()
  );
  assert.equal(pkg.payload.stores.runs, undefined);
}

{
  const local = stores();
  const incomingStores = stores();
  incomingStores.pools = [
    {
      id: "pool:1",
      revision: 3,
      updatedAt: 300,
      name: "Remote pool"
    },
    {
      id: "pool:2",
      revision: 1,
      updatedAt: 250,
      name: "Remote only"
    }
  ];
  incomingStores.presets = [
    {
      id: "preset:1",
      revision: 1,
      updatedAt: 50,
      name: "Older remote preset"
    }
  ];
  incomingStores.runs = [
    { id: "run:1", timestamp: 100, result: "DIFFERENT" },
    { id: "run:2", timestamp: 200, result: "B" }
  ];

  const pkg = createPortablePackage({
    stores: incomingStores,
    scope: "full",
    device: { id: "device:b", name: "Phone" }
  });

  const merged = mergePortableStores(local, pkg);
  assert.equal(
    merged.stores.pools.find((item) => item.id === "pool:1").name,
    "Remote pool"
  );
  assert.ok(merged.stores.pools.some((item) => item.id === "pool:2"));
  assert.equal(
    merged.stores.presets.find((item) => item.id === "preset:1").name,
    "Picker"
  );
  assert.equal(
    merged.stores.runs.find((item) => item.id === "run:1").result,
    "A"
  );
  assert.ok(merged.stores.runs.some((item) => item.id === "run:2"));
  assert.equal(merged.totals.conflicts, 1);
}

{
  const local = stores();
  local.runs.push({ id: "run:local", timestamp: 300 });
  const incoming = stores();
  incoming.pools = [
    { id: "pool:remote", revision: 1, updatedAt: 300, name: "Remote" }
  ];
  const pkg = createPortablePackage({
    stores: incoming,
    scope: "library",
    device: { id: "device:b", name: "Phone" }
  });
  const replaced = replaceStoresFromPackage(local, pkg);
  assert.equal(replaced.pools[0].id, "pool:remote");
  assert.ok(replaced.runs.some((item) => item.id === "run:local"));
}

{
  const pkg = createPortablePackage({
    stores: stores(),
    scope: "full",
    device: { id: "device:a", name: "Laptop" }
  });
  const tampered = structuredClone(pkg);
  tampered.payload.stores.pools[0].name = "Tampered";

  assert.throws(
    () => validatePortablePackage(tampered),
    /integrity check failed/i
  );

  const metadataTampered = structuredClone(pkg);
  metadataTampered.device.name = "Different device";
  assert.throws(
    () => validatePortablePackage(metadataTampered),
    /integrity check failed/i
  );
}

{
  const filename = safePortableFilename({
    scope: "library",
    createdAt: new Date("2026-09-23T02:00:00.000Z")
  });
  assert.equal(
    filename,
    "randomizer-library-2026-09-23T02-00-00-000Z.json"
  );
}

assert.equal(PORTABLE_STORES.includes("runs"), true);
console.log("data-portability tests passed");
