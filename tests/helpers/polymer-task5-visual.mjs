// Task⑤ static visual campaign. Never called inside a performance window.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import * as THREE from '../../vendor/three/three.module.min.js';

function pngPixels(buffer){
  assert.equal(buffer.toString('hex',0,8),'89504e470d0a1a0a');let width,height,type,depth,offset=8,chunks=[];
  while(offset<buffer.length){const n=buffer.readUInt32BE(offset),kind=buffer.toString('ascii',offset+4,offset+8),data=buffer.subarray(offset+8,offset+8+n);if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];}if(kind==='IDAT')chunks.push(data);offset+=n+12;}
  assert.equal(depth,8);assert.ok(type===2||type===6);const channels=type===6?4:3,stride=width*channels,raw=inflateSync(Buffer.concat(chunks)),pixels=Buffer.alloc(height*stride);let src=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[src++];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;pixels[i]=(raw[src++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
  return{width,height,pixels,channels};
}
function countsFromMask(buffer){const {pixels,channels}=pngPixels(buffer),counts=new Map();for(let i=0;i<pixels.length;i+=channels){const color=(pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2];counts.set(color,(counts.get(color)??0)+1);}return counts;}
const maskColor=id=>(Math.imul(id,73856093)>>>0)&0xffffff;
const digest=data=>createHash('sha256').update(data).digest('hex');
function rgbAt(raster,x,y){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=raster.width||y>=raster.height)return[0,0,0];const i=(y*raster.width+x)*raster.channels;return[raster.pixels[i],raster.pixels[i+1],raster.pixels[i+2]];}
function matchesMask(raster,color,x,y){const rgb=rgbAt(raster,x,y);if(color===0)return Math.max(...rgb)<=16;const target=[color>>16,(color>>8)&255,color&255],norm=target.reduce((n,v)=>n+v*v,0),alpha=rgb.reduce((n,v,i)=>n+v*target[i],0)/norm;return alpha>=.50&&alpha<=1.02&&rgb.reduce((n,v,i)=>n+(v-alpha*target[i])**2,0)<=192;}
function continuousLanes(view,lanes,mask){const dpr=view.canvas.dpr,minLength=Math.min(...lanes.map(l=>Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y))),steps=Math.ceil(minLength*2);let best=0,run=0;
  for(let j=0;j<=steps;j++){const t=j/steps,points=lanes.map(l=>({x:l.a.x+(l.b.x-l.a.x)*t,y:l.a.y+(l.b.y-l.a.y)*t})),hit=lanes.every((l,i)=>{const dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,n=Math.hypot(dx,dy),color=maskColor(1024+view.lanes.indexOf(l));return[-.5,0,.5].some(k=>matchesMask(mask,color,(points[i].x-k*dy/n)*dpr,(points[i].y+k*dx/n)*dpr));})&&points.slice(1).every((p,i)=>matchesMask(mask,0,(p.x+points[i].x)*dpr/2,(p.y+points[i].y)*dpr/2));
    run=hit?run+1:0;best=Math.max(best,run);
  }return Math.max(0,best-1)*minLength/steps;
}
const luminance=rgb=>rgb.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
function contourGrade(atom,view,mask,actual){const dpr=view.canvas.dpr,r=atom.radius*dpr,color=maskColor(atom.index+1),cx=atom.center.x*dpr,cy=atom.center.y*dpr,ox=view.canvas.left*dpr,oy=view.canvas.top*dpr;let exposed=0,contrast=0,clipped=0,visible=0;
  for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++){const rgb=rgbAt(mask,x,y),key=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2];if(key!==color)continue;visible++;if(rgbAt(actual,x+ox,y+oy).every(v=>v>=250))clipped++;}
  for(let k=0;k<72;k++){const angle=k*Math.PI/36,dx=Math.cos(angle),dy=Math.sin(angle);let edge=null;for(let rr=r*.7;rr<=r*1.15;rr+=.5)if(matchesMask(mask,color,cx+dx*rr,cy+dy*rr))edge=rr;if(edge===null||!matchesMask(mask,0,cx+dx*(edge+2*dpr),cy+dy*(edge+2*dpr)))continue;exposed++;const inside=rgbAt(actual,cx+dx*edge+ox,cy+dy*edge+oy),outside=rgbAt(actual,cx+dx*(edge+2*dpr)+ox,cy+dy*(edge+2*dpr)+oy);if(Math.abs(luminance(inside)-luminance(outside))>=.05)contrast++;}
  return{exposed,contrast,contrastRatio:exposed?contrast/exposed:0,whiteClipRatio:visible?clipped/visible:1,pass:exposed>0&&contrast/exposed>=.75&&(atom.element==='H'||clipped/Math.max(1,visible)<=.30)};
}

export async function auditPolymerTask5Visual({evaluate,send,artifactDir,route,viewport,sourceSha}){
  const dir=join(artifactDir,'task5',route.polymerId);await mkdir(dir,{recursive:true});
  await evaluate("document.querySelector('[data-polymer-view-reset]').click()");
  const initial=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()'),graphDigest=digest(JSON.stringify(initial.graph)),S=initial.fit.safeRegion,atoms=initial.atoms;
  assert.equal(atoms.length,initial.graph.atoms.length);assert.ok(atoms.every(a=>a.visible));
  const corners=atoms.flatMap(a=>a.corners),bounds={left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
  assert.ok(bounds.left>=S.left-1&&bounds.right<=S.right+1&&bounds.top>=S.top-1&&bounds.bottom<=S.bottom+1,route.routeId+': A01 full sphere cubes');
  const occupancy=Math.max((bounds.right-bounds.left)/S.width,(bounds.bottom-bounds.top)/S.height);assert.ok(occupancy>=.69&&occupancy<=.95,route.routeId+': A02 occupancy');
  for(let i=0;i<initial.graph.bonds.length;i++)assert.equal(initial.lanes.filter(l=>l.bondIndex===i).length,initial.graph.bonds[i].order,route.routeId+': exact real lane count');
  const screenshot=Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64');await writeFile(join(dir,'overview.png'),screenshot);
  let qReset=new THREE.Quaternion(...initial.pose.quaternion);const up=new THREE.Vector3(0,1,0),right=new THREE.Vector3(1,0,0),views=[],atomCoverage=new Map(),bondCoverage=new Map();
  // Fixed budget: yaw0..315 × pitch−60..60, no roll or moving camera. Keep all
  // forty masks, including failures; no best-photo selection or synthetic RAF.
  async function grid(label){
  for(const pitch of [-60,-30,0,30,60])for(let yaw=0;yaw<360;yaw+=45){
    const q=new THREE.Quaternion().setFromAxisAngle(right,pitch*Math.PI/180).multiply(new THREE.Quaternion().setFromAxisAngle(up,yaw*Math.PI/180)).multiply(qReset).normalize();
    const view=await evaluate(`window.__reactionLabProbe.setPolymerObservationPose({quaternion:${JSON.stringify(q.toArray())}})`),dataUrl=await evaluate('window.__reactionLabProbe.polymerIdMask()'),mask=Buffer.from(dataUrl.split(',')[1],'base64'),counts=countsFromMask(mask),raster=pngPixels(mask),dpr=view.canvas.dpr;
    const name=`${label}-id-mask-y${yaw}-p${pitch}.png`;await writeFile(join(dir,name),mask);
    const needsActual=view.atoms.some(a=>!atomCoverage.has(a.index));let actual=null,actualName=null,actualDigest=null;if(needsActual){const bytes=Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64');actual=pngPixels(bytes);actualName=`${label}-render-y${yaw}-p${pitch}.png`;actualDigest=digest(bytes);await writeFile(join(dir,actualName),bytes);}
    const depthOK=view.atoms.every(a=>a.corners.every(p=>p.depth>.2&&p.depth<view.camera.far));
    const visibleAtoms=[];for(const a of view.atoms){const visible=(counts.get(maskColor(a.index+1))??0)/(Math.PI*(a.radius*dpr)**2);const minimumDiameter=(label==='overview'?(a.element==='H'?4:6):(a.element==='H'?6:10));if(depthOK&&visible>=.60&&a.radius*2>=minimumDiameter-.5){const grade=actual?contourGrade(a,view,raster,actual):atomCoverage.get(a.index)?.contour;if(grade?.pass){atomCoverage.set(a.index,{quaternion:q.toArray(),visibleRatio:visible,contour:grade,actualPNG:actualName,actualSha256:actualDigest});visibleAtoms.push(a.index);}}}
    const visibleBonds=[];
    for(let i=0;i<view.graph.bonds.length;i++){const lanes=view.lanes.filter(l=>l.bondIndex===i),lengths=lanes.map(l=>Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y)),widths=lanes.map(l=>2*l.radius),pixels=lanes.map(l=>counts.get(maskColor(1024+view.lanes.indexOf(l)))??0);
      const gaps=lanes.slice(1).map((l,n)=>Math.hypot((l.a.x+l.b.x-lanes[n].a.x-lanes[n].b.x)/2,(l.a.y+l.b.y-lanes[n].a.y-lanes[n].b.y)/2)-l.radius-lanes[n].radius);
      if(lanes.length===view.graph.bonds[i].order&&lengths.every(n=>n>=7.75)&&widths.every(n=>n>=1.25)&&gaps.every(n=>n>=.75)&&pixels.every((n,j)=>n>=lengths[j]*widths[j]*dpr*dpr*.50)&&depthOK&&continuousLanes(view,lanes,raster)>=7.75){bondCoverage.set(i,{quaternion:q.toArray(),lengths,widths,gaps,pixels});visibleBonds.push(i);}}
    views.push({mode:label,selection:view.observation.selection,yaw,pitch,quaternion:q.toArray(),mask:name,sha256:digest(mask),visibleAtoms,visibleBonds});
  }
  }
  await grid('overview');
  const localAttempts=[];
  // At most one declared local shell per real atom. Select through the same
  // explicit indexed atom menu offered to users; no chemical/geometry rewrite.
  for(let atom=0;atom<initial.graph.atoms.length;atom++){
    const needed=!atomCoverage.has(atom)||initial.graph.bonds.some((b,i)=>(b.a===atom||b.b===atom)&&!bondCoverage.has(i));if(!needed)continue;
    await evaluate('window.__reactionLabProbe.setPolymerObservationPose({reset:true})');
    const result=await evaluate(`(()=>{const p=window.__reactionLabProbe.polymerObservation(),i=p.targets.findIndex(t=>t.target.kind==='atom'&&t.target.atomIndices[0]===${atom}),select=document.querySelector('[data-observation-target]');select.value=String(i);select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-observation-focus]').click();return window.__reactionLabProbe.polymerVisualSnapshot()})()`);
    assert.equal(result.observation.state,'LOCAL_FOCUS');qReset=new THREE.Quaternion(...result.pose.quaternion);const image=Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'),name=`local-atom-${atom}.png`;await writeFile(join(dir,name),image);localAttempts.push({atom,pose:result.pose,screenshot:name,sha256:digest(image)});await grid(`local-${atom}`);
  }
  await evaluate('window.__reactionLabProbe.setPolymerObservationPose({reset:true})');
  const report={kind:'STATIC_BROWSER_PNG_AND_TEST_ONLY_ID_MASK',sourceSha,routeId:route.routeId,polymerId:route.polymerId,sampleId:initial.observation.sampleId,graphDigest,viewport,DPR:initial.canvas.dpr,motion:await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'normal'"),initial,screenshot:{path:'overview.png',sha256:digest(screenshot)},occupancy,views,atomWitnesses:Object.fromEntries(atomCoverage),bondWitnesses:Object.fromEntries(bondCoverage),missingAtoms:atoms.map(a=>a.index).filter(i=>!atomCoverage.has(i)),missingBonds:initial.graph.bonds.map((_,i)=>i).filter(i=>!bondCoverage.has(i)),localRecovery:{completed:true,localAttempts},comparisonStates:[],ringSimultaneous:initial.observation.targets.filter(t=>t.target.kind.startsWith('aromatic-')).map(t=>({kind:t.target.kind,bondIndices:t.target.bondIndices,witness:views.find(v=>t.target.bondIndices.every(i=>v.visibleBonds.includes(i)))??null})),rasterLuminance:{completed:true,method:'72 exposed contour rays; linear sRGB delta .05 on adjacent2 CSS px; white clip30%; H exception only for clipping'}};
  async function press(selector){const point=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b||b.disabled||b.hidden)throw Error('Unavailable control '+${JSON.stringify(selector)});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0});}
  async function stable(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
  for(const kind of ['before','after',...(route.completionEvidence.byproducts.water?['water']:[]),...(route.builder==='network'?['concept']:[])]){
    await press('[data-observation-menu]');await press(`[data-observation-${kind}]`);await stable();const before=await evaluate('window.__reactionLabProbe.polymerObservation()');assert.equal(before.state,{before:'COMPARE_BEFORE',after:'COMPARE_AFTER',water:'COMPARE_BYPRODUCT',concept:'CONCEPT_SEPARATE'}[kind]);
    await press('[data-lab-close]');await stable();await press('#open-reaction-lab');await stable();const reopened=await evaluate('window.__reactionLabProbe.polymerObservation()');assert.equal(reopened.state,before.state);assert.equal(reopened.comparisonIdentity,before.comparisonIdentity,'comparison identity survives close/reopen');assert.equal(reopened.comparisonGraph?.atoms.length,before.comparisonGraph?.atoms.length);
    if(kind==='before'||kind==='water'){const changed=viewport.width===360?{width:390,height:844,mobile:true}:{width:360,height:780,mobile:true};await send('Emulation.setDeviceMetricsOverride',{...changed,deviceScaleFactor:initial.canvas.dpr});await stable();const resized=await evaluate('window.__reactionLabProbe.polymerObservation()');assert.ok(resized.comparisonFit.fits,'active comparison refits on resize');await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:initial.canvas.dpr});await stable();}
    const png=Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'),name=`compare-${kind}.png`;await writeFile(join(dir,name),png);report.comparisonStates.push({kind,before,reopened,screenshot:name,sha256:digest(png)});
  }
  await evaluate('window.__reactionLabProbe.setPolymerObservationPose({reset:true})');const final=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()');assert.equal(digest(JSON.stringify(final.graph)),graphDigest,'selection/comparison/resize leave chemistry and origin unchanged');assert.equal(final.metrics.finiteLayoutCalls,initial.metrics.finiteLayoutCalls,'all observations solve geometry zero times');
  await writeFile(join(dir,'visual.json'),JSON.stringify(report,null,2));
  // Coverage gaps remain explicit; local-focus campaign is required before
  // A07 can be accepted. This report alone never declares Task⑤ complete.
  return report;
}
