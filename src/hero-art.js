const SVG_NS=["http:","","www.w3.org","2000","svg"].join("/");
let artSequence=0;

function element(tag,attrs={},children=[]){
  const node=document.createElementNS(SVG_NS,tag);
  for(const [key,value] of Object.entries(attrs)){
    if(value==null) continue;
    node.setAttribute(key,String(value));
  }
  for(const child of children) if(child) node.append(child);
  return node;
}
const g=(attrs={},children=[])=>element("g",attrs,children);
const path=(d,attrs={})=>element("path",{d,...attrs});
const circle=(cx,cy,r,attrs={})=>element("circle",{cx,cy,r,...attrs});
const rect=(x,y,width,height,rx=0,attrs={})=>element("rect",{x,y,width,height,rx,...attrs});
const line=(x1,y1,x2,y2,attrs={})=>element("line",{x1,y1,x2,y2,...attrs});
const text=(x,y,value,attrs={})=>{
  const node=element("text",{x,y,...attrs});
  node.textContent=String(value);
  return node;
};

function root(kind,{className="",variant="stage",viewBox="0 0 200 160",label=""}={}){
  const svg=element("svg",{
    viewBox,
    class:["machine-art","machine-art-"+kind,"art-"+variant,className].filter(Boolean).join(" "),
    role:label?"img":null,
    "aria-label":label||null,
    "aria-hidden":label?null:"true",
    focusable:"false"
  });
  return svg;
}

function defs(svg){
  const node=element("defs");
  svg.append(node);
  return node;
}

function gradient(defsNode,type,stops,attrs={}){
  const id="ra-art-"+(++artSequence);
  const node=element(type,{id,...attrs},stops.map(([offset,color,opacity])=>
    element("stop",{offset,"stop-color":color,"stop-opacity":opacity??1})
  ));
  defsNode.append(node);
  return "url(#"+id+")";
}

function shadow(svg,cx=100,cy=137,rx=55,ry=9){
  svg.append(element("ellipse",{cx,cy,rx,ry,fill:"var(--material-shadow)",opacity:.28}));
}

function coinArt({face="?",variant="stage"}={}){
  const svg=root("coin",{variant,label:"Coin "+face});
  const d=defs(svg);
  const metal=gradient(d,"radialGradient",[
    ["0%","#fff4c8",1],["36%","#f2cb6a",1],["72%","#c68b28",1],["100%","#734914",1]
  ],{cx:"34%",cy:"26%",r:"76%"});
  const inner=gradient(d,"linearGradient",[
    ["0%","#f8d87e",1],["100%","#b8751f",1]
  ],{x1:"0",y1:"0",x2:"1",y2:"1"});
  shadow(svg,100,139,54,8);
  svg.append(
    circle(100,76,56,{fill:metal,stroke:"#6a4212","stroke-width":4}),
    circle(100,76,47,{fill:inner,stroke:"#f8df95","stroke-width":2}),
    circle(100,76,38,{fill:"none",stroke:"#865719","stroke-width":1.5,opacity:.72}),
    path("M72 51c14-14 37-17 56-7",{fill:"none",stroke:"#fff7d5","stroke-width":5,"stroke-linecap":"round",opacity:.55}),
    text(100,89,face,{
      "text-anchor":"middle",fill:"#52340f","font-size":44,"font-weight":850,
      "font-family":"var(--font-display)"
    })
  );
  for(let i=0;i<18;i++){
    const a=(i/18)*Math.PI*2;
    const x1=100+Math.cos(a)*50,y1=76+Math.sin(a)*50;
    const x2=100+Math.cos(a)*54,y2=76+Math.sin(a)*54;
    svg.append(line(x1.toFixed(2),y1.toFixed(2),x2.toFixed(2),y2.toFixed(2),{
      stroke:"#f3d581","stroke-width":1.2,opacity:.7
    }));
  }
  return svg;
}

const PIPS={
  1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]
};
function dieArt({value="•",sides=6,variant="stage"}={}){
  const svg=root("die",{variant,label:"Die "+value,viewBox:"0 0 160 160"});
  const d=defs(svg);
  const enamel=gradient(d,"linearGradient",[
    ["0%","#ffffff",1],["58%","#ece8df",1],["100%","#c9c2b4",1]
  ],{x1:"0",y1:"0",x2:"1",y2:"1"});
  svg.append(
    element("ellipse",{cx:80,cy:137,rx:48,ry:8,fill:"var(--material-shadow)",opacity:.3}),
    rect(25,19,110,110,24,{fill:enamel,stroke:"#a9a294","stroke-width":3}),
    path("M43 36h68c7 0 12 4 15 10",{fill:"none",stroke:"#fff","stroke-width":5,"stroke-linecap":"round",opacity:.82}),
    path("M31 105c5 12 13 18 26 18h51",{fill:"none",stroke:"#90887a","stroke-width":4,"stroke-linecap":"round",opacity:.42})
  );
  const numeric=Number(value);
  if(Number(sides)===6&&Number.isInteger(numeric)&&PIPS[numeric]){
    const coords={1:[53,50],3:[107,50],4:[53,74],5:[80,74],6:[107,74],7:[53,98],9:[107,98]};
    for(const pos of PIPS[numeric]){
      const [cx,cy]=coords[pos];
      svg.append(circle(cx,cy,8,{class:"die-pip pip-"+pos,fill:"#282722"}));
    }
  }else{
    svg.append(text(80,88,value,{
      "text-anchor":"middle",fill:"#282722","font-size":36,"font-weight":850,
      "font-family":"var(--font-display)"
    }));
  }
  return svg;
}

function polar(cx,cy,r,angle){
  const a=(angle-90)*Math.PI/180;
  return [cx+r*Math.cos(a),cy+r*Math.sin(a)];
}
function segmentPath(cx,cy,r,start,end){
  const [x1,y1]=polar(cx,cy,r,end),[x2,y2]=polar(cx,cy,r,start);
  const large=end-start<=180?0:1;
  return "M "+cx+" "+cy+" L "+x1.toFixed(2)+" "+y1.toFixed(2)+" A "+r+" "+r+" 0 "+large+" 0 "+x2.toFixed(2)+" "+y2.toFixed(2)+" Z";
}
const WHEEL_COLORS=["#d8aa45","#cf5f5d","#6a8fd8","#6ab894","#8b79d6","#d47fae","#d78349","#5caeb4"];

function wheelArt({variant="stage",hardwareOnly=false}={}){
  const svg=root("wheel",{variant,label:"Mechanical wheel",viewBox:"0 0 200 190"});
  shadow(svg,100,166,65,8);
  if(!hardwareOnly){
    for(let i=0;i<8;i++) svg.append(path(segmentPath(100,88,65,i*45,(i+1)*45),{
      fill:WHEEL_COLORS[i],stroke:"#1d1b16","stroke-width":1.5
    }));
  }
  svg.append(
    circle(100,88,72,{fill:hardwareOnly?"none":"none",stroke:"#b6ad9c","stroke-width":8}),
    circle(100,88,67,{fill:"none",stroke:"#4a463d","stroke-width":2}),
    circle(100,88,19,{fill:"var(--material-hardware)",stroke:"#b6ad9c","stroke-width":4}),
    circle(100,88,7,{fill:"var(--machine-accent,var(--color-accent-primary))"})
  );
  if(!hardwareOnly){
    svg.append(path("M88 10h24l-12 27Z",{fill:"#ede6d7",stroke:"#6d675b","stroke-width":2,"stroke-linejoin":"round"}));
  }
  for(let i=0;i<8;i++){
    const [cx,cy]=polar(100,88,69,i*45);
    svg.append(circle(cx.toFixed(2),cy.toFixed(2),2.6,{fill:"#e6dfd1",stroke:"#5f5a50","stroke-width":1}));
  }
  return svg;
}

function cardBackArt({variant="stage"}={}){
  const svg=root("card-back",{variant,label:"Deck of cards",viewBox:"0 0 200 180"});
  const d=defs(svg);
  const paper=gradient(d,"linearGradient",[["0%","#fffefa",1],["100%","#ddd6c9",1]],{x1:"0",y1:"0",x2:"1",y2:"1"});
  shadow(svg,101,158,61,8);
  svg.append(
    rect(48,28,91,122,11,{fill:"#4a3f85",stroke:"#1f1b35","stroke-width":3,transform:"rotate(-8 93 89)"}),
    rect(57,19,91,122,11,{fill:paper,stroke:"#b8b0a2","stroke-width":2}),
    rect(65,27,75,106,7,{fill:"#6757b4",stroke:"#403678","stroke-width":2}),
    path("M102 48c5 14 13 22 27 27-14 5-22 13-27 27-5-14-13-22-27-27 14-5 22-13 27-27Z",{fill:"none",stroke:"#d8c7ff","stroke-width":4}),
    circle(102,75,8,{fill:"#d8c7ff"})
  );
  return svg;
}

function cardFaceArt(card,{variant="stage"}={}){
  const value=String(card||"?");
  const suit=value.slice(-1);
  const rank=value.slice(0,-1)||"?";
  const red=/[♥♦]/.test(suit);
  const ink=red?"#b8374c":"#23231f";
  const svg=root("card-face",{variant,label:value||"Card",viewBox:"0 0 160 190"});
  const d=defs(svg);
  const paper=gradient(d,"linearGradient",[["0%","#fffefa",1],["100%","#e8e1d5",1]],{x1:"0",y1:"0",x2:"1",y2:"1"});
  shadow(svg,80,173,48,7);
  svg.append(
    rect(22,10,116,150,12,{fill:paper,stroke:"#b7afa0","stroke-width":2}),
    path("M35 25h71",{fill:"none",stroke:"#fff","stroke-width":3,opacity:.8}),
    text(38,45,rank,{fill:ink,"font-size":25,"font-weight":850,"font-family":"var(--font-display)"}),
    text(38,67,suit||"?",{fill:ink,"font-size":21,"font-family":"serif"}),
    text(80,108,suit||"?",{"text-anchor":"middle",fill:ink,"font-size":58,"font-family":"serif"}),
    g({transform:"rotate(180 122 143)"},[
      text(122,143,rank,{fill:ink,"font-size":25,"font-weight":850,"font-family":"var(--font-display)"}),
      text(122,165,suit||"?",{fill:ink,"font-size":21,"font-family":"serif"})
    ])
  );
  return svg;
}

function tokenArt({variant="stage",accent="var(--machine-accent,var(--color-accent-primary))"}={}){
  const svg=root("tokens",{variant,label:"Chance tokens"});
  shadow(svg,100,139,57,8);
  const chips=[[70,92,32,-10],[119,94,34,11],[98,66,35,2]];
  for(const [cx,cy,radius,rotate] of chips){
    svg.append(g({transform:"rotate("+rotate+" "+cx+" "+cy+")"},[
      circle(cx,cy,radius,{fill:"var(--material-hardware)",stroke:"#6d675c","stroke-width":3}),
      circle(cx,cy,radius-7,{fill:accent,opacity:.86,stroke:"#f4edde","stroke-width":2}),
      circle(cx,cy,radius-16,{fill:"var(--material-panel)",stroke:"#5d584e","stroke-width":2}),
      path("M"+(cx-11)+" "+cy+"h22",{stroke:accent,"stroke-width":4,"stroke-linecap":"round"})
    ]));
  }
  return svg;
}

function ticketArt({variant="stage"}={}){
  const svg=root("tickets",{variant,label:"Chance tickets"});
  shadow(svg,100,138,58,8);
  svg.append(
    g({transform:"rotate(-8 82 84)"},[
      path("M36 49h106v26c-8 2-8 13 0 15v27H36V90c8-2 8-13 0-15Z",{fill:"#efe1b8",stroke:"#766849","stroke-width":2}),
      line(61,49,61,117,{stroke:"#9c8a62","stroke-width":2,"stroke-dasharray":"5 5"}),
      text(99,88,"RANDOM",{"text-anchor":"middle",fill:"#6b5934","font-size":15,"font-weight":800,"letter-spacing":2})
    ]),
    g({transform:"translate(20 -8) rotate(7 82 84)",opacity:.74},[
      path("M36 49h106v26c-8 2-8 13 0 15v27H36V90c8-2 8-13 0-15Z",{fill:"#d9c27e",stroke:"#6f6040","stroke-width":2})
    ])
  );
  return svg;
}

function instrumentArt({variant="stage",value="?"}={}){
  const svg=root("instrument",{variant,label:"Random instrument"});
  const d=defs(svg);
  const glass=gradient(d,"linearGradient",[["0%","#191914",1],["100%","#090907",1]],{x1:"0",y1:"0",x2:"0",y2:"1"});
  shadow(svg,100,139,58,8);
  svg.append(
    rect(35,35,130,94,16,{fill:"var(--material-hardware)",stroke:"#777064","stroke-width":3}),
    rect(49,50,102,47,8,{fill:glass,stroke:"#3f3c35","stroke-width":2}),
    text(100,82,String(value??"?").slice(0,8),{"text-anchor":"middle",fill:"var(--machine-accent,var(--color-accent-primary))","font-size":24,"font-family":"var(--font-mono)"}),
    circle(62,112,7,{fill:"#4f4b42",stroke:"#8c8577","stroke-width":2}),
    circle(100,112,7,{fill:"var(--machine-accent,var(--color-accent-primary))",stroke:"#8c8577","stroke-width":2}),
    circle(138,112,7,{fill:"#4f4b42",stroke:"#8c8577","stroke-width":2})
  );
  return svg;
}

function envelopeArt({variant="stage"}={}){
  const svg=root("envelope",{variant,label:"Private envelope"});
  shadow(svg,100,139,56,8);
  svg.append(
    rect(37,47,126,79,8,{fill:"#efe4cc",stroke:"#7b6d58","stroke-width":2}),
    path("M39 52l61 48 61-48",{fill:"#e3d4b6",stroke:"#8b7b62","stroke-width":2,"stroke-linejoin":"round"}),
    path("M39 122l45-42M161 122l-45-42",{fill:"none",stroke:"#9b896e","stroke-width":2}),
    circle(100,99,17,{fill:"#a94b52",stroke:"#6d2c34","stroke-width":2}),
    path("M100 88c2 7 6 11 13 13-7 2-11 6-13 13-2-7-6-11-13-13 7-2 11-6 13-13Z",{fill:"#efd4aa"})
  );
  return svg;
}

function trophyArt({variant="stage"}={}){
  const svg=root("competition",{variant,label:"Competition draw"});
  shadow(svg,100,140,54,8);
  svg.append(
    path("M70 41h60v19c0 28-13 46-30 46S70 88 70 60Z",{fill:"#d8aa45",stroke:"#70501b","stroke-width":3}),
    path("M70 52H51c0 21 10 32 27 34M130 52h19c0 21-10 32-27 34",{fill:"none",stroke:"#d8aa45","stroke-width":8,"stroke-linecap":"round"}),
    rect(94,105,12,18,3,{fill:"#9a6c25"}),
    rect(76,122,48,10,4,{fill:"#bd8731",stroke:"#70501b","stroke-width":2}),
    path("M100 54l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2Z",{fill:"#fff0b4",opacity:.92})
  );
  return svg;
}

function paletteArt({variant="stage",color="#7C5CFF"}={}){
  const svg=root("palette",{variant,label:"Color palette"});
  shadow(svg,100,140,54,8);
  const cards=[["#d8aa45",-16,67],["#cf5f5d",-8,83],["#6a8fd8",0,99],[color,8,115]];
  for(const [fill,rotate,x] of cards){
    svg.append(g({transform:"rotate("+rotate+" "+x+" 83)"},[
      rect(x-26,43,52,75,10,{fill,stroke:"#6f685d","stroke-width":2}),
      rect(x-19,50,38,49,6,{fill:"none",stroke:"#fff","stroke-width":2,opacity:.35})
    ]));
  }
  return svg;
}

export function toolArtKind(toolId){
  const id=String(toolId||"");
  if(id==="coin") return "coin";
  if(id==="dice") return "die";
  if(id==="wheel") return "wheel";
  if(id==="cards") return "card-back";
  if(id==="color") return "palette";
  if(["picker","sampler","teams","groups","pairs"].includes(id)) return "tokens";
  if(["shuffle","assignment","lottery"].includes(id)) return "tickets";
  if(["secret-santa"].includes(id)) return "envelope";
  if(["elimination","tournament","ladder","rps"].includes(id)) return "competition";
  if(["number","chance","date","time","coordinate","direction","letter"].includes(id)) return "instrument";
  return null;
}

export function toolArtNode(toolId,{variant="stage",result=null}={}){
  switch(toolArtKind(toolId)){
    case "coin": return coinArt({face:result==="Heads"?"H":result==="Tails"?"T":"?",variant});
    case "die": return dieArt({value:Array.isArray(result?.values)?result.values[0]:"•",sides:result?.sides||6,variant});
    case "wheel": return wheelArt({variant});
    case "card-back": return cardBackArt({variant});
    case "palette": return paletteArt({variant,color:typeof result==="string"?result:"#7C5CFF"});
    case "tokens": return tokenArt({variant});
    case "tickets": return ticketArt({variant});
    case "envelope": return envelopeArt({variant});
    case "competition": return trophyArt({variant});
    case "instrument": return instrumentArt({variant,value:result?.summary??result??"?"});
    default:return null;
  }
}

export function coinArtNode(face){return coinArt({face,variant:"stage"});}
export function dieArtNode(value,sides){return dieArt({value,sides,variant:"stage"});}
export function wheelHardwareNode(){return wheelArt({variant:"hardware",hardwareOnly:true});}
export function cardBackArtNode(){return cardBackArt({variant:"stage"});}
export function colorArtNode(color){return paletteArt({variant:"stage",color});}

export function playingCardArtNode(card,className=""){
  const value=String(card||"");
  const red=/[♥♦]/.test(value.slice(-1));
  const wrap=document.createElement("div");
  wrap.className=["play-card","playing-card",red?"red-card":"black-card",className].filter(Boolean).join(" ");
  wrap.setAttribute("aria-label",value||"No card drawn");
  wrap.append(cardFaceArt(value,{variant:"card"}));
  return wrap;
}
