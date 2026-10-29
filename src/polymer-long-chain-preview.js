import * as THREE from '../vendor/three/three.module.min.js';
import {createCollectionViewer} from './collection-viewer.js?v=42';

// Read-only, centered 30-unit display geometry. The reference plan owns all
// chemical connections; Collection neither edits it nor uses a finite Sample.
export function createPolymerLongChainLayout(THREE,plan){
  if(plan?.unitCount!==30||!Array.isArray(plan.atoms)||!plan.atoms.length||!Array.isArray(plan.bonds))throw new Error('Invalid 30-unit reference plan');
  const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
  for(const atom of plan.atoms){
    if(!['C','H','O','N','F','Cl'].includes(atom.element)||![atom.x,atom.y,atom.z].every(Number.isFinite))throw new Error('Invalid reference atom');
    const point=new THREE.Vector3(atom.x,atom.y,atom.z);min.min(point);max.max(point);
  }
  const center=min.add(max).multiplyScalar(.5);
  const atoms=plan.atoms.map(atom=>({element:atom.element,charge:0,point:new THREE.Vector3(atom.x,atom.y,atom.z).sub(center)}));
  const bonds=plan.bonds.map(bond=>({a:bond.a,b:bond.b,order:bond.order}));
  if(bonds.some(bond=>!Number.isInteger(bond.a)||!Number.isInteger(bond.b)||bond.a<0||bond.b<0||bond.a>=atoms.length||bond.b>=atoms.length||![1,2,3].includes(bond.order)))throw new Error('Invalid reference bond');
  const aromaticCycles=(plan.aromaticCycles??[]).map(cycle=>[...cycle]);
  if(aromaticCycles.some(cycle=>cycle.some(id=>!Number.isInteger(id)||id<0||id>=atoms.length)))throw new Error('Invalid aromatic cycle');
  return{atoms,bonds,aromaticCycles,ports:[],sharedGroups:[],stereoDescriptor:null,unitCount:30};
}

export function mountPolymerLongChainPreview({host,polymerId,name}){
  const unitLabel=polymerId==='phenol-formaldehyde-resin'?'30環':new Set(['ethylene-propylene-copolymer','styrene-butadiene-copolymer','nitrile-butadiene-rubber','butyl-rubber','vinylidene-fluoride-hexafluoropropylene-copolymer']).has(polymerId)?'30構成単位':'30反復単位';
  let disposed=false,worker=null,viewer=null,timer=null;
  const showError=()=>{if(!disposed)host.textContent=`${unitLabel}の模型を準備できませんでした。構成単位に切り替えて観察できます。`;};
  host.textContent=`${unitLabel}の立体模型を準備しています…`;
  try{
    worker=new Worker(new URL('./polymer-collection-worker.js?v=1',import.meta.url),{type:'module'});
    timer=setTimeout(()=>{worker?.terminate();worker=null;timer=null;showError();},12000);
    worker.onmessage=event=>{
      clearTimeout(timer);timer=null;worker?.terminate();worker=null;
      if(disposed)return;
      if(event.data?.error||!event.data?.plan){showError();return;}
      try{
        const layout=createPolymerLongChainLayout(THREE,event.data.plan);
        host.replaceChildren();
        viewer=createCollectionViewer({
          host,record:{atoms:[],bonds:[],attachments:[]},name:`${name}・${unitLabel}`,
          fixedLayout:layout,compact:true,showGestureHint:true,
        });
      }catch(error){console.warn('Polymer 30-unit viewer unavailable',polymerId,error);showError();}
    };
    worker.onerror=()=>{clearTimeout(timer);timer=null;worker?.terminate();worker=null;showError();};
    worker.postMessage({polymerId,units:30});
  }catch(error){clearTimeout(timer);worker?.terminate();worker=null;console.warn('Polymer 30-unit worker unavailable',error);showError();}
  return{
    snapshot:()=>viewer?.snapshot?.()??null,
    view:()=>viewer?.view?.()??null,
    dispose(){if(disposed)return;disposed=true;clearTimeout(timer);worker?.terminate();worker=null;viewer?.dispose();viewer=null;host.replaceChildren();},
  };
}
