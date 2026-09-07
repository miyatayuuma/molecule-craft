export const TANK_PRESENTATION=Object.freeze({
  propellant:Object.freeze({icon:'↗',color:'#78d5e7'}),
  fuel:Object.freeze({icon:'◆',color:'#f1a36f'}),
  oxidizer:Object.freeze({icon:'O₂',color:'#8dbcf4'}),
  coolant:Object.freeze({icon:'✦',color:'#91ddd4'}),
});

export function drawCollectorShell(ctx,{x=0,y=0,angle=0,scale=1,bank=0}={}){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale*1.2,scale*1.2*(1-Math.abs(bank)*.18));
  ctx.fillStyle='#f1fbff';ctx.strokeStyle='#b2eaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(17,0);ctx.quadraticCurveTo(-7,-14,-12,-8);ctx.lineTo(-6,0);ctx.lineTo(-12,8);ctx.quadraticCurveTo(-7,14,17,0);ctx.fill();ctx.stroke();
  ctx.fillStyle='#153e58';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();ctx.globalAlpha=1;
}

export function drawCollectorShellPreview(canvas){
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio??1,2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);drawCollectorShell(ctx,{x:rect.width/2+10,y:rect.height/2,angle:-Math.PI/2,scale:Math.min(rect.width/150,rect.height/90)});
}
