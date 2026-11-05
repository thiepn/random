import assert from "node:assert/strict";
import fs from "node:fs";
import {
  entriesFromText, formatEntryText, mergeClipboardEntries,
  createListInputAssist, defaultListEntries
} from "../src/list-input-assist.js";
import { TOOLS } from "../src/registry.js";

assert.equal(TOOLS.length, 25);
for (const id of ["wheel", "picker", "sampler", "shuffle", "teams", "groups",
  "pairs", "assignment", "elimination", "ladder", "secret-santa", "tournament"]) {
  assert.ok(defaultListEntries(id).split("\n").length >= 4, id + " lost its starter list");
}
assert.deepEqual(entriesFromText(" Alpha ; Beta\r\n \n Gamma "), ["Alpha","Beta","Gamma"]);
assert.equal(formatEntryText("One;  Two\n\n  Three"), "One\nTwo\nThree");
assert.deepEqual(mergeClipboardEntries("Old", "One; Two", "append"),
  {value:"Old\nOne\nTwo",added:2});
assert.deepEqual(mergeClipboardEntries("Old", "One; Two", "replace"),
  {value:"One\nTwo",added:2});
assert.deepEqual(mergeClipboardEntries("Old", " \n ; ", "replace"),
  {value:"Old",added:0});
assert.equal(mergeClipboardEntries("A\nA", "A", "append").value,"A\nA\nA",
  "Duplicates can be intentional for weighted selection");
assert.throws(() => mergeClipboardEntries("", "A", "invalid"), TypeError);
assert.throws(() => mergeClipboardEntries("", "A".repeat(200001)), RangeError);

function node(tag, options={}, children=[]) {
  return { tag, options, children: Array.isArray(children)?children:[children],
    textContent: options.text || "", value: options.value || "",
    find(predicate) {
      if(predicate(this)) return this;
      for(const child of this.children) {
        if(child?.find){const hit=child.find(predicate);if(hit)return hit;}
      }
      return null;
    }
  };
}
function textarea(initial="") {
  const handlers = new Map();
  return { value:initial, isConnected:true, addEventListener(k,fn){handlers.set(k,fn)},
    focus(){this.focused=true}, fire(k){handlers.get(k)?.()} };
}
const notes=[],changes=[];
const input=textarea("Alpha\nBeta");
const tree=createListInputAssist({
  toolId:"teams",node,textarea:input,
  clipboard:{readText:async()=>"Gamma; Delta"},
  announce:(message)=>notes.push(message),
  onUpdate:(action,msg)=>changes.push([action,msg])
});
assert.match(tree.find(x=>x.tag==="p").textContent,/participant/i);
assert.equal(tree.find(x=>x.tag==="span"&&x.options.role==="status").textContent,"2 entries");
const button=(action)=>tree.find(x=>x.options.dataset?.inputAction===action);
assert.ok(button("replace")&&button("append")&&button("format"));
await button("append").options.onClick();
assert.equal(input.value,"Alpha\nBeta\nGamma\nDelta");
assert.deepEqual(changes[0],["append","2 entries appended."]);
input.value="  Alpha; Beta\n\n Beta ";input.fire("input");
assert.equal(tree.find(x=>x.tag==="span"&&x.options.role==="status").textContent,"3 entries");
button("format").options.onClick();
assert.equal(input.value,"Alpha\nBeta\nBeta");
assert.equal(changes.at(-1)[0],"format");
input.isConnected=false;await button("replace").options.onClick();
assert.equal(input.value,"Alpha\nBeta\nBeta","Pending clipboard reads may not edit detached views");

const failureInput=textarea("");
const failureNode=createListInputAssist({
  toolId:"picker",node,textarea:failureInput,
  clipboard:{readText:async()=>{throw new Error("denied")}},
  announce:(x)=>notes.push(x),
  onUpdate:()=>{throw new Error("Cannot update after permission failure")}
});
await failureNode.find(x=>x.options.dataset?.inputAction==="replace").options.onClick();
assert.equal(failureInput.focused,true);
assert.match(notes.at(-1),/Clipboard could not be read/);

const app=fs.readFileSync("src/app.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert.ok(app.includes('runControl.append(createListInputAssist({'));
assert.ok(app.includes('new Event("input", { bubbles: true })'));
assert.ok(app.includes('function defaultList(toolId)'));
assert.ok(sw.includes('const CACHE_GENERATION = CACHE + "-g8";'));
assert.ok(sw.includes('"./src/list-input-assist.js"'));
assert.ok(fs.statSync("src/app.js").size <= 423000);
console.log("UI-03 list workflow passed",JSON.stringify({
  builtinTools:TOOLS.length,actions:3,appBytes:fs.statSync("src/app.js").size
}));
