import {modelAtomRadius} from './chemistry.js?v=20';

const DEG=Math.PI/180,FOV_HALF=19*DEG;
const VIEW_WIDTH=192,VIEW_HEIGHT=128,FRAME_MARGIN=5;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const PART_SETTLEMENT={maxSteps:220,movementThreshold:.001,stableSteps:10};

function fitRadius(layout){
  return Math.max(.6,
    ...layout.atoms.map(atom=>atom.point.length()+modelAtomRadius(atom.element)),
    ...layout.ports.map(port=>port.point.length()+.18));
}

function projectLayout(THREE,layout,view,{projection='perspective',width=VIEW_WIDTH,height=VIEW_HEIGHT}={}){
  const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(view.pitch,view.yaw,view.roll,'YXZ'));
  const radius=fitRadius(layout),aspect=width/height,halfFov=Math.min(FOV_HALF,Math.atan(Math.tan(FOV_HALF)*aspect));
  const cameraDistance=radius/Math.sin(halfFov)*1.12,orthographicScale=52/radius;
  const project=point=>{
    const rotated=point.clone().applyQuaternion(quaternion);
    if(projection==='orthographic')return{x:width/2+rotated.x*orthographicScale,y:height/2-rotated.y*orthographicScale,z:rotated.z,scale:orthographicScale};
    const depth=cameraDistance-rotated.z,scale=height/(2*Math.tan(FOV_HALF)*depth);
    return{x:width/2+rotated.x*scale,y:height/2-rotated.y*scale,z:rotated.z,scale};
  };
  const atoms=layout.atoms.map(atom=>{const point=project(atom.point);return{...point,radius:modelAtomRadius(atom.element)*point.scale,element:atom.element};});
  const ports=layout.ports.map(port=>{const point=project(port.point);return{...point,radius:projection==='orthographic'?3:.15*point.scale,atom:port.atom};});
  return{atoms,ports,width,height,radius,projection};
}

function pointSegmentDistance(point,start,end){
  const dx=end.x-start.x,dy=end.y-start.y,lengthSq=dx*dx+dy*dy;
  const t=lengthSq?clamp(((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSq,0,1):0;
  return Math.hypot(point.x-(start.x+t*dx),point.y-(start.y+t*dy));
}

function projectionScore(layout,projected){
  if(!projected.ports.length)return{minimumClearance:Infinity,meanClearance:Infinity,rayVisibility:1,containment:0,footprint:0};
  const clearances=projected.ports.map(port=>Math.min(...projected.atoms.map(atom=>Math.hypot(port.x-atom.x,port.y-atom.y)-port.radius-atom.radius)));
  for(let a=0;a<projected.ports.length;a++)for(let b=a+1;b<projected.ports.length;b++){
    const first=projected.ports[a],second=projected.ports[b];clearances[a]=Math.min(clearances[a],Math.hypot(first.x-second.x,first.y-second.y)-first.radius-second.radius);
    clearances[b]=Math.min(clearances[b],Math.hypot(first.x-second.x,first.y-second.y)-first.radius-second.radius);
  }
  const rayVisibility=projected.ports.map(port=>{
    const atom=projected.atoms[port.atom],rayLength=Math.hypot(port.x-atom.x,port.y-atom.y),samples=12;let visible=0;
    for(let index=1;index<=samples;index++){
      const t=index/(samples+1),sample={x:atom.x+(port.x-atom.x)*t,y:atom.y+(port.y-atom.y)*t,z:atom.z+(port.z-atom.z)*t};
      const occluded=projected.atoms.some((other,id)=>id!==port.atom&&Math.hypot(sample.x-other.x,sample.y-other.y)<other.radius&&other.z+other.radius>sample.z);
      if(!occluded)visible++;
    }
    return rayLength>atom.radius+port.radius?visible/samples:0;
  });
  let containment=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const atom of projected.atoms){
    minX=Math.min(minX,atom.x-atom.radius);maxX=Math.max(maxX,atom.x+atom.radius);minY=Math.min(minY,atom.y-atom.radius);maxY=Math.max(maxY,atom.y+atom.radius);
    containment=Math.max(containment,FRAME_MARGIN-(atom.x-atom.radius),atom.x+atom.radius-(projected.width-FRAME_MARGIN),FRAME_MARGIN-(atom.y-atom.radius),atom.y+atom.radius-(projected.height-FRAME_MARGIN));
  }
  for(const port of projected.ports){
    minX=Math.min(minX,port.x-port.radius);maxX=Math.max(maxX,port.x+port.radius);minY=Math.min(minY,port.y-port.radius);maxY=Math.max(maxY,port.y+port.radius);
    containment=Math.max(containment,FRAME_MARGIN-(port.x-port.radius),port.x+port.radius-(projected.width-FRAME_MARGIN),FRAME_MARGIN-(port.y-port.radius),port.y+port.radius-(projected.height-FRAME_MARGIN));
  }
  const footprint=(maxX-minX)*(maxY-minY)/(projected.width*projected.height);
  return{minimumClearance:Math.min(...clearances),meanClearance:clearances.reduce((sum,value)=>sum+value,0)/clearances.length,rayVisibility:Math.min(...rayVisibility),containment,footprint};
}

function betterScore(candidate,current){
  const keys=['minimumClearance','meanClearance','rayVisibility','containment','footprint'];
  for(let index=0;index<keys.length;index++){
    const key=keys[index],a=candidate.score[key],b=current.score[key];
    if(Math.abs(a-b)<1e-7)continue;
    return index<3?a>b:a<b;
  }
  return candidate.order<current.order;
}

// Every view candidate is scored from the settled atom and attachment-port layout.
// A single returned view is shared by the interactive and generated renderers.
export function canonicalPartView(THREE,layout){
  if(!layout?.atoms?.length||!Array.isArray(layout.ports)||!layout.ports.length)throw new Error('Canonical part view needs settled atoms and attachment ports.');
  const candidates=[];let order=0;
  for(let pitchIndex=0;pitchIndex<=12;pitchIndex++){
    const pitch=(-90+pitchIndex*15)*DEG;
    for(let yawIndex=0;yawIndex<24;yawIndex++){
      const yaw=yawIndex*15*DEG;
      for(let rollIndex=0;rollIndex<12;rollIndex++){
        const roll=rollIndex*30*DEG,view={pitch,yaw,roll};
        const perspective=projectionScore(layout,projectLayout(THREE,layout,view,{projection:'perspective'}));
        const orthographic=projectionScore(layout,projectLayout(THREE,layout,view,{projection:'orthographic'}));
        const score={
          minimumClearance:Math.min(perspective.minimumClearance,orthographic.minimumClearance),
          meanClearance:(perspective.meanClearance+orthographic.meanClearance)/2,
          rayVisibility:Math.min(perspective.rayVisibility,orthographic.rayVisibility),
          containment:Math.max(perspective.containment,orthographic.containment),
          footprint:(perspective.footprint+orthographic.footprint)/2,
        };
        candidates.push({view,score,order:order++});
      }
    }
  }
  candidates.sort((a,b)=>{
    if(betterScore(a,b))return-1;if(betterScore(b,a))return 1;return 0;
  });
  return{...candidates[0].view,score:{...candidates[0].score},fitRadius:fitRadius(layout)};
}

export function projectCanonicalPartLayout(THREE,layout,view,options={}){
  return projectLayout(THREE,layout,view,options);
}
