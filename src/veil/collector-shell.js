export const TANK_PRESENTATION=Object.freeze({
  propellant:Object.freeze({icon:'↗',color:'#78d5e7'}),
  fuel:Object.freeze({icon:'◆',color:'#f1a36f'}),
  oxidizer:Object.freeze({icon:'O₂',color:'#8dbcf4'}),
  coolant:Object.freeze({icon:'✦',color:'#91ddd4'}),
});

export const COLLECTOR_SHELL_SPRITE_URL=new URL('../../assets/collector-shell.png',import.meta.url).href;
const SPRITE_WIDTH=21,SPRITE_HEIGHT=34;
let sprite=null,spriteState='idle';
const pendingDraws=new Map();

function fallback(ctx){
  ctx.fillStyle='#f1fbff';ctx.strokeStyle='#b2eaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(17,0);ctx.quadraticCurveTo(-7,-14,-12,-8);ctx.lineTo(-6,0);ctx.lineTo(-12,8);ctx.quadraticCurveTo(-7,14,17,0);ctx.fill();ctx.stroke();
  ctx.fillStyle='#153e58';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();
}

function flushPending(){
  const draws=[...pendingDraws.values()];pendingDraws.clear();
  for(const {ctx,options} of draws)drawCollectorShell(ctx,options);
}

function ensureSprite(){
  if(spriteState==='ready')return sprite;
  if(spriteState==='loading'||spriteState==='failed'||spriteState==='unavailable')return null;
  const ImageCtor=globalThis.Image??globalThis.window?.Image;
  if(typeof ImageCtor!=='function'){spriteState='unavailable';return null;}
  spriteState='loading';sprite=new ImageCtor();sprite.decoding='async';
  sprite.addEventListener?.('load',()=>{spriteState='ready';flushPending();},{once:true});
  sprite.addEventListener?.('error',()=>{spriteState='failed';flushPending();},{once:true});
  sprite.src=COLLECTOR_SHELL_SPRITE_URL;
  if(sprite.complete&&sprite.naturalWidth>0){spriteState='ready';queueMicrotask(flushPending);}
  return spriteState==='ready'?sprite:null;
}

if(typeof globalThis.window!=='undefined'&&typeof globalThis.window.Image==='function')ensureSprite();

export function drawCollectorShell(ctx,{x=0,y=0,angle=0,scale=1,bank=0}={}){
  const options={x,y,angle,scale,bank},image=ensureSprite();
  if(!image&&spriteState==='loading'){pendingDraws.set(ctx,{ctx,options});return;}
  ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);
  if(image){
    ctx.scale(scale*(1-Math.abs(bank)*.18),scale);
    ctx.drawImage(image,-SPRITE_WIDTH/2,-SPRITE_HEIGHT/2,SPRITE_WIDTH,SPRITE_HEIGHT);
  }else{
    ctx.rotate(-Math.PI/2);ctx.scale(scale*1.2,scale*1.2*(1-Math.abs(bank)*.18));fallback(ctx);
  }
  ctx.restore();ctx.globalAlpha=1;
}

export function drawCollectorShellPreview(canvas){
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio??1,2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);drawCollectorShell(ctx,{x:rect.width*.39,y:rect.height*.52,angle:-Math.PI/2,scale:Math.min(rect.width/150,rect.height/90)});
}
