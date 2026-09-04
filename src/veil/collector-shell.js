export const TANK_PRESENTATION=Object.freeze({
  propellant:Object.freeze({icon:'↗',color:'#78d5e7'}),
  fuel:Object.freeze({icon:'◆',color:'#f1a36f'}),
  oxidizer:Object.freeze({icon:'O₂',color:'#8dbcf4'}),
  coolant:Object.freeze({icon:'✦',color:'#91ddd4'}),
});

export function drawCollectorShell(ctx,{x=0,y=0,angle=0,scale=1,bank=0}={}){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale*1.2,scale*1.2*(1-Math.abs(bank)*.12));
  ctx.strokeStyle='#77b7c9';ctx.globalAlpha=.24;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-15,0);ctx.bezierCurveTo(-30,-5,-42,7,-58,0);ctx.stroke();
  ctx.globalAlpha=.42;ctx.beginPath();ctx.ellipse(0,0,22,17,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=1;ctx.fillStyle='#eaf9fc';ctx.strokeStyle='#b2eaff';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(0,0,14,11,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#153e58';ctx.beginPath();ctx.ellipse(4,0,6,7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#88d6e5';ctx.beginPath();ctx.arc(4,0,9,-.72,.72);ctx.stroke();
  ctx.fillStyle='#bff4fa';ctx.beginPath();ctx.arc(-5,0,2.2,0,Math.PI*2);ctx.fill();ctx.restore();ctx.globalAlpha=1;
}

export function drawCollectorShellPreview(canvas){
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio??1,2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);drawCollectorShell(ctx,{x:rect.width/2+10,y:rect.height/2,angle:-Math.PI/2,scale:Math.min(rect.width/150,rect.height/90)});
}
