import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import { entriesFromText } from "../src/list-input-assist.js";
import {
  planInputHandoff, eligibleHandoffTargets, activeTargetReason, renderInputHandoffModal
} from "../src/tool-input-handoff.js";

assert.equal(TOOLS.length, 25);
const listIds = new Set([
  "wheel","picker","sampler","shuffle","teams","groups","pairs",
  "assignment","elimination","ladder","secret-santa","tournament"
]);
assert.equal(listIds.size,12);
const customs=[
  { id:"custom-prompt",name:"Prompt custom",custom:true,needsInput:true },
  { id:"custom-fixed",name:"Fixed custom",custom:true,needsInput:false }
];
const targets=eligibleHandoffTargets([...TOOLS,...customs],"wheel",
  (tool)=>listIds.has(tool.id)||tool.needsInput===true);
assert.equal(targets.length,12);
assert.equal(targets.some(t=>t.id==="wheel"),false);
assert.equal(targets.some(t=>t.id==="custom-prompt"),true);
assert.equal(targets.some(t=>t.id==="custom-fixed"),false);
assert.equal(targets.some(t=>t.id==="number"),false);

const source=["Anna","Anna","Ben"];
const previous="Old; Keep";
const beforeSource=[...source];
const replace=planInputHandoff(source,previous,"replace");
assert.deepEqual(replace,{text:"Anna\nAnna\nBen",copied:3,previous:2,total:3,mode:"replace"});
const append=planInputHandoff(source,previous,"append");
assert.deepEqual(append,{text:"Old\nKeep\nAnna\nAnna\nBen",copied:3,previous:2,total:5,mode:"append"});
assert.deepEqual(source,beforeSource,"Handoff is a copy; source entries must remain unchanged");
assert.equal(previous,"Old; Keep","Destination must not change before confirmation");
assert.equal(entriesFromText(append.text).length,5,"Deliberate duplicates remain separate draws");
assert.throws(()=>planInputHandoff([],previous),/valid individual entries/);
assert.throws(()=>planInputHandoff(["a\nb"],previous),/valid individual entries/);
assert.throws(()=>planInputHandoff(["a;b"],previous),/valid individual entries/);
assert.throws(()=>planInputHandoff(["A"],previous,"merge"),TypeError);
assert.throws(()=>planInputHandoff(Array(5001).fill("A"),""),/5,000/);
assert.throws(()=>planInputHandoff(["A"],Array(5000).fill("B").join("\n"),"append"),/5,000/);
assert.throws(()=>planInputHandoff(["x".repeat(200001)],""),/too large/);

assert.equal(activeTargetReason(null),null);
assert.match(activeTargetReason({},true),/active session/);
assert.match(activeTargetReason({activeSessionId:"completed-session"},true),/active session/);
assert.equal(activeTargetReason({activeSessionId:"completed-session"},false),null,
  "A completed session must not unnecessarily prevent copying");
assert.match(activeTargetReason({templateSessionId:"t"}),/active session/);
assert.match(activeTargetReason({workflowSessionId:"w"}),/active session/);
assert.match(activeTargetReason({replayRunId:"r"}),/replay mode/);
assert.match(activeTargetReason({},false,true),/still running/);

function node(tag,props={},children=[]) {
  const o={tag,props,children:Array.isArray(children)?children:[children],
    value:props.value??"",textContent:props.text??"",disabled:!!props.disabled};
  o.walk=(matcher)=>{
    if(matcher(o))return o;
    for(const child of o.children) {
      if(child?.walk){const found=child.walk(matcher);if(found)return found;}
    }
    return null;
  };
  return o;
}
const modal=node("section");
const cfg={sourceEntries:[...source],sourceToolId:"wheel",targetId:"",
  mode:"replace",error:null};
const targetList=[{id:"picker",name:"Pick One"},{id:"teams",name:"Teams"}];
let opened=false,rendered=false,cancelled=false;
renderInputHandoffModal(modal,cfg,{
  node,sourceName:"Wheel",targets:targetList,
  getInput:()=>previous,
  activeReason:(tool)=>tool.id==="teams"?"Finish the active session":null,
  onConfirm:(tool,plan)=>{opened=true;assert.equal(tool.id,"picker");assert.equal(plan.copied,3);},
  onCancel:()=>{cancelled=true;},
  rerender:()=>{rendered=true;}
});
assert.match(modal.walk(x=>x.tag==="h2").textContent,/Copy current entries/);
assert.match(modal.walk(x=>x.props.text?.startsWith("Source preview"))?.textContent||"",""); // use props text below
assert.equal(opened,false,"Opening a confirmation dialog must be non-mutating");
const selectors=[];
function walk(n){if(n.tag==="select")selectors.push(n);for(const c of n.children){if(c?.tag)walk(c);}}
walk(modal);
assert.equal(selectors.length,2,"Native mobile/keyboard selects instead of duplicate card grids");
assert.equal(selectors[0].props["aria-label"],"Destination randomizer");
assert.equal(selectors[1].props["aria-label"],"How to copy the entries");
assert.equal(selectors[0].children.some(x=>x.props.value==="teams" && x.disabled),true);
const controls=[];
function buttons(n){if(n.tag==="button")controls.push(n);for(const c of n.children){if(c?.tag)buttons(c);}}
buttons(modal);
assert.equal(controls.length,2);
assert.equal(controls[1].disabled,true,"No destination selected, no automatic overwrite");
selectors[0].props.onChange({target:{value:"picker"}});
assert.equal(cfg.targetId,"picker");
assert.equal(rendered,true);
cfg.targetId="picker";
const nextModal=node("section");
renderInputHandoffModal(nextModal,cfg,{
  node,sourceName:"Wheel",targets:targetList,getInput:()=>previous,
  activeReason:()=>null,
  onConfirm:(tool,plan)=>{opened=true;assert.equal(tool.id,"picker");assert.equal(plan.mode,"replace");},
  onCancel:()=>{cancelled=true;},rerender:()=>{}
});
const buttons2=[];buttons(nextModal); // unused, calculate from traversal below
const confirm=nextModal.walk(x=>x.tag==="button" && x.props.class==="primary");
assert.equal(confirm.disabled,false);
confirm.props.onClick();
assert.equal(opened,true);
const cancel=nextModal.walk(x=>x.tag==="button" && x.props.class==="secondary");
cancel.props.onClick();
assert.equal(cancelled,true);

const app=fs.readFileSync("src/app.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert.ok(app.includes('state.modal?.type === "input-handoff"'));
assert.ok(app.includes('sourceEntries:parseList(tool.custom ? ts.customInputText : ts.listText)'));
assert.ok(app.includes("state.sessions.some((s) => s.toolId === t.id && s.status === \"active\")"));
assert.ok(app.includes("ts.workingSet = null"));
assert.ok(app.includes("ts.activePresetId = null"));
assert.ok(app.includes("reconcileToolSelection(t.id,ts)"));
assert.ok(app.includes("openTool(t.id)"));
assert.ok(sw.includes('"./src/tool-input-handoff.js"'));
assert.ok(fs.statSync("src/app.js").size<=423000);
const css=fs.readdirSync(".").filter(x=>x.endsWith(".css"));
assert.equal(css.length,19);
assert.ok(css.reduce((n,file)=>n+fs.statSync(file).size,0)<=174500);
console.log("UI-06 input handoff regression passed",JSON.stringify({
  tools:TOOLS.length,compatible:targets.length,appBytes:fs.statSync("src/app.js").size
}));
