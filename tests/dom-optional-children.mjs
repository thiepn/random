import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/app.js","utf8");

assert.ok(
  app.includes("function appendPresent(parent, ...children)"),
  "Optional-child DOM rendering must use appendPresent."
);
assert.ok(
  app.includes("if (child == null) continue;"),
  "appendPresent must drop nullish optional children."
);
assert.equal(
  app.includes("wrap.append("),
  false,
  "Stage builders must not call native wrap.append with optional null children."
);
assert.equal(
  app.includes("body.append("),
  false,
  "Modal/body builders must not call native body.append with optional null children."
);

assert.equal(
  app.includes("document.appendPresent("),
  false,
  "appendPresent must receive document.body, not be called as a document method."
);
assert.ok(
  app.includes("appendPresent(document.body,"),
  "Document-level optional children must use appendPresent(document.body, ...)."
);

for(const marker of [
  "appendPresent(wrap,",
  "appendPresent(body,"
]){
  assert.ok(app.includes(marker),"Missing optional-child safe append path: "+marker);
}

// Native Element.append() converts null/undefined to visible text. Keep conditional
// children behind the helper anywhere these high-risk stage/body builders render.
const risky=/\b(?:wrap|body)\.append\s*\(/g;
assert.equal(risky.test(app),false,"Unsafe native append path returned.");

console.log("optional DOM child regression certification passed",JSON.stringify({
  helper:true,
  wrapNativeAppend:false,
  bodyNativeAppend:false
}));
