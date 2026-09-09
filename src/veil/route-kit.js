const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const freezePoint=point=>Object.freeze({...point});
const freezePath=points=>Object.freeze(points.map(freezePoint));
const unit=angle=>({x:Math.cos(angle),y:Math.sin(angle)});
const lerp=(a,b,t)=>a+(b-a)*t;

function cubicPoint(a,b,c,d,t){
  const u=1-t,u2=u*u,t2=t*t;
  return {x:u2*u*a.x+3*u2*t*b.x+3*u*t2*c.x+t2*t*d.x,y:u2*u*a.y+3*u2*t*b.y+3*u*t2*c.y+t2*t*d.y};
}
function cubicTangent(a,b,c,d,t){
  const u=1-t;
  const dx=3*u*u*(b.x-a.x)+6*u*t*(c.x-b.x)+3*t*t*(d.x-c.x);
  const dy=3*u*u*(b.y-a.y)+6*u*t*(c.y-b.y)+3*t*t*(d.y-c.y);
  return Math.atan2(dy,dx);
}
function cubicSection(id,a,b,c,d,steps=20){
  return Array.from({length:steps+1},(_,i)=>{const t=i/steps,p=cubicPoint(a,b,c,d,t);return {...p,angle:cubicTangent(a,b,c,d,t),section:id};});
}
function spiralTangent(center,r0,r1,theta0,sweep,t){
  const r=lerp(r0,r1,t),theta=theta0+sweep*t,dr=r1-r0,dtheta=sweep;
  return Math.atan2(dr*Math.sin(theta)+r*Math.cos(theta)*dtheta,dr*Math.cos(theta)-r*Math.sin(theta)*dtheta);
}
function spiralSection(id,center,r0,r1,theta0,sweep,steps=28){
  return Array.from({length:steps+1},(_,i)=>{const t=i/steps,r=lerp(r0,r1,t),theta=theta0+sweep*t;return {x:center.x+Math.cos(theta)*r,y:center.y+Math.sin(theta)*r,angle:spiralTangent(center,r0,r1,theta0,sweep,t),section:id};});
}
function appendPath(target,section){for(let i=target.length?1:0;i<section.length;i++)target.push(section[i]);}
function resamplePath(points,spacing){
  if(points.length<2)return freezePath(points);
  const result=[{...points[0]}];let previous={...points[0]},remainder=0;
  for(let i=1;i<points.length;i++){
    const endpoint=points[i];let dx=endpoint.x-previous.x,dy=endpoint.y-previous.y,len=Math.hypot(dx,dy);
    while(len>1e-8&&remainder+len>=spacing){
      const f=(spacing-remainder)/len;
      previous={x:previous.x+dx*f,y:previous.y+dy*f,angle:Math.atan2(dy,dx),section:endpoint.section};
      result.push({...previous});
      dx=endpoint.x-previous.x;dy=endpoint.y-previous.y;len=Math.hypot(dx,dy);remainder=0;
    }
    remainder+=len;previous={...endpoint};
  }
  const last=points.at(-1),tail=result.at(-1);
  if(Math.hypot(last.x-tail.x,last.y-tail.y)>1e-5)result.push({...last});
  for(let i=0;i<result.length;i++){
    const a=result[Math.max(0,i-1)],b=result[Math.min(result.length-1,i+1)];
    result[i].angle=Math.atan2(b.y-a.y,b.x-a.x);
  }
  return freezePath(result);
}
function offsetPath(points,offset){return freezePath(points.map(point=>({x:point.x-Math.sin(point.angle)*offset,y:point.y+Math.cos(point.angle)*offset,angle:point.angle,section:point.section})));}

export function createVortexFlybyRoute({id='vortex-route',entry,exit,center,width=220,outerRadius=620,innerRadius=105,startAngle=.4,inwardTurns=.39,outwardTurns=.25,direction=-1,spacing=20}={}){
  if(!entry||!exit||!center)throw Error('Vortex route requires entry, exit and center sockets');
  const sweepIn=direction*Math.PI*2*inwardTurns;
  const thetaIn=startAngle+sweepIn,coreExitAngle=thetaIn+Math.PI,sweepOut=direction*Math.PI*2*outwardTurns;
  const approachEnd={x:center.x+Math.cos(startAngle)*outerRadius,y:center.y+Math.sin(startAngle)*outerRadius};
  const spiralInTangent=spiralTangent(center,outerRadius,innerRadius,startAngle,sweepIn,0);
  const entryAngle=Number.isFinite(entry.angle)?entry.angle:Math.atan2(approachEnd.y-entry.y,approachEnd.x-entry.x);
  const approachDistance=Math.hypot(approachEnd.x-entry.x,approachEnd.y-entry.y),entryHandle=Math.min(190,approachDistance*.55),endHandle=Math.min(170,approachDistance*.48);
  const eUnit=unit(entryAngle),sInUnit=unit(spiralInTangent);
  const approach=cubicSection('approach',entry,{x:entry.x+eUnit.x*entryHandle,y:entry.y+eUnit.y*entryHandle},{x:approachEnd.x-sInUnit.x*endHandle,y:approachEnd.y-sInUnit.y*endHandle},approachEnd,18);
  const inward=spiralSection('spiral-in',center,outerRadius,innerRadius,startAngle,sweepIn,32);
  const innerIn=inward.at(-1),innerOut={x:center.x+Math.cos(coreExitAngle)*innerRadius,y:center.y+Math.sin(coreExitAngle)*innerRadius};
  const inwardEndAngle=innerIn.angle,radialAngle=Math.atan2(center.y-innerIn.y,center.x-innerIn.x),radialUnit=unit(radialAngle),inwardUnit=unit(inwardEndAngle);
  const coreA=cubicSection('core-in',innerIn,{x:innerIn.x+inwardUnit.x*48,y:innerIn.y+inwardUnit.y*48},{x:center.x-radialUnit.x*34,y:center.y-radialUnit.y*34},center,8);
  const outwardStartAngle=spiralTangent(center,innerRadius,outerRadius,coreExitAngle,sweepOut,0),outwardUnit=unit(outwardStartAngle);
  const coreB=cubicSection('core-out',center,{x:center.x+radialUnit.x*34,y:center.y+radialUnit.y*34},{x:innerOut.x-outwardUnit.x*48,y:innerOut.y-outwardUnit.y*48},innerOut,8);
  const outward=spiralSection('spiral-out',center,innerRadius,outerRadius,coreExitAngle,sweepOut,24);
  const outerOut=outward.at(-1),outwardEndAngle=outerOut.angle,exitAngle=Number.isFinite(exit.angle)?exit.angle:Math.atan2(exit.y-outerOut.y,exit.x-outerOut.x),exitDistance=Math.hypot(exit.x-outerOut.x,exit.y-outerOut.y),startHandle=Math.min(150,exitDistance*.55),exitHandle=Math.min(120,exitDistance*.45),outUnit=unit(outwardEndAngle),xUnit=unit(exitAngle);
  const exitCurve=cubicSection('exit',outerOut,{x:outerOut.x+outUnit.x*startHandle,y:outerOut.y+outUnit.y*startHandle},{x:exit.x-xUnit.x*exitHandle,y:exit.y-xUnit.y*exitHandle},exit,14);
  const dense=[];for(const section of [approach,inward,coreA,coreB,outward,exitCurve])appendPath(dense,section);
  const points=resamplePath(dense,spacing),fieldOffsets=[-width*.42,-width*.2,0,width*.2,width*.42],fieldLines=Object.freeze(fieldOffsets.map(offset=>offsetPath(points,offset)));
  return Object.freeze({id,width,center:freezePoint(center),points,fieldLines,sections:Object.freeze(['approach','spiral-in','core-in','core-out','spiral-out','exit']),entry:Object.freeze({position:freezePoint(entry),angle:entryAngle,width}),exit:Object.freeze({position:freezePoint(exit),angle:exitAngle,width}),sockets:Object.freeze({entry:freezePoint(entry),core:freezePoint(center),exit:freezePoint(exit)})});
}

function nearestOnRoute(route,p){
  let best=null;
  for(let i=0;i<route.points.length-1;i++){
    const a=route.points[i],b=route.points[i+1],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<1e-8)continue;
    const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l2,0,1),x=a.x+dx*t,y=a.y+dy*t,distance=Math.hypot(p.x-x,p.y-y);
    if(!best||distance<best.distance)best={distance,x,y,angle:Math.atan2(dy,dx),index:i,t};
  }
  return best;
}
export function routeFlowAt(route,p,{speed=34,radius=route.width*.72}={}){
  const nearest=nearestOnRoute(route,p);if(!nearest||nearest.distance>=radius)return {x:0,y:0,intensity:0,distance:nearest?.distance??Infinity};
  const t=1-nearest.distance/radius,intensity=t*t*(3-2*t);
  return {x:Math.cos(nearest.angle)*speed*intensity,y:Math.sin(nearest.angle)*speed*intensity,intensity,distance:nearest.distance,angle:nearest.angle};
}
