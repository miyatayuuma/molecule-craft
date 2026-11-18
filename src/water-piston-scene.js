import * as T from '../vendor/three/three.module.min.js';
import { BORE, HIGH, COUNT } from './water-gas.js';

export function createPistonScene(stage) {
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  stage.prepend(renderer.domElement);
  const scene=new T.Scene(), camera=new T.OrthographicCamera(-5,5,9,-9,.1,80);
  const instrument=new T.Group(), piston=new T.Group(), gasGroup=new T.Group();
  const orbit=new T.Group(); orbit.add(camera); scene.add(orbit,instrument,gasGroup);
  scene.fog=new T.Fog(0x315359,22.5,33);
  instrument.add(piston);
  scene.add(new T.HemisphereLight(0xeaffff,0x486378,2));
  const key=new T.DirectionalLight(0xfff2da,3);
  key.position.set(-4,10,8); scene.add(key);
  const metal=color=>new T.MeshStandardMaterial({color,metalness:.42,roughness:.34});
  const navy=metal(0x25495a), silver=metal(0x8daeba), signal=metal(0xffaa42);
  const glass=new T.MeshBasicMaterial({color:0x73d5de,transparent:true,opacity:.058,depthWrite:false,side:T.DoubleSide});
  function cylinder(parent,r,h,y,material,x=0,z=0,open=false) {
    const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,64,1,open),material);
    mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }
  cylinder(instrument,BORE,HIGH+.38,(HIGH+.38)/2,glass,0,0,true);
  cylinder(instrument,BORE+.16,.35,-.18,navy);
  cylinder(instrument,BORE+.10,.09,-.03,silver);
  function rim(y,material) {
    const ring=new T.Mesh(new T.TorusGeometry(BORE,.055,8,80),material);
    ring.rotation.x=Math.PI/2; ring.position.y=y; instrument.add(ring);
  }
  rim(HIGH+.38,silver); rim(.08,silver);
  for (const side of [-1,1]) cylinder(instrument,.055,HIGH+.4,HIGH/2, silver,side*BORE,0);
  // Narrow glass reflections make the front surface legible at low pixel densities.
  const sheen=new T.MeshBasicMaterial({color:0xc0f7ee,transparent:true,opacity:.13,depthWrite:false});
  for(const [angle,arc] of [[-1.12,.075],[-.98,.026],[1.22,.033]]){
    const stripe=new T.Mesh(new T.CylinderGeometry(BORE,BORE,HIGH,64,1,true,angle,arc),sheen);
    stripe.position.y=HIGH/2; instrument.add(stripe);
  }
  const shaft=cylinder(instrument,.11,1,0,silver);
  const bridge=new T.Mesh(new T.BoxGeometry(BORE*2,.15,.32),navy);
  bridge.position.y=HIGH+.39; instrument.add(bridge);
  cylinder(instrument,.28,.26,HIGH+.42,silver);
  cylinder(piston,.36,.18,.34,silver);
  const points=[];
  for(let i=0;i<=28;i++){
    const y=.4+i*.49, x=-BORE-.06;
    points.push(new T.Vector3(x,y,.12),new T.Vector3(x+(i%4===0?.38:.17),y,.12));
  }
  instrument.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x92c2ca})));
  cylinder(piston,BORE-.035,.27,.135,navy);
  cylinder(piston,BORE-.025,.09,.24,silver);
  cylinder(piston,BORE-.025,.055,.07,signal);
  const arm=new T.Mesh(new T.BoxGeometry(BORE+1,.13,.23),silver);
  arm.position.set((BORE+1)/2,.32,0); piston.add(arm);

  const sphere=new T.SphereGeometry(1,10,8), bond=new T.CylinderGeometry(1,1,1,6);
  const instance=(geometry,material,count)=>{
    const batch=new T.InstancedMesh(geometry,material,count);
    batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    batch.frustumCulled=false; gasGroup.add(batch); return batch;
  };
  const oxygen=instance(sphere,metal(0xe34e40),COUNT);
  const hydrogen=instance(sphere,metal(0xf6fcff),COUNT*2);
  const links=instance(bond,metal(0xc3cdd1),COUNT*2);
  const body=new T.Object3D(), part=new T.Object3D(), matrix=new T.Matrix4();
  const local=(x,y,angle,sx,sy,sz)=>{
    part.position.set(x,y,0); part.rotation.set(0,0,angle); part.scale.set(sx,sy,sz);
    part.updateMatrix(); return part.matrix.clone();
  };
  const oxygenY=-.215*Math.cos(52.25*Math.PI/180)*2*1.008/(15.999+2*1.008);
  const core=local(0,oxygenY,0,.139,.139,.139);
  const ends=[], sticks=[];
  for (const sign of [-1,1]){
    const angle=sign*52.25*Math.PI/180, x=Math.sin(angle)*.215, y=Math.cos(angle)*.215;
    ends.push(local(x,y+oxygenY,0,.089,.089,.089));
    sticks.push(local(x/2,y/2+oxygenY,-angle,.04,.215,.04));
  }
  let width,height,scale;
  function resize() {
    width=stage.clientWidth; height=stage.clientHeight;
    if(!width||!height)return;
    scale=Math.min(width/9.35,height/16.6);
    camera.left=-width/(2*scale); camera.right=-camera.left;
    camera.top=height/(2*scale); camera.bottom=-camera.top;
    camera.position.set(.43,10.75,24); camera.lookAt(.43,HIGH/2,0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    renderer.setSize(width,height,false);
  }
  const anchor=new T.Vector3();
  function draw(gas,angle,handle) {
    piston.position.y=gas.height;
    shaft.scale.y=HIGH+.4-gas.height;
    shaft.position.y=(HIGH+.4+gas.height)/2;
    orbit.rotation.y=angle; orbit.updateMatrixWorld(true);
    // The control follows the visible side of the circular face throughout an orbit.
    piston.rotation.y=angle;
    gas.particles.forEach((p,i)=>{
      body.position.set(p.x,p.y,p.z);
      body.quaternion.copy(p.orientation);
      body.updateMatrix();
      oxygen.setMatrixAt(i,matrix.multiplyMatrices(body.matrix,core));
      for(let k=0;k<2;k++){
        hydrogen.setMatrixAt(2*i+k,matrix.multiplyMatrices(body.matrix,ends[k]));
        links.setMatrixAt(2*i+k,matrix.multiplyMatrices(body.matrix,sticks[k]));
      }
    });
    for(const mesh of [oxygen,hydrogen,links]) mesh.instanceMatrix.needsUpdate=true;
    anchor.set(BORE+.73,.32,0); piston.localToWorld(anchor); anchor.project(camera);
    handle.style.left=((anchor.x+1)*width/2)+'px';
    handle.style.top=((1-anchor.y)*height/2)+'px';
    renderer.render(scene,camera);
  }
  resize();
  return {resize,draw,unitsPerPixel:()=>1/(scale*camera.matrixWorld.elements[5]),
    dispose(){
      const geometries=new Set(),materials=new Set();
      scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});
      geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    }};
}
