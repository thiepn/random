const CACHE = "randomizer-shell-v11";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./phase1.css",
  "./phase2.css",
  "./phase3.css",
  "./phase4.css",
  "./phase5.css",
  "./phase6.css",
  "./phase7.css",
  "./phase8.css",
  "./phase9.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/app.js",
  "./src/random-core.js",
  "./src/tool-engine.js",
  "./src/selection-model.js",
  "./src/dice-engine.js",
  "./src/number-engine.js",
  "./src/pool-model.js",
  "./src/rule-model.js",
  "./src/constraint-engine.js",
  "./src/session-model.js",
  "./src/presentation-engine.js",
  "./src/preset-model.js",
  "./src/session-template-model.js",
  "./src/party-model.js",
  "./src/storage.js",
  "./src/registry.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("randomizer-") && key !== CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE).then((cache) =>
              cache.put("./index.html", response.clone())
            );
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (
            response
            && response.status === 200
            && response.type !== "opaque"
          ) {
            caches.open(CACHE).then((cache) =>
              cache.put(event.request, response.clone())
            );
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
