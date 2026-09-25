import assert from "node:assert/strict";
import fs from "node:fs";

const read=(file)=>fs.readFileSync(file,"utf8");
const design=read("design-system.css");
const styles=read("styles.css");
const shell=read("app-shell.css");
const tool=read("tool-experience.css");
const home=read("home-arcade.css");
const a11y=read("phase14.css");
const index=read("index.html");
const app=read("src/app.js");
const visual=read("src/visual-preferences.js");
const runtime=app+"\n"+visual;
const sw=read("sw.js");
const css=[design,styles,shell,tool,home,a11y].join("\n");

assert.equal(fs.existsSync("visual-resilience.css"),false);
assert.equal(index.includes('./visual-resilience.css'),false);
assert.equal(sw.includes('"./visual-resilience.css"'),false);
assert.ok(sw.includes('"./src/visual-preferences.js"'));
assert.match(index,/viewport-fit=cover/);
assert.doesNotMatch(index,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);

for(const marker of [
  ':root[data-theme="light"]',
  ':root[data-theme="dark"]',
  ':root[data-accent="violet"]',
  ':root[data-accent="cyan"]',
  ':root[data-accent="blue"]',
  ':root[data-accent="pink"]',
  ':root[data-accent="red"]',
  ':root[data-accent="gold"]',
  ':root[data-accent="green"]',
  ':root[data-accent="orange"]',
  'html[data-motion="reduced"]',
  'env(safe-area-inset-left)',
  '@media(max-width:359px)',
  '(orientation:landscape)',
  '@media(min-width:1600px)',
  '@media (forced-colors:active)',
  'overflow-wrap:anywhere'
]) assert.ok(css.includes(marker),"Missing V9 resilience marker: "+marker);

for(const marker of [
  'root.dataset.theme = theme',
  'root.dataset.accent = accessibility.accent',
  'root.dataset.motion =',
  '"(prefers-color-scheme: dark)"',
  '"(prefers-reduced-motion: reduce)"',
  'meta[name="theme-color"]',
  'class: "segmented settings-theme-modes"',
  'class: "settings-accent-picker"',
  '"aria-label": "Accent color"'
]) assert.ok(runtime.includes(marker),"Missing V9 runtime contract: "+marker);

for(const [token,value] of [
  ["--color-canvas","#f3efe6"],
  ["--color-surface-1","#fffdf7"],
  ["--color-text-primary","#20211e"],
  ["--color-text-secondary","#454741"],
  ["--color-text-tertiary","#5b5d56"]
]) assert.ok(design.includes(token+":"+value),"Missing light-theme token: "+token);

function rgb(hex){
  let h=hex.replace("#","");
  if(h.length===3) h=h.split("").map(c=>c+c).join("");
  assert.equal(h.length,6,"Expected hex color: "+hex);
  return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);
}
function luminance(hex){
  const c=rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a,b){
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

for(const text of ["#20211e","#454741","#5b5d56"]){
  assert.ok(contrast(text,"#f3efe6")>=4.5,text+" fails light canvas contrast");
  assert.ok(contrast(text,"#fffdf7")>=4.5,text+" fails light surface contrast");
}

const rootCss=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const totalCss=rootCss.reduce((sum,name)=>sum+fs.statSync(name).size,0);
assert.ok(totalCss<=175000,"V9 exceeded global CSS budget: "+totalCss);

console.log("Themes, responsiveness and visual resilience V9 certification passed",JSON.stringify({
  cssBytes:totalCss,
  ownership:"distributed"
}));
