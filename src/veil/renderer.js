import {drawChallengeCurrents} from './expedition-challenges.js';
import {CHO_DESTINATION} from './cho-campaign.js';
import { VEIL, EXPEDITION } from './config.js';
import { OXYGEN_ROUTES,OXYGEN_REWARD,oxygenGateEnvelopeAt } from './oxygen-routes.js';
import {NITROGEN_CORE_FRACTURE_DURATION,nitrogenCoreIsGone,nitrogenCoreLifecycle,nitrogenVisualEffectiveAt} from './nitrogen-routes.js';
import { random } from './map.js';
import { clamp } from './engine.js';
import { drawCollectorShell } from './collector-shell.js';
import {insightCategoryFor,INSIGHT_CATEGORY_COLORS} from '../insight-category.js';
import {isInsideSafeExtractionSite} from './safe-extraction-sites.js';
import {RARE_ECOLOGY_ELEMENTS,RARE_ECOLOGY_VISUALS} from './rare-ecology.js';
import {ABRASIVE_PLUME,ABRASIVE_VISUAL_SAMPLES,abrasiveEffectiveAt} from './abrasive-field.js';
import {ELECTRICAL_FIELD,ELECTRICAL_VISUAL_SAMPLES,electricalEffectiveAt} from './electrical-field.js';
export const LOST_CARGO_PARTICLE_CAP=36;
export const LOST_INSIGHT_PARTICLE_CAP=4;
export const RETURN_EFFECTS=Object.freeze({stable:Object.freeze({duration:EXPEDITION.normalExtractionSeconds}),emergency:Object.freeze({duration:1.35}),'stable-warp':Object.freeze({duration:.48}),'emergency-warp':Object.freeze({duration:.56})});
const LOST_CARGO_ELEMENTS=['H','C','N','O',...RARE_ECOLOGY_ELEMENTS];
const smoothstep=t=>t*t*(3-2*t);
export function createReturnEffect(mode){const config=RETURN_EFFECTS[mode];if(!config)return null;return {mode,life:0,duration:config.duration};}
export function returnEffectFrame(effect){
  const progress=clamp((effect?.life??0)/(effect?.duration||1),0,1);
  if(effect?.mode==='stable'||effect?.mode==='emergency')return {mode:effect.mode,progress,collapse:0,warp:0};
  if(effect?.mode==='stable-warp'||effect?.mode==='emergency-warp')return {mode:effect.mode,progress,collapse:smoothstep(progress),warp:Math.sin(progress*Math.PI)*.085};
  return {mode:null,progress:0,collapse:0,warp:0};
}
export function lostCargoParticleCounts(lost,cap=LOST_CARGO_PARTICLE_CAP){
  const weights=LOST_CARGO_ELEMENTS.map(element=>({element,amount:Number.isSafeInteger(lost?.[element])&&lost[element]>0?lost[element]:0})).filter(item=>item.amount>0);
  const total=weights.reduce((sum,item)=>sum+item.amount,0),target=Math.min(Math.max(0,Math.floor(cap)),total);if(!target)return {H:0,C:0,O:0};
  if(total<=target)return Object.fromEntries(weights.map(({element,amount})=>[element,amount]));
  const counts=Object.fromEntries(weights.map(({element})=>[element,0])),reserved=Math.min(target,weights.length);for(let i=0;i<reserved;i++)counts[weights[i].element]=1;
  const remaining=target-reserved,shares=weights.map(item=>{const exact=item.amount/total*remaining,floor=Math.floor(exact);counts[item.element]+=floor;return {...item,remainder:exact-floor};});
  let unassigned=target-Object.values(counts).reduce((sum,n)=>sum+n,0);shares.sort((a,b)=>b.remainder-a.remainder||b.amount-a.amount||LOST_CARGO_ELEMENTS.indexOf(a.element)-LOST_CARGO_ELEMENTS.indexOf(b.element));
  for(let i=0;i<unassigned;i++)counts[shares[i%shares.length].element]++;
  return counts;
}
function createForcedLossParticle(origin,rng,details={}){
  const angle=rng()*Math.PI*2,speed=105+rng()*90,offset=4+rng()*10;
  return {...details,x:origin.x+Math.cos(angle)*offset,y:origin.y+Math.sin(angle)*offset,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:0,duration:.56+rng()*.06,spin:(rng()-.5)*7};
}
export function createLostCargoParticles(lost,origin,rng=Math.random){
  const counts=lostCargoParticleCounts(lost),particles=[];
  for(const element of LOST_CARGO_ELEMENTS)for(let i=0;i<counts[element];i++)particles.push(createForcedLossParticle(origin,rng,{element}));
  return particles;
}
export function createLostInsightParticles(insights,origin,rng=Math.random){
  const ids=[...new Set((Array.isArray(insights)?insights:[]).filter(id=>typeof id==='string'&&id))].slice(0,LOST_INSIGHT_PARTICLE_CAP);
  return ids.map(id=>{const category=insightCategoryFor(id);return createForcedLossParticle(origin,rng,{insightId:id,icon:'💡',category,color:INSIGHT_CATEGORY_COLORS[category]??INSIGHT_CATEGORY_COLORS.general});});
}
export function advanceForcedLossParticle(particle,target,dt,reduced=false){
  const elapsed=clamp(dt,0,.15);particle.life=Math.min(particle.duration,particle.life+elapsed);
  const scatterEnd=reduced?.05:.15,drag=Math.exp(-elapsed*(particle.life<scatterEnd?3.2:5.6));
  particle.x+=particle.vx*elapsed;particle.y+=particle.vy*elapsed;particle.vx*=drag;particle.vy*=drag;
  if(target&&particle.life>=scatterEnd){
    const progress=clamp((particle.life-scatterEnd)/Math.max(.01,particle.duration-scatterEnd),0,1),pull=1-Math.exp(-elapsed*((reduced?18:8)+progress*(reduced?14:18)));
    particle.x+=(target.x-particle.x)*pull;particle.y+=(target.y-particle.y)*pull;
  }
  return particle;
}
export function forcedLossParticleAlpha(particle){
  const progress=clamp((particle?.life??0)/(particle?.duration||1),0,1);
  return 1-smoothstep(clamp((progress-.5)/.5,0,1));
}
export function createVeilRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas 2D unavailable');
  let w=1,h=1,scale=1,baseScale=1,camera={x:0,y:0},fresh=true;
  const rng=random(17),stars=Array.from({length:170},()=>({x:rng(),y:rng(),r:.3+rng()*1.1,z:.05+rng()*.2}));
  const sprites={},cloudLayer=document.createElement('canvas'),spriteColors={normal:'147,225,255',dense:'186,245,255',rare:'255,220,152',carbon:'207,154,255',nitrogen:'59,130,246',oxygen:'255,157,119',signal:'255,230,155',horizon:'230,204,255',player:'163,235,255'};
  for(const visual of Object.values(RARE_ECOLOGY_VISUALS))spriteColors[visual.sprite]=visual.rgb;
  for(const [name,color]of Object.entries(spriteColors)){
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gradient=g.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,`rgba(${color},1)`);gradient.addColorStop(.12,`rgba(${color},.95)`);gradient.addColorStop(.3,`rgba(${color},.23)`);gradient.addColorStop(1,`rgba(${color},0)`);g.fillStyle=gradient;g.fillRect(0,0,64,64);sprites[name]=c;
  }
  function resize(){
    const r=canvas.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);const dpr=Math.min(window.devicePixelRatio||1,VEIL.maxDpr);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);baseScale=clamp(Math.min(w/660,h/950),.48,1.15);scale=baseScale;
    // The soft distant clouds do not need DPR-sized gradients rebuilt every frame.
    cloudLayer.width=Math.ceil(w*1.3);cloudLayer.height=Math.ceil(h*1.3);const g=cloudLayer.getContext('2d');
    g.fillStyle='#040d19';g.fillRect(0,0,cloudLayer.width,cloudLayer.height);
    for(const cloud of [{x:.12,y:.18,r:.85,color:'12,51,79'},{x:.94,y:.65,r:.72,color:'20,48,75'},{x:.5,y:1.1,r:.65,color:'12,61,76'}]){
      const x=cloud.x*w+w*.15,y=cloud.y*h+h*.15,radius=Math.max(w,h)*cloud.r,gradient=g.createRadialGradient(x,y,0,x,y,radius);
      gradient.addColorStop(0,`rgba(${cloud.color},.53)`);gradient.addColorStop(1,`rgba(${cloud.color},0)`);g.fillStyle=gradient;g.fillRect(0,0,cloudLayer.width,cloudLayer.height);
    }
  }
  const screen=(x,y)=>({x:(x-camera.x)*scale+w/2,y:(y-camera.y)*scale+h/2});
  function glow(x,y,size,kind='normal',alpha=1){ctx.globalAlpha=alpha;ctx.drawImage(sprites[kind]||sprites.normal,x-size/2,y-size/2,size,size);ctx.globalAlpha=1;}
  function drawInsightBulb(x,y,size,color,alpha,rotation=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(size/24,size/24);ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(12,2);ctx.bezierCurveTo(6.4,2,4.2,6,5.2,10.2);ctx.lineTo(7.2,13.2);ctx.bezierCurveTo(8.2,14.5,9,15.7,9,17.2);ctx.lineTo(9,18.5);ctx.lineTo(15,18.5);ctx.lineTo(15,17.2);ctx.bezierCurveTo(15,15.7,15.8,14.5,16.8,13.2);ctx.lineTo(18.8,10.2);ctx.bezierCurveTo(19.8,6,17.6,2,12,2);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(9,20);ctx.lineTo(15,20);ctx.lineTo(15,21.1);ctx.quadraticCurveTo(15,22,13.9,22);ctx.lineTo(10.1,22);ctx.quadraticCurveTo(9,22,9,21.1);ctx.closePath();ctx.fill();ctx.restore();ctx.globalAlpha=1;
  }
  function drawReturnEffect(effect,center,reduced){
    const frame=returnEffectFrame(effect),p=frame.progress,normal=frame.mode==='stable'||frame.mode==='stable-warp',warping=frame.mode?.endsWith('-warp');
    if(frame.mode==='stable'){
      const radius=22+24*p;ctx.strokeStyle='#b9f1f8';ctx.globalAlpha=(1-p)*.34;ctx.lineWidth=1.2*scale;ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.stroke();
    }else if(warping){
      const color=normal?'#c3f7ff':'#dba2be',radius=12+Math.max(w,h)*.12*(1-frame.collapse);ctx.save();ctx.translate(center.x,center.y);ctx.strokeStyle=color;
      for(let i=0;i<3;i++){ctx.globalAlpha=(1-p)*(.25+i*.1);ctx.lineWidth=(1+i*.45)*scale;ctx.beginPath();ctx.ellipse(0,0,radius*(.72+i*.16),radius*(.43+i*.1),i*.32,0,Math.PI*2);ctx.stroke();}ctx.restore();
      const fade=reduced?p:smoothstep(clamp((p-.28)/.72,0,1));ctx.fillStyle=normal?`rgba(3,12,22,${fade})`:`rgba(5,2,10,${fade})`;ctx.fillRect(0,0,w,h);
    }
    ctx.globalAlpha=1;
  }
  function drawSafeExtractionSite(site,time,reduced,arrowTarget=false){
    if(!site)return;const center=screen(site.x,site.y),radius=site.radius*scale;
    if(arrowTarget&&(center.x<24||center.x>w-24||center.y<24||center.y>h-24)){
      const target={x:clamp(center.x,24,w-24),y:clamp(center.y,24,h-24)},angle=Math.atan2(center.y-target.y,center.x-target.x);
      ctx.save();ctx.translate(target.x,target.y);ctx.rotate(angle);ctx.fillStyle='#9adbe7';ctx.strokeStyle='#d2f6fa';ctx.globalAlpha=.82;
      ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,-7);ctx.lineTo(-4,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.globalAlpha=.9;ctx.font='600 8px system-ui';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText('SAFE SITE',0,10);ctx.restore();ctx.globalAlpha=1;return;
    }
    if(center.x<-radius-52||center.x>w+radius+52||center.y<-radius-52||center.y>h+radius+52)return;
    ctx.save();ctx.translate(center.x,center.y);ctx.strokeStyle='#9adbe7';ctx.lineWidth=1;ctx.globalAlpha=.22;
    const clipped=Number.isFinite(site.geometry?.top)&&Number.isFinite(site.geometry?.bottom),top=(site.geometry.top-site.y)*scale,bottom=(site.geometry.bottom-site.y)*scale;
    if(clipped){const edge=Math.sqrt(Math.max(0,radius*radius-Math.max(top*top,bottom*bottom)));ctx.save();ctx.beginPath();ctx.rect(-radius,top,radius*2,bottom-top);ctx.clip();ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(-edge,top);ctx.lineTo(edge,top);ctx.moveTo(-edge,bottom);ctx.lineTo(edge,bottom);ctx.stroke();}
    else{ctx.beginPath();ctx.arc(0,0,Math.max(13,radius),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.34;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,Math.max(10,radius*.56),-.5,Math.PI*1.42);ctx.stroke();}
    ctx.globalAlpha=.48;ctx.beginPath();ctx.arc(0,0,Math.max(8,radius*.26),0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#d2f6fa';ctx.globalAlpha=.86;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 11px system-ui';ctx.fillText('SAFE SITE',0,0);
    ctx.globalAlpha=.78;ctx.font='600 8px system-ui';ctx.fillText('EXTRACTION',0,13);ctx.restore();ctx.globalAlpha=1;
  }
  function drawDistantNitrogenCore(run,core,distance,reduced){
    if(nitrogenCoreIsGone(core,run.time)||distance>4800||distance<900)return;
    const dx=core.x-run.player.x,dy=core.y-run.player.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
    const edge=Math.min(Math.abs(ux)>1e-5?w*.45/Math.abs(ux):Infinity,Math.abs(uy)>1e-5?h*.45/Math.abs(uy):Infinity),offset=Math.min(distance*scale,edge);
    const x=w/2+ux*offset,y=h/2+uy*offset,progress=clamp((4800-distance)/(4800-900),0,1),fade=smoothstep((distance-900)/500),size=12+36*progress,activity=.22+.7*progress,pulse=.5+.5*Math.sin(run.time*1.35);
    ctx.save();ctx.globalAlpha=fade;
    const glowRadius=size*(1.7+pulse*.25),glow=ctx.createRadialGradient(x,y,0,x,y,glowRadius);glow.addColorStop(0,`rgba(206,156,255,${.28*activity})`);glow.addColorStop(.34,`rgba(151,91,220,${.18*activity})`);glow.addColorStop(1,'rgba(92,55,157,0)');ctx.fillStyle=glow;ctx.fillRect(x-glowRadius,y-glowRadius,glowRadius*2,glowRadius*2);
    ctx.strokeStyle='#d4b3ff';ctx.lineWidth=1+progress;ctx.globalAlpha=fade*(.2+.42*activity);
    for(let i=0;i<3;i++){const r=size*(.48+i*.34)+pulse*size*.09;ctx.beginPath();ctx.ellipse(x,y,r,r*(.58+i*.09),run.time*.09+i*.55,0,Math.PI*2);ctx.stroke();}
    const emission=(run.time*.31)%1;if(!reduced&&emission<.24){const t=emission/.24,r=size*(.65+t*2.8);ctx.globalAlpha=fade*(1-t)*(.16+.3*activity);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#dfc6ff';ctx.globalAlpha=fade*(.52+.4*activity);ctx.beginPath();ctx.arc(x,y,Math.max(2,size*.11),0,Math.PI*2);ctx.fill();ctx.restore();ctx.globalAlpha=1;
  }
  function drawNitrogenCore(run,core,distance){
    const lifecycle=nitrogenCoreLifecycle(core,run.time);if(lifecycle==='gone'||distance>1400)return;
    const r=core.radius,extent=r*4.5;if(core.x+extent<camera.x-w/(2*scale)||core.x-extent>camera.x+w/(2*scale)||core.y+extent<camera.y-h/(2*scale)||core.y-extent>camera.y+h/(2*scale))return;
    const elapsed=lifecycle==='fracturing'?run.time-core.fracturedAt:0,progress=lifecycle==='fracturing'?clamp(elapsed/NITROGEN_CORE_FRACTURE_DURATION,0,1):0,impact=lifecycle==='fracturing'?1-smoothstep(clamp(progress/.15,0,1)):0,rupture=lifecycle==='fracturing'?smoothstep(clamp((progress-.12)/.42,0,1)):0,disperse=lifecycle==='fracturing'?smoothstep(clamp((progress-.48)/.5,0,1)):0;
    const alpha=smoothstep(clamp((1400-distance)/500,0,1)),near=1-distance/1400,pulse=.5+.5*Math.sin(run.time*1.3),seed=(run.map.seed??1)*.013,bodyScale=1-.94*disperse,bodyAlpha=lifecycle==='fracturing'?1-smoothstep(clamp((progress-.42)/.53,0,1)):1;
    ctx.save();ctx.globalAlpha=alpha;
    if(lifecycle==='intact'){
      const haloRadius=r*1.72,halo=ctx.createRadialGradient(core.x,core.y,r*.72,core.x,core.y,haloRadius);halo.addColorStop(0,'rgba(135,104,183,.12)');halo.addColorStop(.58,'rgba(100,69,148,.1)');halo.addColorStop(1,'rgba(68,43,96,0)');ctx.fillStyle=halo;ctx.fillRect(core.x-haloRadius,core.y-haloRadius,haloRadius*2,haloRadius*2);
      ctx.strokeStyle='#9b87c6';ctx.globalAlpha=alpha*(.11+near*.09+pulse*.025);ctx.lineWidth=1.4+near*.8;
      for(let ring=0;ring<3;ring++){const rr=r*(1.08+ring*.21),sway=Math.sin(run.time*.9+ring*1.7)*.05;ctx.beginPath();ctx.ellipse(core.x,core.y,rr,rr*(.79+sway),ring*.62+run.time*.04,run.time*.13+ring*1.7,run.time*.13+ring*1.7+Math.PI*(1.1+ring*.1));ctx.stroke();}
    }
    if(lifecycle==='fracturing'&&progress>.04){
      const waveAlpha=alpha*.82*(1-progress)**.72,mainRadius=r*(1.05+1.7*smoothstep(progress));ctx.strokeStyle='#f1e4ff';ctx.globalAlpha=waveAlpha;ctx.lineWidth=4.2-1.8*progress;ctx.beginPath();ctx.ellipse(core.x,core.y,mainRadius,mainRadius*.88,.18+progress*.55,0,Math.PI*2);ctx.stroke();
      const echo=mainRadius*.72;ctx.globalAlpha=waveAlpha*.5;ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(core.x,core.y,echo,echo*.92,-.22,0,Math.PI*2);ctx.stroke();
    }
    if(bodyAlpha>.008){
      ctx.save();ctx.translate(core.x,core.y);ctx.scale(bodyScale,bodyScale);ctx.globalAlpha=alpha*bodyAlpha;
      const vertices=48;ctx.beginPath();for(let i=0;i<=vertices;i++){const angle=i/vertices*Math.PI*2,rough=1+.09*Math.sin(angle*3+seed)+.055*Math.cos(angle*5-seed*.7)+.025*Math.sin(angle*9+1.4),collapse=1+rupture*.13*Math.sin(angle*7+seed*3+progress*8),radius=r*rough*collapse,x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();
      const mass=ctx.createRadialGradient(-r*.2,-r*.29,r*.035,0,0,r*1.12);mass.addColorStop(0,'#57466d');mass.addColorStop(.22,'#30263f');mass.addColorStop(.7,'#171320');mass.addColorStop(1,'#06060b');ctx.fillStyle=mass;ctx.fill();
      ctx.strokeStyle='#e0ccff';ctx.globalAlpha=alpha*bodyAlpha*(.88+near*.1+impact*.12);ctx.lineWidth=4.2+near*1.2+impact*3;ctx.stroke();
      ctx.strokeStyle='#75658f';ctx.globalAlpha=alpha*bodyAlpha*.72;ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(0,0,r*.93,.1,Math.PI*1.85);ctx.stroke();
      ctx.save();ctx.clip();
      const crackReveal=lifecycle==='fracturing'?Math.max(.12,Math.min(1,.25+rupture*.75)):1;
      for(let i=0;i<10;i++){
        const angle=i*2.399963+seed,reach=r*(.34+(i%5)*.105)*crackReveal,bend=.12*Math.sin(i*3.7+seed),start=r*(.02+(i%3)*.015),endX=Math.cos(angle+bend)*reach,endY=Math.sin(angle+bend)*reach;
        ctx.strokeStyle=i%3===0?'#fff0b6':'#d7b6ff';ctx.globalAlpha=alpha*bodyAlpha*(.57+near*.2+impact*.38+rupture*.24);ctx.lineWidth=1.8+near*.9+impact*2.2+rupture*1.6;ctx.beginPath();ctx.moveTo(Math.cos(angle)*start,Math.sin(angle)*start);ctx.lineTo(Math.cos(angle+bend*.4)*reach*.49,Math.sin(angle+bend*.4)*reach*.49);ctx.lineTo(endX,endY);ctx.stroke();
        if(i%2===0){const branch=reach*.18;ctx.globalAlpha*=.82;ctx.lineWidth*=.7;ctx.beginPath();ctx.moveTo(Math.cos(angle+bend)*reach*.52,Math.sin(angle+bend)*reach*.52);ctx.lineTo(Math.cos(angle+bend+.52)*branch+Math.cos(angle+bend)*reach*.52,Math.sin(angle+bend+.52)*branch+Math.sin(angle+bend)*reach*.52);ctx.stroke();}
      }
      const heart=ctx.createRadialGradient(0,0,0,0,0,r*.27);heart.addColorStop(0,`rgba(255,238,190,${.62+impact*.38})`);heart.addColorStop(.28,`rgba(207,158,255,${.25+near*.15+impact*.5})`);heart.addColorStop(1,'rgba(136,98,184,0)');ctx.fillStyle=heart;ctx.globalAlpha=alpha*bodyAlpha*(.7+impact*.3);ctx.beginPath();ctx.arc(0,0,r*.29,0,Math.PI*2);ctx.fill();ctx.restore();ctx.restore();
    }
    const fragmentStart=lifecycle==='fracturing'?clamp((progress-.1)/.2,0,1):0;ctx.save();
    for(let i=0;i<14;i++){
      const angle=i*2.399963+seed,variance=.78+.28*Math.sin(i*9.17+seed),orbit=r*(1.14+(i%5)*.105),travel=lifecycle==='fracturing'?r*(.12+progress*2.55*variance):0,distanceFromCenter=orbit+travel,spin=angle+run.time*(lifecycle==='fracturing'?.06:.035+i%3*.007),x=core.x+Math.cos(spin)*distanceFromCenter,y=core.y+Math.sin(spin)*distanceFromCenter*.8,size=(2.2+(i%4)*.85)*(lifecycle==='fracturing'?1+progress*.42:1),rotation=angle+run.time*.13+i,cos=Math.cos(rotation),sin=Math.sin(rotation),bitAlpha=lifecycle==='fracturing'?fragmentStart*(1-progress*.55):.42+near*.15;
      ctx.fillStyle=i%4===0?'#f4dbff':'#ad92c8';ctx.globalAlpha=alpha*bitAlpha;ctx.beginPath();ctx.moveTo(x+cos*size,y+sin*size);ctx.lineTo(x+(-cos*.55+sin*.66)*size,y+(-sin*.55-cos*.66)*size);ctx.lineTo(x+(-cos*.8-sin*.32)*size,y+(-sin*.8+cos*.32)*size);ctx.closePath();ctx.fill();
    }
    ctx.restore();
    ctx.restore();ctx.globalAlpha=1;
  }
  function draw(run,dt,reduced=false){
    const p=run.player,burst=p.boost>0,combustion=p.combustion===true,boost=burst||combustion,fever=Math.min(run.chain/VEIL.feverChain,1),lead=Math.min(p.speed*VEIL.cameraLead,VEIL.cameraMaxLead);
    if(run.returnEffect)run.returnEffect.life=Math.min(run.returnEffect.duration,run.returnEffect.life+dt);
    scale+=(baseScale*(boost&&!reduced?1-VEIL.boostZoom:1)-scale)*(1-Math.exp(-dt*5));
    const target={x:p.x+Math.cos(p.angle)*lead,y:p.y+Math.sin(p.angle)*lead};
    if(fresh){camera=target;fresh=false;}else{const ease=1-Math.exp(-dt*VEIL.cameraEase);camera.x+=(target.x-camera.x)*ease;camera.y+=(target.y-camera.y)*ease;}
    const returnFrame=returnEffectFrame(run.returnEffect),returnCenter=screen(p.x,p.y);ctx.save();
    ctx.globalAlpha=1;ctx.lineWidth=1;ctx.lineCap='butt';
    ctx.drawImage(cloudLayer,-w*.15-Math.sin(camera.x*.0004)*w*.06,-h*.15-Math.sin(camera.y*.00025)*h*.06);
    if(run.map.universe){
      const carbon=clamp((-p.y-3300)/4700,0,1),oxygen=clamp((-p.y-7600)/4000,0,1),nitrogen=clamp((-p.y-12650)/2100,0,1);
      ctx.fillStyle=`rgba(71,31,91,${carbon*(1-oxygen)*.18})`;ctx.fillRect(0,0,w,h);
      ctx.fillStyle=`rgba(103,38,30,${oxygen*(1-nitrogen*.72)*.22})`;ctx.fillRect(0,0,w,h);
      ctx.fillStyle=`rgba(34,66,142,${nitrogen*.20})`;ctx.fillRect(0,0,w,h);
      const visibleHeat=Math.max(run.ambientHeat??0,run.heat??0);if(visibleHeat>0){ctx.fillStyle=`rgba(255,77,38,${Math.min(visibleHeat/100*.12,.12)})`;ctx.fillRect(0,0,w,h);}
    }
    ctx.fillStyle='#aac5d6';
    for(const s of stars){const x=((s.x*w-camera.x*s.z*scale)%w+w)%w,y=((s.y*h-camera.y*s.z*scale)%h+h)%h;ctx.globalAlpha=.14+s.z;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();if(boost&&!reduced){ctx.strokeStyle='#6597b2';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(p.angle)*(55+fever*25)*s.z,y-Math.sin(p.angle)*(55+fever*25)*s.z);ctx.stroke();}}ctx.globalAlpha=1;
    if(!run.map.universe&&run.gatePassed&&run.time-run.gateTime<7){
      const glimpse=screen(-50,-4160),fade=Math.min(1,(run.time-run.gateTime)*1.5)*Math.min(1,(7-run.time+run.gateTime)/2),radius=370*scale;
      const g=ctx.createRadialGradient(glimpse.x,glimpse.y,0,glimpse.x,glimpse.y,radius);g.addColorStop(0,`rgba(173,134,211,${fade*.3})`);g.addColorStop(.45,`rgba(105,109,176,${fade*.18})`);g.addColorStop(1,'rgba(83,102,157,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<48;i++){const a=i*2.399,r=Math.sqrt(i/48)*radius*.7;glow(glimpse.x+Math.cos(a)*r,glimpse.y+Math.sin(a)*r*.48,12*scale,'rare',fade*.7);}
    }
    const sites=run.map.safeExtractionSites??[],carryingInsight=(run.carriedInsights?.length??0)>0,nitrogenField=!!run.map.nitrogenCore&&!nitrogenCoreIsGone(run.map.nitrogenCore,run.time),returnAvailable=!run.captured&&!run.returnEffect&&(carryingInsight||isInsideSafeExtractionSite(p,sites)),nearestSite=!carryingInsight&&!nitrogenField?[...sites].sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0]:null;
    for(const site of sites)drawSafeExtractionSite(site,run.time,reduced,site.id===nearestSite?.id);
    const distantCore=run.map.nitrogenCore,coreDistance=distantCore?Math.hypot(distantCore.x-p.x,distantCore.y-p.y):Infinity;
    drawDistantNitrogenCore(run,distantCore,coreDistance,reduced);
    ctx.save();ctx.translate(w/2-camera.x*scale,h/2-camera.y*scale);ctx.scale(scale,scale);
    if(run.map.universe){
      // Broad moving strata make Oxygen Surge a hot, fast environment rather
      // than another set of recoloured dots. They are readable from outside.
      const top=-11780,bottom=-8830;
      const heatFog=ctx.createRadialGradient(80,(top+bottom)/2,50,80,(top+bottom)/2,1700);
      heatFog.addColorStop(0,'rgba(167,55,35,.17)');heatFog.addColorStop(.7,'rgba(105,34,40,.07)');heatFog.addColorStop(1,'rgba(70,30,50,0)');ctx.fillStyle=heatFog;ctx.fillRect(-1250,top-250,2600,bottom-top+500);
      for(let i=0;i<18;i++){
        const y=bottom-(i+.5)*(bottom-top)/18,wave=Math.sin(run.time*(.7+i%3*.12)+i)*38;
        ctx.strokeStyle=i%3===0?'#a95344':'#6f3c50';ctx.globalAlpha=.08+(i%4===0?.08:0);ctx.lineWidth=i%4===0?3:1;
        ctx.beginPath();for(let j=0;j<=22;j++){const x=-1250+j/22*2600,yy=y+Math.sin(x*.006+i*.8+run.time*1.3)*18+wave;j?ctx.lineTo(x,yy):ctx.moveTo(x,yy);}ctx.stroke();
      }ctx.globalAlpha=1;
    }
    if(run.map.universe){
      drawChallengeCurrents(ctx,run.time,run.map.seed??1);
      for(const route of OXYGEN_ROUTES){
        ctx.strokeStyle=route.color;ctx.lineWidth=2;ctx.globalAlpha=.22;
        ctx.beginPath();route.knots.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
        const bands=route.gates.length?route.gates:Array.from({length:14},(_,i)=>({y:-8910-i*110,depth:60,pressure:route.pressure}));
        for(const [bandIndex,gate] of bands.entries()){
          if(route.restStops?.some(stop=>Math.abs(gate.y-stop.y)<stop.depth/2+gate.depth/2))continue;
          const localized=route.gates.length?oxygenGateEnvelopeAt(route,gate,{x:route.x,y:gate.y},run.map.seed??1,bandIndex):null,visualHalfWidth=localized?.halfWidth??route.width/2,visualCenter=localized?.center??route.x,left=visualCenter-visualHalfWidth,visualWidth=visualHalfWidth*2,pressure=clamp((gate.pressure??route.pressure)/600,0,1),depth=Math.max(28,gate.depth*1.45),strands=reduced?4:7;
          ctx.save();ctx.beginPath();ctx.rect(left-12,gate.y-depth/2,visualWidth+24,depth);ctx.clip();ctx.strokeStyle=route.color;ctx.lineCap='round';
          for(let i=0;i<strands;i++){
            const lane=(i+.5)/strands,x=left+lane*visualWidth,sway=Math.sin(run.time*.9+i*1.7+gate.y*.013)*8,phase=reduced?0:((run.time*(34+pressure*24)+bandIndex*17+i*11)%depth)-depth/2;
            ctx.globalAlpha=.07+pressure*.11+(i%3===0?.045:0);ctx.lineWidth=.8+pressure*.9;
            ctx.beginPath();ctx.moveTo(x+sway-7,gate.y-depth*.7+phase*.18);ctx.bezierCurveTo(x-sway*.35+5,gate.y-depth*.2,x+sway*.45-4,gate.y+depth*.18,x-sway+7,gate.y+depth*.7+phase*.18);ctx.stroke();
          }
          const grains=reduced?3:6;ctx.fillStyle=route.color;
          for(let i=0;i<grains;i++){
            const phase=(run.time*(.64+pressure*.5)+i*.173+bandIndex*.097)%1,x=left+visualWidth*(.1+((i*.31+bandIndex*.19)%1)*.8)+Math.sin(run.time*1.3+i)*5,y=gate.y-depth*.55+phase*depth*1.1;
            ctx.globalAlpha=Math.sin(phase*Math.PI)*(.12+pressure*.24);ctx.beginPath();ctx.ellipse(x,y,.8+pressure*.55,3+pressure*3,0,0,Math.PI*2);ctx.fill();
          }
          ctx.restore();
        }
        for(const stop of route.restStops??[]){
          const radius=route.width*.62,calm=ctx.createRadialGradient(route.x,stop.y,0,route.x,stop.y,radius);calm.addColorStop(0,'rgba(106,178,203,.11)');calm.addColorStop(.7,'rgba(79,142,169,.045)');calm.addColorStop(1,'rgba(55,102,131,0)');ctx.fillStyle=calm;ctx.fillRect(route.x-radius,stop.y-radius,2*radius,2*radius);
          ctx.strokeStyle='#79b8cc';ctx.globalAlpha=.12;ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(route.x,stop.y,radius*(.35+i*.18),radius*(.13+i*.055),run.time*.08+i*.8,0,Math.PI*1.75);ctx.stroke();}
        }
      }
      // Reward convergence is shown as oxygen-colored motes physically streaming inward, not a marker glyph.
      const rewardGlow=ctx.createRadialGradient(OXYGEN_REWARD.x,OXYGEN_REWARD.y,0,OXYGEN_REWARD.x,OXYGEN_REWARD.y,OXYGEN_REWARD.radius*1.2);rewardGlow.addColorStop(0,'rgba(255,148,77,.16)');rewardGlow.addColorStop(1,'rgba(255,148,77,0)');ctx.fillStyle=rewardGlow;ctx.fillRect(OXYGEN_REWARD.x-OXYGEN_REWARD.radius*1.2,OXYGEN_REWARD.y-OXYGEN_REWARD.radius*1.2,OXYGEN_REWARD.radius*2.4,OXYGEN_REWARD.radius*2.4);for(let i=0;i<9;i++){const phase=(run.time*.18+i/9)%1,r=OXYGEN_REWARD.radius*(1.05-phase*.82),a=i*2.399+run.time*.12;ctx.globalAlpha=.16+phase*.48;ctx.fillStyle='#ff944d';ctx.beginPath();ctx.arc(OXYGEN_REWARD.x+Math.cos(a)*r,OXYGEN_REWARD.y+Math.sin(a)*r,1.5+phase*2.1,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    }
    if(run.map.universe&&run.map.worldState===ELECTRICAL_FIELD.worldState){
      for(const sample of ELECTRICAL_VISUAL_SAMPLES){
        const effective=electricalEffectiveAt(sample,run.map.worldState),density=clamp(effective*(reduced?.58:1.05),0,1);if(effective<=0||sample.threshold>density)continue;
        const at=screen(sample.x,sample.y);if(at.x<-55||at.x>w+55||at.y<-55||at.y>h+55)continue;
        const radius=9+effective*18,corona=ctx.createRadialGradient(sample.x,sample.y,0,sample.x,sample.y,radius);corona.addColorStop(0,`rgba(168,205,255,${.035+effective*.075})`);corona.addColorStop(1,'rgba(134,157,226,0)');ctx.fillStyle=corona;ctx.fillRect(sample.x-radius,sample.y-radius,radius*2,radius*2);
        const cycle=(run.time*(.58+effective*.9)+sample.phase)%1,window=.035+effective*.085;if(reduced||cycle>window)continue;
        const flash=1-cycle/window,length=7+effective*15,a=sample.angle+Math.sin(run.time*.7+sample.phase*6.28)*.18,dx=Math.cos(a)*length,dy=Math.sin(a)*length,mx=sample.x+dx*.48+Math.sin(sample.phase*17)*3,my=sample.y+dy*.48+Math.cos(sample.phase*13)*3;
        ctx.strokeStyle='#bed7ff';ctx.globalAlpha=(.09+effective*.35)*flash;ctx.lineWidth=.55+effective*.55;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sample.x-dx*.18,sample.y-dy*.18);ctx.lineTo(mx,my);ctx.lineTo(sample.x+dx,sample.y+dy);ctx.stroke();
        if(sample.threshold<effective*.42){ctx.globalAlpha*=.72;ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx-Math.sin(a)*(4+effective*5)+dx*.18,my+Math.cos(a)*(4+effective*5)+dy*.18);ctx.stroke();}
      }
      ctx.globalAlpha=1;
    }
    if(run.map.universe&&run.map.worldState===ABRASIVE_PLUME.worldState){
      const direction=ABRASIVE_PLUME.direction;
      for(const sample of ABRASIVE_VISUAL_SAMPLES){
        const effective=abrasiveEffectiveAt(sample,run.map.worldState),density=clamp(effective*(reduced?.7:1.1),0,1);if(effective<=0||sample.threshold>density)continue;
        const offset=Math.sin(run.time*(1.2+effective)+sample.phase*Math.PI*2)*(10+effective*18),x=sample.x+direction.x*offset,y=sample.y+direction.y*offset,at=screen(x,y);if(at.x<-40||at.x>w+40||at.y<-40||at.y>h+40)continue;
        const length=5+effective*13;ctx.strokeStyle='#b8b19d';ctx.globalAlpha=.045+effective*.23;ctx.lineWidth=.7+effective*.75;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-direction.x*length,y-direction.y*length);ctx.lineTo(x,y);ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    if(run.map.universe&&run.map.nitrogenHazards?.length){
      // Local hazard wisps use the same spatial and post-Awakening authority as gameplay.
      for(const visual of run.map.nitrogenVisuals??[]){
        const item=run.map.nitrogenHazards.find(hazard=>hazard.id===visual.hazardId);if(!item)continue;
        const effective=Math.min(1.25,nitrogenVisualEffectiveAt(item,visual,run.time,{worldState:run.map.worldState}).scale),pulse=.82+.18*Math.sin(run.time*.7+visual.phase),alpha=effective*pulse,radius=(item.type==='thermal'?145:118)*(.75+effective*.55);
        if(alpha<.035)continue;
        if(visual.x+radius<camera.x-w/(2*scale)||visual.x-radius>camera.x+w/(2*scale)||visual.y+radius<camera.y-h/(2*scale)||visual.y-radius>camera.y+h/(2*scale))continue;
        const fog=ctx.createRadialGradient(visual.x,visual.y,1,visual.x,visual.y,radius);
        if(item.type==='thermal'){fog.addColorStop(0,`rgba(235,116,80,${.11*alpha})`);fog.addColorStop(1,'rgba(200,83,56,0)');}
        else{fog.addColorStop(0,`rgba(124,147,225,${.12*alpha})`);fog.addColorStop(1,'rgba(72,98,160,0)');}
        ctx.fillStyle=fog;ctx.fillRect(visual.x-radius,visual.y-radius,radius*2,radius*2);
        if(!reduced&&item.type!=='thermal'){ctx.save();ctx.translate(visual.x,visual.y);ctx.rotate(item.angle??0);ctx.strokeStyle='#91a9df';ctx.globalAlpha=.08+.16*alpha;ctx.lineWidth=.7+effective;ctx.beginPath();ctx.moveTo(-45,0);ctx.quadraticCurveTo(0,Math.sin(run.time+visual.phase)*16,45,0);ctx.stroke();ctx.restore();ctx.globalAlpha=1;}
      }
      const core=run.map.nitrogenCore;
      drawNitrogenCore(run,core,coreDistance);
    }
    if(run.map.universe){
      const d=CHO_DESTINATION,pulse=1+Math.sin(run.time*1.7)*.035,radius=d.radius*pulse;ctx.save();
      const halo=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,radius*1.75);halo.addColorStop(0,run.destinationReached?'rgba(183,245,201,.18)':'rgba(244,211,139,.16)');halo.addColorStop(.5,run.destinationReached?'rgba(143,222,174,.08)':'rgba(212,167,95,.07)');halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.fillRect(d.x-radius*1.8,d.y-radius*1.8,radius*3.6,radius*3.6);
      ctx.strokeStyle=run.destinationReached?'#bff5c9':'#f4d38b';ctx.lineCap='round';for(let i=0;i<3;i++){const r=radius*(.76+i*.22),spin=run.time*(i%2?-.24:.18)+i*2.15;ctx.globalAlpha=.2+i*.09;ctx.lineWidth=1.2+i*.45;ctx.beginPath();ctx.arc(d.x,d.y,r,spin,spin+Math.PI*(.92+i*.11));ctx.stroke();}
      ctx.globalAlpha=run.destinationReached?.6:.38;ctx.fillStyle=run.destinationReached?'#d9ffe3':'#ffe8b3';ctx.beginPath();ctx.arc(d.x,d.y,4.5+Math.sin(run.time*2.4)*1.2,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // Route lines remain as environmental structure; symbolic arrows and labels are intentionally omitted.
    for(const route of run.map.routes){if(route.nitrogen===true)continue;const element=route.element??'H',color=element==='C'?'#54345f':element==='N'?'#315c9f':element==='O'?'#70433d':route.kind==='dense'?'#214f62':'#142e40';ctx.beginPath();route.points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle=color;ctx.lineWidth=element==='O'?1.8:1.2;ctx.globalAlpha=element==='O'?.8:1;ctx.stroke();ctx.globalAlpha=1;}
    // Wisps travel in the direction of the force: no collision outlines or debug rings.
    for(const f of run.map.fields){
      const r=f.radius;if(f.x+r<camera.x-w/(2*scale)||f.x-r>camera.x+w/(2*scale)||f.y+r<camera.y-h/(2*scale)||f.y-r>camera.y+h/(2*scale))continue;
      const intensity=f.effectiveIntensity??f.intensity??.7,forceCue=clamp(Math.sqrt((f.effectiveForce??f.force??VEIL.fieldForce)/VEIL.fieldForce),1,1.9);
      const fog=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
      const burstField=f.kind==='burst-advantage';fog.addColorStop(0,burstField?`rgba(205,151,255,${.14+intensity*.12})`:`rgba(136,136,220,${.09+intensity*.06})`);fog.addColorStop(1,burstField?'rgba(138,84,206,0)':'rgba(88,117,169,0)');
      ctx.fillStyle=fog;ctx.fillRect(f.x-r,f.y-r,r*2,r*2);
      ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle??.15);
      for(let i=0;i<13;i++){
        const band=(i-6)*r/9,span=Math.sqrt(Math.max(0,r*r-band*band));
        const wave=(x)=>band+Math.sin(x/r*3+i*.65-run.time*.65)*r*.065*Math.sin((x/span+1)*Math.PI/2);
        ctx.strokeStyle=burstField?'#d7b2ff':'#889bc3';ctx.lineWidth=(i%3===0?2:1)*forceCue;ctx.globalAlpha=Math.min(.5,(burstField?.16:.09)+intensity*.12)*forceCue*(1-Math.abs(band)/r);
        ctx.beginPath();for(let j=0;j<=28;j++){const x=-span+j/28*span*2;j?ctx.lineTo(x,wave(x)):ctx.moveTo(x,wave(x));}ctx.stroke();
        for(let j=0;j<3;j++){const phase=(run.time*(.16+intensity*.08)+i*.073+j/3)%1,x=(phase*2-1)*span,y=wave(x);
          ctx.globalAlpha=Math.sin(phase*Math.PI)*(.24+intensity*.22);ctx.fillStyle=burstField?'#efdcff':'#a2b9e0';ctx.beginPath();ctx.ellipse(x,y,3.8,1.2,0,0,Math.PI*2);ctx.fill();}
      }
      if(burstField){ctx.strokeStyle='#f0d8ff';ctx.globalAlpha=.42;ctx.lineWidth=1.4;for(let i=0;i<3;i++){const radius=r*(.34+i*.24),phase=run.time*.48+i*2.09;ctx.beginPath();ctx.ellipse(0,0,radius,radius*.7,phase,0,Math.PI*1.62);ctx.stroke();}}
      ctx.globalAlpha=1;ctx.restore();
    }
    const gate=VEIL.gate;
    const veil=ctx.createRadialGradient(gate.x,gate.y,0,gate.x,gate.y,gate.width*.7);
    veil.addColorStop(0,'rgba(115,149,200,.13)');veil.addColorStop(1,'rgba(59,96,141,0)');ctx.fillStyle=veil;ctx.fillRect(gate.x-gate.width,gate.y-gate.width,gate.width*2,gate.width*2);
    for(let i=0;i<16;i++){
      const offset=(i-7.5)*15;ctx.strokeStyle='#82adc2';ctx.globalAlpha=.06+Math.sin(i*.67)**2*.14;ctx.lineWidth=i%4===0?2:1;
      ctx.beginPath();for(let j=0;j<=32;j++){const t=j/32,x=gate.x-gate.width*.7+t*gate.width*1.4,y=gate.y+offset+Math.sin(t*4+i*.16+run.time*.25)*24+(t-.5)**2*110;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
      const t=(run.time*.32+i*.113)%1;ctx.globalAlpha=Math.sin(t*Math.PI)*.35;ctx.fillStyle='#b3e4f1';ctx.beginPath();ctx.ellipse(gate.x-gate.width*.7+t*gate.width*1.4,gate.y+offset+Math.sin(t*4+i*.16+run.time*.25)*24+(t-.5)**2*110,5,1.1,0,0,Math.PI*2);ctx.fill();
    }ctx.globalAlpha=1;
    if(run.map.universe){
      for(const cluster of run.map.clusters){
        const intact=cluster.ready<=run.time,pulse=1+Math.sin(run.time*2.2+cluster.phase)*.08,age=run.time-cluster.burstAt;
        if(!intact&&age>1.3)continue;
        const radius=(intact?cluster.radius:cluster.radius*(1+Math.max(0,age)*1.2))*pulse,alpha=intact?.22:Math.max(0,.28-age*.2);
        const cloud=ctx.createRadialGradient(cluster.x,cluster.y,4,cluster.x,cluster.y,radius*1.4);cloud.addColorStop(0,`rgba(221,168,255,${alpha})`);cloud.addColorStop(.45,`rgba(142,82,171,${alpha*.65})`);cloud.addColorStop(1,'rgba(91,48,119,0)');ctx.fillStyle=cloud;ctx.fillRect(cluster.x-radius*1.5,cluster.y-radius*1.5,radius*3,radius*3);
        if(intact){
          // A carbon landmark reads as a packed, breakable mass. Its many
          // shards are visual only; entering the radius releases real dust.
          for(let i=0;i<26;i++){const a=i*2.399+cluster.phase,r=Math.sqrt((i+.5)/26)*radius*.72,x=cluster.x+Math.cos(a)*r,y=cluster.y+Math.sin(a)*r*.72,size=1.8+(i%5)*.55;ctx.save();ctx.translate(x,y);ctx.rotate(a+i*.37);ctx.fillStyle=i%4===0?'#eedaff':'#bb89d0';ctx.globalAlpha=.34+(i%3)*.13;ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*.7,-size*.55);ctx.lineTo(-size*.45,size*.75);ctx.closePath();ctx.fill();ctx.restore();}
          ctx.strokeStyle='#b77ecb';ctx.globalAlpha=.14;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(cluster.x+Math.cos(cluster.phase+i)*8,cluster.y+Math.sin(cluster.phase+i)*6,radius*(.4+i*.12),radius*(.2+i*.08),cluster.phase+i*.7,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
        }
      }
      for(const signal of run.map.signals)if(!signal.ready&&signal.claimable===true){
        // Signals read as emission: a live core plus paired wavefronts, never an abstract triangle marker.
        const pulse=(run.time*.7)%1,core=ctx.createRadialGradient(signal.x,signal.y,0,signal.x,signal.y,14);core.addColorStop(0,'rgba(241,210,139,.8)');core.addColorStop(.22,'rgba(241,210,139,.3)');core.addColorStop(1,'rgba(241,210,139,0)');ctx.fillStyle=core;ctx.globalAlpha=.8;ctx.fillRect(signal.x-14,signal.y-14,28,28);ctx.fillStyle='#f1d28b';ctx.beginPath();ctx.arc(signal.x,signal.y,2.6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f1d28b';ctx.lineWidth=1.3;for(let wave=0;wave<3;wave++){const phase=(pulse+wave/3)%1,radius=9+phase*42;ctx.globalAlpha=(1-phase)*.36;ctx.beginPath();ctx.arc(signal.x,signal.y,radius,-.72,.72);ctx.stroke();ctx.beginPath();ctx.arc(signal.x,signal.y,radius,Math.PI-.72,Math.PI+.72);ctx.stroke();}ctx.globalAlpha=1;
      }
      const horizon=ctx.createRadialGradient(100,-12200,0,100,-12200,470);horizon.addColorStop(0,'rgba(238,218,255,.36)');horizon.addColorStop(.22,'rgba(181,135,215,.15)');horizon.addColorStop(1,'rgba(103,68,143,0)');ctx.fillStyle=horizon;ctx.fillRect(-420,-12720,1040,1040);
    }
    ctx.restore();
    for(const dust of run.map.dust){
      if(dust.ready>run.time)continue;const q=screen(dust.x,dust.y);if(q.x<-35||q.x>w+35||q.y<-35||q.y>h+35)continue;const pureH=dust.kind==='rare'&&(dust.element??'H')==='H',element=dust.element??'H',ecology=dust.rareEcology===true?RARE_ECOLOGY_VISUALS[element]:null,kind=ecology?.sprite??(pureH?'rare':element==='C'?'carbon':element==='N'?'nitrogen':element==='O'?'oxygen':dust.kind);
      if(dust.flow&&!reduced){ctx.strokeStyle=element==='O'?'#d86d58':'#679caf';ctx.globalAlpha=.25;ctx.lineWidth=1.2*scale;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-Math.cos(dust.angle)*18*scale,q.y-Math.sin(dust.angle)*18*scale);ctx.stroke();ctx.globalAlpha=1;}
      glow(q.x,q.y,(ecology?44:pureH?38:element==='C'?28:element==='N'?27:element==='O'?25:22)*scale,kind);
      if(element==='C'&&!ecology){ctx.save();ctx.translate(q.x,q.y);ctx.rotate(dust.angle+dust.id*.7);ctx.fillStyle='#e7c8ff';ctx.beginPath();ctx.moveTo(4*scale,0);ctx.lineTo(-3*scale,-3*scale);ctx.lineTo(-2*scale,3*scale);ctx.closePath();ctx.fill();ctx.restore();}
      else{ctx.fillStyle=ecology?.color??(pureH?'#ffe2a1':element==='N'?'#93c5fd':element==='O'?'#ffd2bd':'#d1f5ff');ctx.beginPath();ctx.arc(q.x,q.y,(ecology?3.8:pureH?4:element==='N'?3.2:element==='O'?3:2.5)*scale,0,Math.PI*2);ctx.fill();}
      if(pureH||ecology){ctx.strokeStyle=ecology?.color??'#c7ab76';ctx.globalAlpha=ecology?.72:1;ctx.lineWidth=ecology?1.2*scale:1;ctx.beginPath();ctx.arc(q.x,q.y,(ecology?11:12)*scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    }
    for(const wave of run.shockWaves??[]){const at=screen(wave.x,wave.y),progress=clamp(wave.life/wave.duration,0,1),radius=wave.radius*scale*smoothstep(progress),alpha=(1-progress)*(wave.coreFracture?.9:.72),tnt=wave.material==='2-4-6-trinitrotoluene';ctx.save();ctx.strokeStyle=wave.coreFracture?'#e3d2ff':tnt?'#ffd5a6':'#a7eff5';ctx.globalAlpha=alpha;ctx.lineWidth=(wave.coreFracture?3.2:tnt?2.6:1.8)*scale;ctx.beginPath();ctx.arc(at.x,at.y,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=alpha*.42;ctx.lineWidth=1*scale;ctx.beginPath();ctx.arc(at.x,at.y,radius*.78,0,Math.PI*2);ctx.stroke();ctx.restore();}
    // Dust eaters are self-organising particle vortices: a light-swallowing
    // core, orbiting grains and a wake, never a face or biological silhouette.
    for(const eater of run.eaters??[]){
      const at=screen(eater.x,eater.y),pulse=1+Math.sin(run.time*3.1+eater.phase)*.1,radius=27*pulse*scale;
      if(at.x<-90||at.x>w+90||at.y<-90||at.y>h+90)continue;
      if(!reduced&&eater.trail.length>1){ctx.strokeStyle='#422d4e';ctx.globalAlpha=.34;ctx.lineWidth=9*scale;ctx.lineCap='round';ctx.beginPath();for(const [i,point]of eater.trail.entries()){const t=screen(point.x,point.y);i?ctx.lineTo(t.x,t.y):ctx.moveTo(t.x,t.y);}ctx.stroke();ctx.globalAlpha=1;}
      const voidGlow=ctx.createRadialGradient(at.x,at.y,2,at.x,at.y,radius*2.2);voidGlow.addColorStop(0,'rgba(1,3,9,.98)');voidGlow.addColorStop(.28,'rgba(18,11,27,.92)');voidGlow.addColorStop(.62,'rgba(86,46,96,.28)');voidGlow.addColorStop(1,'rgba(97,58,112,0)');ctx.fillStyle=voidGlow;ctx.fillRect(at.x-radius*2.3,at.y-radius*2.3,radius*4.6,radius*4.6);
      ctx.save();ctx.translate(at.x,at.y);ctx.rotate(run.time*.55+eater.phase);for(let i=0;i<16;i++){const a=i*2.399+Math.sin(run.time*.7+i)*.08,r=radius*(.7+(i%5)*.22);ctx.fillStyle=i%4===0?'#9872a5':'#5e526f';ctx.globalAlpha=.24+(i%3)*.12;ctx.beginPath();ctx.ellipse(Math.cos(a)*r,Math.sin(a)*r*.72,2.2*scale,1*scale,a,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#80628c';ctx.globalAlpha=.26;ctx.lineWidth=1.2*scale;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,radius*(1+i*.34),radius*(.48+i*.2),i*.8,0,Math.PI*1.72);ctx.stroke();}ctx.restore();ctx.globalAlpha=1;
    }
    for(const e of run.effects){
      const q=screen(e.x,e.y),ecology=e.rareEcology?RARE_ECOLOGY_VISUALS[e.element]:null;ctx.strokeStyle=ecology?.color??(e.kind==='rare'?'#edd099':e.kind==='carbon'?'#d7a9ef':e.kind==='nitrogen'?'#60a5fa':e.kind==='oxygen'?'#ffad8f':'#9eeaff');ctx.globalAlpha=(1-e.life/e.duration)*.7;ctx.lineWidth=(1+fever*.7)*scale;
      ctx.beginPath();(e.trail??[]).forEach((point,i)=>{const at=screen(point.x,point.y);i?ctx.lineTo(at.x,at.y):ctx.moveTo(at.x,at.y);});ctx.lineTo(q.x,q.y);ctx.stroke();ctx.globalAlpha=1;glow(q.x,q.y,(ecology?26:20)*scale,ecology?.sprite??e.kind);
    }
    const captureTarget=run.eaters?.find(eater=>eater.id===run.forcedReturn?.eaterId)??null;
    for(const particle of run.lostCargoEffects??[]){
      advanceForcedLossParticle(particle,captureTarget,dt,reduced);
      const ecology=RARE_ECOLOGY_VISUALS[particle.element],alpha=forcedLossParticleAlpha(particle),at=screen(particle.x,particle.y),kind=ecology?.sprite??(particle.element==='C'?'carbon':particle.element==='N'?'nitrogen':particle.element==='O'?'oxygen':'normal'),color=ecology?.color??(particle.element==='C'?'#e7c8ff':particle.element==='N'?'#93c5fd':particle.element==='O'?'#ffd2bd':'#d1f5ff');
      if(!reduced){ctx.strokeStyle=color;ctx.globalAlpha=alpha*.38;ctx.lineWidth=1.4*scale;ctx.beginPath();ctx.moveTo(at.x-particle.vx*.045*scale,at.y-particle.vy*.045*scale);ctx.lineTo(at.x,at.y);ctx.stroke();}
      glow(at.x,at.y,(particle.element==='C'?28:24)*scale,kind,alpha*.82);ctx.save();ctx.translate(at.x,at.y);ctx.rotate(particle.spin*particle.life);ctx.fillStyle=color;ctx.globalAlpha=alpha;if(particle.element==='C'){ctx.beginPath();ctx.moveTo(4*scale,0);ctx.lineTo(-3*scale,-3*scale);ctx.lineTo(-2*scale,3*scale);ctx.closePath();ctx.fill();}else{ctx.beginPath();ctx.arc(0,0,(particle.element==='O'?3:2.5)*scale,0,Math.PI*2);ctx.fill();}ctx.restore();ctx.globalAlpha=1;
    }
    if(run.lostCargoEffects)run.lostCargoEffects=run.lostCargoEffects.filter(particle=>particle.life<particle.duration);
    for(const particle of run.lostInsightEffects??[]){
      advanceForcedLossParticle(particle,captureTarget,dt,reduced);const progress=clamp(particle.life/particle.duration,0,1),alpha=forcedLossParticleAlpha(particle),at=screen(particle.x,particle.y),size=Math.max(12,24*scale)*(1-progress*.38);
      drawInsightBulb(at.x,at.y,size,particle.color??INSIGHT_CATEGORY_COLORS.general,alpha,reduced?0:particle.spin*particle.life*.22);
    }
    if(run.lostInsightEffects)run.lostInsightEffects=run.lostInsightEffects.filter(particle=>particle.life<particle.duration);
    const q=screen(p.x,p.y);
    if(!reduced)for(let i=1;i<p.trail.length;i++){const a=screen(p.trail[i-1].x,p.trail[i-1].y),b=screen(p.trail[i].x,p.trail[i].y);ctx.strokeStyle=combustion?'#ffb27d':boost?'#baf5ff':'#70aec7';ctx.globalAlpha=i/p.trail.length*(boost?.7:.3);ctx.lineWidth=(boost?9:4)*scale*i/p.trail.length;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.globalAlpha=1;
    if(boost&&!reduced){
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.angle);ctx.strokeStyle=combustion?'#ffd09d':'#b3edff';
      for(let i=0;i<6;i++){const side=i%2?1:-1,offset=(35+i*7)*scale;ctx.globalAlpha=.12;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-100*scale,offset*side);ctx.quadraticCurveTo(0,offset*side,65*scale,offset*side*.45);ctx.stroke();}ctx.restore();ctx.globalAlpha=1;
    }
    if(boost){ctx.strokeStyle=combustion?'#e69b77':'#8bd9ea';ctx.globalAlpha=.09+fever*.05;ctx.lineWidth=1;ctx.beginPath();ctx.arc(q.x,q.y,(run.config.suctionRadius+(p.drive?.boostRadius??0)+Math.sin(run.time*4)*2)*scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    if(returnAvailable){ctx.strokeStyle='#d7f6ff';ctx.globalAlpha=.4;ctx.lineWidth=1.1*scale;ctx.beginPath();ctx.arc(q.x,q.y,24*scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    ctx.save();if(returnFrame.mode?.endsWith('-warp')&&!reduced&&returnFrame.warp>0){ctx.translate(q.x,q.y);ctx.rotate(Math.sin(returnFrame.progress*Math.PI*2)*returnFrame.warp*.55);ctx.scale(1+returnFrame.warp,1-returnFrame.warp*.66);ctx.translate(-q.x,-q.y);}
    glow(q.x,q.y,(boost?combustion?112:132:65+fever*12)*scale,combustion?'oxygen':'player',.85);
    // The controlled body is a field-held Collector Shell, not a conventional
    // ship: a spherical gathering aperture rides inside a visible anchor halo.
    drawCollectorShell(ctx,{x:q.x,y:q.y,angle:p.angle,scale,bank:p.bank??0});ctx.restore();
    // Navigation is carried by the field geometry itself; avoid symbolic C/O/arrow signage on the playfield.
    if(run.gatePassed){const alpha=Math.max(0,1-(run.time-(run.gateTime??run.time))/6);ctx.fillStyle=`rgba(151,194,224,${alpha*.08})`;ctx.fillRect(0,0,w,h);}
    if(run.danger!=='clear'){const alpha=run.danger==='danger'?.18:.08,vignette=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.22,w/2,h/2,Math.max(w,h)*.72);vignette.addColorStop(0,'rgba(45,10,35,0)');vignette.addColorStop(1,`rgba(74,18,48,${alpha})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);}
    ctx.restore();if(run.returnEffect)drawReturnEffect(run.returnEffect,returnCenter,reduced);
  }
  resize();return {draw,resize,screen,
    beginReturn(run,mode){run.returnEffect=createReturnEffect(mode);return run.returnEffect?.duration??0;},
    beginWarp(run,mode){run.returnEffect=createReturnEffect(mode==='emergency'?'emergency-warp':'stable-warp');return run.returnEffect?.duration??0;},
    beginForcedReturn(run,{lost={},insights=[]}={}){
      if(!run?.forcedReturn)return 0;
      if(run.forcedReturn.presentationStarted)return run.returnEffect?.duration??RETURN_EFFECTS.emergency.duration;
      run.forcedReturn.presentationStarted=true;run.lostCargoEffects=createLostCargoParticles(lost,run.player,rng);run.lostInsightEffects=createLostInsightParticles(insights,run.player,rng);run.returnEffect=createReturnEffect('emergency');return run.returnEffect.duration;
    },
    scatterLostCargo(run,lost){run.lostCargoEffects=createLostCargoParticles(lost,run.player,rng);return run.lostCargoEffects.length;},
    reset(){fresh=true;},get size(){return {w,h,scale};}};
}
