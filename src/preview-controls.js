// View-only state. Never receives a crafting graph, camera or placements.
export function createPreviewControls(changed=()=>{}) {
  const initial={yaw:.32,pitch:-.18,roll:0,zoom:1},view={...initial},pointers=new Map();
  const emit=()=>changed({...view});
  const zoom=factor=>{view.zoom=Math.max(.45,Math.min(2.8,view.zoom*factor));};
  const pair=()=>{const [a,b]=[...pointers.values()];return {distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),angle:Math.atan2(b.y-a.y,b.x-a.x)};};
  return {
    snapshot:()=>({...view}),
    down(id,x,y){if(pointers.size<2)pointers.set(id,{x,y});},
    move(id,x,y){
      const previous=pointers.get(id);if(!previous)return;
      if(pointers.size===1){view.yaw+=(x-previous.x)*.009;view.pitch+=(y-previous.y)*.009;pointers.set(id,{x,y});}
      else{const before=pair();pointers.set(id,{x,y});const after=pair();zoom(after.distance/before.distance);view.roll+=Math.atan2(Math.sin(after.angle-before.angle),Math.cos(after.angle-before.angle));}
      emit();
    },
    up:id=>pointers.delete(id),cancel:()=>pointers.clear(),
    zoom(factor){zoom(factor);emit();},
    rotate(yaw,pitch){view.yaw+=yaw;view.pitch+=pitch;emit();},
    reset(){Object.assign(view,initial);pointers.clear();emit();},
  };
}
