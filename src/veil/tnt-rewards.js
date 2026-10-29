import {GROWTH} from './growth.js';
import {MAX_RESOURCE_VALUE} from './resources-persistence.js';

export const TNT_ATOMS_PER_ENEMY=40;
const ELEMENTS=['H','C','N','O'];
// The available room accounts for unbanked cargo and the saved dust remainder.
export function rewardRoomUnits(run,state,element){
  const factor=GROWTH.dustPerAtom[element]??1;
  return Math.max(0,(MAX_RESOURCE_VALUE-(state.elements[element]??0))*factor-(state.dust?.[element]??0)-(run.elementDust[element]??0));
}
export function releaseEaterAtoms(run,state,position,random=Math.random){
  const pending=Object.fromEntries(ELEMENTS.map(el=>[el,0]));
  for(const d of run.map.dust)if(d.tntReward&&d.ready!==Infinity)pending[d.element]=(pending[d.element]??0)+d.value;
  const room=Object.fromEntries(ELEMENTS.map(el=>[el,Math.max(0,Math.floor((rewardRoomUnits(run,state,el)-pending[el])/(GROWTH.dustPerAtom[el]??1)))]));
  const weights=Object.fromEntries(ELEMENTS.map(el=>[el,1]));
  for(const dust of run.map.dust){const el=dust.element??'H';if(!dust.tntReward&&Object.hasOwn(weights,el))weights[el]++;}
  const counts=Object.fromEntries(ELEMENTS.map(el=>[el,0]));
  for(let i=0;i<TNT_ATOMS_PER_ENEMY;i++){
    const eligible=ELEMENTS.filter(el=>room[el]>0);if(!eligible.length)break;
    let n=random()*eligible.reduce((sum,el)=>sum+weights[el],0),chosen=eligible.at(-1);
    for(const el of eligible){n-=weights[el];if(n<0){chosen=el;break;}}
    counts[chosen]++;room[chosen]--;
  }
  let index=0;for(const el of ELEMENTS){if(!counts[el])continue;const angle=index++*2.4,offset=14;
    run.map.dust.push({id:run.map.dust.length,x:position.x+Math.cos(angle)*offset,y:position.y+Math.sin(angle)*offset,angle,element:el,kind:el==='C'?'carbon':el==='O'?'oxygen':'normal',value:counts[el]*(GROWTH.dustPerAtom[el]??1),ready:0,tntReward:true});
  }
  return counts;
}
