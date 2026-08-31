import { VEIL } from './config.js';
import { random } from './map.js';
import { clamp } from './engine.js';
export function createVeilRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas 2D unavailable');
  let w=1,h=1,scale=1,baseScale=1,camera={x:0,y:0},fresh=true;
  const rng=random(17),stars=Array.from({length:170},()=>({x:rng(),y:rng(),r:.3+rng()*1.1,z:.05+rng()*.2}));
  const sprites={},cloudLayer=document.createElement('canvas');
  for(const [name,color]of Object.entries({normal:'147,225,255',dense:'186,245,255',rare:'255,220,152',player:'163,235,255'})){
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
  function draw(run,dt,reduced=false){
    const p=run.player,boost=p.boost>0,fever=Math.min(run.chain/VEIL.feverChain,1),lead=Math.min(p.speed*VEIL.cameraLead,VEIL.cameraMaxLead);
    scale+=(baseScale*(boost&&!reduced?1-VEIL.boostZoom:1)-scale)*(1-Math.exp(-dt*5));
    const target={x:p.x+Math.cos(p.angle)*lead,y:p.y+Math.sin(p.angle)*lead};
    if(fresh){camera=target;fresh=false;}else{const ease=1-Math.exp(-dt*VEIL.cameraEase);camera.x+=(target.x-camera.x)*ease;camera.y+=(target.y-camera.y)*ease;}
    ctx.globalAlpha=1;ctx.lineWidth=1;ctx.lineCap='butt';
    ctx.drawImage(cloudLayer,-w*.15-Math.sin(camera.x*.0004)*w*.06,-h*.15-Math.sin(camera.y*.00025)*h*.06);
    ctx.fillStyle='#aac5d6';
    for(const s of stars){const x=((s.x*w-camera.x*s.z*scale)%w+w)%w,y=((s.y*h-camera.y*s.z*scale)%h+h)%h;ctx.globalAlpha=.14+s.z;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();if(boost&&!reduced){ctx.strokeStyle='#6597b2';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(p.angle)*(55+fever*25)*s.z,y-Math.sin(p.angle)*(55+fever*25)*s.z);ctx.stroke();}}ctx.globalAlpha=1;
    if(run.gatePassed&&run.time-run.gateTime<7){
      const glimpse=screen(-50,-4160),fade=Math.min(1,(run.time-run.gateTime)*1.5)*Math.min(1,(7-run.time+run.gateTime)/2),radius=370*scale;
      const g=ctx.createRadialGradient(glimpse.x,glimpse.y,0,glimpse.x,glimpse.y,radius);g.addColorStop(0,`rgba(173,134,211,${fade*.3})`);g.addColorStop(.45,`rgba(105,109,176,${fade*.18})`);g.addColorStop(1,'rgba(83,102,157,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<48;i++){const a=i*2.399,r=Math.sqrt(i/48)*radius*.7;glow(glimpse.x+Math.cos(a)*r,glimpse.y+Math.sin(a)*r*.48,12*scale,'rare',fade*.7);}
    }
    ctx.save();ctx.translate(w/2-camera.x*scale,h/2-camera.y*scale);ctx.scale(scale,scale);
    // Flow geometry is visible before entering it, and even after its dust is collected.
    for(const route of run.map.routes){ctx.beginPath();route.points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle=route.kind==='dense'?'#214f62':'#142e40';ctx.lineWidth=1.2;ctx.stroke();
      for(let i=10;i<route.points.length;i+=24){const q=route.points[i];ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.angle);ctx.strokeStyle='#33546a';ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(0,0);ctx.lineTo(-7,4);ctx.stroke();ctx.restore();}}
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
    ctx.restore();
    for(const dust of run.map.dust){if(dust.ready>run.time)continue;const q=screen(dust.x,dust.y);if(q.x<-30||q.x>w+30||q.y<-30||q.y>h+30)continue;const rare=dust.kind==='rare';glow(q.x,q.y,(rare?38:22)*scale,dust.kind);ctx.fillStyle=rare?'#ffe2a1':'#d1f5ff';ctx.beginPath();ctx.arc(q.x,q.y,(rare?4:2.5)*scale,0,Math.PI*2);ctx.fill();if(rare){ctx.strokeStyle='#c7ab76';ctx.beginPath();ctx.arc(q.x,q.y,12*scale,0,Math.PI*2);ctx.stroke();}}
    for(const e of run.effects){
      const q=screen(e.x,e.y);ctx.strokeStyle=e.kind==='rare'?'#edd099':'#9eeaff';ctx.globalAlpha=(1-e.life/e.duration)*.7;ctx.lineWidth=(1+fever*.7)*scale;
      ctx.beginPath();(e.trail??[]).forEach((point,i)=>{const at=screen(point.x,point.y);i?ctx.lineTo(at.x,at.y):ctx.moveTo(at.x,at.y);});ctx.lineTo(q.x,q.y);ctx.stroke();ctx.globalAlpha=1;glow(q.x,q.y,20*scale,e.kind);
    }
    const q=screen(p.x,p.y);
    if(!reduced)for(let i=1;i<p.trail.length;i++){const a=screen(p.trail[i-1].x,p.trail[i-1].y),b=screen(p.trail[i].x,p.trail[i].y);ctx.strokeStyle=boost?'#baf5ff':'#70aec7';ctx.globalAlpha=i/p.trail.length*(boost?.7:.3);ctx.lineWidth=(boost?9:4)*scale*i/p.trail.length;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.globalAlpha=1;
    if(boost&&!reduced){
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.angle);ctx.strokeStyle='#b3edff';
      for(let i=0;i<6;i++){const side=i%2?1:-1,offset=(35+i*7)*scale;ctx.globalAlpha=.12;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-100*scale,offset*side);ctx.quadraticCurveTo(0,offset*side,65*scale,offset*side*.45);ctx.stroke();}ctx.restore();ctx.globalAlpha=1;
    }
    glow(q.x,q.y,(boost?130:70+fever*25)*scale,'player',.85);
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.angle);ctx.scale(scale*1.2,scale*1.2*(1-Math.abs(p.bank??0)*.18));ctx.fillStyle='#f1fbff';ctx.strokeStyle='#b2eaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(17,0);ctx.quadraticCurveTo(-7,-14,-12,-8);ctx.lineTo(-6,0);ctx.lineTo(-12,8);ctx.quadraticCurveTo(-7,14,17,0);ctx.fill();ctx.stroke();ctx.fillStyle='#153e58';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();
    for(const label of run.map.labels){const at=screen(label.x,label.y);if(Math.hypot(at.x-q.x,at.y-q.y)>480||at.y<110||at.y>h-180)continue;ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#7395aa';ctx.fillText(label.text,at.x,at.y-35);}
    // A discreet wayfinder prevents empty-space wandering without a permanent map panel.
    let nearest=null,best=Infinity;for(const d of run.map.dust){if(d.ready>run.time)continue;const distance=Math.hypot(d.x-p.x,d.y-p.y);if(distance<best){nearest=d;best=distance;}}
    if(nearest&&best>140){const angle=Math.atan2(nearest.y-p.y,nearest.x-p.x),x=q.x+Math.cos(angle)*85,y=q.y+Math.sin(angle)*85;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle='#729bad';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(2,0);ctx.lineTo(-5,5);ctx.stroke();ctx.restore();}
    if(run.gatePassed){const alpha=Math.max(0,1-(run.time-(run.gateTime??run.time))/6);ctx.fillStyle=`rgba(151,194,224,${alpha*.08})`;ctx.fillRect(0,0,w,h);}
  }
  resize();return {draw,resize,screen,reset(){fresh=true;},get size(){return {w,h,scale};}};
}
