// Optional currents share physics, visual geometry and traversal rewards.
export const EXPEDITION_CHALLENGES=Object.freeze([
  {id:'pulse',bottom:-8350,top:-8750,width:220,rewards:['dimethyl-ether','ethene','propene']},
  {id:'curve',bottom:-10820,top:-11320,width:240,rewards:['propane','phenol','formaldehyde']},
  {id:'thermal',bottom:-11320,top:-11600,width:260,rewards:['ethylene-glycol','n-hexane']},
]);
export const challengeCenter=(zone,y)=>zone.id==='curve'?120+170*Math.sin((y-zone.bottom)/500*Math.PI):120;
export function challengeEnvironment(p,time){
  const z=EXPEDITION_CHALLENGES.find(z=>p.y<=z.bottom&&p.y>=z.top&&Math.abs(p.x-challengeCenter(z,p.y))<z.width);
  if(!z)return null;
  const strength=Math.max(0,1-Math.abs(p.x-challengeCenter(z,p.y))/z.width),pulse=(1+Math.sin(time*2*Math.PI/2.4))/2;
  return {pressure:(z.id==='pulse'?130+280*pulse:z.id==='curve'?330:280)*strength,flowX:z.id==='curve'?Math.cos((p.y-z.bottom)/500*Math.PI)*-65*strength:0,heat:z.id==='thermal'?48:0};
}
export function recordChallengePassage(run,old){
  if(!run.map.universe)return;run.challengeProgress??={};
  for(const z of EXPEDITION_CHALLENGES){
    const p=run.player,inside=Math.abs(p.x-challengeCenter(z,p.y))<z.width;
    if(!run.challengeProgress[z.id]?.complete&&old.y>=z.bottom&&p.y<z.bottom&&inside)run.challengeProgress[z.id]={distance:0};
    const progress=run.challengeProgress[z.id];if(!progress||progress.complete)continue;
    if(inside&&p.y<z.bottom&&old.y>z.top)progress.distance+=Math.max(0,old.y-p.y);
    if(old.y>=z.top&&p.y<z.top&&inside&&progress.distance>=(z.bottom-z.top)*.7){progress.complete=true;run.events.push({type:'inspiration',rewards:z.rewards});}
  }
}
export function drawChallengeCurrents(ctx,time){
  ctx.save();
  for(const z of EXPEDITION_CHALLENGES){
    ctx.strokeStyle=z.id==='thermal'?'#cf7451':'#8ba6c7';ctx.lineWidth=1.5;
    for(let i=0;i<16;i++){const y=z.top+((i/16+time*.13)%1)*(z.bottom-z.top),x=challengeCenter(z,y)+(i%3-1)*z.width*.45;
      ctx.globalAlpha=z.id==='pulse'?.12+.12*(1+Math.sin(time*2*Math.PI/2.4))/2:.16;ctx.beginPath();ctx.moveTo(x,y-22);ctx.quadraticCurveTo(x+10,y,x,y+22);ctx.stroke();}
  }ctx.restore();
}
