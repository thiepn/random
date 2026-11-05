import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import { defaultListEntries } from "../src/list-input-assist.js";
import { checkToolSetup, attachSetupGuidance, setupFamilyLabel } from "../src/setup-guidance.js";

const check = (id, state) => checkToolSetup({ id }, state);
const valid = {
  listText: "Anna\nBen", selectionEntries: [], sampleCount: 1,
  allowRepeats: false, teamCount: 2, groupCount: 2,
  targetText: "Volunteer", ladderOutcomes: "Present\nVoucher",
  numberMin: 1, numberMax: 5, numberMode: "integer",
  numberCount: 2, numberPrecision: 2, numberUnique: false,
  lotteryMax: 10, lotteryCount: 5, chance: 50,
  xMin: 0, xMax: 10, yMin: 0, yMax: 10,
  dateStart: "2026-01-01", dateEnd: "2026-01-02",
  timeStart: "08:00", timeEnd: "12:00"
};

const copy = (next = {}) => ({ ...valid, ...next });
for (const id of ["wheel","picker","sampler","shuffle","teams","groups","pairs",
  "assignment","elimination","ladder","secret-santa","tournament",
  "number","lottery","chance","coordinate","date","time"]) {
  assert.equal(check(id,copy()),null,"Valid first-run setup flagged: "+id);
}
assert.equal(TOOLS.length,25);
assert.equal(setupFamilyLabel("wheel"),"Weighted spinner");
assert.equal(setupFamilyLabel("unknown"),"Randomizer");
assert.equal(checkToolSetup({id:"custom-demo",custom:true},copy()),null);
assert.equal(check("coin",copy()),null);

const short = check("wheel", copy({listText:"Anna"}));
assert.match(short.message,/at least 2 entries/i);
assert.equal(short.field,"textarea.field");
assert.match(check("sampler",copy({listText:"",sampleCount:1})).message,/at least 1 entry/i);
assert.match(check("shuffle",copy({listText:"A"})).message,/at least 2 entries/i);
assert.match(check("wheel",copy({
  selectionEntries:[{key:"Anna\u001f1",label:"Anna",weight:0,excluded:false},
    {key:"Ben\u001f1",label:"Ben",weight:1,excluded:false}]
})).message,/eligible entries/);
assert.match(check("picker",copy({
  selectionEntries:[{key:"Anna\u001f1",label:"Anna",weight:-1,excluded:false}]
})).message,/Weight.*zero or greater/);
const sampler = check("sampler",copy({sampleCount:3}));
assert.match(sampler.message,/only 2 entries are eligible/);
assert.deepEqual(sampler.fix,{label:"Set winners to 2",key:"sampleCount",value:2});
assert.equal(check("sampler",copy({sampleCount:3,allowRepeats:true})),null);
const teams = check("teams",copy({teamCount:4}));
assert.deepEqual(teams.fix,{label:"Use 2 teams",key:"teamCount",value:2});
assert.match(check("groups",copy({groupCount:3})).message,/between 2 and 2 groups/);
assert.match(check("assignment",copy({targetText:"  ; \n"})).message,/destination or task/);
assert.equal(check("assignment",copy({targetText:"Task"})),null);
const ladder = check("ladder",copy({ladderOutcomes:"One"}));
assert.match(ladder.message,/2 players but 1 outcomes/);
assert.equal(ladder.field,'textarea[aria-label="Outcomes / prizes"]');
assert.match(check("secret-santa",copy({listText:"Anna;Anna"})).message,/unique participant names/);
assert.equal(check("secret-santa",copy({listText:"Anna;Ben"})),null);

assert.match(check("number",copy({numberMin:10,numberMax:2})).message,/Minimum is greater/);
assert.match(check("number",copy({numberCount:0})).message,/between 1 and 100/);
assert.match(check("number",copy({numberMode:"decimal",numberPrecision:7})).message,/1 to 6 decimal/);
assert.match(check("number",copy({numberMode:"decimal",numberPrecision:2,
  numberMin:0.123})).message,/decimal precision/);
const unique=check("number",copy({numberMin:1,numberMax:2,numberCount:3,numberUnique:true}));
assert.deepEqual(unique.fix,{label:"Draw 2 unique values",key:"numberCount",value:2});
assert.equal(check("number",copy({numberMin:1,numberMax:2,numberCount:3,numberUnique:false})),null);
const lottery=check("lottery",copy({lotteryMax:3,lotteryCount:5}));
assert.deepEqual(lottery.fix,{label:"Draw 3 numbers",key:"lotteryCount",value:3});
assert.match(check("chance",copy({chance:110})).message,/0% and 100%/);
assert.match(check("coordinate",copy({xMin:12,xMax:4})).message,/X requires/);
assert.match(check("date",copy({dateStart:"2026-10-09",dateEnd:"2026-10-01"})).message,/chronological order/);
assert.match(check("time",copy({timeStart:"19:00",timeEnd:"08:00"})).message,/within one day/);
assert.equal(check("sampler",copy()),null,"diagnostics must not mutate the original config");

function node(tag,props={},children=[]) {
  return {
    tag,props,children:Array.isArray(children)?children:[children],
    hidden:false,style:{},events:{},textContent:props.text||"",
    replaceChildren(...items){this.children=items;},
    addEventListener(name,cb){this.events[name]=cb;},
    focus(){this.focused=true;},
    scrollIntoView(){this.scrolled=true;}
  };
}
const summary=node("summary");
const numberField=node("input");
let focusedField=null;
const container={
  children:[summary],events:{},
  querySelector(selector){
    if(selector==="summary")return summary;
    if(selector==="#team-count"){focusedField=numberField;return numberField;}
    return null;
  },
  insertBefore(child,after){
    const i=after?this.children.indexOf(after):-1;
    this.children.splice(i<0?this.children.length:i,0,child);
  },
  addEventListener(name,cb){this.events[name]=cb;}
};
const state=copy({teamCount:5});
const fixes=[];
const panel=attachSetupGuidance(container,{id:"teams"},state,node,
  (fix,field)=>fixes.push([fix,field]));
assert.equal(container.children[1],panel);
assert.equal(panel.hidden,false);
assert.equal(panel.props["aria-live"],"polite");
assert.match(panel.children[1].textContent,/Choose between 2 and 2/);
panel.children.find(x=>x.tag==="button"&&x.children[0]==="Edit field").props.onClick();
assert.equal(numberField.focused,true);
panel.children.find(x=>x.tag==="button"&&x.children[0]==="Use 2 teams").props.onClick();
assert.deepEqual(fixes,[[{label:"Use 2 teams",key:"teamCount",value:2},"#team-count"]]);
state.teamCount=2;
container.events.input();
assert.equal(panel.hidden,true);
assert.equal(panel.children.length,0);
state.teamCount=7;
container.events.change();
assert.equal(panel.hidden,false);
assert.deepEqual(Object.keys(state).sort(),Object.keys(copy()).sort(),
  "DOM guidance must not write setup state");

const app=fs.readFileSync("src/app.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert.match(app,/attachSetupGuidance\(controls, tool, ts, node/);
assert.match(app,/configSetter\(tool.id, ts, fix.key, fix.value, true\)/);
assert.ok(sw.includes('"./src/setup-guidance.js"'));
assert.ok(sw.includes('CACHE + "-g6"'));
assert.ok(fs.statSync("src/app.js").size<=423000);
console.log("UI-05 inline setup guidance regression passed",JSON.stringify({
  tools:TOOLS.length,appBytes:fs.statSync("src/app.js").size
}));
