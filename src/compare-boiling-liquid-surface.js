import * as THREE from '../vendor/three/three.module.min.js';

// A shallow sample dish with a real free surface, an enclosing glass wall and
// gas bubbles *below* the surface. Only the vapor/spray use Quarks; a large
// FLIP/SPH solver would be wasteful for a mobile encyclopedia illustration.
const RADIUS=.385;
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const fract=x=>x-Math.floor(x);
const seed=(i,salt)=>fract(Math.sin((i+salt)*127.1)*43758.5453);

function liquidSurfaceGeometry(){
  const segments=72,rings=22;
  const coords=[],uvs=[],indices=[];
  for(let r=0;r<=rings;r++)for(let i=0;i<=segments;i++){
    const theta=2*Math.PI*i/segments,radial=RADIUS*r/rings;
    coords.push(radial*Math.cos(theta),0,radial*Math.sin(theta));
    uvs.push(.5+radial*Math.cos(theta)/(RADIUS*2),.5+radial*Math.sin(theta)/(RADIUS*2));
    if(r>0&&i>0){const p=r*(segments+1)+i;
      indices.push(p,p-1,p-segments-1,p-1,p-segments-2,p-segments-1);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}

function liquidSurfaceMaterial(){
  return new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uHeat:{value:0},uBoil:{value:0},uColor:{value:new THREE.Color('#eaf3f7')},uOpacity:{value:1}},
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`uniform float uTime;uniform float uHeat;uniform float uBoil;
      varying vec2 vP;varying float vHeight;
      void main(){vec3 p=position;vP=p.xz;
        float fast=sin(length(p.xz-vec2(.07,-.09))*45.-uTime*15.)*sin(p.x*32.+uTime*7.);
        float broad=sin(p.x*21.+uTime*3.)*sin(p.z*19.-uTime*2.5);
        p.y+=(broad*.005*uHeat+fast*.013*uBoil)*(1.-smoothstep(.30,.39,length(p.xz)));
        vHeight=p.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`precision mediump float;uniform float uTime;uniform float uHeat;uniform float uBoil;
      uniform float uOpacity;uniform vec3 uColor;varying vec2 vP;varying float vHeight;
      void main(){float radial=length(vP)/.385;
        float swirl=sin(vP.x*34.+uTime*1.8)*sin(vP.y*27.-uTime*2.2);
        float ripple=sin(length(vP-vec2(.11,-.08))*57.-uTime*15.)*.5+.5;
        float reflect=pow(max(0.,sin(vP.x*13.+vP.y*9.-uTime*.85)),16.);
        float edge=pow(clamp(radial,0.,1.),5.);
        vec3 col=uColor*(.48+.20*swirl*uHeat+.15*ripple*uBoil)
          +vec3(.19,.28,.32)*(edge*.9+reflect*.35)
          +vec3(.24,.31,.36)*pow(max(0.,ripple),12.)*uBoil*.5;
        float alpha=uOpacity*(.81+.13*edge);
        gl_FragColor=vec4(col,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export class ComparisonLiquidSpecimen {
  constructor(){
    this.group=new THREE.Group();
    // In the comparison's front-facing orthographic camera this tilt makes
    // the round dish visibly elliptical, not a vertical puddle/sphere.
    this.group.rotation.x=.72;
    this.group.position.set(0,-.27,.04);
    this.time=0;
    this.glass=new THREE.MeshPhysicalMaterial({color:0xcce8ec,metalness:.02,roughness:.11,
      transmission:.78,thickness:.24,ior:1.45,clearcoat:1,
      transparent:true,opacity:.52,depthWrite:false,side:THREE.DoubleSide});
    this.rimMaterial=new THREE.MeshPhysicalMaterial({color:0xd5eff5,metalness:.17,roughness:.13,
      transparent:true,opacity:.82,depthWrite:false,clearcoat:1});
    this.bodyMaterial=new THREE.MeshPhysicalMaterial({color:0xeaf3f7,metalness:0,roughness:.10,
      transmission:.50,thickness:.23,ior:1.33,clearcoat:.75,
      transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide});
    this.meniscusMaterial=new THREE.MeshBasicMaterial({color:0xd8f1f4,transparent:true,
      opacity:.55,depthWrite:false,side:THREE.DoubleSide});
    this.bubbleMaterial=new THREE.MeshPhysicalMaterial({color:0xf5fdff,metalness:0,roughness:.06,
      transmission:.5,transparent:true,opacity:.7,depthWrite:false,side:THREE.FrontSide});
    this.rippleMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,
      opacity:0,depthWrite:false,side:THREE.DoubleSide});
    this.wallGeometry=new THREE.CylinderGeometry(.433,.405,.145,72,1,true);
    this.rimGeometry=new THREE.TorusGeometry(.432,.013,12,96);
    this.bottomGeometry=new THREE.CircleGeometry(.408,72);
    this.bodyGeometry=new THREE.CylinderGeometry(RADIUS,.372,.112,72,1,true);
    this.meniscusGeometry=new THREE.TorusGeometry(RADIUS,.007,8,96);
    this.surfaceGeometry=liquidSurfaceGeometry();
    this.bubbleGeometry=new THREE.SphereGeometry(1,10,8);
    this.rippleGeometry=new THREE.RingGeometry(.052,.057,64);

    this.wall=new THREE.Mesh(this.wallGeometry,this.glass);this.wall.position.y=-.064;
    this.wall.renderOrder=2;
    this.rim=new THREE.Mesh(this.rimGeometry,this.rimMaterial);this.rim.rotation.x=-Math.PI/2;
    this.rim.position.y=.009;this.rim.renderOrder=7;
    this.bottom=new THREE.Mesh(this.bottomGeometry,this.glass);
    this.bottom.rotation.x=-Math.PI/2;this.bottom.position.y=-.13;
    this.bottom.renderOrder=2;
    this.body=new THREE.Mesh(this.bodyGeometry,this.bodyMaterial);
    this.body.renderOrder=3;
    this.surface=new THREE.Mesh(this.surfaceGeometry,liquidSurfaceMaterial());
    this.surface.renderOrder=5;
    this.meniscus=new THREE.Mesh(this.meniscusGeometry,this.meniscusMaterial);
    this.meniscus.rotation.x=-Math.PI/2;this.meniscus.renderOrder=6;
    this.bubbles=new THREE.InstancedMesh(this.bubbleGeometry,this.bubbleMaterial,40);
    this.bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.bubbles.count=0;
    this.bubbles.frustumCulled=false;this.bubbles.renderOrder=4;
    this.ripples=Array.from({length:3},()=>{
      const mesh=new THREE.Mesh(this.rippleGeometry,this.rippleMaterial.clone());
      mesh.rotation.x=-Math.PI/2;mesh.renderOrder=6;return mesh;
    });
    this.group.add(this.bottom,this.wall,this.body,this.surface,this.meniscus,this.bubbles,...this.ripples,this.rim);
    this.dummy=new THREE.Object3D();
    this.update({dish:0,liquid:0,bubbles:0},'#eaf3f7',0);
  }

  update(morph,tint,dt){
    this.time+=Math.min(.05,Math.max(0,dt));
    const dish=clamp(morph.dish),volume=clamp(morph.liquid),boil=clamp(morph.bubbles);
    this.group.visible=dish>.002;
    this.glass.opacity=.52*dish;
    this.rimMaterial.opacity=.82*dish;
    const visible=volume>.007;
    for(const mesh of [this.body,this.surface,this.meniscus,this.bubbles])mesh.visible=visible;
    if(!visible){this.bubbles.count=0;for(const ring of this.ripples)ring.visible=false;return;}
    const radiusScale=.35+.65*Math.sqrt(volume);
    const surfaceHeight=-.012-(1-volume)*.092;
    const bodyHeight=Math.max(.007,Math.min(.112,.112*volume));
    this.body.scale.set(radiusScale,bodyHeight/.112,radiusScale);
    this.body.position.y=surfaceHeight-bodyHeight/2;
    this.bodyMaterial.color.set(tint);this.bodyMaterial.opacity=.68*Math.min(1,volume*5);
    this.surface.scale.set(radiusScale,1,radiusScale);
    this.surface.position.y=surfaceHeight+.001;
    this.surface.material.uniforms.uTime.value=this.time;
    this.surface.material.uniforms.uHeat.value=1;
    this.surface.material.uniforms.uBoil.value=boil;
    this.surface.material.uniforms.uColor.value.set(tint);
    this.surface.material.uniforms.uOpacity.value=Math.min(1,volume*4);
    this.meniscus.scale.set(radiusScale,1,radiusScale);
    this.meniscus.position.y=surfaceHeight+.004;
    this.meniscusMaterial.color.set(tint);
    this.meniscusMaterial.opacity=.48*Math.min(1,volume*4);

    const count=Math.min(40,Math.round(40*boil));this.bubbles.count=count;
    for(let i=0;i<count;i++){
      const speed=.68+seed(i,4)*.8;
      const progress=fract(this.time*speed+seed(i,3));
      const distance=radiusScale*RADIUS*.76*Math.sqrt(seed(i,8));
      const angle=seed(i,7)*Math.PI*2;
      this.dummy.position.set(Math.cos(angle)*distance, surfaceHeight-bodyHeight+progress*bodyHeight,Math.sin(angle)*distance);
      const rise=progress<.89?1:(1-progress)/.11;
      const size=(.008+seed(i,5)*.017)*(.6+progress*.7)*Math.max(.12,rise);
      this.dummy.scale.setScalar(size);this.dummy.updateMatrix();this.bubbles.setMatrixAt(i,this.dummy.matrix);
    }
    this.bubbles.instanceMatrix.needsUpdate=count>0;
    for(let i=0;i<this.ripples.length;i++){
      const ring=this.ripples[i];ring.visible=boil>.04;
      const t=fract(this.time*(.68+i*.11)+i*.37);
      const radial=.13*radiusScale,angle=seed(i,12)*Math.PI*2;
      ring.position.set(Math.cos(angle)*radial,surfaceHeight+.012,Math.sin(angle)*radial);
      ring.scale.setScalar((.48+t*2)*radiusScale);
      ring.material.opacity=boil*.23*(1-t)*Math.min(1,volume*5);
    }
  }

  dispose(){
    this.group.removeFromParent();
    for(const material of [this.glass,this.rimMaterial,this.bodyMaterial,this.surface.material,
      this.meniscusMaterial,this.bubbleMaterial,this.rippleMaterial,...this.ripples.map(mesh=>mesh.material)])material.dispose();
    for(const geometry of [this.wallGeometry,this.rimGeometry,this.bottomGeometry,this.bodyGeometry,
      this.surfaceGeometry,this.meniscusGeometry,this.bubbleGeometry,this.rippleGeometry])geometry.dispose();
  }
}
