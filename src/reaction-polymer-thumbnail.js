// Use the polymer encyclopedia's own unit viewer, with one temporary viewer at a time.
const cache=new Map(), queue=[];
let active=false;
export function polymerReactionImage(id,name){
  const image=document.createElement('img');
  image.alt=`${name}の3D構成単位`; image.dataset.polymerUnit=id;
  if(cache.has(id)) image.src=cache.get(id);
  else {queue.push({id,name,image});queueMicrotask(pump);}
  return image;
}
async function pump(){
  if(active)return;
  while(queue.length){
    const item=queue.shift();
    if(!item.image.isConnected)continue;
    if(cache.has(item.id)){item.image.src=cache.get(item.id);continue;}
    active=true;
    const stage=document.createElement('div');stage.className='polymer-thumbnail-staging';document.body.append(stage);
    let viewer,finished=false,timer;
    const finish=data=>{
      if(finished)return;finished=true;clearTimeout(timer);
      if(data){cache.set(item.id,data);if(item.image.isConnected)item.image.src=data;}
      else {item.image.alt=`${item.name}の模型を読み込めませんでした`;}
      queueMicrotask(()=>{viewer?.dispose();stage.remove();active=false;pump();});
    };
    timer=setTimeout(()=>finish(null),10000);
    try{
      const {mountPolymerUnitPreview}=await import('./polymer-unit-preview.js?v=4');
      if(!finished)viewer=mountPolymerUnitPreview({host:stage,polymerId:item.id,name:item.name,onReady:({snapshot})=>{if(snapshot)finish(snapshot);},onThumbnail:finish});
    }catch(error){console.warn('Polymer unit preview unavailable',item.id,error);finish(null);}
    return;
  }
}
