import {drawCollectorShell} from './collector-shell.js';
import {performanceFor} from './molecule-roles.js';

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const safe=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export function propellantPreviewValues(id,{amount=null}={}){
  const performance=performanceFor(id,'propellant');
  if(!performance)return null;
  const available=amount==null?performance.capacity:Math.max(0,amount);
  return Object.freeze({
    burstPower:performance.burstPower,
    burstDistance:42+performance.burstPower*142,
    shots:Math.floor(available/performance.moleculesPerBurst),
    fullShots:Math.floor(performance.capacity/performance.moleculesPerBurst),
  });
}

export function fuelPreviewValues(id,{fuelAmount=null,oxygenAmount=36,coolantId=null}={}){
  const fuel=performanceFor(id,'fuel');
  if(!fuel)return null;
  const coolant=performanceFor(coolantId,'coolant');
  const amount=fuelAmount==null?fuel.capacity:Math.max(0,fuelAmount);
  const oxygen=Math.max(0,oxygenAmount);
  const secondsPerFuel=2*fuel.energy;
  const fuelSeconds=amount*secondsPerFuel;
  const oxygenSeconds=fuel.oxygenPerFuel>0?oxygen/fuel.oxygenPerFuel*secondsPerFuel:Infinity;
  const limitingSeconds=Math.min(fuelSeconds,oxygenSeconds);
  const fuelDrainRate=clamp01(.16+.24/Math.max(.35,fuel.energy));
  const oxygenPerSecond=fuel.oxygenPerFuel/Math.max(.35,secondsPerFuel);
  const oxygenDrainRate=clamp01(.12+oxygenPerSecond*.24);
  const coolingRelief=coolant?clamp01(coolant.coolingPower*.22*coolant.environmentTolerance):0;
  const heatRise=clamp01(.18+fuel.heatFactor*.46-coolingRelief*.34);
  return Object.freeze({
    response:fuel.response,
    responseVisual:clamp01((fuel.response-.45)/1.2),
    fuelDrainRate,
    oxygenDrainRate,
    heatRise,
    limitingSeconds,
    oxygenLimited:oxygenSeconds<fuelSeconds,
  });
}

export function coolantPreviewValues(id){
  const coolant=performanceFor(id,'coolant');
  if(!coolant)return null;
  return Object.freeze({
    initialCooling:clamp01(coolant.coolingPower/1.9),
    endurance:clamp01(coolant.durationFactor/3.2),
    highHeatTolerance:clamp01(coolant.environmentTolerance/1.75),
    depletionRate:clamp01(.18+.56/Math.max(.45,coolant.durationFactor)),
    coolingPower:coolant.coolingPower,
    durationFactor:coolant.durationFactor,
    environmentTolerance:coolant.environmentTolerance,
  });
}

export function loadoutPreviewValues(use,id,context={}){
  if(use==='propellant')return propellantPreviewValues(id,{amount:context.amount});
  if(use==='fuel')return fuelPreviewValues(id,{fuelAmount:context.amount,oxygenAmount:context.oxygenAmount,coolantId:context.coolantId});
  if(use==='coolant')return coolantPreviewValues(id);
  if(use==='oxidizer')return performanceFor(id,'oxidizer')?Object.freeze({minimal:true}):null;
  return null;
}

function style(node,values){Object.assign(node.style,values);return node;}
function node(tag,values={}){return style(document.createElement(tag),values);}
function meter(label){
  const row=node('div',{display:'grid',gridTemplateColumns:'48px 1fr',alignItems:'center',gap:'7px',fontSize:'11px',letterSpacing:'.03em',color:'#c9d9df'}),caption=document.createElement('span'),track=node('i',{position:'relative',display:'block',height:'7px',borderRadius:'7px',overflow:'hidden',background:'#263945'}),candidate=node('b',{position:'absolute',inset:'0',transformOrigin:'left',background:'#aee8f3'}),ghost=node('em',{position:'absolute',top:'1px',bottom:'1px',left:'0',width:'2px',background:'#80939b',opacity:'.8'});caption.textContent=label;track.append(candidate,ghost);row.append(caption,track);return {row,candidate,ghost};
}
function setMeter(meter,candidate,current){meter.candidate.style.transform=`scaleX(${clamp01(candidate)})`;meter.ghost.style.left=`calc(${clamp01(current)*100}% - 1px)`;meter.ghost.hidden=!Number.isFinite(current);}

function setupCanvas(host,height=226){
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');style(canvas,{display:'block',width:'100%',height:`${height}px`,minHeight:`${height}px`});host.append(canvas);
  const resize=()=>{const rect=canvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio??1,2);canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));return {ctx:canvas.getContext('2d'),width:rect.width,height:rect.height,ratio};};
  return {canvas,resize};
}
function beginLoop(host,draw,reduced){
  const token={cancelled:false};host._loadoutPreviewToken?.cancel?.();host._loadoutPreviewToken={cancel(){token.cancelled=true;}};
  if(reduced){draw(.56);return;}
  const start=performance.now();const frame=now=>{if(token.cancelled||!host.isConnected)return;draw(((now-start)%3000)/3000);requestAnimationFrame(frame);};requestAnimationFrame(frame);
}
function shell(ctx,x,y,alpha=1,scale=1){ctx.save();ctx.globalAlpha=alpha;drawCollectorShell(ctx,{x,y,angle:0,scale});ctx.restore();}
function trail(ctx,x0,x1,y,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#9bdde9';ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();ctx.restore();}

function propellantPreview(host,candidate,current,{reduced=false}={}){
  const {resize}=setupCanvas(host,232),shots=node('div',{display:'grid',gridTemplateColumns:'1fr',gap:'5px',padding:'0 10px 8px'});host.append(shots);
  const dots=(count,ghost=false)=>{const row=node('div',{display:'flex',justifyContent:'center',gap:'5px',minHeight:'12px',opacity:ghost?'.38':'1'});for(let i=0;i<count;i++)row.append(node('i',{display:'block',width:'9px',height:'9px',borderRadius:'50%',background:ghost?'#8e9ca2':'#b7edf5',boxShadow:ghost?'none':'0 0 7px #77d8e6'}));return row;};
  if(current)shots.append(dots(current.shots,true));shots.append(dots(candidate.shots,false));
  beginLoop(host,phase=>{const {ctx,width,height,ratio}=resize();if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);const startX=Math.max(42,width*.16),y=height*.55,t=Math.min(1,phase/.46),ease=1-Math.pow(1-t,3);if(current){const x=startX+current.burstDistance*ease;trail(ctx,startX,x,y,.22);shell(ctx,x,y,.28,1.42);}const x=startX+candidate.burstDistance*ease;trail(ctx,startX,x,y,.85);shell(ctx,x,y,1,1.5);},reduced);
}

function fuelPreview(host,candidate,current,{reduced=false}={}){
  const {resize}=setupCanvas(host,230),meters=node('div',{display:'grid',gap:'6px',padding:'0 12px 10px'}),fuel=meter('燃料'),oxygen=meter('O₂'),temp=meter('温度');meters.append(fuel.row,oxygen.row,temp.row);host.append(meters);
  beginLoop(host,phase=>{const {ctx,width,height,ratio}=resize();if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);const t=Math.min(1,phase/.72),startX=Math.max(42,width*.14),travel=Math.max(90,width*.62),y=height*.43;const distance=(response)=>{const k=.65+safe(response,.5)*1.2;const raw=t-(1-Math.exp(-k*t))/k;const max=1-(1-Math.exp(-k))/k;return travel*(max>0?raw/max:0);};if(current)shell(ctx,startX+distance(current.response),y,.28,1.38);shell(ctx,startX+distance(candidate.response),y,1,1.48);const cycle=Math.min(1,phase/.82);setMeter(fuel,1-candidate.fuelDrainRate*cycle,current?1-current.fuelDrainRate*cycle:NaN);setMeter(oxygen,1-candidate.oxygenDrainRate*cycle,current?1-current.oxygenDrainRate*cycle:NaN);setMeter(temp,candidate.heatRise*cycle,current?current.heatRise*cycle:NaN);},reduced);
}

function coolantPreview(host,candidate,current,{reduced=false}={}){
  const {resize}=setupCanvas(host,230),meterRow=meter('冷却剤');host.append(style(meterRow.row,{margin:'0 12px 10px'}));
  beginLoop(host,phase=>{const {ctx,width,height,ratio}=resize();if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);const t=Math.min(1,phase/.78),x=width*.5,y=height*.5;const heat=(v)=>Math.max(0,1-v.initialCooling*(.35+.65*t)*(.72+v.highHeatTolerance*.28));const drawHeat=(v,alpha,scale)=>{const h=heat(v),radius=44+22*h;ctx.save();ctx.globalAlpha=alpha;const gradient=ctx.createRadialGradient(x,y,4,x,y,radius);gradient.addColorStop(0,`rgba(255,235,180,${.85*h})`);gradient.addColorStop(.45,`rgba(255,112,58,${.75*h})`);gradient.addColorStop(1,'rgba(255,60,30,0)');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();shell(ctx,x,y,alpha,scale);ctx.restore();};if(current)drawHeat(current,.28,1.42);drawHeat(candidate,1,1.5);const candidateLevel=Math.max(0,1-candidate.depletionRate*t),currentLevel=current?Math.max(0,1-current.depletionRate*t):NaN;setMeter(meterRow,candidateLevel,currentLevel);},reduced);
}

export function renderLoadoutPreview(host,{use,candidateId,currentId=null,candidateAmount=null,currentAmount=null,oxygenAmount=36,coolantId=null,reduced=false}={}){
  host._loadoutPreviewToken?.cancel?.();host.replaceChildren();style(host,{display:'block',minHeight:'250px',padding:'4px 0',border:'0',background:'transparent',overflow:'hidden'});
  const candidate=loadoutPreviewValues(use,candidateId,{amount:candidateAmount,oxygenAmount,coolantId});const current=currentId?loadoutPreviewValues(use,currentId,{amount:currentAmount,oxygenAmount,coolantId}):null;
  if(!candidate){host.hidden=true;return null;}host.hidden=false;host.dataset.previewKind=use;
  if(use==='propellant')propellantPreview(host,candidate,current,{reduced});
  else if(use==='fuel')fuelPreview(host,candidate,current,{reduced});
  else if(use==='coolant')coolantPreview(host,candidate,current,{reduced});
  else {host.style.minHeight='44px';const minimal=node('div',{height:'44px',display:'grid',placeItems:'center',fontSize:'18px',fontWeight:'800',letterSpacing:'.06em',opacity:'.86'});minimal.textContent='O₂';host.append(minimal);}
  return {candidate,current};
}
