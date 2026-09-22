const CACHE = "randomizer-shell-v4";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./phase1.css",
  "./phase2.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/app.js",
  "./src/random-core.js",
  "./src/tool-engine.js",
  "./src/selection-model.js",
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
          if (response && response.status === 200 && response.type !== "opaque") {
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
