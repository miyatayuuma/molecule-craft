import {compileReactionGuide} from '../reaction-lab-guidance.js?v=1';
export const REACTION_RECIPE_FIELD_CONFIG=Object.freeze({discoveryRate:.30,spawnChance:.15,fieldCap:1,readyWeight:2,minDistance:100,maxDistance:240,pickupRadius:32});
export function recipeCandidatePool({authority,progress,records,collection,config=REACTION_RECIPE_FIELD_CONFIG}){
  if(!authority||!progress||!collection||collection.discoveredCount<Math.ceil(records.length*config.discoveryRate))return [];
  return authority.entries().filter(e=>e.encyclopediaIncluded&&progress.getState(e.reactionId)==='notFound').map(entry=>({entry,guide:compileReactionGuide(entry,records)})).filter(x=>x.guide.ok).map(x=>({...x,weight:x.guide.species.every(id=>collection.hasMolecule(id))?config.readyWeight:1}));
}
export function chooseFieldRecipe({authority,progress,records,collection,runId,dust,player,random,config=REACTION_RECIPE_FIELD_CONFIG}){
  if(progress?.fieldRecipeCount(runId,'field')>=config.fieldCap)return null;
  const pool=recipeCandidatePool({authority,progress,records,collection,config});if(!pool.length||random()>=config.spawnChance)return null;
  let n=random()*pool.reduce((sum,x)=>sum+x.weight,0),choice=pool.at(-1);for(const candidate of pool){n-=candidate.weight;if(n<0){choice=candidate;break;}}
  const drop={reactionId:choice.entry.reactionId,source:'field'};
  return placeFieldRecipe(drop,dust,player,random,config)??{...drop,pending:true};

}
export function recipeSegmentDistance(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/l)):0;return Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t);}

export function placeFieldRecipe(drop,dust,player,random=()=>0,config=REACTION_RECIPE_FIELD_CONFIG){
  const candidates=(dust??[]).filter(d=>Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.ready<=0&&d.cluster===undefined&&!d.flow&&Math.hypot(d.x-player.x,d.y-player.y)>=config.minDistance&&Math.hypot(d.x-player.x,d.y-player.y)<=config.maxDistance);
  if(!candidates.length)return null;
  const pos=candidates[Math.floor(random()*candidates.length)];return {reactionId:drop.reactionId,source:drop.source,x:pos.x,y:pos.y};
}

export const TNT_RECIPE_CHANCE=.55;
export function chooseTntRecipe({authority,progress,records,collection,runId,random=Math.random}){
  if(progress.fieldRecipeCount(runId,'tnt')>=2 || progress.fieldRecipeCount(runId,'field')+progress.fieldRecipeCount(runId,'tnt')>=3)return null;
  const pool=recipeCandidatePool({authority,progress,records,collection,config:{...REACTION_RECIPE_FIELD_CONFIG,discoveryRate:0}});
  if(!pool.length || random()>=TNT_RECIPE_CHANCE)return null;
  let n=random()*pool.reduce((sum,item)=>sum+item.weight,0);
  for(const candidate of pool){n-=candidate.weight;if(n<0)return candidate.entry.reactionId;}
  return pool.at(-1).entry.reactionId;
}
