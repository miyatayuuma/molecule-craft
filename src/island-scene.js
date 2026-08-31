import {ISLAND_TARGETS, TARGET_BY_ID, SALT_ROCK, SAMPLE_BY_ID} from './island-data.js?v=33';
import {clamp} from './island-engine.js?v=33';
import {createPreviewModel} from './preview-model.js?v=31';
import {ELEMENTS} from './chemistry.js?v=20';

// Geometry, colors and motion make the toy; no downloaded models or textures.
// Everything is local, bounded, and reusable on a mobile GPU.
export function createIslandScene({THREE:T,host,records=[],onUnavailable=()=>{}}) {
  let renderer;
  try {renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
  catch {onUnavailable();return null;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000,0);renderer.domElement.style.touchAction='none';
  renderer.domElement.setAttribute('aria-label','Discovery Islandの3Dジオラマ');
  host.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-7,7,7,-7,.1,70);
  const resources=new Set(),materials=new Map(),meshes=[];
  const own=r=>(resources.add(r),r);
  const geo={
    ball:own(new T.SphereGeometry(1,16,10)),pebble:own(new T.DodecahedronGeometry(1,0)),
    cylinder:own(new T.CylinderGeometry(1,1,1,20)),cone:own(new T.ConeGeometry(1,1,16)),
    cube:own(new T.BoxGeometry(1,1,1)),leaf:own(new T.SphereGeometry(1,12,8)),
  };
  function material(color,options={}) {
    const key=color+JSON.stringify(options);
    if(!materials.has(key))materials.set(key,own(new T.MeshStandardMaterial({color,roughness:.76,metalness:0,...options})));
    return materials.get(key);
  }
  function mesh(shape,color,parent,x=0,y=0,z=0,sx=1,sy=sx,sz=sx,options={}) {
    const node=new T.Mesh(typeof shape==='string'?geo[shape]:shape,typeof color==='string'||typeof color==='number'?material(color,options):color);
    node.position.set(x,y,z);node.scale.set(sx,sy,sz);node.castShadow=!options.transparent;node.receiveShadow=true;
    (parent||scene).add(node);meshes.push(node);return node;
  }
  const group=(parent=scene,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;};
  function torus(parent,r,tube,color,x=0,y=0,z=0,options={}) {
    return mesh(own(new T.TorusGeometry(r,tube,8,40)),color,parent,x,y,z,1,1,1,options);
  }
  const rand=i=>{const n=Math.sin(i*127.1+19.7)*43758.5453;return n-Math.floor(n);};
  function tube(parent,points,radius,color,options={}) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const node=mesh(own(new T.TubeGeometry(curve,28,radius,6,false)),color,parent,0,0,0,1,1,1,options);
    return {node,curve};
  }
  scene.add(new T.HemisphereLight(0xffffed,0x678c99,2.5));
  const key=new T.DirectionalLight(0xfff0cd,3.1);key.position.set(-5,12,8);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-7,right:7,top:6,bottom:-6,near:1,far:30});
  key.shadow.normalBias=.045;key.shadow.bias=-.0002;scene.add(key);
  const fill=new T.DirectionalLight(0xb9eeff,1.3);fill.position.set(7,5,-6);scene.add(fill);
  const root=group();

  // Layered ceramic plinth and a beveled island with a real pond opening.
  mesh('cylinder','#638f9c',root,0,-.76,0,5.75,.23,4.38);
  mesh('cylinder','#ebd6b4',root,0,-.6,0,5.5,.36,4.04);
  mesh('cylinder','#fff2d2',root,0,-.4,0,5.45,.13,4.01);
  mesh('cylinder','#5eabb2',root,0,-.315,0,5.33,.06,3.87);
  function landShape() {
    const shape=new T.Shape();
    for(let i=0;i<=64;i++) {
      const a=i/64*Math.PI*2,r=1+.035*Math.sin(a*5)+.02*Math.cos(a*3);
      const x=Math.cos(a)*4.95*r,z=Math.sin(a)*3.25*r;
      i?shape.lineTo(x,z):shape.moveTo(x,z);
    }
    const hole=new T.Path();hole.absellipse(-2.2,-1.1,1.49,1.15,0,Math.PI*2,true,0);shape.holes.push(hole);return shape;
  }
  const land=mesh(own(new T.ExtrudeGeometry(landShape(),{depth:.21,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.1,bevelThickness:.09,curveSegments:48})), '#97b97b',root,0,-.24,0);
  land.rotation.x=-Math.PI/2;
  const pondFloor=mesh('cylinder','#c4a875',root,-2.2,-.205,1.1,1.48,.055,1.14);
  mesh('cylinder','#ad996a',root,-2.2,-.162,1.1,1.3,.015,.99);
  const waterMat=own(new T.MeshStandardMaterial({color:'#49bed6',roughness:.25,metalness:.15,transparent:true,opacity:.88}));
  const pondWater=mesh('cylinder',waterMat,root,-2.2,-.13,1.1,1.37,.018,1.04);
  const ripple=[];
  for(let i=0;i<3;i++) {
    const ring=torus(root,.36+i*.29,.013,'#c1f4e7',-2.2,-.1,1.1,{transparent:true,opacity:.65});ring.rotation.x=-Math.PI/2;ripple.push(ring);
  }
  const wet=mesh('cylinder','#6c9570',root,-2.52,-.007,-.35,1.02,.014,.43,{transparent:true,opacity:.3});
  const gardenPatch=mesh('cylinder','#c7b17d',root,-2.5,-.001,-1.3,1.32,.027,1.03);
  const gardenMat=own(new T.MeshStandardMaterial({color:'#a4a361',roughness:.9}));gardenPatch.material=gardenMat;
  const soilPatch=mesh('cylinder','#e2c597',root,-.15,.018,2.4,.84,.026,.57);
  const soilMat=own(new T.MeshStandardMaterial({color:'#e2c597',roughness:1}));soilPatch.material=soilMat;
  // Broad stepping stones and stream grooves, not a detailed ground texture.
  for(let i=0;i<10;i++) {
    const x=-1.3+i*.4,z=.7+Math.sin(i*.8)*.22;
    const n=mesh('pebble',i%3?'#e8dfba':'#d0cba9',root,x,.055,z,.16,.07,.12);n.rotation.y=i;
  }
  tube(root,[[-2.2,.01,-.15],[-2.4,.014,-.5],[-2.5,.015,-1.1]],.035,'#7e9961');
  tube(root,[[-1,.005,1.4],[-.5,.02,2.1],[-.15,.02,2.4]],.025,'#ae9569');
  const waterfall=tube(root,[[-2.65,-.02,2.12],[-2.4,-.015,2.9],[-2.2,-.23,3.3],[-2.2,-.5,3.47]],.12,'#72d7e3',{transparent:true,opacity:.8}).node;
  const rainbow=group(root,-2.35,.2,2.8);
  for(let i=0;i<4;i++) {
    const arc=mesh(own(new T.TorusGeometry(.72+i*.065,.023,6,30,Math.PI)),['#ff9f83','#ffe294','#abe6bf','#9fcbef'][i],rainbow);
    arc.rotation.y=-.18;
  }
  // Low-cost instanced shore stones and tufts.
  const stoneMat=material('#d4d4b5'),stones=new T.InstancedMesh(geo.pebble,stoneMat,38),dummy=new T.Object3D();own(stones);root.add(stones);stones.castShadow=true;stones.receiveShadow=true;
  for(let i=0;i<38;i++) {
    const a=i/38*Math.PI*2;
    if(i<20)dummy.position.set(-2.2+Math.cos(a*1.9)*1.53,.025,1.1+Math.sin(a*1.9)*1.17);
    else dummy.position.set(Math.cos(a)*4.55,.01,Math.sin(a)*2.98);
    const s=.08+rand(i)*.13;dummy.scale.set(s,s*.6,s*.8);dummy.rotation.set(0,i,.1);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
  }
  const tufts=new T.InstancedMesh(geo.cone,material('#719952'),46);own(tufts);root.add(tufts);
  for(let i=0;i<46;i++) {
    const a=i*.91,x=Math.cos(a)*(3.5+rand(i)*.7),z=Math.sin(a)*(2.45+rand(i+70)*.35);
    dummy.position.set(x,.13,z);dummy.scale.set(.05,.21+rand(i)*.18,.05);dummy.rotation.set(.15*rand(i),i,.18*rand(i+7));dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);
  }

  const plants=[],leafMat=own(new T.MeshStandardMaterial({color:'#a5a66c',roughness:.8})),flowerMat=material('#f1a2ad');
  for(let i=0;i<5;i++) {
    const base=group(root,-2.85+(i%3)*.48,0,-1.75+Math.floor(i/3)*.75),stem=group(base),h=.65+(i===1?.7:rand(i)*.25);
    mesh('cylinder','#729458',stem,0,h*.5,0,.04,h,.04);
    const left=mesh('leaf',leafMat,stem,-.16,h*.52,0,.31,.11,.17);left.rotation.z=-.4;
    const right=mesh('leaf',leafMat,stem,.2,h*.7,0,.35,.11,.2);right.rotation.z=.4;
    const bud=group(stem,0,h,0);
    for(let j=0;j<5;j++){const a=j/5*Math.PI*2;mesh('ball',flowerMat,bud,Math.cos(a)*.12,0,Math.sin(a)*.12,.13,.07,.1);}
    mesh('ball','#ffdf86',bud,0,.05,0,.095,.055,.095);
    plants.push({stem,bud,h,seed:i});
  }
  // Toy tree, leaning and recovering with the rest of the garden.
  const tree=group(root,-3.65,0,-1.8),treeCrown=group(tree,0,1.32,0);
  mesh('cylinder','#ab8462',tree,0,.7,0,.1,1.4,.1);
  for(const [x,y,z,s]of [[0,.2,0,.59],[-.37,0,0,.44],[.4,-.08,.08,.43]])mesh('ball',leafMat,treeCrown,x,y,z,s,s*.8,s);
  const reeds=group(root,-2.9,0,2.35);
  for(let i=0;i<5;i++){const n=mesh('cone','#91bd72',reeds,(i-2)*.15,.27,rand(i)*.2,.065,.55,.08);n.rotation.z=(i-2)*.13;}

  // Copper and zinc battery; ionic motion is separate from its power source.
  const cell=group(root,.7,0,.55);
  mesh('cylinder','#ede2be',cell,0,.12,0,.75,.22,.62);
  const glass=material('#b2e8de',{transparent:true,opacity:.22,roughness:.22,depthWrite:false});
  mesh(own(new T.CylinderGeometry(.58,.52,.7,28,1,true)),glass,cell,0,.54,0);
  const rim=torus(cell,.58,.045,'#a7cecd',0,.89,0);rim.rotation.x=-Math.PI/2;
  const cellWater=mesh('cylinder',own(waterMat.clone()),cell,0,.34,0,.515,.06,.515);
  mesh('cube','#ca8864',cell,-.26,.7,0,.13,.75,.35);
  mesh('cube','#a6c1c6',cell,.26,.7,0,.13,.75,.35);
  const batteryBulb=mesh('ball','#587d70',cell,0,.16,.56,.11,.08,.07);
  const bulbMat=own(new T.MeshStandardMaterial({color:'#668c79',emissive:'#a7f4a0',emissiveIntensity:0}));batteryBulb.material=bulbMat;
  const cellCrystals=group(cell,0,.25,0);
  for(let i=0;i<8;i++){const n=mesh('cube','#fcf5df',cellCrystals,(rand(i)-.5)*.68,.07,(rand(i+8)-.5)*.65,.12,.13,.12);n.rotation.set(.2,i,.18);}
  const wire=tube(root,[[.92,.12,.4],[1.6,.07,0],[2.65,.09,-.7],[2.55,.25,-1.1],[1.7,.08,-1.5],[.55,.9,-1.9]],.036,'#5a7070');
  const charges=Array.from({length:4},()=>mesh('ball','#d8ffc0',root,0,0,0,.045,.045,.045,{emissive:'#a4ef7c',emissiveIntensity:1.4}));
  // A sealed heat pipe connects the experiment tray to the battery and lamp.
  tube(root,[[3.15,.17,1.45],[2.5,.11,2],[1.2,.08,1.8],[.7,.15,.55]],.055,'#c4946b');

  const burner=group(root,3.15,0,1.45);
  mesh('cylinder','#dd8c72',burner,0,.15,0,.77,.3,.67);
  mesh('cylinder','#4e6265',burner,0,.32,0,.61,.08,.52);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;mesh('cylinder','#e0c79c',burner,Math.cos(a)*.45,.54,Math.sin(a)*.4,.038,.5,.038);}
  const burnerRing=torus(burner,.49,.045,'#eed3ab',0,.77,0);burnerRing.rotation.x=-Math.PI/2;
  mesh('cylinder','#fbcdc0',burner,.47,.34,.46,.17,.1,.17);
  const button3D=mesh('cylinder','#cf5f59',burner,.47,.41,.46,.115,.065,.115);
  const fuelGauge=mesh('cylinder','#798d91',burner,-.5,.48,.48,.07,.25,.07);
  const fire=group(burner,0,.36,0),flameMat=own(new T.MeshStandardMaterial({color:'#ffaa61',emissive:'#ff9744',emissiveIntensity:1.1,roughness:.8}));
  const flames=[];
  for(let i=0;i<5;i++){const f=mesh('ball',i===0?'#fff1b2':flameMat,fire,(rand(i)-.5)*.28,.2,(rand(i+11)-.5)*.2,.15,.38,.15);flames.push(f);}
  mesh('ball','#83cbe6',fire,0,.04,0,.3,.085,.25,{emissive:'#699bfa',emissiveIntensity:1});
  const pinwheelBase=group(root,4.18,.04,1.5);mesh('cylinder','#879d8e',pinwheelBase,0,.64,0,.045,1.28,.045);
  const pinwheel=group(pinwheelBase,0,1.3,.04);
  for(let i=0;i<4;i++){const blade=group(pinwheel);blade.rotation.z=i*Math.PI/2;mesh('leaf',['#edb87c','#92cfd1','#edaaa0','#cde09b'][i],blade,.18,.11,0,.27,.11,.045);}
  mesh('ball','#fff0cb',pinwheel,0,0,.06,.085);
  const scorch=mesh('cylinder','#806850',root,3.15,.021,2.17,.51,.012,.31,{transparent:true,opacity:.01});

  // An arched rock shell (with an actual opening), sliding gate and crystal room.
  const cave=group(root,.55,-.01,-2.4),arch=new T.Shape();
  arch.moveTo(-1.3,0);arch.lineTo(-1.3,.9);arch.quadraticCurveTo(-1.3,1.94,0,1.94);arch.quadraticCurveTo(1.3,1.94,1.3,.9);arch.lineTo(1.3,0);arch.lineTo(.79,0);arch.lineTo(.79,.84);arch.quadraticCurveTo(.79,1.36,0,1.39);arch.quadraticCurveTo(-.79,1.36,-.79,.84);arch.lineTo(-.79,0);arch.closePath();
  mesh(own(new T.ExtrudeGeometry(arch,{depth:.54,bevelEnabled:true,bevelSize:.07,bevelThickness:.06,bevelSegments:2,steps:1})), '#819590',cave,0,0,-.2);
  mesh('cube','#293e45',cave,0,.68,-.3,1.7,1.38,.1);
  mesh('cylinder','#657d77',cave,0,.01,-.05,.79,.055,.58);
  for(let i=0;i<5;i++){const n=mesh('pebble',i%2?'#8ca395':'#a4b39b',cave,(rand(i)-.5)*1.8,1.65+rand(i+8)*.25,-.24, .35+rand(i)*.2,.32,.35);n.rotation.y=i;}
  const gate=group(cave,0,0,.36);
  for(let i=0;i<5;i++)mesh('cylinder','#b99c75',gate,(i-2)*.27,.55,0,.037,1.05,.037);
  mesh('cube','#d4b98d',gate,0,.87,0,1.35,.08,.065);
  const caveCrystals=group(cave,0,.04,-.13),caveCrystalMat=own(new T.MeshStandardMaterial({color:'#c4abeb',emissive:'#a987e9',emissiveIntensity:.05,roughness:.3}));
  for(let i=0;i<4;i++){const n=mesh(own(new T.CylinderGeometry(.01,.13,.45+rand(i)*.25,5)),caveCrystalMat,caveCrystals,(i-1.5)*.29,.3,-.02,.9,1,.9);n.rotation.z=(i-1.5)*.1;}
  const caveLamp=mesh('ball','#b2b8a0',cave,0,1.63,.46,.16,.12,.08);
  const lampMat=own(new T.MeshStandardMaterial({color:'#b3b991',emissive:'#fff0a8',emissiveIntensity:0}));caveLamp.material=lampMat;
  const lampLight=new T.PointLight(0xf4e8b4,0,4,2);lampLight.position.set(.55,.9,-1.92);scene.add(lampLight);
  const path=group(root,.55,.025,-1.2);
  for(let i=0;i<4;i++)mesh('pebble','#ddcfac',path,(i%2?-.12:.12),.025,-i*.23,.22,.045,.16);

  // Washable lens: water removes dust, organic solvent removes resin.
  const lens=group(root,2.55,.02,-1.1);mesh('cylinder','#e5d8b5',lens,0,.1,0,.49,.17,.38);
  mesh('cylinder','#77968b',lens,0,.5,0,.055,.78,.055);
  const lensFace=group(lens,0,.85,.015);lensFace.rotation.x=-.32;
  torus(lensFace,.36,.06,'#e6c595');
  mesh('ball','#9dd9da',lensFace,0,0,0,.33,.33,.065,{transparent:true,opacity:.7,metalness:.15,roughness:.18});
  const resinMat=own(new T.MeshStandardMaterial({color:'#937848',transparent:true,opacity:1,roughness:.9}));
  const resin=mesh('ball',resinMat,lensFace,0,0,.075,.31,.31,.035);
  const dust=group(lensFace,0,0,.11);
  for(let i=0;i<5;i++)mesh('ball','#e6cea1',dust,(rand(i)-.5)*.38,(rand(i+20)-.5)*.4,0,.09,.07,.016);
  // Mineral indicator, a deliberately fantastical crystal pigment in a dish.
  const dish=group(root,-.65,.035,-.5);mesh('cylinder','#ede4ce',dish,0,.11,0,.54,.16,.45);
  const dishRim=torus(dish,.46,.055,'#e1cdaa',0,.2,0);dishRim.rotation.x=-Math.PI/2;
  const indicatorMat=own(new T.MeshStandardMaterial({color:'#b394d4',roughness:.3,emissive:'#644775',emissiveIntensity:.13}));
  const crystals=group(dish,0,.2,0);
  for(let i=0;i<5;i++){const n=mesh(own(new T.CylinderGeometry(.035,.13,.45+rand(i+7)*.26,5)),indicatorMat,crystals,(rand(i)-.5)*.45,.19,(rand(i+8)-.5)*.3);n.rotation.z=(rand(i)-.5)*.55;}
  const dishWater=mesh('cylinder',own(waterMat.clone()),dish,0,.23,0,.4,.025,.34);

  const flask=group(root,3.6,0,-.15);mesh('cylinder','#e3cda6',flask,0,.08,0,.36,.15,.31);
  mesh('ball',glass,flask,0,.38,0,.27,.28,.27);mesh('cylinder',glass,flask,0,.66,0,.1,.28,.1);
  mesh('cylinder','#caa07a',flask,0,.8,0,.115,.08,.115);
  const balloon=group(flask,0,1,0);mesh('ball','#f3bd8d',balloon,0,.21,0,.33,.45,.32);mesh('cone','#e8a976',balloon,0,-.2,0,.07,.13,.07);
  mesh('ball','#ffe3bd',balloon,-.11,.4,.25,.065,.11,.015);
  const stringGeo=own(new T.BufferGeometry().setFromPoints([new T.Vector3(0,.8,0),new T.Vector3(0,1,0)]));
  const string=new T.Line(stringGeo,own(new T.LineBasicMaterial({color:'#a48f76'})));flask.add(string);

  const salt=group(root,SALT_ROCK.x,0,SALT_ROCK.z);
  mesh('pebble','#b4bab1',salt,0,.21,0,.62,.35,.49);
  for(let i=0;i<7;i++){const n=mesh('cube','#fff1d5',salt,(rand(i)-.5)*.65,.35+rand(i+10)*.26,(rand(i+30)-.5)*.5,.16,.17,.16);n.rotation.set(.15,i*.6,.12);}
  // Tiny original creature silhouettes; their poses follow simulation intent.
  function creature(species) {
    const body=group(root),anim=group(body);let shellGlow=null,halo=null;
    if(species==='puddle') {
      mesh('ball','#77ccd7',anim,0,.18,0,.24,.19,.28);
      for(const side of [-1,1]){mesh('ball','#8ddde0',anim,side*.2,.085,.12,.12,.055,.12);for(let j=0;j<2;j++){const n=mesh('cone','#e9baa4',anim,side*.21,.24+j*.07,.025,.035,.18,.04);n.rotation.z=side*1.1;}}
      mesh('ball','#c5e9cf',anim,0,.145,.21,.14,.1,.1);
    } else if(species==='leaf') {
      mesh('ball','#a0bd63',anim,0,.17,0,.26,.16,.29);
      const leaf=mesh('leaf','#799f59',anim,0,.32,-.04,.18,.07,.3);leaf.rotation.x=-.27;
      mesh('cylinder','#e2d59b',anim,0,.33,-.06,.016,.018,.23).rotation.x=Math.PI/2;
      for(const side of [-1,1])mesh('ball','#879f55',anim,side*.2,.055,.14,.1,.055,.09);
    } else {
      mesh('ball','#c3daa9',anim,0,.07,.04,.19,.075,.31);
      shellGlow=own(new T.MeshStandardMaterial({color:'#b3a0dc',emissive:'#b9eacd',emissiveIntensity:.04,roughness:.5}));
      mesh('ball',shellGlow,anim,0,.25,-.055,.23,.23,.22);
      halo=torus(body,.28,.016,'#c7f9b8',0,.026,0,{transparent:true,opacity:.5,depthWrite:false,emissive:'#d4ffb6',emissiveIntensity:1});halo.rotation.x=-Math.PI/2;halo.visible=false;
      const spiral=torus(anim,.13,.025,'#e1d6f3',0,.25,.147);spiral.scale.set(.8,.85,1);
      for(const side of [-1,1]){mesh('cylinder','#bad7a7',anim,side*.095,.18,.25,.018,.17,.018);mesh('ball','#edf4c6',anim,side*.095,.28,.25,.04);}
    }
    for(const side of [-1,1]) {
      mesh('ball','#f9f3db',anim,side*.089,.235,.239,.059,.066,.04);
      mesh('ball','#344f55',anim,side*.089,.232,.272,.027,.035,.018);
      mesh('ball','#fffdf1',anim,side*.08,.245,.283,.009);
    }
    return {body,anim,shellGlow,halo};
  }
  const creatureModels=new Map();for(const species of ['puddle','leaf','glow'])for(let i=0;i<2;i++)creatureModels.set(`${species}-${i}`,creature(species));

  const targetRing=torus(root,.75,.026,'#fff3cd',0,.07,0,{transparent:true,opacity:.92});targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.1);
  const hitMeshes=[];
  for(const target of [...ISLAND_TARGETS,SALT_ROCK]) {
    const n=new T.Mesh(geo.ball,new T.MeshBasicMaterial({visible:false}));own(n.material);
    n.position.set(target.x,.3,target.z);n.scale.set(target.radius,.55,target.radius);n.userData.target=target.id;root.add(n);hitMeshes.push(n);
  }
  // A single points draw call, fixed buffers, and a hard particle cap.
  const CAP=160,positions=new Float32Array(CAP*3),colors=new Float32Array(CAP*3),sizes=new Float32Array(CAP),particles=Array.from({length:CAP},()=>({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0}));
  const particleGeo=own(new T.BufferGeometry());particleGeo.setAttribute('position',new T.BufferAttribute(positions,3));particleGeo.setAttribute('color',new T.BufferAttribute(colors,3));particleGeo.setAttribute('size',new T.BufferAttribute(sizes,1));
  const particleMat=own(new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,
    uniforms:{scale:{value:1}},vertexShader:'attribute float size; varying vec3 vColor; varying float vAlive; uniform float scale; void main(){vColor=color; vAlive=step(0.01,size); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0,size*scale);}',
    fragmentShader:`varying vec3 vColor; varying float vAlive;
      void main(){
        float d=length(gl_PointCoord-vec2(0.5));
        if(vAlive<0.5||d>0.5)discard;
        gl_FragColor=vec4(vColor,(1.0-smoothstep(0.32,0.5,d))*.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const points=new T.Points(particleGeo,particleMat);points.frustumCulled=false;scene.add(points);let particleCursor=0;
  const palette={water:'#85dcef',overflow:'#b8f3f2',drain:'#8bd8e2',dissolve:'#e4faff',salt:'#fff6e8',fire:'#ffce73',spark:'#ffd993',steam:'#eef4d9',oxygen:'#e9b4a6',gas:'#c8cdd6',clean:'#ffe0ef',nutrient:'#d8eab1',neutralize:'#c8acff',creature:'#edebb6',grow:'#bfe489',bubble:'#b9e6e4',collect:'#ffffd9',tint:'#e7c6ff',drop:'#fff1c9'};
  function burst(type,targetId,amount=1,color=null,origin=null) {
    const target=origin||TARGET_BY_ID.get(targetId)||SALT_ROCK,c=new T.Color(color||palette[type]||'#e7ecc5');
    const count=type==='creature'?5:type==='overflow'&&amount<1?4:Math.min(24,Math.round(11+amount*3));
    for(let i=0;i<count;i++) {
      const index=particleCursor++%CAP,p=particles[index],seed=particleCursor;
      p.life=p.max=.6+rand(seed)*.6;p.x=target.x+(rand(seed+1)-.5)*.3;p.y=origin?.y??(targetId==='burner'?.8:.35);p.z=target.z+(rand(seed+2)-.5)*.3;
      p.vx=(rand(seed+3)-.5)*1.2;p.vz=(rand(seed+4)-.5)*1.2;p.vy=type==='steam'||type==='gas'?.9:1+rand(seed+5);p.size=type==='gas'||type==='steam'?12:5+rand(seed+6)*5;
      colors[index*3]=c.r;colors[index*3+1]=c.g;colors[index*3+2]=c.b;
    }
    particleGeo.attributes.color.needsUpdate=true;
  }
  const recordById=new Map(records.map(r=>[r.id,r])),sampleModels=new Map(),throws=[];
  function sampleModel(id) {
    if(sampleModels.has(id))return sampleModels.get(id);
    const g=new T.Group(),record=recordById.get(id);
    if(record) {
      const model=createPreviewModel(T,record);for(let i=0;i<90;i++)model.step();
      const atoms=model.snapshot().atoms;
      for(const atom of atoms){const cfg=ELEMENTS[atom.element];mesh('ball',cfg.color,g,atom.point.x,atom.point.y,atom.point.z,cfg.radius*.72);}
      for(const [a,b]of record.bonds) {
        const start=new T.Vector3(atoms[a].point.x,atoms[a].point.y,atoms[a].point.z),end=new T.Vector3(atoms[b].point.x,atoms[b].point.y,atoms[b].point.z),mid=start.clone().add(end).multiplyScalar(.5),direction=end.clone().sub(start);
        const n=mesh('cylinder','#b4c8ca',g,mid.x,mid.y,mid.z,.055,direction.length(),.055);n.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());
      }
    } else for(let i=0;i<4;i++){const n=mesh('cube',i%2?'#e5d8fa':'#fff9e5',g,(i%2-.5)*.45,(Math.floor(i/2)-.5)*.45,0,.4);n.rotation.y=.2;}
    g.scale.setScalar(.32);sampleModels.set(id,g);return g;
  }
  function throwSample(id,targetId,dose=1,point=null) {
    const target=TARGET_BY_ID.get(targetId);if(!target)return;
    const n=sampleModel(id).clone(true);root.add(n);
    const x=point?.x??target.x,z=point?.z??target.z;
    n.position.set(x,4,z);throws.push({node:n,x,z,time:0,land:.36,targetId});
    if(throws.length>12)root.remove(throws.shift().node);
  }
  let yaw=.16,pitch=.72,zoom=1,panX=0,panZ=0,width=1,height=1,lastPower=false,lastGrow=false,disposed=false,lost=false;
  const colorDry=new T.Color('#aaa16a'),colorAlive=new T.Color('#76a959'),colorBloom=new T.Color('#73b866');
  const pink=new T.Color('#ed8f9c'),purple=new T.Color('#b89be2'),blue=new T.Color('#72b6e9');
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  function updateCamera() {
    const aspect=width/height,h=Math.max(10.1,12.8/aspect)/zoom;
    camera.left=-h*aspect/2;camera.right=h*aspect/2;camera.top=h/2;camera.bottom=-h/2;
    const radius=22;camera.position.set(panX+Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,panZ+Math.cos(yaw)*Math.cos(pitch)*radius);
    camera.lookAt(panX,.15,panZ);camera.updateProjectionMatrix();camera.updateMatrixWorld();particleMat.uniforms.scale.value=renderer.getPixelRatio()*zoom;
  }
  function resize(){width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);updateCamera();}
  const observer=window.ResizeObserver?new window.ResizeObserver(resize):null;observer?.observe(host);resize();
  function render(world,dt=0) {
    if(disposed||lost)return;
    const time=world.clock,pond=world.zones.pond,garden=world.zones.garden,v=world.garden.vigor,heat=world.zones.burner.heat;
    const fillLevel=clamp(pond.water/1.05),scale=.12+Math.sqrt(fillLevel)*.88;
    pondWater.scale.set(1.37*scale,.018,1.04*scale);pondWater.position.y=-.145+fillLevel*.18;
    pondWater.material.color.set(pond.toxin>.2?'#89a5b9':pond.salt>.5?'#78c3bc':'#49bed6');
    for(let i=0;i<ripple.length;i++){const r=ripple[i];r.visible=fillLevel>.13;r.position.y=pondWater.position.y+.02;r.scale.setScalar((.7+Math.sin(time*.7+i)*.12)*scale);}
    wet.material.opacity=clamp(garden.water)*.75;gardenMat.color.copy(colorDry).lerp(colorAlive,clamp(v));
    leafMat.color.copy(colorDry).lerp(colorBloom,clamp(v));soilMat.color.set(world.zones.soil.water>.2?'#aa9367':'#e2c597');
    for(const p of plants){p.stem.rotation.z=(1-clamp(v))*(.85+(p.seed%2?-.28:.1))+(reduced?0:Math.sin(time*1.9+p.seed)*.025);p.stem.scale.y=.6+clamp(v)*.5;p.bud.scale.setScalar(Math.max(.04,world.garden.bloom));}
    tree.rotation.z=(1-clamp(v))*.15;treeCrown.scale.setScalar(.65+clamp(v)*.4);
    reeds.visible=world.unlocks.marsh;waterfall.visible=world.waterfall>.01;rainbow.visible=world.waterfall>.14;
    if(waterfall.visible&&dt>0&&Math.floor(time*8)!==Math.floor((time-dt)*8))burst('overflow','pond',.1,null,{x:-2.2,y:-.27,z:3.36});
    const cellState=world.zones.cell;
    cellWater.visible=cellState.water>.025;cellWater.position.y=.28+clamp(cellState.water)*.44;
    cellCrystals.visible=cellState.salt-cellState.dissolved>.02;cellCrystals.scale.setScalar(clamp((cellState.salt-cellState.dissolved)*2,.25,1.15));
    bulbMat.emissiveIntensity=world.power*1.9;bulbMat.color.set(world.power>.25?'#c6ed9c':'#668c79');
    for(let i=0;i<charges.length;i++){charges[i].visible=world.power>.15;charges[i].position.copy(wire.curve.getPoint((time*.36+i/4)%1));}
    fuelGauge.scale.y=.04+world.zones.burner.fuel*.15;
    fire.visible=heat>.035;
    flameMat.color.set(world.zones.burner.salt>.05?'#ffe360':'#ffad68');flameMat.emissive.set(world.zones.burner.salt>.05?'#ffbf35':'#ff8744');
    for(let i=0;i<flames.length;i++){const n=flames[i],flicker=reduced?1:1+Math.sin(time*14+i*2)*.13;n.scale.y=(.2+heat*.38)*flicker;n.position.y=.1+n.scale.y*.5;n.rotation.z=reduced?0:Math.sin(time*7+i)*.1;}
    pinwheel.rotation.z+=dt*(.08+heat*7);button3D.scale.y=.065;scorch.material.opacity=world.burner.scorch*.65;
    lampMat.emissiveIntensity=world.caveLight*2;lampMat.color.set(world.caveLight>.2?'#f7e5a5':'#adb292');lampLight.intensity=world.caveLight*3;
    gate.position.y+=( (world.unlocks.cave?1.4:0)-gate.position.y)*Math.min(1,dt*2.4);gate.visible=gate.position.y<1.35;
    path.visible=world.unlocks.cave;caveCrystalMat.emissiveIntensity=.03+world.caveLight*.6;
    resinMat.opacity=world.lens.resin;resin.visible=world.lens.resin>.015;dust.visible=world.lens.dust>.05;dust.scale.setScalar(Math.max(.01,world.lens.dust/.6));
    const pH=world.zones.crystal.pH;indicatorMat.color.copy(purple).lerp(pH<7?pink:blue,clamp(Math.abs(pH-7)/2));
    dishWater.visible=world.zones.crystal.water>.02;
    const lift=world.zones.flask.lift;balloon.position.y=.98+lift*.8;balloon.position.x=reduced?0:Math.sin(time*1.4)*lift*.07;balloon.scale.setScalar(.5+Math.min(lift,.9)*.65);
    stringGeo.attributes.position.setXYZ(1,balloon.position.x,balloon.position.y-.2*balloon.scale.y,0);stringGeo.attributes.position.needsUpdate=true;
    salt.rotation.y=Math.sin(time*.6)*.01;
    for(let i=0;i<world.creatures.length;i++){
      const c=world.creatures[i],m=creatureModels.get(c.id),oldX=m.body.position.x,oldZ=m.body.position.z;
      m.body.visible=c.active;m.body.position.set(c.x,c.species==='puddle'&&c.behavior==='swim'?pondWater.position.y:0,c.z);
      if(Math.hypot(c.x-oldX,c.z-oldZ)>.0005)m.body.rotation.y=Math.atan2(c.x-oldX,c.z-oldZ);
      m.anim.position.y=reduced?0:c.behavior==='rest'?.012*Math.sin(time*2+i):Math.abs(Math.sin(time*5+i))*.08;
      m.anim.rotation.z=c.behavior==='flee'?Math.sin(time*15+i)*.13:0;
      m.anim.scale.y=c.behavior==='rest'?.83:1;
      if(m.shellGlow){const glowing=c.behavior==='glow';m.shellGlow.emissiveIntensity=glowing ? .55+.2*Math.sin(time*2+i) : .04;m.halo.visible=glowing;if(glowing&&dt>0&&Math.floor(time*1.5+i)!==Math.floor((time-dt)*1.5+i))burst('creature','cave',.2,'#d6f7b5',{x:c.x,y:.12,z:c.z});}
    }
    for(let i=throws.length-1;i>=0;i--){const d=throws[i];d.time+=dt;const t=clamp(d.time/.56);d.node.position.y=d.land+(1-t*t)*3.6;d.node.rotation.y=t*3;d.node.rotation.z=t*.45;if(t>=1){root.remove(d.node);throws.splice(i,1);}}
    for(let i=0;i<CAP;i++){const p=particles[i];p.life=Math.max(0,p.life-dt);if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*1.2;positions[i*3]=p.x;positions[i*3+1]=p.y;positions[i*3+2]=p.z;sizes[i]=p.size*Math.min(1,p.life*3);}else sizes[i]=0;}
    particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.size.needsUpdate=true;
    if(!lastPower&&world.power>.35)burst('spark','cell');if(!lastGrow&&v>.4)burst('grow','garden');lastPower=world.power>.35;lastGrow=v>.4;
    renderer.render(scene,camera);
  }
  const contextLost=e=>{e.preventDefault();lost=true;onUnavailable('3D表示が一時停止しました。再読み込みで島を復元できます。');};
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  function finishThrows(){for(const d of throws)root.remove(d.node);throws.length=0;}
  return {
    canvas:renderer.domElement,render,resize,throwSample,burst,finishThrows,
    clearEffects(){finishThrows();for(const p of particles)p.life=0;gate.position.y=0;},
    hitTest(clientX,clientY) {
      const r=renderer.domElement.getBoundingClientRect();if(clientX<r.left||clientX>r.right||clientY<r.top||clientY>r.bottom)return null;
      pointer.set((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);
      scene.updateMatrixWorld();const hit=raycaster.intersectObjects(hitMeshes,false)[0];
      const point=raycaster.ray.intersectPlane(plane,new T.Vector3());
      if(hit)return{id:hit.object.userData.target,point:point??hit.point};
      if(point&&(point.x/4.9)**2+(point.z/3.2)**2<1)return{id:'soil',point};return null;
    },
    project(id) {
      const t=TARGET_BY_ID.get(id)||(id==='salt-rock'?SALT_ROCK:null);if(!t)return null;
      const p=new T.Vector3(t.x,id==='cave'?1.65:id==='resin'?1.15:.65,t.z).project(camera);
      return{x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z>=-1&&p.z<=1};
    },
    highlight(id) {
      const t=TARGET_BY_ID.get(id)||(id==='salt-rock'?SALT_ROCK:null);targetRing.visible=!!t;
      if(t){targetRing.position.set(t.x,.1,t.z);targetRing.scale.setScalar(t.radius/.75);}
    },
    orbit(dx,dy){yaw-=dx*.006;pitch=clamp(pitch+dy*.004,.5,1.05);updateCamera();},
    zoomBy(ratio){zoom=clamp(zoom*ratio,.8,1.85);updateCamera();},
    pan(dx,dy){panX=clamp(panX-dx*.012,-2,2);panZ=clamp(panZ-dy*.012,-1.4,1.4);updateCamera();},
    frame(){yaw=.16;pitch=.72;zoom=1;panX=0;panZ=0;updateCamera();},
    stats(){return{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,particles:particles.filter(p=>p.life>0).length,flyingSamples:throws.length,geometries:renderer.info.memory.geometries};},
    dispose(){disposed=true;observer?.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);for(const r of resources)r.dispose?.();renderer.dispose();renderer.domElement.remove();},
  };
}
