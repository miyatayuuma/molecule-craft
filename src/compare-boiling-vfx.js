import * as THREE from '../vendor/three/three.module.min.js';
import {
  BatchedRenderer, ParticleSystem, SphereEmitter, IntervalValue,
  ConstantValue, ConstantColor, ForceOverLife, Vector4, RenderMode,
} from '../vendor/quarks/three.quarks-v0.16.0.mjs';

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
    map:texture,color:bubble?0xc8fff3:0x7edce8,transparent:true,
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
    this.innerGeometry=new THREE.SphereGeometry(.32,32,24);
    this.glass=new THREE.MeshPhysicalMaterial({
      color:0x6ad5d7,metalness:.04,roughness:.12,transmission:.38,
      thickness:.9,clearcoat:1,clearcoatRoughness:.08,
      iridescence:.32,iridescenceIOR:1.31,
      transparent:true,opacity:.86,depthWrite:false,side:THREE.FrontSide,
      emissive:0x104851,emissiveIntensity:.28,
    });
    this.liquid=new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0},uHeat:{value:0},uOpacity:{value:1}},
      transparent:true,depthWrite:false,side:THREE.FrontSide,
      vertexShader:`varying vec3 vNormal;varying vec3 vP;void main(){vNormal=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`precision mediump float;uniform float uTime;uniform float uHeat;uniform float uOpacity;varying vec3 vNormal;varying vec3 vP;
        void main(){float sw=sin(vP.y*19.+sin(vP.x*12.+uTime*.8)*.8+uTime*1.4)*.5+.5;
          float ed=pow(1.-abs(normalize(vNormal).z),2.);
          vec3 deep=mix(vec3(.055,.23,.28),vec3(.05,.46,.50),sw*.62);
          vec3 warm=vec3(.38,.78,.71);
          vec3 col=mix(deep,warm,sw*.12+uHeat*.17)+ed*vec3(.16,.43,.46);
          gl_FragColor=vec4(col,uOpacity*(.67+ed*.2));}`,
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
    const inside=new THREE.Mesh(this.innerGeometry,this.liquid.clone());
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:this.texture,color:0x75dfdf,transparent:true,opacity:.10,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.scale.set(1.0,1.0,1);halo.position.z=-.12;
    group.add(halo,inside,outside);this.scene.add(group);
    const orb={group,outside,inside,halo};this.orbs.set(id,orb);return orb;
  }

  update(physics,snapshots,indexById,dt,activeId){
    if(this.disposed)return;
    this.activeId=activeId;
    let active=null;
    for(const [id,snapshot] of snapshots){
      const index=indexById.get(id);if(index===undefined)continue;
      const orb=this.orb(id),point=this.host.toWorld(physics.beadPosition(index));
      // All phase changes are local to the visual; no physics node teleports.
      orb.group.position.copy(point);orb.group.position.z+=.39;
      orb.group.visible=snapshot.opacity>.005;
      orb.outside.material.opacity=snapshot.opacity*.86;
      orb.inside.material.uniforms.uOpacity.value=snapshot.opacity;
      orb.inside.material.uniforms.uHeat.value=snapshot.phase==='heating'?.25+snapshot.time*.32:1;
      orb.inside.material.uniforms.uTime.value+=dt;
      orb.halo.material.opacity=snapshot.opacity*.12;
      orb.group.scale.setScalar(snapshot.phase==='boiling'?1+Math.sin(snapshot.time*19)*.014:1);
      if(id===activeId)active={snapshot,position:orb.group.position};
    }
    for(const [id,orb] of this.orbs)if(!snapshots.has(id))orb.group.visible=false;
    const phase=active?.snapshot.phase;
    this.bubbles.emission.value=phase==='boiling'?78:phase==='heating'&&active.snapshot.time>1.35?8:0;
    this.vapor.emission.value=phase==='boiling'?Math.min(110,24+active.snapshot.time*30):0;
    if(active){
      this.bubbles.system.emitter.position.copy(active.position);
      this.vapor.system.emitter.position.copy(active.position);
      this.vapor.system.emitter.position.y+=.14;
    }
    this.bubbles.system.emitter.updateMatrixWorld(true);
    this.vapor.system.emitter.updateMatrixWorld(true);
    this.batch.update(Math.min(dt,.05));
  }

  dispose(){
    if(this.disposed)return;this.disposed=true;
    for(const orb of this.orbs.values()){
      orb.group.removeFromParent();orb.outside.material.dispose();orb.inside.material.dispose();orb.halo.material.dispose();
    }
    this.orbs.clear();
    for(const layer of [this.bubbles,this.vapor]){
      this.batch.deleteSystem(layer.system);layer.system.emitter.removeFromParent();
      layer.system.dispose();layer.material.dispose();
    }
    for(const batch of this.batch.batches)batch.dispose();
    this.batch.removeFromParent();this.geometry.dispose();this.innerGeometry.dispose();
    this.glass.dispose();this.liquid.dispose();this.texture.dispose();
  }
}
