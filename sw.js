const CACHE = "randomizer-shell-v1.1.0";
const SHELL = [
  "./",
  "./index.html",
  "./design-system.css",
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
  "./phase10.css",
  "./phase11.css",
  "./phase12.css",
  "./phase13.css",
  "./phase14.css",
  "./brand-icons.css",
  "./app-shell.css",
  "./home-arcade.css",
  "./tool-experience.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/brand/random-spark-mark.svg",
  "./src/app.js",
  "./src/icon-system.js",
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
  "./src/custom-experience-model.js",
  "./src/custom-engine.js",
  "./src/workflow-model.js",
  "./src/data-portability.js",
  "./src/performance-model.js",
  "./src/worker-client.js",
  "./src/accessibility-i18n.js",
  "./src/visual-preferences.js",
  "./src/visual-boot.js",
  "./src/security.js",
  "./src/compute-tasks.js",
  "./src/compute-worker.js",
  "./src/storage.js",
  "./src/registry.js"
];

const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL("./index.html", self.registration.scope).href;
const SHELL_URLS = new Set(
  SHELL.map((path) => new URL(path, self.registration.scope).href)
);

function isScopedSameOriginUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.origin === SCOPE_URL.origin
      && url.pathname.startsWith(SCOPE_URL.pathname)
    );
  } catch {
    return false;
  }
}

function trustedMessageSource(source) {
  return Boolean(
    source
    && typeof source.url === "string"
    && isScopedSameOriginUrl(source.url)
  );
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (
    trustedMessageSource(event.source)
    && data
    && typeof data === "object"
    && !Array.isArray(data)
    && Object.keys(data).length === 1
    && data.type === "SKIP_WAITING"
  ) {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
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

  const requestUrl = new URL(event.request.url);
  if (!isScopedSameOriginUrl(requestUrl.href)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  if (!SHELL_URLS.has(requestUrl.href)) return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request)
    )
  );
});
