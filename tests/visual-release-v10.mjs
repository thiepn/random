import assert from "node:assert/strict";
import fs from "node:fs";

const read=(file)=>fs.readFileSync(file,"utf8");
const index=read("index.html");
const styles=read("styles.css");
const shell=read("app-shell.css");
const tool=read("tool-experience.css");
const app=read("src/app.js");
const visual=read("src/visual-preferences.js");
const boot=read("src/visual-boot.js");
const sw=read("sw.js");
const ci=read(".github/workflows/ci.yml");

for(const file of [
  "docs/design/V10-VISUAL-RELEASE-READINESS.md",
  "RELEASE-NOTES-v1.1.0.md",
  "src/visual-boot.js"
]){
  assert.ok(fs.existsSync(file),"V10 release-readiness file missing: "+file);
}

assert.ok(index.includes('<script src="./src/visual-boot.js"></script>'));
assert.ok(
  index.indexOf('./src/visual-boot.js')<index.indexOf('./design-system.css'),
  "Visual boot must execute before visual styles."
);
assert.doesNotMatch(index,/<script(?![^>]*\bsrc=)/i);
assert.doesNotMatch(index,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
assert.ok(sw.includes('"./src/visual-boot.js"'));

for(const marker of [
  'localStorage.getItem("randomizer.visual.v1")',
  'root.dataset.theme = theme',
  'root.dataset.accent =',
  'root.dataset.contrast = contrast',
  'root.dataset.controlSize =',
  'root.dataset.motion = motion',
  '"(prefers-color-scheme: dark)"',
  '"(prefers-contrast: more)"',
  '"(prefers-reduced-motion: reduce)"'
]){
  assert.ok(boot.includes(marker),"Missing first-paint contract: "+marker);
}

assert.ok(
  visual.includes('localStorage.setItem("randomizer.visual.v1"'),
  "Runtime preferences must mirror first-paint display state."
);
assert.ok(
  app.includes("createDisplayPreferenceControls"),
  "Display controls must remain outside the app controller."
);

for(const legacy of [
  ".layout{min-height:100vh",
  ".topbar{\n  position:sticky",
  ".top-actions{display:flex;align-items:center;gap:8px}",
  ".bottom-nav{\n  position:fixed",
  ".nav-button{\n  border:0;background:transparent",
  ".nav-button span{font-size:19px"
]){
  assert.equal(
    styles.includes(legacy),
    false,
    "Obsolete pre-V4 shell CSS returned: "+legacy
  );
}

assert.ok(
  styles.includes("color:var(--color-text-on-accent);font-weight:900"),
  "Brand foreground must use the semantic on-accent token."
);
assert.ok(
  styles.includes("background:var(--material-inset);box-shadow:var(--shadow-inset)"),
  "Stepper must use semantic inset material."
);
assert.equal(
  styles.includes("background:#0d1020"),
  false,
  "Core Stepper may not retain a dark-only background."
);

for(const marker of [
  "env(safe-area-inset-top)",
  "env(safe-area-inset-bottom)",
  "@media (min-width:720px)",
  "@media (min-width:1180px)",
  "@media (forced-colors:active)"
]){
  assert.ok(shell.includes(marker),"Missing shell resilience contract: "+marker);
}

const resilience=[read("design-system.css"),styles,shell,tool,read("home-arcade.css"),read("phase14.css")].join("\n");
for(const marker of [
  ':root[data-theme="light"]',
  ':root[data-theme="dark"]',
  'html[data-theme="light"] .tool-stage-v2',
  'html[data-motion="reduced"]',
  '@media(max-width:359px)',
  '(orientation:landscape)',
  '@media(min-width:1600px)',
  '@media (forced-colors:active)',
  'overflow-wrap:anywhere'
]){
  assert.ok(resilience.includes(marker),"Missing V10 visual resilience: "+marker);
}

assert.ok(
  /stage-family-(?:coin|dice|wheel|cards|list|people|competition|private|generator)/.test(tool),
  "Tool visual families must remain explicit."
);

for(const source of [boot,visual]){
  assert.doesNotMatch(source,/\bhttps?:\/\//i);
  assert.doesNotMatch(source,/\beval\s*\(|\bnew\s+Function\s*\(/);
}

const appBytes=fs.statSync("src/app.js").size;
const cssFiles=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const cssBytes=cssFiles.reduce((sum,name)=>sum+fs.statSync(name).size,0);

assert.ok(
  appBytes<=423500,
  "V10 requires controller headroom below 423.5 KB: "+appBytes
);
assert.ok(
  cssBytes<=174000,
  "V10 requires at least 1 KB CSS headroom: "+cssBytes
);
assert.ok(
  ci.includes("Final Visual QA & v1.1 Readiness V10 certification"),
  "V10 must be a production release gate."
);

console.log("Final Visual QA / v1.1 Readiness V10 certification passed",JSON.stringify({
  appBytes,
  appHeadroom:425000-appBytes,
  cssBytes,
  cssHeadroom:175000-cssBytes
}));
