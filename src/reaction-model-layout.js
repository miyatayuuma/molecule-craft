import {REACTION_MODEL_METRICS} from '../generated/reaction-model-metrics.js';
export const reactionModelMetric=item=>REACTION_MODEL_METRICS[`${item.polymerUnit?'polymer':'molecule'}-${item.id}`];

// One world-to-pixel scale per equation, not one fit per molecule. All symbols
// occupy dedicated slots. Large units clip inside their own slot, never over +/→.
export function reactionEquationLayout(inputs,outputs,width=280,height=100){
 const sides=[inputs,outputs],all=sides.flat(),models=all.map(reactionModelMetric);
 if(models.some(m=>!m))throw new Error('Missing reaction model projection');
 const plus=12,arrow=24,pad=4,gap=4;
 const natural=sides.map(side=>side.reduce((sum,item)=>sum+reactionModelMetric(item).width,0));
 const signs=sides.map(side=>Math.max(0,side.length-1)*plus+side.length*gap);
 const available=Math.max(1,width-pad*2-arrow-signs[0]-signs[1]);
 const scale=Math.max(12,Math.min(25,available/(natural[0]+natural[1]),(height-14)/Math.max(...models.map(m=>m.height))));
 const leftShare=Math.max(.30,Math.min(.66,natural[0]/(natural[0]+natural[1])));
 const widths=[available*leftShare+signs[0],available*(1-leftShare)+signs[1]],placements=[],symbols=[];
 let x=pad;
 sides.forEach((side,sideIndex)=>{
   const slotTotal=widths[sideIndex]-signs[sideIndex];
   side.forEach((item,i)=>{
     const m=reactionModelMetric(item),slot=slotTotal*m.width/natural[sideIndex];
     placements.push({item,x:x+gap/2,y:height/2,width:slot,height:height-8,modelWidth:m.width*scale,modelHeight:m.height*scale,scale});
     x+=slot+gap;
     if(i<side.length-1){symbols.push({kind:'plus',x:x+plus/2,y:height/2});x+=plus;}
   });
   if(sideIndex===0){symbols.push({kind:'arrow',x:x+arrow/2,y:height/2});x+=arrow;}
 });
 return{width,height,scale,placements,symbols};
}
