import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("sw.js", "utf8");
const scope = "https://example.test/random/";
const oldName = "randomizer-shell-v1.2.0-g3";
const oldEntries = new Map([
  [new URL("./index.html", scope).href, "old index"],
  [new URL("./src/app.js", scope).href, "old app"]
]);
const cacheData = new Map([[oldName, oldEntries]]);
const listeners = new Map();
let claimed = false;

const caches = {
  open: async (name) => {
    if (!cacheData.has(name)) cacheData.set(name, new Map());
    return {
      addAll: async (paths) => {
        for (const path of paths) {
          cacheData.get(name).set(
            new URL(path, scope).href,
            "new " + path
          );
        }
      },
      match: async (request) => {
        const url = typeof request === "string" ? request : request.url;
        return cacheData.get(name).get(url);
      }
    };
  },
  keys: async () => [...cacheData.keys()],
  delete: async (name) => cacheData.delete(name)
};
const self = {
  registration: { scope },
  clients: { claim: async () => { claimed = true; } },
  skipWaiting: async () => {},
  addEventListener: (name, handler) => listeners.set(name, handler)
};
vm.runInNewContext(source, {
  URL, Set, self, caches,
  fetch: async () => { throw new Error("offline"); }
}, { filename: "sw.js" });

async function lifecycle(name) {
  let pending;
  listeners.get(name)({
    waitUntil: (promise) => { pending = promise; }
  });
  assert.ok(pending, name + " must wait for cache work");
  await pending;
}

await lifecycle("install");
const generations = [...cacheData.keys()];
assert.equal(generations.length, 2);
const activeName = generations.find((name) => name !== oldName);
assert.equal(activeName, "randomizer-shell-v1.2.0-g4");
assert.equal(cacheData.get(oldName).get(new URL("./src/app.js", scope).href), "old app");
assert.equal(
  cacheData.get(activeName).get(new URL("./src/home-search.js", scope).href),
  "new ./src/home-search.js"
);
assert.equal(cacheData.get(activeName).get(new URL("./src/list-input-assist.js", scope).href),
  "new ./src/list-input-assist.js");

await lifecycle("activate");
assert.equal(claimed, true);
assert.deepEqual([...cacheData.keys()], [activeName]);

async function request(url, mode) {
  let response;
  listeners.get("fetch")({
    request: { method: "GET", url, mode },
    respondWith: (promise) => { response = promise; }
  });
  assert.ok(response, "Fetch should be intercepted: " + url);
  return response;
}

assert.equal(
  await request(new URL("./", scope).href, "navigate"),
  "new ./index.html"
);
assert.equal(
  await request(new URL("./src/app.js", scope).href, "same-origin"),
  "new ./src/app.js"
);
console.log("service-worker cache-generation regression tests passed");
