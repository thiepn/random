import assert from "node:assert/strict";
import fs from "node:fs";

const version = fs.readFileSync("VERSION", "utf8").trim();
const app = fs.readFileSync("src/app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
const maintenance = fs.readFileSync("MAINTENANCE.md", "utf8");
const releaseNotes = fs.readFileSync(
  "RELEASE-NOTES-v" + version + ".md",
  "utf8"
);
const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");

assert.match(
  version,
  /^\d+\.\d+\.\d+$/,
  "VERSION must contain a semantic version"
);
assert.equal(version, "1.0.0");

assert.ok(
  app.includes(
    'const PORTABILITY_APP_VERSION = "' + version + '";'
  ),
  "App portability metadata must match VERSION"
);

assert.ok(
  index.includes(
    '<meta name="application-version" content="' + version + '">'
  ),
  "index.html application-version must match VERSION"
);

assert.ok(
  sw.includes(
    'const CACHE = "randomizer-shell-v' + version + '";'
  ),
  "Service-worker cache generation must match VERSION"
);

assert.ok(
  changelog.includes("## [" + version + "]"),
  "CHANGELOG must contain current release"
);

assert.ok(
  releaseNotes.includes("# Randomizer Arcade v" + version),
  "Release notes must contain current release title"
);

assert.ok(
  maintenance.includes("v1.0.0"),
  "Maintenance baseline must identify v1.0.0"
);

for (const required of [
  "Version baseline certification",
  "Versioned GitHub release",
  'gh release create "$TAG"',
  'needs: production-certify'
]) {
  assert.ok(
    ci.includes(required),
    "CI is missing release invariant: " + required
  );
}

assert.ok(
  ci.includes("contents: write"),
  "Release job must explicitly request contents: write"
);

console.log(
  "version baseline certification passed",
  JSON.stringify({ version })
);
