// The campaign ends at a place, never at a recipe or collection-count gate.
export const CHO_DESTINATION=Object.freeze({x:280,y:-12470,radius:95,label:'CHOの最深部'});
export const isCHO=atoms=>atoms.every(atom=>['H','C','O'].includes(typeof atom==='string'?atom:atom.element));

export function recordChoDestination(run,old){
  if(!run.map.universe||run.destinationReached||run.captured)return;
  const p=run.player,d=CHO_DESTINATION,dx=p.x-old.x,dy=p.y-old.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((d.x-old.x)*dx+(d.y-old.y)*dy)/length)):0;
  if(Math.hypot(old.x+t*dx-d.x,old.y+t*dy-d.y)<=d.radius){
    run.destinationReached=true;run.events.push({type:'choDestination'});
  }
}
