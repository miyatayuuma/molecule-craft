import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerReferenceModel} from './polymer-reference-model.js?v=7';

self.onmessage=async event=>{
  try{
    if(event.data.polymerId==='phenol-formaldehyde-resin'&&event.data.units===100){
      const response=await fetch(new URL('../data/phenolic-reference-100.json',import.meta.url));
      if(!response.ok)throw new Error(`phenolic-reference-asset-${response.status}`);
      const plan=await response.json();
      if(plan.polymerId!=='phenol-formaldehyde-resin'||plan.unitCount!==100||plan.ringCount!==100||plan.aromaticCycles?.length!==100||plan.bridges?.length!==99)throw new Error('phenolic-reference-asset-invalid');
      self.postMessage({plan});return;
    }
    self.postMessage({plan:createPolymerReferenceModel(THREE,event.data.polymerId,event.data.units,{extraRepeat:['polyethylene-terephthalate','polyethylene-adipate','polyethylene-adipamide','nylon-6-6'].includes(event.data.polymerId)})});
  }
  catch(error){self.postMessage({error:String(error?.message??error)});}
};
