import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync("visual-resilience.css","utf8");
const index=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("src/app.js","utf8");
const visual=fs.readFileSync("src/visual-preferences.js","utf8");
const runtime=app+"\n"+visual;
const sw=fs.readFileSync("sw.js","utf8");

assert.ok(index.includes('./visual-resilience.css'));
assert.ok(index.indexOf('./tool-experience.css')<index.indexOf('./visual-resilience.css'));
assert.ok(sw.includes('"./visual-resilience.css"'));
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
  '@media(forced-colors:active)',
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
  ["--color-canvas","#f6f7fb"],
  ["--color-surface-1","#fff"],
  ["--color-text-primary","#10131a"],
  ["--color-text-secondary","#3b4558"],
  ["--color-text-tertiary","#566176"]
]) assert.ok(css.includes(token+":"+value),"Missing light-theme token: "+token);

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

for(const text of ["#10131a","#3b4558","#566176"]){
  assert.ok(contrast(text,"#f6f7fb")>=4.5,text+" fails light canvas contrast");
  assert.ok(contrast(text,"#ffffff")>=4.5,text+" fails light surface contrast");
}

const rootCss=fs.readdirSync(".").filter(name=>name.endsWith(".css"));
const totalCss=rootCss.reduce((sum,name)=>sum+fs.statSync(name).size,0);
assert.ok(totalCss<=175000,"V9 exceeded global CSS budget: "+totalCss);

console.log("Themes, responsiveness and visual resilience V9 certification passed",JSON.stringify({
  cssBytes:totalCss,
  v9Bytes:fs.statSync("visual-resilience.css").size
}));
