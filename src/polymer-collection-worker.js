import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerReferenceModel} from './polymer-reference-model.js?v=7';

// Dedicated Collection worker: exactly 30 repeat units, without the extra
// continuation unit used by Reaction Lab's finite-to-reference transition.
self.onmessage=event=>{
  try{
    const {polymerId,units}=event.data??{};
    if(units!==30)throw new RangeError('Collection requires 30 repeat units');
    self.postMessage({plan:createPolymerReferenceModel(THREE,polymerId,units)});
  }catch(error){self.postMessage({error:String(error?.message??error)});}
};
