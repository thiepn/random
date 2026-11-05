import assert from "node:assert/strict";
import fs from "node:fs";
import { TOOLS } from "../src/registry.js";
import {
  findToolsForTask, suggestedTools, renderToolFinder
} from "../src/tool-discovery.js";

assert.equal(TOOLS.length, 25);
for (const tool of TOOLS) {
  assert.equal(findToolsForTask(tool.name, TOOLS)[0]?.id, tool.id,
    "Exact tool name not discoverable: " + tool.id);
}
for (const [query, id] of [
  ["choose dinner", "picker"],
  ["split into teams", "teams"],
  ["make breakout groups", "groups"],
  ["draw raffle winners", "sampler"],
  ["assign chores", "assignment"],
  ["secret gift exchange", "secret-santa"],
  ["tournament bracket", "tournament"],
  ["choose a hex color", "color"],
  ["random coordinate", "coordinate"],
  ["choose left or right", "direction"]
]) {
  assert.equal(findToolsForTask(query, TOOLS)[0]?.id, id,
    "Task phrase failed: " + query);
}
const custom = {
  id: "custom-1", name: "Book Club Selector",
  blurb: "Choose our next novel", aliases: ["reading", "books"],
  primitive: "pick", accent: "violet", custom: true
};
assert.equal(findToolsForTask("book club selector", TOOLS, [custom])[0]?.id,
  custom.id);
assert.equal(findToolsForTask("reading", TOOLS, [custom])[0]?.id, custom.id);
assert.equal(findToolsForTask("pick", TOOLS, [custom]).some(t => t.id === custom.id), true);
assert.deepEqual(findToolsForTask("unknown-token-zz", TOOLS, [custom]), []);
assert.equal(findToolsForTask("", TOOLS, [custom]).length, 26);
assert.deepEqual(suggestedTools(TOOLS,[custom],["custom-1","teams","teams"],["picker"],5)
  .map(t => t.id).slice(0,3), ["custom-1","teams","picker"]);

class FakeNode {
  constructor(tag, attrs={}, children=[]) {
    this.tag=tag;this.attrs=attrs;this.value=attrs.value||"";
    this.textContent=attrs.text||"";this.children=[];this.events={};
    for(const [k,v] of Object.entries(attrs)) {
      if(k.startsWith("on")&&typeof v==="function")
        this.addEventListener(k.slice(2).toLowerCase(),v);
    }
    this.append(...(Array.isArray(children)?children:[children]));
  }
  append(...children){
    const items=children.filter(x=>x!=null);
    this.children.push(...items);
    this.textContent+=items.map(x=>typeof x==="string"?x:x.textContent||"").join("");
  }
  replaceChildren(...children){this.children=[];this.textContent="";this.append(...children);}
  addEventListener(name,callback){this.events[name]=callback;}
  querySelectorAll(selector){
    const found=[];
    const visit=(node)=>{
      for(const child of node.children){
        if(!(child instanceof FakeNode))continue;
        if(selector==="button" && child.tag==="button")found.push(child);
        visit(child);
      }
    };
    visit(this);return found;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){FakeNode.active=this;}
  click(){this.fire("click");}
  fire(type,init={}){
    const event={target:this,...init,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true;}};
    this.events[type]?.(event);return event;
  }
}
function node(tag,props,children){return new FakeNode(tag,props,children);}
const opened=[],modal=node("section",{});
renderToolFinder(modal,{
  node,builtins:TOOLS,customs:[custom],recentIds:["custom-1"],
  favorites:["picker"],openTool:(id)=>opened.push(id)
});
const input=modal.children.find(x=>x.tag==="input");
assert.ok(input,"Tool finder must have a search field");
const resultRegion=modal.children.find(x=>x.attrs["aria-label"]==="Matching randomizers");
const status=modal.children.find(x=>x.attrs.role==="status");
assert.ok(resultRegion&&status);
assert.equal(resultRegion.querySelectorAll("button")[0].attrs["aria-label"],
  "Open Book Club Selector");

input.value="split into teams";input.fire("input");
assert.equal(resultRegion.querySelectorAll("button")[0].attrs["aria-label"],"Open Teams");
const down=input.fire("keydown",{key:"ArrowDown",isComposing:false});
assert.equal(down.defaultPrevented,true);
assert.equal(FakeNode.active,resultRegion.querySelectorAll("button")[0]);
const option=resultRegion.querySelectorAll("button")[0];
const up=resultRegion.fire("keydown",{key:"ArrowUp",target:option});
assert.equal(up.defaultPrevented,true);
assert.equal(FakeNode.active,input);
input.fire("keydown",{key:"Enter",isComposing:false});
assert.deepEqual(opened,["teams"]);
input.value="zz-not-a-task";input.fire("input");
assert.equal(resultRegion.querySelectorAll("button").length,0);
assert.match(status.textContent,/0 matching tools/);
assert.match(resultRegion.children[0].textContent,/No matches/);

const quick=modal.children.find(x=>x.tag==="div" && x.children.some(
  item=>item instanceof FakeNode && item.textContent==="Raffle winners"));
assert.ok(quick);
quick.children.find(x=>x.textContent==="Raffle winners").click();
assert.equal(input.value,"pick raffle winners");
assert.equal(resultRegion.querySelectorAll("button")[0].attrs["aria-label"],
  "Open Pick Several");
resultRegion.querySelectorAll("button")[0].click();
assert.deepEqual(opened,["teams","sampler"]);

const app=fs.readFileSync("src/app.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert.match(app,/findToolsForTask\(/);
assert.equal((app.match(/findToolsForTask\(/g)||[]).length,2,
  "Both Home and Arcade should use shared task search");
assert.ok(app.includes('renderToolFinder(modal, {'));
assert.ok(app.includes('onClick: openToolFinder'));
assert.ok(app.includes('event.ctrlKey || event.metaKey'));
assert.ok(app.includes('state.modal.type === "tool-finder"'));
assert.ok(sw.includes('"./src/tool-discovery.js"'));
assert.ok(sw.includes('CACHE + "-g6"'));
assert.ok(fs.statSync("src/app.js").size <= 423000);
const styles=fs.readdirSync(".").filter(x=>x.endsWith(".css"));
assert.equal(styles.length,19);
const cssBytes=styles.reduce((n,path)=>n+fs.statSync(path).size,0);
assert.ok(cssBytes<=174500);
console.log("UI-04 task finder regression passed",JSON.stringify({
  tools:TOOLS.length,customSearched:1,cssBytes,appBytes:fs.statSync("src/app.js").size
}));
