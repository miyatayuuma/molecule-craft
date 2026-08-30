import {planSpawn} from '../src/spawn-layout.js?v=28';
import {createPreviewModel} from '../src/preview-model.js?v=26';
import {ELEMENTS} from '../src/chemistry.js?v=20';
import {unpairedElectronCount,lonePairCount,valenceShellRadius} from '../src/bonding-model.js';

export function checkSpawnLayouts(THREE,templates){
  let cases=0;
  for(const template of templates){
    const model=createPreviewModel(THREE,{...template,attachments:undefined});for(let i=0;i<220;i++)model.step();
    const layout=model.snapshot(),orders=template.atoms.map(()=>0);
    for(const [a,b,n] of template.bonds){orders[a]+=n;orders[b]+=n;}
    const parts=layout.atoms.map((atom,i)=>{const r=ELEMENTS[atom.element].radius;return{x:atom.point.x,y:atom.point.y,z:-atom.point.z,radius:Math.max(r*1.04,(unpairedElectronCount(atom.element,orders[i])||lonePairCount(atom.element,orders[i]))?valenceShellRadius(atom.element,r*1.02)+.08:0)+.06};});
    for(const [width,height,distance] of [[390,430,3],[390,430,10],[900,430,10]]){
      const plan=planSpawn({parts,width,height,insets:{left:18,right:18,top:88,bottom:72},distance,obstacles:[{x:0,y:0,z:0,radius:.6}],anchor:{x:3,y:2,z:0}});
      if(!plan||plan.distance<distance)throw new Error(`${template.id}: missing fit or zoomed in`);
      const camera=new THREE.PerspectiveCamera(44,width/height,.01,200);camera.position.z=plan.distance;camera.lookAt(0,0,0);camera.updateMatrixWorld();
      // Independent Three.js projection of sphere surfaces, not just the planner
      // bounds or connection-atom center. Includes electrons at the outer radius.
      for(const part of parts)for(let i=0;i<64;i++){
        const y=1-2*(i+.5)/64,r=Math.sqrt(1-y*y),a=i*2.3999632297;
        const p=new THREE.Vector3(part.x+plan.x+r*Math.cos(a)*part.radius,part.y+plan.y+y*part.radius,part.z+r*Math.sin(a)*part.radius).project(camera);
        const x=(p.x+1)*width/2,screenY=(1-p.y)*height/2;
        if(x<18-1e-6||x>width-18+1e-6||screenY<88-1e-6||screenY>height-72+1e-6||p.z<-1||p.z>1)throw new Error(`${template.id}: sphere/electron outside viewport`);
      }
      cases++;
    }
  }
  return `${cases} whole-part spawn projections passed (${templates.length} parts; portrait, landscape, close zoom)`;
}
