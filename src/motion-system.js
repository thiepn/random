const ACTIVE = new Map();
const GENERATION = new Map();

const TOOL_MOTION_KIND = Object.freeze({
  coin:"coin",
  dice:"dice",
  wheel:"wheel",
  cards:"card",
  color:"palette",
  picker:"tokens",
  sampler:"tokens",
  teams:"tokens",
  groups:"tokens",
  pairs:"tokens",
  shuffle:"tickets",
  assignment:"tickets",
  lottery:"tickets",
  number:"instrument",
  chance:"instrument",
  date:"instrument",
  time:"instrument",
  coordinate:"instrument",
  direction:"instrument",
  letter:"instrument",
  "secret-santa":"envelope",
  elimination:"trophy",
  tournament:"trophy",
  ladder:"trophy",
  rps:"trophy"
});

const EASE = Object.freeze({
  impact:"cubic-bezier(.16,1,.3,1)",
  toss:"cubic-bezier(.2,.75,.2,1)",
  settle:"cubic-bezier(.22,.9,.25,1)",
  snap:"cubic-bezier(.18,.9,.3,1.2)",
  mechanical:"cubic-bezier(.15,.72,.18,1)"
});

function supportsMotion(stage){
  return Boolean(stage && typeof stage.animate==="function");
}

function add(active,element,keyframes,options){
  if(!element || typeof element.animate!=="function") return null;
  const animation=element.animate(keyframes,{fill:"both",...options});
  active.push(animation);
  return animation;
}

function duration(plan,factor=1,min=120,max=1800){
  return Math.max(min,Math.min(max,Math.round(Number(plan?.activeMs||plan?.duration||400)*factor)));
}

function art(stage,kind){
  return stage?.querySelector(".machine-art-"+kind)||null;
}

function all(stage,selector){
  return [...(stage?.querySelectorAll(selector)||[])];
}

function coin(active,stage,plan){
  const target=stage.querySelector(".stage-orb")||art(stage,"coin");
  add(active,target,[
    {transform:"translateY(0) rotateY(0deg) rotateZ(0deg) scale(1)",offset:0},
    {transform:"translateY(-64px) rotateY(540deg) rotateZ(-7deg) scale(1.06)",offset:.42},
    {transform:"translateY(-18px) rotateY(900deg) rotateZ(4deg) scale(1.025)",offset:.72},
    {transform:"translateY(5px) rotateY(1060deg) rotateZ(-2deg) scale(.99)",offset:.88},
    {transform:"translateY(0) rotateY(1080deg) rotateZ(0deg) scale(1)",offset:1}
  ],{duration:duration(plan,.9,420,1350),easing:EASE.toss});
}

function dice(active,stage,plan){
  const dice=all(stage,".die");
  const base=duration(plan,.82,380,1200);
  dice.forEach((die,index)=>{
    const side=index%2===0?1:-1;
    add(active,die,[
      {transform:"translate3d(0,0,0) rotate(0deg) scale(1)",offset:0},
      {transform:`translate3d(${side*12}px,-42px,0) rotate(${side*145}deg) scale(1.04)`,offset:.34},
      {transform:`translate3d(${-side*6}px,-8px,0) rotate(${side*285}deg) scale(1.01)`,offset:.66},
      {transform:`translate3d(${side*3}px,5px,0) rotate(${side*344}deg) scale(.98)`,offset:.84},
      {transform:"translate3d(0,0,0) rotate(360deg) scale(1)",offset:1}
    ],{duration:base+index*45,delay:index*28,easing:EASE.toss});
  });
}

function wheel(active,stage,plan){
  const hardware=stage.querySelector(".art-hardware");
  const pointer=stage.querySelector(".wheel-pointer");
  const label=stage.querySelector(".wheel-center-label");
  const d=duration(plan,.9,700,2800);
  add(active,hardware,[
    {transform:"rotate(0deg) scale(1)",offset:0},
    {transform:"rotate(-1.2deg) scale(1.006)",offset:.28},
    {transform:"rotate(.8deg) scale(1.003)",offset:.58},
    {transform:"rotate(-.35deg) scale(1)",offset:.82},
    {transform:"rotate(0deg) scale(1)",offset:1}
  ],{duration:d,easing:EASE.mechanical});
  const tickDuration=Math.max(1,Number(plan?.activeMs||d));
  const tickFrames=[{transform:"translateX(-50%) rotate(0deg)",offset:0}];
  for(const [index,delay] of (plan?.tickSchedule||[]).entries()){
    tickFrames.push({
      transform:`translateX(-50%) rotate(${index%2===0?6:-5}deg)`,
      offset:Math.min(.96,Math.max(.01,delay/tickDuration))
    });
  }
  tickFrames.push({transform:"translateX(-50%) rotate(0deg)",offset:1});
  add(active,pointer,tickFrames,{
    duration:tickDuration,
    easing:"linear"
  });
  add(active,label,[{opacity:.55,transform:"scale(.96)"},{opacity:1,transform:"scale(1)"}],{
    duration:Math.min(420,d),delay:Math.max(0,Number(plan?.impactMs||0)-180),easing:EASE.impact
  });
}

function card(active,stage,plan){
  const deck=stage.querySelector(".card-deck");
  const face=stage.querySelector(".playing-card");
  const d=duration(plan,.78,360,1000);
  add(active,deck,[
    {transform:"rotate(-7deg) translateX(0)"},
    {transform:"rotate(-11deg) translateX(-9px)",offset:.36},
    {transform:"rotate(-6deg) translateX(3px)",offset:.7},
    {transform:"rotate(-7deg) translateX(0)"}
  ],{duration:d,easing:EASE.impact});
  add(active,face,[
    {opacity:0,transform:"translate3d(-40px,24px,0) rotateY(78deg) rotate(10deg) scale(.92)",offset:0},
    {opacity:1,transform:"translate3d(8px,-5px,0) rotateY(-7deg) rotate(4deg) scale(1.025)",offset:.72},
    {opacity:1,transform:"translate3d(0,0,0) rotateY(0deg) rotate(5deg) scale(1)",offset:1}
  ],{duration:d,delay:Math.min(120,Number(plan?.anticipationMs||0)),easing:EASE.impact});
}

function tokens(active,stage,plan){
  const target=art(stage,"tokens");
  if(!target) return;
  const pieces=all(target,"g");
  const d=duration(plan,.65,320,760);
  pieces.slice(0,3).forEach((piece,index)=>{
    const x=[-16,18,-2][index]||0;
    const y=[8,10,-14][index]||0;
    const r=[-18,16,6][index]||0;
    add(active,piece,[
      {opacity:.15,transform:`translate(${x}px,${y-28}px) rotate(${r*2}deg) scale(.88)`},
      {opacity:1,transform:`translate(${x*.12}px,${y*.12}px) rotate(${r*.15}deg) scale(1.03)`,offset:.78},
      {opacity:1,transform:"translate(0,0) rotate(0deg) scale(1)"}
    ],{duration:d,delay:index*55,easing:EASE.toss});
  });
}

function tickets(active,stage,plan){
  const target=art(stage,"tickets");
  const slips=all(target,"g");
  const d=duration(plan,.7,320,820);
  slips.forEach((slip,index)=>add(active,slip,[
    {opacity:.1,transform:`translate(${index?28:-28}px,-12px) rotate(${index?20:-20}deg)`},
    {opacity:1,transform:`translate(${index?-3:3}px,2px) rotate(${index?5:-5}deg)`,offset:.78},
    {opacity:1,transform:"translate(0,0) rotate(0deg)"}
  ],{duration:d,delay:index*65,easing:EASE.impact}));
}

function instrument(active,stage,plan){
  const target=art(stage,"instrument");
  if(!target) return;
  const display=target.querySelector("text");
  const controls=all(target,"circle");
  const d=duration(plan,.5,240,520);
  add(active,target,[
    {transform:"translateY(0) scale(1)"},
    {transform:"translateY(-2px) scale(1.012)",offset:.5},
    {transform:"translateY(0) scale(1)"}
  ],{duration:d,easing:EASE.impact});
  add(active,display,[
    {opacity:.18,filter:"blur(3px)"},
    {opacity:.55,filter:"blur(1px)",offset:.55},
    {opacity:1,filter:"blur(0)"}
  ],{duration:d,easing:"steps(5,end)"});
  controls.slice(-3).forEach((control,index)=>add(active,control,[
    {transformOrigin:"center",transform:"scale(1)"},
    {transformOrigin:"center",transform:"scale(.72)",offset:.45},
    {transformOrigin:"center",transform:"scale(1)"}
  ],{duration:180,delay:index*45,easing:EASE.snap}));
}

function envelope(active,stage,plan){
  const target=art(stage,"envelope");
  if(!target) return;
  const seal=all(target,"circle").at(-1);
  const d=duration(plan,.68,300,720);
  add(active,target,[
    {opacity:.35,transform:"translateY(12px) scale(.96)"},
    {opacity:1,transform:"translateY(-3px) scale(1.015)",offset:.72},
    {opacity:1,transform:"translateY(0) scale(1)"}
  ],{duration:d,easing:EASE.impact});
  add(active,seal,[
    {transformOrigin:"center",transform:"scale(.65) rotate(-10deg)",opacity:.35},
    {transformOrigin:"center",transform:"scale(1.14) rotate(3deg)",opacity:1,offset:.7},
    {transformOrigin:"center",transform:"scale(1) rotate(0deg)",opacity:1}
  ],{duration:Math.min(420,d),delay:Math.min(100,Number(plan?.anticipationMs||0)),easing:EASE.snap});
}

function trophy(active,stage,plan){
  const target=art(stage,"competition");
  if(!target) return;
  add(active,target,[
    {opacity:.2,transform:"translateY(20px) scale(.86)",offset:0},
    {opacity:1,transform:"translateY(-8px) scale(1.07)",offset:.58},
    {opacity:1,transform:"translateY(3px) scale(.98)",offset:.82},
    {opacity:1,transform:"translateY(0) scale(1)"}
  ],{duration:duration(plan,.68,340,920),easing:EASE.impact});
}

function palette(active,stage,plan){
  const target=art(stage,"palette");
  if(!target) return;
  const cards=all(target,"g");
  const d=duration(plan,.55,260,600);
  cards.forEach((card,index)=>add(active,card,[
    {opacity:.25,transform:`translateX(${(index-1.5)*-12}px) rotate(${(index-1.5)*-8}deg) scale(.94)`},
    {opacity:1,transform:"translateX(0) rotate(0deg) scale(1)"}
  ],{duration:d,delay:index*35,easing:EASE.impact}));
}

const RUNNERS={coin,dice,wheel,card,tokens,tickets,instrument,envelope,trophy,palette};
const SOURCE_MOTION_KIND=Object.freeze({
  coin:"coin",dice:"dice",wheel:"wheel",card:"card",
  pick:"tokens",teams:"tokens",pairs:"tokens",shuffle:"tickets",
  assignment:"tickets",private:"envelope",tournament:"trophy",
  elimination:"trophy",ladder:"trophy",generator:"instrument"
});

export function motionKindForTool(toolId,sourceKind=""){
  return TOOL_MOTION_KIND[String(toolId||"")]
    || SOURCE_MOTION_KIND[String(sourceKind||"")]
    || "instrument";
}

function clearActive(key){
  const animations=ACTIVE.get(key)||[];
  for(const animation of animations){
    try{animation.cancel();}catch{}
  }
  ACTIVE.delete(key);
}

export function cancelPhysicalMotion(toolId){
  const key=String(toolId||"");
  clearActive(key);
  GENERATION.set(key,(GENERATION.get(key)||0)+1);
}

export function playPhysicalMotion({
  toolId,
  stage,
  plan
}={}){
  const key=String(toolId||"");
  clearActive(key);
  if(!supportsMotion(stage)||!plan||plan.duration<=0||plan.reducedMotion) return [];

  const active=[];
  ACTIVE.set(key,active);
  const kind=motionKindForTool(key,plan.sourceKind);
  const runner=RUNNERS[kind]||RUNNERS.instrument;

  if(plan.effects==="low"){
    const target=stage.querySelector(".art-stage,.stage-orb,.die,.wheel,.playing-card")||stage.querySelector(".stage-content");
    add(active,target,[
      {opacity:.72,transform:"scale(.985)"},
      {opacity:1,transform:"scale(1)"}
    ],{duration:Math.min(320,Math.max(160,plan.duration)),easing:EASE.settle});
  }else{
    runner(active,stage,plan);
  }

  if(!active.length){
    ACTIVE.delete(key);
    return active;
  }

  for(const animation of active){
    animation.finished.catch(()=>{}).finally(()=>{
      const current=ACTIVE.get(key);
      if(current&&current.every(item=>item.playState==="finished"||item.playState==="idle")){
        ACTIVE.delete(key);
      }
    });
  }
  return active;
}

export function schedulePhysicalMotion({toolId,plan}={}){
  if(typeof window==="undefined"||!plan||plan.duration<=0||plan.reducedMotion) return;
  const key=String(toolId||"");
  const generation=GENERATION.get(key)||0;
  window.requestAnimationFrame(()=>{
    if((GENERATION.get(key)||0)!==generation) return;
    window.requestAnimationFrame(()=>{
      if((GENERATION.get(key)||0)!==generation) return;
      const stage=[...document.querySelectorAll(".tool-stage-v2")]
        .find(node=>node.dataset.tool===key);
      if(stage) playPhysicalMotion({toolId:key,stage,plan});
    });
  });
}
