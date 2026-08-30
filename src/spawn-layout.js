// Camera-local coordinates: x/right, y/up, z/towards the camera, origin at
// cameraTarget. Planning never changes existing atoms or the camera itself.
export function projectSpawnSphere(point,distance,focal,width,height){
  const depth=distance-point.z,r=point.radius??0;
  if(depth<=r+1e-6)return null;
  const extent=value=>{
    const spread=r*Math.sqrt(depth*depth+value*value-r*r),denom=depth*depth-r*r;
    return [(value*depth-spread)/denom,(value*depth+spread)/denom];
  };
  const [left,right]=extent(point.x),[bottom,top]=extent(point.y);
  return {left:width/2+left*focal,right:width/2+right*focal,top:height/2-top*focal,bottom:height/2-bottom*focal};
}
const union=boxes=>({left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))});
const overlaps=(a,b,gap)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;

export function planSpawn({parts,obstacles=[],bonds=[],width,height,insets={},distance,fov=44,anchor={x:0,y:0,z:0},gap=10,maxDistance=36}){
  if(!parts.length||width<1||height<1||distance<=0)return null;
  const safe={left:insets.left??18,right:width-(insets.right??18),top:insets.top??18,bottom:height-(insets.bottom??18)};
  if(safe.right<=safe.left||safe.bottom<=safe.top)return null;
  const focal=height/(2*Math.tan(fov*Math.PI/360));
  const project=(p,d)=>projectSpawnSphere(p,d,focal,width,height);
  const inside=b=>b&&b.left>=safe.left-1e-6&&b.right<=safe.right+1e-6&&b.top>=safe.top-1e-6&&b.bottom<=safe.bottom+1e-6;
  function findAt(d){
    const occupied=[];
    for(const p of obstacles){
      if(d-p.z+(p.radius??0)<=0)continue; // entirely behind the camera
      occupied.push(project(p,d)??{left:0,right:width,top:0,bottom:height});
    }
    for(const bond of bonds){const a=project(bond.a,d),b=project(bond.b,d);if(a&&b)occupied.push(union([a,b]));}
    const relevant=occupied.filter(b=>overlaps(b,safe,gap));
    const atOrigin=parts.map(p=>project(p,d));if(atOrigin.some(p=>!p))return null;
    const box=union(atOrigin),originX=width/2,originY=height/2;
    const focus=project({...anchor,radius:0},d);
    const preferred={x:Math.max(safe.left,Math.min(safe.right,focus?.left??originX)),y:Math.max(safe.top,Math.min(safe.bottom,focus?.top??originY))};
    const xs=new Set([preferred.x,originX,safe.left+originX-box.left,safe.right+originX-box.right]);
    const ys=new Set([preferred.y,originY,safe.top+originY-box.top,safe.bottom+originY-box.bottom]);
    const step=Math.max(10,Math.max(width,height)/40);
    for(let x=safe.left;x<=safe.right;x+=step)xs.add(x);
    for(let y=safe.top;y<=safe.bottom;y+=step)ys.add(y);
    // Obstacle edges make narrow but usable gaps candidates too.
    const nearby=[...relevant].sort((a,b)=>((a.left+a.right)/2-preferred.x)**2+((a.top+a.bottom)/2-preferred.y)**2-((b.left+b.right)/2-preferred.x)**2-((b.top+b.bottom)/2-preferred.y)**2).slice(0,24);
    for(const b of nearby){xs.add(b.right+gap+originX-box.left);xs.add(b.left-gap+originX-box.right);ys.add(b.bottom+gap+originY-box.top);ys.add(b.top-gap+originY-box.bottom);}
    const candidates=[];
    for(const x of xs)if(x>=safe.left&&x<=safe.right)for(const y of ys)if(y>=safe.top&&y<=safe.bottom)candidates.push({x,y,score:(x-preferred.x)**2+(y-preferred.y)**2});
    candidates.sort((a,b)=>a.score-b.score);
    for(const screen of candidates){
      const x=(screen.x-originX)*d/focal,y=(originY-screen.y)*d/focal;
      const boxes=parts.map(p=>project({...p,x:p.x+x,y:p.y+y},d)),bounds=union(boxes);
      if(!inside(bounds)||relevant.some(b=>overlaps(bounds,b,gap)))continue;
      return {x,y,distance:d,zoomed:d>distance+1e-6,bounds};
    }
    return null;
  }
  // Exhaust the current view before considering any camera movement.
  const current=findAt(distance);if(current)return current;
  let low=distance,high=distance,result=null,limit=Math.max(distance,maxDistance);
  while(high<limit){high=Math.min(limit,high*1.12);result=findAt(high);if(result)break;low=high;}
  if(!result)return null;
  // Refine the first fitting zoom level, without zooming in or moving the target.
  for(let i=0;i<6;i++){const middle=(low+high)/2,candidate=findAt(middle);if(candidate){high=middle;result=candidate;}else low=middle;}
  return result;
}
