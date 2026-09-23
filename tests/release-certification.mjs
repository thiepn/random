import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of [
  "VERSION",
  "CHANGELOG.md",
  "MAINTENANCE.md",
  "RELEASE-NOTES-v1.0.0.md",
  "index.html",
  "manifest.webmanifest",
  "design-system.css",
  "brand-icons.css",
  "app-shell.css",
  "home-arcade.css",
  "tool-experience.css",
  "sw.js",
  "src/app.js",
  "src/security.js",
  "src/storage.js",
  "src/random-core.js",
  "src/tool-engine.js",
  "tests/security.mjs",
  "tests/cross-feature-regression.mjs",
  "tests/adversarial-fuzz.mjs",
  "tests/release-certification.mjs",
  "tests/version-baseline.mjs",
  ".github/workflows/ci.yml"
]) {
  assert.ok(exists(file), "Release-critical file is missing: " + file);
}

const index = read("index.html");
const sw = read("sw.js");
const app = read("src/app.js");
const ci = read(".github/workflows/ci.yml");
const manifest = JSON.parse(read("manifest.webmanifest"));
const version = read("VERSION").trim();

assert.equal(version, "1.0.0");
assert.ok(
  app.includes(
    'const PORTABILITY_APP_VERSION = "' + version + '";'
  ),
  "Portable metadata must match VERSION"
);
assert.ok(
  index.includes(
    '<meta name="application-version" content="' + version + '">'
  ),
  "Document version metadata must match VERSION"
);
assert.ok(
  sw.includes(
    'const CACHE = "randomizer-shell-v' + version + '";'
  ),
  "Service-worker cache generation must match VERSION"
);

assert.match(index, /Content-Security-Policy/);
assert.match(index, /script-src 'self'/);
assert.doesNotMatch(index, /<script(?![^>]*\bsrc=)/i);
assert.match(
  index,
  /<script type="module" src="\.\/src\/app\.js"><\/script>/
);

assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.id, "./");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 1);
assert.ok(
  manifest.icons.every((icon) =>
    String(icon.src || "").startsWith("./")
  )
);
assert.ok(
  manifest.shortcuts.every((shortcut) =>
    String(shortcut.url || "").startsWith("./")
  )
);

const shellMatch = sw.match(/const SHELL = \[([\s\S]*?)\];/);
assert.ok(shellMatch, "Service worker shell declaration is missing");
const shell = new Set(
  [...shellMatch[1].matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
);

function resolveImport(fromFile, specifier) {
  const base = path.dirname(fromFile);
  let resolved = path.normalize(path.join(base, specifier))
    .split(path.sep)
    .join("/");
  if (!path.extname(resolved)) resolved += ".js";
  return resolved;
}

function importsFrom(file) {
  const source = read(file);
  const specs = [];
  for (const match of source.matchAll(
    /(?:import\s+(?:[^"'()]+?\s+from\s+)?|export\s+[^"']+?\s+from\s+)["']([^"']+)["']/g
  )) {
    specs.push(match[1]);
  }
  return specs;
}

const visited = new Set();
const queue = ["src/app.js", "src/compute-worker.js"];

while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);

  for (const specifier of importsFrom(file)) {
    assert.ok(
      specifier.startsWith("."),
      "Production modules may not import packages/remotes: "
        + file + " -> " + specifier
    );
    const dependency = resolveImport(file, specifier);
    assert.ok(
      exists(dependency),
      "Missing production dependency: "
        + file + " -> " + dependency
    );
    queue.push(dependency);
  }
}

for (const file of visited) {
  assert.ok(
    shell.has("./" + file),
    "Offline shell is missing module: " + file
  );
}

for (const entry of shell) {
  if (entry === "./") continue;
  assert.ok(entry.startsWith("./"));
  assert.ok(
    exists(entry.slice(2)),
    "Offline shell references missing asset: " + entry
  );
}

const productionJs = fs.readdirSync("src")
  .filter((name) => name.endsWith(".js"))
  .map((name) => "src/" + name);

for (const file of [...productionJs, "sw.js"]) {
  const source = read(file);
  assert.doesNotMatch(source, /\bMath\.random\s*\(/);
  assert.doesNotMatch(
    source,
    /\beval\s*\(|\bnew\s+Function\s*\(|document\.write\s*\(|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(/
  );
}

for (const file of productionJs) {
  assert.doesNotMatch(
    read(file),
    /\bhttps?:\/\//i,
    "Production module contains a remote URL dependency: " + file
  );
}

const jsBytes = productionJs.reduce(
  (sum, file) => sum + fs.statSync(file).size,
  0
);
const cssFiles = fs.readdirSync(".")
  .filter((name) => name.endsWith(".css"));
const cssBytes = cssFiles.reduce(
  (sum, file) => sum + fs.statSync(file).size,
  0
);

assert.ok(
  jsBytes <= 1024 * 1024,
  "Production JavaScript exceeded 1 MiB: " + jsBytes
);
assert.ok(
  cssBytes <= 175000,
  "Production CSS exceeded 175 KB: " + cssBytes
);
assert.ok(fs.statSync("sw.js").size <= 16384);
assert.ok(fs.statSync("manifest.webmanifest").size <= 16384);

for (const requiredStep of [
  "Security, privacy and integrity certification",
  "Cross-feature release regression certification",
  "Adversarial fuzz certification",
  "Version baseline certification",
  "Visual redesign contract certification",
  "Design System V2 certification",
  "Brand and iconography V3 certification",
  "Adaptive shell V4 certification",
  "Home and Arcade V5 certification",
  "Tool Experience V6 certification",
  "Production release certification",
  "Versioned GitHub release"
]) {
  assert.ok(
    ci.includes(requiredStep),
    "CI is missing release gate: " + requiredStep
  );
}

assert.match(ci, /timeout-minutes:/);
assert.match(ci, /workflow_dispatch:/);
assert.match(ci, /needs:\s*certify/);

console.log(
  "production release certification passed",
  JSON.stringify({
    reachableModules: visited.size,
    productionJsBytes: jsBytes,
    cssBytes,
    shellAssets: shell.size
  })
);
