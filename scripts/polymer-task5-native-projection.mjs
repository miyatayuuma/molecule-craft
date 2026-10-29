// Owner: docs/validation/polymer-local-fragment-task5-native-projection.md.
// Offline executable, piecewise native constraints; never a production scorer.
// No affine depth, fixed front facet, old screen pool or clearance slack.
import assert from 'node:assert/strict';
import {render} from './analyze-polymer-task5-exact-mesh.mjs';
// Identical frozen DOM predicates; the historically hash-bound visual helper stays unchanged.
function modelOccludesAnnotation(view,p){return(view.domOcclusions?.modelOccluders??[]).some(o=>{if(o.kind==='atom')return Math.hypot(p.x-o.x,p.y-o.y)<=o.radius;const dx=o.b.x-o.a.x,dy=o.b.y-o.a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-o.a.x)*dx+(p.y-o.a.y)*dy)/n)):0;return Math.hypot(p.x-o.a.x-t*dx,p.y-o.a.y-t*dy)<=o.width/2;});}
export function underDom(view,p,{annotations=true}={}){const o=view.domOcclusions;if(!o)return false;return o.rectangles.some(r=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom)||annotations&&o.circles.some(c=>Math.abs(Math.hypot(p.x-c.x,p.y-c.y)-c.radius)<=c.stroke/2)&&!modelOccludesAnnotation(view,p);}

function rectangleErasesPixel(view,x,y,dpr=view.canvas?.dpr??1){
  const width=view.canvas?.bufferWidth??Infinity,height=view.canvas?.bufferHeight??Infinity;
  return view.domOcclusions.rectangles.some(q=>x>=Math.max(0,Math.floor(q.left*dpr))&&x<Math.min(width,Math.ceil(q.right*dpr))&&y>=Math.max(0,Math.floor(q.top*dpr))&&y<Math.min(height,Math.ceil(q.bottom*dpr)));
}

const r=Math.fround;
export function nativeTriangle(t,x,y,near,far){
  const {a,b,c,den}=t;
  if(t.culled||Math.abs(den)<1e-12)return null;
  // Three independent edge functions. The third is NOT 1-u-v: rounding that
  // expression changes ownership of exactly-on-edge native pixels.
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
  const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
  const w=((a.y-b.y)*(x-b.x)+(b.x-a.x)*(y-b.y))/den;
  const inclusive=(p,q)=>{if(den<0)[p,q]=[q,p];return q.y<p.y||q.y===p.y&&q.x>p.x;};
  const covered=u>=0&&v>=0&&w>=0&&!(u===0&&!inclusive(b,c)||v===0&&!inclusive(c,a)||w===0&&!inclusive(a,b));
  const cameraDepth=1/(u/a.depth+v/b.depth+w/c.depth);
  const D=r(1/r(r(b.x-a.x)*r(c.y-a.y)-r(c.x-a.x)*r(b.y-a.y)));
  const za=r(b.ndc-a.ndc),zb=r(c.ndc-a.ndc);
  const DA=r(r(r(c.y-a.y)*za-r(b.y-a.y)*zb)*D);
  const DB=r(r(r(b.x-a.x)*zb-r(c.x-a.x)*za)*D);
  const depth=r(r(DA*r(x-a.x)+DB*r(y-a.y))+a.ndc);
  return {covered:covered&&cameraDepth>near&&cameraDepth<far,depth,cameraDepth,
    triangle:t.triangle,barycentric:[u,v,w],plane:[DA,DB,a.ndc],
    // Positive inside, including an exclusive zero edge only as a boundary
    // diagnostic. The actual covered predicate above always decides truth.
    edgeDistances:[u*Math.abs(den)/Math.hypot(b.x-c.x,b.y-c.y),
      v*Math.abs(den)/Math.hypot(c.x-a.x,c.y-a.y),
      w*Math.abs(den)/Math.hypot(a.x-b.x,a.y-b.y)]};
}

export function nativeProjection(snapshot){
  const {canvas,camera}=snapshot.visual,W=canvas.bufferWidth,H=canvas.bufferHeight;
  assert.ok(W>0&&H>0);
  // Same captured native vertex transforms, Float32 arithmetic and 1/16-px
  // quantization as the retained legacy4 CPU oracle. No pixel raster loop here.
  const triangles=render(snapshot,'legacy4',{trace:true,exactEdges:true,projectOnly:true}).triangles;
  const bins=new Map(),bounds=new Map(),cache=new Map(),size=8;
  triangles.forEach((t,order)=>{
    if(t.culled||Math.abs(t.den)<1e-12)return;
    const xs=[t.a.x,t.b.x,t.c.x],ys=[t.a.y,t.b.y,t.c.y];
    const box={left:Math.max(0,Math.ceil(Math.min(...xs)-.5)),right:Math.min(W-1,Math.floor(Math.max(...xs)-.5)),
      top:Math.max(0,Math.ceil(Math.min(...ys)-.5)),bottom:Math.min(H-1,Math.floor(Math.max(...ys)-.5))};
    if(box.left>box.right||box.top>box.bottom)return;
    const previous=bounds.get(t.id);
    bounds.set(t.id,previous?{left:Math.min(previous.left,box.left),right:Math.max(previous.right,box.right),
      top:Math.min(previous.top,box.top),bottom:Math.max(previous.bottom,box.bottom)}:box);
    for(let y=Math.floor(box.top/size);y<=Math.floor(box.bottom/size);y++)for(let x=Math.floor(box.left/size);x<=Math.floor(box.right/size);x++){
      const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push({t,order,box});
    }
  });
  function pixel(x,y){
    assert.ok(Number.isInteger(x)&&Number.isInteger(y));
    if(x<0||y<0||x>=W||y>=H)return {id:0,depth:Infinity,triangle:null};
    const key=x+','+y;if(cache.has(key))return cache.get(key);
    let best={id:0,depth:Infinity,triangle:null};
    for(const {t,order,box} of bins.get(Math.floor(x/size)+','+Math.floor(y/size))??[]){
      if(x<box.left||x>box.right||y<box.top||y>box.bottom)continue;
      const f=nativeTriangle(t,x+.5,y+.5,camera.near,camera.far);
      // Native LEQUAL: equal Float32 depths are owned by the later draw.
      if(f?.covered&&f.depth<=best.depth)best={...f,id:t.id,order};
    }
    cache.set(key,best);return best;
  }
  function front(id,x,y){
    let best=null;
    for(const t of triangles)if(t.id===id){const f=nativeTriangle(t,x,y,camera.near,camera.far);
      if(f?.covered&&(!best||f.depth<=best.depth))best=f;}
    return best;
  }
  return {triangles,bounds,pixel,front,width:W,height:H,cache};
}

export function laneBranch(lane,dpr,pixel,view,id){
  const dx=lane.b.x-lane.a.x,dy=lane.b.y-lane.a.y,length=Math.hypot(dx,dy),steps=Math.ceil(2*length);
  assert.ok(steps>0);
  const samples=[];let best=0,run=0,start=0,bestStart=0;
  for(let j=0;j<=steps;j++){
    const cells=[-.5,0,.5].map(k=>{
      const t=j/steps;
      const x=lane.a.x+dx*t-k*dy/length,y=lane.a.y+dy*t+k*dx/length;
      const floorX=Math.floor(x*dpr),floorY=Math.floor(y*dpr),owner=pixel(floorX,floorY).id;
      return {k,x,y,floorX,floorY,owner,hit:!rectangleErasesPixel(view,floorX,floorY,dpr)&&!underDom(view,{x,y})&&owner===id};
    });
    const hit=cells.some(c=>c.hit);if(hit)run++;else {run=0;start=j+1;}
    if(run>best){best=run;bestStart=start;}
    samples.push({j,hit,cells});
  }
  return {length,steps,ceilArgument:2*length,continuous:Math.max(0,best-1)*length/steps,
    bestStart,bestEnd:bestStart+best-1,samples};
}

export function nativeConstraints(snapshot,group,domOcclusions){
  const projection=nativeProjection(snapshot),v=snapshot.visual,dpr=v.canvas.dpr;
  const view={canvas:v.canvas,lanes:v.lanes,domOcclusions};
  const targets=[...group.atomIndices.map(index=>({kind:'atom',index,id:index+1})),
    ...group.bondIndices.map(index=>({kind:'bond',index,id:1024+v.lanes.findIndex(l=>l.bondIndex===index)}))];
  const objects=targets.map(target=>{
    const box=projection.bounds.get(target.id),rawPixels=[],visiblePixels=[];
    if(box)for(let y=box.top;y<=box.bottom;y++)for(let x=box.left;x<=box.right;x++){
      if(projection.pixel(x,y).id!==target.id)continue;
      rawPixels.push([x,y]);
      // Formal visibility mask erases rectangles using integer floor/ceil;
      // circles use pixel centres and the captured model annotation occluders.
      const erased=rectangleErasesPixel(view,x,y);
      if(!erased&&!underDom({...view,domOcclusions:{...domOcclusions,rectangles:[]}}, {x:(x+.5)/dpr,y:(y+.5)/dpr}))visiblePixels.push([x,y]);
    }
    if(target.kind==='atom'){
      const atom=v.atoms[target.index],required=.6*Math.PI*(atom.radius*dpr)**2,diameter=2*atom.radius;
      return {...target,box,rawPixels,visiblePixels,required,diameter,
        pass:visiblePixels.length>=required&&diameter>=(atom.element==='H'?6:10)-.5};
    }
    const lane=v.lanes.find(l=>l.bondIndex===target.index),branch=laneBranch(lane,dpr,projection.pixel,view,target.id);
    const width=2*lane.radius,required=branch.length*width*dpr*dpr*.5;
    return {...target,box,rawPixels,visiblePixels,required,width,branch,
      pass:branch.length>=7.75&&width>=1.25&&visiblePixels.length>=required&&branch.continuous>=7.75};
  });
  return {objects,projection,jointPass:objects.every(o=>o.pass),
    domain:'captured native mesh; legacy4 CPU arithmetic, exact per-pose branches; NOT universal GPU equivalence'};
}
