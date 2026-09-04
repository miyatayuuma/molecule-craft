import { VEIL, EXPEDITION } from './config.js';
import { random } from './map.js';
import { clamp } from './engine.js';
import { drawCollectorShell } from './collector-shell.js';
export const LOST_CARGO_PARTICLE_CAP=36;
export const RETURN_EFFECTS=Object.freeze({stable:Object.freeze({duration:EXPEDITION.anchorLockSeconds}),emergency:Object.freeze({duration:.65})});
const LOST_CARGO_ELEMENTS=['H','C','O'];
const easeOutCubic=t=>1-(1-t)**3;
const smoothstep=t=>t*t*(3-2*t);
export function createReturnEffect(mode){const config=RETURN_EFFECTS[mode];if(!config)return null;return {mode,life:0,duration:config.duration};}
export function returnEffectFrame(effect){
  const progress=clamp((effect?.life??0)/(effect?.duration||1),0,1);
  if(effect?.mode==='stable')return {mode:'stable',progress,collapse:smoothstep(progress),warp:0};
  if(effect?.mode==='emergency'){const collapse=easeOutCubic(clamp((progress-.16)/.84,0,1)),warp=Math.sin(clamp(progress/.3,0,1)*Math.PI)*.032;return {mode:'emergency',progress,collapse,warp};}
  return {mode:null,progress:0,collapse:0,warp:0};
}
export function lostCargoParticleCounts(lost,cap=LOST_CARGO_PARTICLE_CAP){
  const weights=LOST_CARGO_ELEMENTS.map(element=>({element,amount:Number.isSafeInteger(lost?.[element])&&lost[element]>0?lost[element]:0})).filter(item=>item.amount>0);
  const total=weights.reduce((sum,item)=>sum+item.amount,0),target=Math.min(Math.max(0,Math.floor(cap)),total);if(!target)return {H:0,C:0,O:0};
  if(total<=target)return Object.fromEntries(LOST_CARGO_ELEMENTS.map(element=>[element,lost[element]??0]));
  const counts={H:0,C:0,O:0},reserved=Math.min(target,weights.length);for(let i=0;i<reserved;i++)counts[weights[i].element]=1;
  const remaining=target-reserved,shares=weights.map(item=>{const exact=item.amount/total*remaining,floor=Math.floor(exact);counts[item.element]+=floor;return {...item,remainder:exact-floor};});
  let unassigned=target-Object.values(counts).reduce((sum,n)=>sum+n,0);shares.sort((a,b)=>b.remainder-a.remainder||b.amount-a.amount||LOST_CARGO_ELEMENTS.indexOf(a.element)-LOST_CARGO_ELEMENTS.indexOf(b.element));
  for(let i=0;i<unassigned;i++)counts[shares[i%shares.length].element]++;
  return counts;
}
export function createLostCargoParticles(lost,origin,rng=Math.random){
  const counts=lostCargoParticleCounts(lost),particles=[];
  for(const element of LOST_CARGO_ELEMENTS)for(let i=0;i<counts[element];i++){
    const angle=rng()*Math.PI*2,speed=150+rng()*135,offset=4+rng()*10;
    particles.push({element,x:origin.x+Math.cos(angle)*offset,y:origin.y+Math.sin(angle)*offset,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:0,duration:.48+rng()*.14,spin:(rng()-.5)*9});
  }
  return particles;
}
export function createVeilRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas 2D unavailable');
  let w=1,h=1,scale=1,baseScale=1,camera={x:0,y:0},fresh=true;
  const rng=random(17),stars=Array.from({length:170},()=>({x:rng(),y:rng(),r:.3+rng()*1.1,z:.05+rng()*.2}));
  const sprites={},cloudLayer=document.createElement('canvas');
  for(const [name,color]of Object.entries({normal:'147,225,255',dense:'186,245,255',rare:'255,220,152',carbon:'207,154,255',oxygen:'255,157,119',signal:'255,230,155',horizon:'230,204,255',player:'163,235,255'})){
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
  function drawReturnEffect(effect,center,reduced){
    const frame=returnEffectFrame(effect),p=frame.progress,collapse=frame.collapse,maxRadius=Math.hypot(w,h)*.62;
    if(frame.mode==='stable'){
      if(!reduced)for(let i=0;i<18;i++){const delay=(i%6)*.025,local=easeOutCubic(clamp((p-delay)/(1-delay),0,1)),angle=i*2.399+(1-local)*.32,radius=maxRadius*(.34+(i%5)*.055)*(1-local)+5;glow(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius,12+(i%3)*3,i%5===0?'rare':'normal',Math.sin(local*Math.PI)*.72);}
      for(let i=0;i<3;i++){const local=easeOutCubic(clamp((p-i*.06)/(1-i*.06),0,1)),radius=Math.max(4,maxRadius*(.52+i*.1)*(1-local));ctx.strokeStyle=i===1?'#e1fbff':'#8fdae9';ctx.globalAlpha=Math.sin(local*Math.PI)*(.34+i*.08);ctx.lineWidth=(1.2+i*.45)*scale;ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.stroke();}
      const aperture=Math.max(2,maxRadius*(1-collapse)),shade=ctx.createRadialGradient(center.x,center.y,Math.max(0,aperture*.32),center.x,center.y,Math.max(3,aperture));shade.addColorStop(0,'rgba(3,12,22,0)');shade.addColorStop(.62,`rgba(3,12,22,${p*.2})`);shade.addColorStop(1,`rgba(2,8,15,${Math.min(.96,p*1.12)})`);ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
      if(p>.84){ctx.fillStyle=`rgba(2,8,15,${(p-.84)/.16*.88})`;ctx.fillRect(0,0,w,h);}
    }else if(frame.mode==='emergency'){
      const warning=Math.max(0,1-p/.34);ctx.save();ctx.translate(center.x,center.y);
      for(let i=0;i<3;i++){const radius=Math.max(5,maxRadius*(.48+i*.09)*(1-collapse)),offset=(1-collapse)*Math.sin(p*31+i*2.1)*7;ctx.save();ctx.translate(offset,(i-1)*3*(1-collapse));ctx.rotate((i-1)*.12*(1-collapse));ctx.strokeStyle=i===1?'#d7a0d8':'#8e5b91';ctx.globalAlpha=.2+warning*.24;ctx.lineWidth=(1.2+i*.35)*scale;ctx.beginPath();ctx.ellipse(0,0,radius,radius*(.58+i*.06),0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      if(warning>0){ctx.strokeStyle='#dba2be';ctx.globalAlpha=warning*.42;ctx.lineWidth=2*scale;for(const side of [-1,1]){ctx.beginPath();ctx.arc(0,0,maxRadius*.2,-.5+side*.16,.5+side*.16);ctx.stroke();}}ctx.restore();
      const aperture=Math.max(2,maxRadius*(1-collapse)),shade=ctx.createRadialGradient(center.x,center.y,Math.max(0,aperture*.2),center.x,center.y,Math.max(3,aperture));shade.addColorStop(0,'rgba(16,4,20,0)');shade.addColorStop(.52,`rgba(23,7,29,${p*.24})`);shade.addColorStop(1,`rgba(5,2,10,${Math.min(.98,p*1.22)})`);ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
      if(p>.78){ctx.fillStyle=`rgba(5,2,10,${(p-.78)/.22*.92})`;ctx.fillRect(0,0,w,h);}
    }
    ctx.globalAlpha=1;
  }
  function draw(run,dt,reduced=false){
    const p=run.player,burst=p.boost>0,combustion=p.combustion===true,boost=burst||combustion,fever=Math.min(run.chain/VEIL.feverChain,1),lead=Math.min(p.speed*VEIL.cameraLead,VEIL.cameraMaxLead);
    if(run.returnEffect)run.returnEffect.life=Math.min(run.returnEffect.duration,run.returnEffect.life+dt);
    scale+=(baseScale*(boost&&!reduced?1-VEIL.boostZoom:1)-scale)*(1-Math.exp(-dt*5));
    const target={x:p.x+Math.cos(p.angle)*lead,y:p.y+Math.sin(p.angle)*lead};
    if(fresh){camera=target;fresh=false;}else{const ease=1-Math.exp(-dt*VEIL.cameraEase);camera.x+=(target.x-camera.x)*ease;camera.y+=(target.y-camera.y)*ease;}
    const returnFrame=returnEffectFrame(run.returnEffect),returnCenter=screen(p.x,p.y);ctx.save();if(returnFrame.mode==='emergency'&&!reduced&&returnFrame.warp>0){ctx.translate(returnCenter.x,returnCenter.y);ctx.scale(1+returnFrame.warp,1-returnFrame.warp*.72);ctx.translate(-returnCenter.x,-returnCenter.y);}
    ctx.globalAlpha=1;ctx.lineWidth=1;ctx.lineCap='butt';
    ctx.drawImage(cloudLayer,-w*.15-Math.sin(camera.x*.0004)*w*.06,-h*.15-Math.sin(camera.y*.00025)*h*.06);
    if(run.map.universe){
      const carbon=clamp((-p.y-3300)/4700,0,1),oxygen=clamp((-p.y-7600)/4000,0,1);
      ctx.fillStyle=`rgba(71,31,91,${carbon*(1-oxygen)*.18})`;ctx.fillRect(0,0,w,h);
      ctx.fillStyle=`rgba(103,38,30,${oxygen*.22})`;ctx.fillRect(0,0,w,h);
      const visibleHeat=Math.max(run.ambientHeat??0,run.heat??0);if(visibleHeat>0){ctx.fillStyle=`rgba(255,77,38,${Math.min(visibleHeat/100*.12,.12)})`;ctx.fillRect(0,0,w,h);}
    }
    ctx.fillStyle='#aac5d6';
    for(const s of stars){const x=((s.x*w-camera.x*s.z*scale)%w+w)%w,y=((s.y*h-camera.y*s.z*scale)%h+h)%h;ctx.globalAlpha=.14+s.z;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();if(boost&&!reduced){ctx.strokeStyle='#6597b2';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(p.angle)*(55+fever*25)*s.z,y-Math.sin(p.angle)*(55+fever*25)*s.z);ctx.stroke();}}ctx.globalAlpha=1;
    if(!run.map.universe&&run.gatePassed&&run.time-run.gateTime<7){
      const glimpse=screen(-50,-4160),fade=Math.min(1,(run.time-run.gateTime)*1.5)*Math.min(1,(7-run.time+run.gateTime)/2),radius=370*scale;
      const g=ctx.createRadialGradient(glimpse.x,glimpse.y,0,glimpse.x,glimpse.y,radius);g.addColorStop(0,`rgba(173,134,211,${fade*.3})`);g.addColorStop(.45,`rgba(105,109,176,${fade*.18})`);g.addColorStop(1,'rgba(83,102,157,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<48;i++){const a=i*2.399,r=Math.sqrt(i/48)*radius*.7;glow(glimpse.x+Math.cos(a)*r,glimpse.y+Math.sin(a)*r*.48,12*scale,'rare',fade*.7);}
    }
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
    // Flow geometry is visible before entering it, and even after its dust is collected.
    for(const route of run.map.routes){const element=route.element??'H',color=element==='C'?'#54345f':element==='O'?'#70433d':route.kind==='dense'?'#214f62':'#142e40',arrow=element==='C'?'#80588e':element==='O'?'#9b6554':'#33546a';ctx.beginPath();route.points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle=color;ctx.lineWidth=element==='O'?1.8:1.2;ctx.globalAlpha=element==='O'?.8:1;ctx.stroke();ctx.globalAlpha=1;
      for(let i=10;i<route.points.length;i+=24){const q=route.points[i];ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.angle);ctx.strokeStyle=arrow;ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(0,0);ctx.lineTo(-7,4);ctx.stroke();ctx.restore();}}
    // Wisps travel in the direction of the force: no collision outlines or debug rings.
    for(const f of run.map.fields){
      const at=screen(f.x,f.y),r=f.radius;if(at.x<-r*scale||at.x>w+r*scale||at.y<-r*scale||at.y>h+r*scale)continue;
      const intensity=f.intensity??.7;
      const fog=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
      fog.addColorStop(0,`rgba(136,136,220,${.09+intensity*.06})`);fog.addColorStop(1,'rgba(88,117,169,0)');
      ctx.fillStyle=fog;ctx.fillRect(f.x-r,f.y-r,r*2,r*2);
      ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle??.15);
      for(let i=0;i<13;i++){
        const band=(i-6)*r/9,span=Math.sqrt(Math.max(0,r*r-band*band));
        const wave=(x)=>band+Math.sin(x/r*3+i*.65-run.time*.65)*13*Math.sin((x/span+1)*Math.PI/2);
        ctx.strokeStyle='#889bc3';ctx.lineWidth=i%3===0?2:1;ctx.globalAlpha=(.09+intensity*.12)*(1-Math.abs(band)/r);
        ctx.beginPath();for(let j=0;j<=28;j++){const x=-span+j/28*span*2;j?ctx.lineTo(x,wave(x)):ctx.moveTo(x,wave(x));}ctx.stroke();
        for(let j=0;j<3;j++){const phase=(run.time*(.16+intensity*.08)+i*.073+j/3)%1,x=(phase*2-1)*span,y=wave(x);
          ctx.globalAlpha=Math.sin(phase*Math.PI)*(.24+intensity*.22);ctx.fillStyle='#a2b9e0';ctx.beginPath();ctx.ellipse(x,y,3.8,1.2,0,0,Math.PI*2);ctx.fill();}
      }
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
      for(const signal of run.map.signals)if(!signal.ready){
        const pulse=(run.time*.7)%1,radius=18+pulse*34;ctx.strokeStyle='#f1d28b';ctx.globalAlpha=(1-pulse)*.42;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(signal.x,signal.y,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.7;ctx.beginPath();for(let i=0;i<3;i++){const a=run.time*.4+i*Math.PI*2/3;i?ctx.lineTo(signal.x+Math.cos(a)*9,signal.y+Math.sin(a)*9):ctx.moveTo(signal.x+Math.cos(a)*9,signal.y+Math.sin(a)*9);}ctx.closePath();ctx.stroke();ctx.globalAlpha=1;
      }
      const horizon=ctx.createRadialGradient(100,-12200,0,100,-12200,470);horizon.addColorStop(0,'rgba(238,218,255,.36)');horizon.addColorStop(.22,'rgba(181,135,215,.15)');horizon.addColorStop(1,'rgba(103,68,143,0)');ctx.fillStyle=horizon;ctx.fillRect(-420,-12720,1040,1040);
    }
    ctx.restore();
    for(const dust of run.map.dust){
      if(dust.ready>run.time)continue;const q=screen(dust.x,dust.y);if(q.x<-35||q.x>w+35||q.y<-35||q.y>h+35)continue;const rare=dust.kind==='rare',element=dust.element??'H',kind=rare?'rare':element==='C'?'carbon':element==='O'?'oxygen':dust.kind;
      if(dust.flow&&!reduced){ctx.strokeStyle=element==='O'?'#d86d58':'#679caf';ctx.globalAlpha=.25;ctx.lineWidth=1.2*scale;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-Math.cos(dust.angle)*18*scale,q.y-Math.sin(dust.angle)*18*scale);ctx.stroke();ctx.globalAlpha=1;}
      glow(q.x,q.y,(rare?38:element==='C'?28:element==='O'?25:22)*scale,kind);
      if(element==='C'){ctx.save();ctx.translate(q.x,q.y);ctx.rotate(dust.angle+dust.id*.7);ctx.fillStyle='#e7c8ff';ctx.beginPath();ctx.moveTo(4*scale,0);ctx.lineTo(-3*scale,-3*scale);ctx.lineTo(-2*scale,3*scale);ctx.closePath();ctx.fill();ctx.restore();}
      else{ctx.fillStyle=rare?'#ffe2a1':element==='O'?'#ffd2bd':'#d1f5ff';ctx.beginPath();ctx.arc(q.x,q.y,(rare?4:element==='O'?3:2.5)*scale,0,Math.PI*2);ctx.fill();}
      if(rare){ctx.strokeStyle='#c7ab76';ctx.beginPath();ctx.arc(q.x,q.y,12*scale,0,Math.PI*2);ctx.stroke();}
    }
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
      const q=screen(e.x,e.y);ctx.strokeStyle=e.kind==='rare'?'#edd099':e.kind==='carbon'?'#d7a9ef':e.kind==='oxygen'?'#ffad8f':'#9eeaff';ctx.globalAlpha=(1-e.life/e.duration)*.7;ctx.lineWidth=(1+fever*.7)*scale;
      ctx.beginPath();(e.trail??[]).forEach((point,i)=>{const at=screen(point.x,point.y);i?ctx.lineTo(at.x,at.y):ctx.moveTo(at.x,at.y);});ctx.lineTo(q.x,q.y);ctx.stroke();ctx.globalAlpha=1;glow(q.x,q.y,20*scale,e.kind);
    }
    for(const particle of run.lostCargoEffects??[]){
      particle.life+=dt;const drag=Math.exp(-dt*2.4);particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.vx*=drag;particle.vy*=drag;
      const alpha=Math.max(0,1-particle.life/particle.duration)**1.35,at=screen(particle.x,particle.y),kind=particle.element==='C'?'carbon':particle.element==='O'?'oxygen':'normal',color=particle.element==='C'?'#e7c8ff':particle.element==='O'?'#ffd2bd':'#d1f5ff';
      if(!reduced){ctx.strokeStyle=color;ctx.globalAlpha=alpha*.38;ctx.lineWidth=1.4*scale;ctx.beginPath();ctx.moveTo(at.x-particle.vx*.045*scale,at.y-particle.vy*.045*scale);ctx.lineTo(at.x,at.y);ctx.stroke();}
      glow(at.x,at.y,(particle.element==='C'?28:24)*scale,kind,alpha*.82);ctx.save();ctx.translate(at.x,at.y);ctx.rotate(particle.spin*particle.life);ctx.fillStyle=color;ctx.globalAlpha=alpha;if(particle.element==='C'){ctx.beginPath();ctx.moveTo(4*scale,0);ctx.lineTo(-3*scale,-3*scale);ctx.lineTo(-2*scale,3*scale);ctx.closePath();ctx.fill();}else{ctx.beginPath();ctx.arc(0,0,(particle.element==='O'?3:2.5)*scale,0,Math.PI*2);ctx.fill();}ctx.restore();ctx.globalAlpha=1;
    }
    if(run.lostCargoEffects)run.lostCargoEffects=run.lostCargoEffects.filter(particle=>particle.life<particle.duration);
    const q=screen(p.x,p.y);
    if(!reduced)for(let i=1;i<p.trail.length;i++){const a=screen(p.trail[i-1].x,p.trail[i-1].y),b=screen(p.trail[i].x,p.trail[i].y);ctx.strokeStyle=combustion?'#ffb27d':boost?'#baf5ff':'#70aec7';ctx.globalAlpha=i/p.trail.length*(boost?.7:.3);ctx.lineWidth=(boost?9:4)*scale*i/p.trail.length;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.globalAlpha=1;
    if(boost&&!reduced){
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.angle);ctx.strokeStyle=combustion?'#ffd09d':'#b3edff';
      for(let i=0;i<6;i++){const side=i%2?1:-1,offset=(35+i*7)*scale;ctx.globalAlpha=.12;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-100*scale,offset*side);ctx.quadraticCurveTo(0,offset*side,65*scale,offset*side*.45);ctx.stroke();}ctx.restore();ctx.globalAlpha=1;
    }
    if(boost){ctx.strokeStyle=combustion?'#e69b77':'#8bd9ea';ctx.globalAlpha=.09+fever*.05;ctx.lineWidth=1;ctx.beginPath();ctx.arc(q.x,q.y,(run.config.suctionRadius+(p.drive?.boostRadius??0)+Math.sin(run.time*4)*2)*scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    glow(q.x,q.y,(boost?combustion?112:132:65+fever*12)*scale,combustion?'oxygen':'player',.85);
    // The controlled body is a field-held Collector Shell, not a conventional
    // ship: a spherical gathering aperture rides inside a visible anchor halo.
    drawCollectorShell(ctx,{x:q.x,y:q.y,angle:p.angle,scale,bank:p.bank??0});
    for(const label of run.map.labels){const at=screen(label.x,label.y);if(Math.hypot(at.x-q.x,at.y-q.y)>480||at.y<110||at.y>h-180)continue;ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#7395aa';ctx.fillText(label.text,at.x,at.y-35);}
    // A discreet wayfinder prevents empty-space wandering without a permanent map panel.
    let nearest=null,best=Infinity;for(const d of run.map.dust){if(d.ready>run.time)continue;const distance=Math.hypot(d.x-p.x,d.y-p.y);if(distance<best){nearest=d;best=distance;}}
    if(nearest&&best>140){const angle=Math.atan2(nearest.y-p.y,nearest.x-p.x),x=q.x+Math.cos(angle)*85,y=q.y+Math.sin(angle)*85;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle='#729bad';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(2,0);ctx.lineTo(-5,5);ctx.stroke();ctx.restore();}
    if(run.gatePassed){const alpha=Math.max(0,1-(run.time-(run.gateTime??run.time))/6);ctx.fillStyle=`rgba(151,194,224,${alpha*.08})`;ctx.fillRect(0,0,w,h);}
    if(run.danger!=='clear'){const alpha=run.danger==='danger'?.18:.08,vignette=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.22,w/2,h/2,Math.max(w,h)*.72);vignette.addColorStop(0,'rgba(45,10,35,0)');vignette.addColorStop(1,`rgba(74,18,48,${alpha})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);}
    ctx.restore();if(run.returnEffect)drawReturnEffect(run.returnEffect,returnCenter,reduced);
  }
  resize();return {draw,resize,screen,beginReturn(run,mode){run.returnEffect=createReturnEffect(mode);return run.returnEffect?.duration??0;},scatterLostCargo(run,lost){run.lostCargoEffects=createLostCargoParticles(lost,run.player,rng);return run.lostCargoEffects.length;},reset(){fresh=true;},get size(){return {w,h,scale};}};
}
