// Actual headless Chromium interaction against the full checked-out app.
// Node built-ins + Chrome DevTools Protocol; no new package or test dependency.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";

const root = process.cwd();
const mime = {".js":"text/javascript",".html":"text/html",".css":"text/css",
  ".svg":"image/svg+xml",".webmanifest":"application/manifest+json",
  ".json":"application/json",".png":"image/png",".woff2":"font/woff2"};
const server=createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  const path=resolve(root,"."+(url.pathname==="/" ? "/index.html":decodeURIComponent(url.pathname)));
  if(!path.startsWith(root+"/")||!existsSync(path)){res.writeHead(404);res.end("Not found");return;}
  try{const body=readFileSync(path);
    res.writeHead(200,{"Content-Type":mime[extname(path)]||"application/octet-stream","Cache-Control":"no-store"});
    res.end(body);
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+server.address().port;
const profile=mkdtempSync(join(tmpdir(),"random-ui13-"));
let chrome,ws,seq=0;const pending=new Map();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

try{
  const binary=["google-chrome","google-chrome-stable","chromium","chromium-browser"].find(cmd=>{
    try{execFileSync("which",[cmd],{stdio:"ignore"});return true;}catch{return false;}
  });
  assert.ok(binary,"Chrome/Chromium not available: no browser evidence");
  let chromeErrors="";
  chrome=spawn(binary,["--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--disable-gpu","--no-first-run","--disable-background-networking",
    "--remote-debugging-port=0","--user-data-dir="+profile,"--window-size=900,800","about:blank"],
    {stdio:["ignore","ignore","pipe"]});
  chrome.stderr.on("data",data=>{chromeErrors+=String(data).slice(0,600);});
  let port;
  for(let i=0;i<250;i++){
    if(existsSync(join(profile,"DevToolsActivePort"))){
      port=Number(readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0]);break;
    }
    await delay(100);
  }
  assert.ok(port,"Actual Chrome DevTools connection timed out; process="+chrome.exitCode+
    "; stderr="+chromeErrors.slice(-1500));
  const tabs=await(await fetch("http://127.0.0.1:"+port+"/json/list")).json();
  const tab=tabs.find(p=>p.type==="page");
  assert.ok(tab?.webSocketDebuggerUrl,"No Chromium page");
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener("open",resolve,{once:true});
    ws.addEventListener("error",reject,{once:true});
  });
  ws.addEventListener("message",event=>{
    const packet=JSON.parse(event.data);
    if(!pending.has(packet.id))return;
    const {resolve,reject}=pending.get(packet.id);pending.delete(packet.id);
    packet.error?reject(new Error(JSON.stringify(packet.error))):resolve(packet.result);
  });
  const cdp=(method,params={})=>{
    const id=++seq;
    const response=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
    ws.send(JSON.stringify({id,method,params}));return response;
  };
  const js=async expression=>{
    const response=await cdp("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if(response.exceptionDetails)throw Error("Browser eval: "+response.exceptionDetails.text);
    return response.result.value;
  };
  async function waitUntil(expression,label){
    for(let i=0;i<150;i++){
      const v=await js(expression);if(v)return v;
      await delay(100);
    }
    throw Error("Timeout: "+label+"; page="+await js("document.body.innerText.slice(0,400)"));
  }
  async function click(selector){
    // CDP dispatch does not scroll off-screen elements automatically.
    await js("document.querySelector("+JSON.stringify(selector)+")?.scrollIntoView({block:'center',inline:'center'})");
    await delay(120);
    const point=await js("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");"+
      "if(!e)return null;const b=e.getBoundingClientRect();"+
      "return{x:b.x+b.width/2,y:b.y+Math.min(b.height/2,14)};})()");
    assert.ok(point,"Missing actual app control "+selector);
    await cdp("Input.dispatchMouseEvent",{type:"mouseMoved",x:point.x,y:point.y});
    await cdp("Input.dispatchMouseEvent",{type:"mousePressed",x:point.x,y:point.y,button:"left",clickCount:1});
    await cdp("Input.dispatchMouseEvent",{type:"mouseReleased",x:point.x,y:point.y,button:"left",clickCount:1});
    await delay(250);
  }

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Page.navigate",{url:origin+"/?tool=picker"});
  const editor=".tool-id-picker .tool-controls textarea";
  await waitUntil("Boolean(document.querySelector("+JSON.stringify(editor)+"))","Pick One tool setup");
  assert.match(await js("document.querySelector('h1')?.textContent || ''"),/Pick One/);

  await click(editor);
  await cdp("Input.insertText",{text:"\nUI13 typed item"});
  assert.match(await js("document.querySelector("+JSON.stringify(editor)+")?.value"),/UI13 typed item/);

  const sourceSelect='select[aria-label="Input source"]';
  await js("window.__ui13NativeSelect=document.querySelector("+JSON.stringify(sourceSelect)+")");
  await click(sourceSelect);
  const selectPreserved=await js("window.__ui13NativeSelect?.isConnected === true");
  assert.equal(selectPreserved,true,
    "Blur refresh destroyed real native Input source select during first pointer activation");
  assert.match(await js("document.querySelector("+JSON.stringify(editor)+")?.value"),/UI13 typed item/);

  assert.match(await js("document.querySelector("+JSON.stringify(editor)+")?.value"),/UI13 typed item/,
    "Opening the native selector must not discard the edited list");
  assert.ok(readFileSync(join(root,"src/app.js"),"utf8").includes(
    'document.activeElement?.matches("select")'),
    "The native select must not be unmounted by a list-blur refresh");
  console.log("UI-13 actual Chromium full-app native select PASS",JSON.stringify({
    browser:binary,tool:"picker",nativeSelectPreserved:selectPreserved,
    temporaryInputPreserved:true
  }));

}finally{
  ws?.close();chrome?.kill("SIGKILL");
  await new Promise(resolve=>server.close(resolve));
  rmSync(profile,{recursive:true,force:true});
}
