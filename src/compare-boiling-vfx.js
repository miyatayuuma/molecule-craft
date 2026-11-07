import * as THREE from '../vendor/three/three.module.min.js';
import {
  BatchedRenderer, ParticleSystem, SphereEmitter, IntervalValue,
  ConstantValue, ConstantColor, ForceOverLife, Vector4, RenderMode,
} from '../vendor/quarks/three.quarks-v0.16.0.mjs';
import {boilingMorph} from './compare-boiling-morph.js';
import {ComparisonLiquidSpecimen} from './compare-boiling-liquid-surface.js';

// Small CPU particle counts, GPU-instanced sprites, and translucent glass:
// the visual is a *bulk liquid specimen*, not an individual H2O molecule.
function glowTexture(doc){
  const canvas=doc.createElement('canvas');canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(32,32,0,32,32,30);
  gradient.addColorStop(0,'rgba(255,255,255,1)');
  gradient.addColorStop(.20,'rgba(200,254,247,.9)');
  gradient.addColorStop(.56,'rgba(125,233,229,.35)');
  gradient.addColorStop(1,'rgba(80,211,222,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function particleSystem({texture,kind}){
  const bubble=kind==='bubble';
  const material=new THREE.MeshBasicMaterial({
    map:texture,color:bubble?0xc8fff3:0xf6f9fc,transparent:true,
    opacity:bubble?.78:.46,depthWrite:false,depthTest:true,
    blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  });
  const emission=new ConstantValue(0);
  const system=new ParticleSystem({
    material,renderMode:RenderMode.BillBoard,worldSpace:true,
    looping:true,duration:1000,
    shape:new SphereEmitter({radius:bubble?.25:.31,thickness:bubble?1:.4}),
    startLife:new IntervalValue(bubble?.40:1.1,bubble?1.0:2.3),
    startSpeed:new IntervalValue(bubble?.015:.06,bubble?.12:.22),
    startSize:new IntervalValue(bubble?.022:.07,bubble?.075:.17),
    startColor:new ConstantColor(new Vector4(1,1,1,bubble?.76:.50)),
    emissionOverTime:emission,
    behaviors:[new ForceOverLife(new ConstantValue(0),new ConstantValue(bubble?.9:.42),new ConstantValue(0))],
  });
  return {system,material,emission};
}

export class ComparisonBoilingVisual {
  constructor(ropeScene){
    this.host=ropeScene;this.scene=ropeScene.scene;this.disposed=false;
    this.geometry=new THREE.SphereGeometry(.38,40,28);
    this.glass=new THREE.MeshPhysicalMaterial({
      color:0xeaf3f7,metalness:.04,roughness:.12,transmission:.38,
      thickness:.9,clearcoat:1,clearcoatRoughness:.08,
      iridescence:.32,iridescenceIOR:1.31,
      transparent:true,opacity:.86,depthWrite:false,side:THREE.FrontSide,
    });
    this.texture=glowTexture(ropeScene.stage.ownerDocument);
    this.bubbles=particleSystem({texture:this.texture,kind:'bubble'});
    this.vapor=particleSystem({texture:this.texture,kind:'vapor'});
    this.batch=new BatchedRenderer();
    this.batch.addSystem(this.bubbles.system);this.batch.addSystem(this.vapor.system);
    this.scene.add(this.batch,this.bubbles.system.emitter,this.vapor.system.emitter);
    this.orbs=new Map();
    this.activeId=null;
  }

  orb(id){
    if(this.orbs.has(id))return this.orbs.get(id);
    const group=new THREE.Group();
    const outside=new THREE.Mesh(this.geometry,this.glass.clone());
    const liquid=new ComparisonLiquidSpecimen();
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:this.texture,color:0xb2e7ee,transparent:true,opacity:.10,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.scale.set(.85,.85,1);halo.position.z=-.12;
    const dropletMaterial=new THREE.MeshPhysicalMaterial({color:0xe8f9fb,roughness:.12,
      transmission:.45,transparent:true,opacity:.68,depthWrite:false});
    const droplets=new THREE.InstancedMesh(this.geometry,dropletMaterial,12);
    droplets.count=0;droplets.frustumCulled=false;
    group.add(halo,liquid.group,outside,droplets);this.scene.add(group);
    const orb={group,outside,liquid,halo,droplets};this.orbs.set(id,orb);return orb;
  }

  update(physics,snapshots,indexById,dt,activeId,phaseAppearanceById=new Map()){
    if(this.disposed)return;
    this.activeId=activeId;
    let active=null;
    for(const [id,snapshot] of snapshots){
      const index=indexById.get(id);if(index===undefined)continue;
      const orb=this.orb(id),point=this.host.toWorld(physics.beadPosition(index));
      const appearance=phaseAppearanceById.get(id);
      const morph=boilingMorph(snapshot);
      // All phase changes are local to the visual; no physics node teleports.
      orb.group.position.copy(point);orb.group.position.z+=.39;
      orb.group.visible=morph.pearl>.002||morph.dish>.002||morph.condensation>.002;
      orb.outside.visible=morph.pearl>.005;
      orb.outside.material.opacity=.86*Math.min(1,morph.pearl*1.35);
      orb.outside.scale.setScalar(.24+.76*morph.pearl);
      orb.outside.position.y=-.19*(1-morph.pearl);
      orb.liquid.update(morph,appearance?.liquid?.renderColor??'#eaf3f7',dt);
      orb.halo.material.opacity=morph.condensation*.36+morph.pearl*.08;
      orb.halo.scale.setScalar(.7+morph.condensation*.4);
      const dropletCount=morph.condensation>.005?12:0;
      orb.droplets.count=dropletCount;
      if(dropletCount){
        const dummy=new THREE.Object3D();
        for(let i=0;i<dropletCount;i++){
          const theta=i*Math.PI*(3-Math.sqrt(5));
          const radial=(.11+.22*Math.sqrt((i+.5)/dropletCount))*(1-morph.pearl);
          dummy.position.set(Math.cos(theta)*radial,Math.sin(theta)*radial,.05+i*.001);
          dummy.scale.setScalar((.055+(i%4)*.012)*morph.condensation);
          dummy.updateMatrix();orb.droplets.setMatrixAt(i,dummy.matrix);
        }
        orb.droplets.instanceMatrix.needsUpdate=true;
      }
      if(id===activeId)active={snapshot,morph,position:orb.group.position};
    }
    for(const [id,orb] of this.orbs)if(!snapshots.has(id))orb.group.visible=false;
    this.vapor.material.color.set(phaseAppearanceById.get(activeId)?.gas?.renderColor??'#f6f9fc');
    // Internal bubbles are rendered in the liquid itself; Quarks adds only
    // the brief surface spray and upward plume at the boiling point.
    this.bubbles.emission.value=active?Math.round(active.morph.bubbles*16):0;
    this.vapor.emission.value=active?Math.round(active.morph.vapor*88):0;
    if(active){
      this.bubbles.system.emitter.position.copy(active.position);
      this.bubbles.system.emitter.position.y-=.23;
      this.bubbles.system.emitter.position.z+=.05;
      this.vapor.system.emitter.position.copy(active.position);
      this.vapor.system.emitter.position.y-=.18;
      this.vapor.system.emitter.position.z+=.05;
    }
    this.bubbles.system.emitter.updateMatrixWorld(true);
    this.vapor.system.emitter.updateMatrixWorld(true);
    this.batch.update(Math.min(dt,.05));
  }

  dispose(){
    if(this.disposed)return;this.disposed=true;
    for(const orb of this.orbs.values()){
      orb.group.removeFromParent();orb.liquid.dispose();orb.outside.material.dispose();
      orb.halo.material.dispose();orb.droplets.material.dispose();
    }
    this.orbs.clear();
    for(const layer of [this.bubbles,this.vapor]){
      this.batch.deleteSystem(layer.system);layer.system.emitter.removeFromParent();
      layer.system.dispose();layer.material.dispose();
    }
    for(const batch of this.batch.batches)batch.dispose();
    this.batch.removeFromParent();this.geometry.dispose();
    this.glass.dispose();this.texture.dispose();
  }
}
