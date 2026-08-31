import { VEIL } from './config.js';
import { random } from './map.js';
import { clamp } from './engine.js';
export function createVeilRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas 2D unavailable');
  let w=1,h=1,scale=1,camera={x:0,y:0},fresh=true;
  const rng=random(17),stars=Array.from({length:170},()=>({x:rng(),y:rng(),r:.3+rng()*1.1,z:.05+rng()*.2}));
  const sprites={};
  for(const [name,color]of Object.entries({normal:'147,225,255',dense:'186,245,255',rare:'255,220,152',player:'163,235,255'})){
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gradient=g.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,`rgba(${color},1)`);gradient.addColorStop(.12,`rgba(${color},.95)`);gradient.addColorStop(.3,`rgba(${color},.23)`);gradient.addColorStop(1,`rgba(${color},0)`);g.fillStyle=gradient;g.fillRect(0,0,64,64);sprites[name]=c;
  }
  function resize(){const r=canvas.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);const dpr=Math.min(window.devicePixelRatio||1,VEIL.maxDpr);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);scale=clamp(Math.min(w/660,h/950),.48,1.15);}
  const screen=(x,y)=>({x:(x-camera.x)*scale+w/2,y:(y-camera.y)*scale+h/2});
  function glow(x,y,size,kind='normal',alpha=1){ctx.globalAlpha=alpha;ctx.drawImage(sprites[kind]||sprites.normal,x-size/2,y-size/2,size,size);ctx.globalAlpha=1;}
  function draw(run,dt,reduced=false){
    const p=run.player,boost=p.boost>0,fever=Math.min(run.chain/100,1),lead=Math.min(p.speed*.55,145);
    const target={x:p.x+Math.cos(p.angle)*lead,y:p.y+Math.sin(p.angle)*lead};
    if(fresh){camera=target;fresh=false;}else{const ease=1-Math.exp(-dt*5);camera.x+=(target.x-camera.x)*ease;camera.y+=(target.y-camera.y)*ease;}
    ctx.fillStyle='#040d19';ctx.fillRect(0,0,w,h);
    // Large soft clouds remain behind the crisp, deliberately placed resources.
    for(const cloud of [{x:.12,y:.18,r:.85,color:'12,51,79'},{x:.94,y:.65,r:.72,color:'20,48,75'},{x:.5,y:1.1,r:.65,color:'12,61,76'}]){
      const x=cloud.x*w-Math.sin(camera.x*.0004)*w*.15,y=cloud.y*h-Math.sin(camera.y*.00025)*h*.13,r=Math.max(w,h)*cloud.r,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${cloud.color},.53)`);g.addColorStop(1,`rgba(${cloud.color},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
    ctx.fillStyle='#aac5d6';
    for(const s of stars){const x=((s.x*w-camera.x*s.z*scale)%w+w)%w,y=((s.y*h-camera.y*s.z*scale)%h+h)%h;ctx.globalAlpha=.14+s.z;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();if(boost&&!reduced){ctx.strokeStyle='#6597b2';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(p.angle)*18*s.z,y-Math.sin(p.angle)*18*s.z);ctx.stroke();}}ctx.globalAlpha=1;
    if(run.gatePassed&&run.time-run.gateTime<7){
      const glimpse=screen(-50,-4160),fade=Math.min(1,(run.time-run.gateTime)*1.5)*Math.min(1,(7-run.time+run.gateTime)/2),radius=370*scale;
      const g=ctx.createRadialGradient(glimpse.x,glimpse.y,0,glimpse.x,glimpse.y,radius);g.addColorStop(0,`rgba(173,134,211,${fade*.3})`);g.addColorStop(.45,`rgba(105,109,176,${fade*.18})`);g.addColorStop(1,'rgba(83,102,157,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<48;i++){const a=i*2.399,r=Math.sqrt(i/48)*radius*.7;glow(glimpse.x+Math.cos(a)*r,glimpse.y+Math.sin(a)*r*.48,12*scale,'rare',fade*.7);}
    }
    ctx.save();ctx.translate(w/2-camera.x*scale,h/2-camera.y*scale);ctx.scale(scale,scale);
    // Flow geometry is visible before entering it, and even after its dust is collected.
    for(const route of run.map.routes){ctx.beginPath();route.points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle=route.kind==='dense'?'#214f62':'#142e40';ctx.lineWidth=1.2;ctx.stroke();
      for(let i=10;i<route.points.length;i+=24){const q=route.points[i];ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.angle);ctx.strokeStyle='#33546a';ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(0,0);ctx.lineTo(-7,4);ctx.stroke();ctx.restore();}}
    for(const f of run.map.fields){const s=screen(f.x,f.y);if(s.x<-180||s.x>w+180||s.y<-180||s.y>h+180)continue;const alpha=f.active?.23:f.warning?.14:.05;const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.radius);g.addColorStop(0,`rgba(166,124,222,${alpha})`);g.addColorStop(1,'rgba(166,124,222,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=f.active?'#9b7cbc':f.warning?'#bca0e0':'#3e3558';ctx.lineWidth=1.5;ctx.setLineDash([7,12]);ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      if(f.active)for(let i=0;i<3;i++){const radius=((run.time*60+i*50)%f.radius);ctx.globalAlpha=(1-radius/f.radius)*.32;ctx.beginPath();ctx.arc(f.x,f.y,radius,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
    }
    const gate=VEIL.gate;ctx.strokeStyle='#5b7d9c';ctx.lineWidth=1;
    for(let i=0;i<7;i++){const y=gate.y-80+i*25;ctx.beginPath();for(let j=0;j<=24;j++){const x=gate.x-gate.width/2+j*gate.width/24,yy=y+Math.sin(j*.6+run.time*1.3)*6;j?ctx.lineTo(x,yy):ctx.moveTo(x,yy);}ctx.globalAlpha=.24;ctx.stroke();}ctx.globalAlpha=1;
    ctx.restore();
    for(const dust of run.map.dust){if(dust.ready>run.time)continue;const q=screen(dust.x,dust.y);if(q.x<-30||q.x>w+30||q.y<-30||q.y>h+30)continue;const rare=dust.kind==='rare';glow(q.x,q.y,(rare?38:22)*scale,dust.kind);ctx.fillStyle=rare?'#ffe2a1':'#d1f5ff';ctx.beginPath();ctx.arc(q.x,q.y,(rare?4:2.5)*scale,0,Math.PI*2);ctx.fill();if(rare){ctx.strokeStyle='#c7ab76';ctx.beginPath();ctx.arc(q.x,q.y,12*scale,0,Math.PI*2);ctx.stroke();}}
    for(const e of run.effects){const q=screen(e.x,e.y),origin=screen(e.startX,e.startY),end=screen(p.x,p.y);ctx.strokeStyle=e.kind==='rare'?'#edd099':'#9eeaff';ctx.globalAlpha=(1-e.life/e.duration)*.6;ctx.lineWidth=1+fever;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.quadraticCurveTo((origin.x+end.x)/2+e.side*24,(origin.y+end.y)/2,q.x,q.y);ctx.stroke();ctx.globalAlpha=1;glow(q.x,q.y,18*scale,e.kind);}
    const q=screen(p.x,p.y);
    if(!reduced)for(let i=1;i<p.trail.length;i++){const a=screen(p.trail[i-1].x,p.trail[i-1].y),b=screen(p.trail[i].x,p.trail[i].y);ctx.strokeStyle=boost?'#baf5ff':'#70aec7';ctx.globalAlpha=i/p.trail.length*(boost?.7:.3);ctx.lineWidth=(boost?9:4)*scale*i/p.trail.length;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.globalAlpha=1;
    glow(q.x,q.y,(boost?110:70+fever*25)*scale,'player',.85);
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.angle);ctx.scale(scale*1.2,scale*1.2);ctx.fillStyle='#f1fbff';ctx.strokeStyle='#b2eaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(17,0);ctx.quadraticCurveTo(-7,-14,-12,-8);ctx.lineTo(-6,0);ctx.lineTo(-12,8);ctx.quadraticCurveTo(-7,14,17,0);ctx.fill();ctx.stroke();ctx.fillStyle='#153e58';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();
    for(const label of run.map.labels){const at=screen(label.x,label.y);if(Math.hypot(at.x-q.x,at.y-q.y)>480||at.y<110||at.y>h-180)continue;ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#7395aa';ctx.fillText(label.text,at.x,at.y-35);}
    // A discreet wayfinder prevents empty-space wandering without a permanent map panel.
    let nearest=null,best=Infinity;for(const d of run.map.dust){if(d.ready>run.time)continue;const distance=Math.hypot(d.x-p.x,d.y-p.y);if(distance<best){nearest=d;best=distance;}}
    if(nearest&&best>140){const angle=Math.atan2(nearest.y-p.y,nearest.x-p.x),x=q.x+Math.cos(angle)*85,y=q.y+Math.sin(angle)*85;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle='#729bad';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(2,0);ctx.lineTo(-5,5);ctx.stroke();ctx.restore();}
    if(run.gatePassed){const alpha=Math.max(0,1-(run.time-(run.gateTime??run.time))/6);ctx.fillStyle=`rgba(151,194,224,${alpha*.08})`;ctx.fillRect(0,0,w,h);}
  }
  resize();return {draw,resize,screen,reset(){fresh=true;},get size(){return {w,h,scale};}};
}
