import assert from "node:assert/strict";
import fs from "node:fs";

const sw = fs.readFileSync("sw.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const manifest = JSON.parse(
  fs.readFileSync("manifest.webmanifest", "utf8")
);

const shellMatch = sw.match(/const SHELL = \[([\s\S]*?)\];/);
assert.ok(shellMatch, "Service worker SHELL list must exist.");

const entries = [...shellMatch[1].matchAll(/"([^"]+)"/g)]
  .map((match) => match[1]);

assert.ok(entries.length > 10, "Offline shell should contain app assets.");
assert.equal(
  new Set(entries).size,
  entries.length,
  "Offline shell entries must not be duplicated."
);

for (const entry of entries) {
  if (entry === "./") continue;
  assert.ok(
    entry.startsWith("./"),
    "Offline shell paths must be relative: " + entry
  );
  const path = entry.slice(2);
  assert.ok(
    fs.existsSync(path),
    "Offline shell references missing asset: " + path
  );
}

for (const required of [
  "./phase13.css",
  "./src/performance-model.js",
  "./src/worker-client.js",
  "./src/compute-tasks.js",
  "./src/compute-worker.js"
]) {
  assert.ok(entries.includes(required), required + " must be precached.");
}

assert.ok(
  index.includes('./phase13.css'),
  "index.html must load Phase 13 styles."
);
assert.equal(
  index.includes("\\n"),
  false,
  "index.html must not contain escaped newline artifacts."
);
assert.equal(
  sw.includes("\\n"),
  false,
  "sw.js must not contain escaped newline artifacts."
);
assert.equal(manifest.display, "standalone");
assert.ok(manifest.id, "PWA manifest must have a stable id.");

console.log("offline-shell tests passed");
