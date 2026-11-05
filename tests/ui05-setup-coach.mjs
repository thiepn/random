import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import { executeTool } from "../src/tool-engine.js";
import { occurrenceKeys } from "../src/selection-model.js";
import {
  setupIssue, setupHelp, buildSetupCoach, stopInvalidRun, toolFamilyLabel
} from "../src/tool-setup-health.js";

assert.equal(TOOLS.length, 25);
for (const tool of TOOLS) {
  assert.equal(typeof setupHelp(tool.id, true), "string");
}
assert.match(setupHelp("dice"), /quick dice/i);
assert.match(setupHelp("time"), /same day/i);
assert.equal(toolFamilyLabel("wheel"), "Weighted spinner");

const initial = {
  listText: "Anna\nBen\nCara", selectionEntries: [], sampleCount: 3,
  allowRepeats: false, teamCount: 2, groupCount: 2,
  targetText: "Cooking\nCleaning", ladderOutcomes: "A\nB\nC",
  numberMin: 1, numberMax: 100, numberCount: 1,
  numberMode: "integer", numberPrecision: 2, numberUnique: false,
  lotteryCount: 6, lotteryMax: 49, dateStart: "2026-11-01",
  dateEnd: "2026-12-01", timeStart: "09:00", timeEnd: "17:00",
  xMin: 0, xMax: 10, yMin: 0, yMax: 10,
  customInputText: "A\nB"
};
const state = (extra) => ({...initial,...extra});
function check(tool, change, code, patch=null) {
  const result = setupIssue(tool, state(change));
  assert.equal(result?.code, code, tool + " failed");
  if (patch) assert.deepEqual(result.patch,patch);
  return result;
}
assert.equal(setupIssue("coin", state()),null);
assert.equal(setupIssue("wheel",state()),null);
assert.equal(setupIssue("sampler",state()),null);
assert.equal(setupIssue("number",state()),null);
assert.equal(setupIssue("date",state()),null);
assert.equal(setupIssue("time",state()),null);

check("wheel",{listText:"Solo"},"missing-entries");
check("picker",{listText:""},"missing-entries");
check("shuffle",{listText:"One"},"missing-entries");
check("teams",{listText:"A\nB",teamCount:3},"teams-count",{teamCount:2});
check("groups",{listText:"A\nB",groupCount:3},"groups-count",{groupCount:2});
check("sampler",{listText:"A\nB",sampleCount:3},"sampler-count",{sampleCount:2});
assert.equal(setupIssue("sampler",state({listText:"A\nB",sampleCount:3,allowRepeats:true})),null);
check("assignment",{targetText:" \n ; "},"missing-targets");
check("ladder",{ladderOutcomes:"Prize A\nPrize B"},"ladder-outcomes");
check("secret-santa",{listText:"Anna\nBen\nAnna"},"duplicate-names");
check("number",{numberMin:10,numberMax:3},"number-range",
  {numberMin:3,numberMax:10});
check("number",{numberMin:1,numberMax:2,numberCount:3,numberUnique:true},
  "number-unique",{numberCount:2});
check("number",{numberMode:"decimal",numberMin:0,numberMax:.02,
  numberPrecision:2,numberCount:4,numberUnique:true},"number-unique",
  {numberCount:3});
check("lottery",{lotteryCount:8,lotteryMax:5},"lottery-count",{lotteryCount:5});
check("date",{dateStart:"2026-11-15",dateEnd:"2026-11-03"},
  "date-range",{dateStart:"2026-11-03",dateEnd:"2026-11-15"});
check("date",{dateStart:"not-a-date"},"date-invalid");
check("time",{timeStart:"19:00",timeEnd:"09:00"},"time-range",
  {timeStart:"09:00",timeEnd:"19:00"});
check("time",{timeStart:"garbage"},"time-invalid");
check("coordinate",{xMin:12,xMax:2,yMin:11,yMax:4},"coordinate-range",
  {xMin:2,xMax:12,yMin:4,yMax:11});
assert.equal(setupIssue("custom-1",state({customInputText:""}),{customNeedsInput:true}).code,"custom-empty");

const keys = occurrenceKeys(["A","B","C"]);
check("wheel",{
  listText:"A\nB\nC",
  selectionEntries:keys.map((key,i)=>({key,weight:1,excluded:i>0}))
},"excluded-entries");
check("sampler",{
  listText:"A\nB\nC",sampleCount:2,
  selectionEntries:keys.map((key,i)=>({key,weight:1,excluded:i!==0}))
},"sampler-count",{sampleCount:1});
check("wheel",{
  listText:"A\nB\nC",
  selectionEntries:keys.map((key,i)=>({key,weight:i===0?-1:1,excluded:false}))
},"invalid-weights");

assert.throws(
  ()=>executeTool("sampler",{items:["A","B"],sampleCount:3,allowRepeats:false}, {int:()=>0}),
  /Winner count/
);
assert.throws(
  ()=>executeTool("ladder",{items:["A","B","C"],outcomes:["X","Y"]}, {int:()=>0}),
  /exactly one outcome/
);
assert.throws(
  ()=>executeTool("lottery",{lotteryCount:8,lotteryMax:5},{int:()=>0}),
  /more unique numbers/
);

function node(tag,props={},children=[]) {
  return {
    tag,props,children:Array.isArray(children)?children:[children],
    textContent:props.text||"",hidden:false,events:{},
    addEventListener(k,f){this.events[k]=f},
    querySelector(){return null},
    focus(){this.focused=true}
  };
}
const toolState=state({listText:"A\nB",sampleCount:3});
let applied=null;
const focused={focus(){this.focused=true}};
const root={querySelector(){return focused;}};
const coach=buildSetupCoach({
  toolId:"sampler",toolState,node,root,
  onApply:(patch)=>{applied=patch;Object.assign(toolState,patch);}
});
assert.equal(coach.refresh().code,"sampler-count");
const notice=coach.panel.children.at(-1);
assert.equal(notice.hidden,false);
const button=notice.children[1];
assert.match(button.textContent,/Set winners to 2/);
button.props.onClick();
assert.deepEqual(applied,{sampleCount:2});
assert.equal(coach.refresh(),null);
assert.equal(notice.hidden,true);

const bad=state({listText:"A"});
const missing=buildSetupCoach({toolId:"teams",toolState:bad,node,root,onApply:()=>{}});
missing.panel.children.at(-1).children[1].props.onClick();
assert.equal(focused.focused,true,"Edit entries must focus the field");

let rendered=false,spoken=false,scrolled=false,buttonFocused=false;
const details={
  open:false,scrollIntoView(){scrolled=true},
  querySelector(){return {focus(){buttonFocused=true}}}
};
const oldDocument=globalThis.document;
globalThis.document={querySelector:()=>details};
try {
  assert.equal(stopInvalidRun("teams",bad,{
    render:()=>{rendered=true;},announce:()=>{spoken=true;}
  }),true);
  assert.equal(details.open,true);
  assert.equal(rendered&&spoken&&scrolled&&buttonFocused,true);
  assert.equal(stopInvalidRun("teams",state(),{
    render:()=>{throw Error("Unexpected render")}
  }),false);
} finally {
  globalThis.document=oldDocument;
}

const app=fs.readFileSync("src/app.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert.ok(app.includes("buildSetupCoach({"));
assert.ok(app.includes('controls.addEventListener("input",coach.refresh)'));
assert.ok(app.includes("stopInvalidRun(id, ts,"));
assert.ok(sw.includes('"./src/tool-setup-health.js"'));
assert.ok(fs.statSync("src/app.js").size<=423000);
const css=fs.readdirSync(".").filter(n=>n.endsWith(".css"));
assert.equal(css.length,19);
assert.ok(css.reduce((sum,n)=>sum+fs.statSync(n).size,0)<=174500);
console.log("UI-05 actionable setup coach passed",JSON.stringify({
  builtinTools:TOOLS.length,appBytes:fs.statSync("src/app.js").size,
  validated:20
}));
