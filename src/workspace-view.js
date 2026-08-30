import {structureFrame} from './workspace-model.js?v=20';

// Selection may be cleared by tapping the background; viewing focus must not be.
// The cached pivot survives rotations, but is invalidated by actual deformation.
export function createWorkspaceView(){
  let anchorId=null,previousIds=new Set(),signature=null,pivot=null;
  function resolve(structures,fallback=null){
    let focus=structures.find(item=>item.ids.has(anchorId));
    if(!focus){
      let overlap=0;
      for(const item of structures){const count=[...item.ids].filter(id=>previousIds.has(id)).length;if(count>overlap){overlap=count;focus=item;}}
    }
    focus??=fallback??structures[0]??null;
    if(focus?.signature!==signature){pivot=null;signature=focus?.signature??null;}
    previousIds=new Set(focus?.ids??[]);
    if(!focus?.ids.has(anchorId))anchorId=focus?.graph.atoms[0]?.id??null;
    return focus;
  }
  return {
    select(id){if(id!=null)anchorId=id;},resolve,
    clear(){anchorId=null;previousIds.clear();signature=null;pivot=null;},
    geometryChanged(){pivot=null;},
    frame(structure,center){anchorId=structure.graph.atoms[0].id;previousIds=new Set(structure.ids);signature=structure.signature;pivot={x:center.x,y:center.y,z:center.z};},
    capture(structures,fallback,positionFor){
      const focus=resolve(structures,fallback);if(!focus)return null;
      pivot??=structureFrame(focus,positionFor,44,1)?.center??null;
      return pivot?{ids:new Set(focus.ids),center:{...pivot}}:null;
    },
  };
}

export function rotateStructure(rotation,positionFor,quaternion){
  if(!rotation)return;
  for(const id of rotation.ids){const point=positionFor(id);if(point)point.sub(rotation.center).applyQuaternion(quaternion).add(rotation.center);}
}
