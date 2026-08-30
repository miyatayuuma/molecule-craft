import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ELEMENTS } from './chemistry.js?v=20';
import { createPreviewModel } from './preview-model.js?v=26';
import { createPreviewControls } from './preview-controls.js?v=21';
import { AROMATIC_STYLE, aromaticBondKeys, displayedBondOrder, aromaticRingFrame, aromaticRingPoints, createAromaticRing, updateAromaticRing } from './aromatic-rendering.js?v=26';

// Only a handful of CPU layouts are retained. No cached canvases/GPU contexts.
const layouts=new Map();

export function createCollectionViewer({host,record,name,onThumbnail=()=>{}}) {
  let disposed=false,frame=0,renderer=null,observer=null,model=null,layout=null;
  let scene=null,camera=null,group=null,width=1,height=1,radius=1,ready=false;
  let canvas=null,context=null,steps=0,stable=0,thumbnailSent=false;
  let aromaticEdges=new Set(),aromaticFrames=[];
  const resources=new Set(),listeners=[],viewState={};
  const owner=host.ownerDocument,make=(tag,text,className)=>{const node=owner.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
  const stage=make('div',null,'model-stage'),status=make('p','立体模型を準備しています…','model-status');
  status.setAttribute('role','status');
  const toolbar=make('div',null,'model-toolbar'),zoomLabel=make('output','100%','model-zoom');
  host.append(stage,toolbar,status);host.classList.add('collection-model');
  const listen=(node,type,handler,options)=>{node.addEventListener(type,handler,options);listeners.push(()=>node.removeEventListener(type,handler,options));};
  const controls=createPreviewControls(view=>{Object.assign(viewState,view);zoomLabel.value=`${Math.round(view.zoom*100)}%`;requestDraw();});
  Object.assign(viewState,controls.snapshot());
  for(const [label,action] of [['縮小',()=>controls.zoom(1/1.2)],['拡大',()=>controls.zoom(1.2)],['表示リセット',()=>controls.reset()]]){
    const button=make('button',label);button.type='button';button.setAttribute('aria-label',`模型を${label}`);listen(button,'click',action);toolbar.append(button);
  }
  toolbar.append(zoomLabel);
  const instruction=make('p','1本指で回転 · ピンチで拡大縮小 · 矢印キーでも回転できます。閲覧専用で、制作中の分子には影響しません。','collection-note');host.append(instruction);
  if(record.attachments?.length)host.append(make('p','金色の輪と点線は接続可能点です。原子・電子ではありません。','model-port-key'));

  function requestDraw(){if(!disposed&&!frame&&!owner.hidden)frame=requestAnimationFrame(tick);}
  function tick(){
    frame=0;if(disposed||owner.hidden)return;
    if(!ready){
      if(!layout){
        const started=performance.now();
        do{const movement=model.step();steps++;stable=movement<.001?stable+1:0;}while(steps<220&&stable<10&&performance.now()-started<5);
        if(steps<220&&stable<10){requestDraw();return;}
        layout=model.snapshot();model=null;layouts.set(key,layout);
        while(layouts.size>8)layouts.delete(layouts.keys().next().value);
      }
      try{initialize();ready=true;}catch(error){status.textContent='立体模型を表示できませんでした。図鑑の説明は引き続き利用できます。';console.warn('Collection preview unavailable',error);releaseGraphics();return;}
    }
    draw();
    if(!thumbnailSent){
      thumbnailSent=true;
      try{const small=make('canvas');small.width=96;small.height=80;const scale=Math.min(96/canvas.width,80/canvas.height),w=canvas.width*scale,h=canvas.height*scale;small.getContext('2d').drawImage(canvas,(96-w)/2,(80-h)/2,w,h);onThumbnail(small.toDataURL('image/png'));}catch{}
    }
  }
  const key=JSON.stringify([record.atoms,record.bonds,record.attachments??[]]);
  layout=layouts.get(key)??null;if(!layout)model=createPreviewModel(THREE,record);

  function initialize(){
    aromaticEdges=aromaticBondKeys(layout.aromaticCycles);
    aromaticFrames=layout.aromaticCycles.map(cycle=>aromaticRingFrame(THREE,cycle.map(id=>layout.atoms[id].point))).filter(Boolean);
    radius=Math.max(.6,...layout.atoms.map(atom=>atom.point.length()+ELEMENTS[atom.element].radius*.72),...layout.ports.map(port=>port.point.length()+.18));
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.01,200);group=new THREE.Group();scene.add(group);
    scene.add(new THREE.HemisphereLight(0xffffff,0x24304a,2.5));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,7);scene.add(light);
    const candidate=make('canvas');
    // A software projection of the same 3D coordinates remains rotatable when
    // WebGL is unavailable. It is not a 2D topology diagram or a static image.
    let gl=null;try{gl=candidate.getContext('webgl2',{alpha:true,antialias:true});}catch{}
    if(gl){
      try{renderer=new THREE.WebGLRenderer({canvas:candidate,context:gl,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;}
      catch{gl.getExtension('WEBGL_lose_context')?.loseContext();}
    }
    canvas=renderer?renderer.domElement:make('canvas');
    if(!renderer){context=canvas.getContext('2d');if(!context)throw new Error('No canvas context');}
    canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${name}の回転できる立体模型`);
    canvas.className='model-canvas';stage.append(canvas);
    if(renderer)buildMeshes();
    bindControls();observer=new ResizeObserver(resize);observer.observe(stage);resize();
    host.dataset.renderMode=renderer?'webgl':'software-3d';
    status.textContent=renderer?'立体模型 · 元素色と結合次数を表示':'立体模型 · 軽量3D表示（WebGLを利用できない環境）';
    if(aromaticFrames.length)status.textContent+=' · 水色の輪は環全体で共有するπ電子の記号です';
  }
  const own=resource=>{resources.add(resource);return resource;};
  function buildMeshes(){
    const sphere=own(new THREE.SphereGeometry(1,20,14)),cylinder=own(new THREE.CylinderGeometry(1,1,1,10));
    const materials=new Map();
    for(const atom of layout.atoms){
      if(!materials.has(atom.element))materials.set(atom.element,own(new THREE.MeshStandardMaterial({color:ELEMENTS[atom.element].color,roughness:.32,metalness:.06})));
      const mesh=new THREE.Mesh(sphere,materials.get(atom.element));mesh.position.copy(atom.point);mesh.scale.setScalar(ELEMENTS[atom.element].radius*.72);group.add(mesh);
    }
    const bondMaterial=own(new THREE.MeshStandardMaterial({color:0x9eafc5,roughness:.4}));
    for(const bond of layout.bonds){
      const order=displayedBondOrder(bond,aromaticEdges);
      const a=layout.atoms[bond.a].point,b=layout.atoms[bond.b].point,axis=b.clone().sub(a).normalize();
      const reference=Math.abs(axis.z)<.85?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
      const side=new THREE.Vector3().crossVectors(axis,reference).normalize();
      for(let i=0;i<order;i++){
        const mesh=new THREE.Mesh(cylinder,bondMaterial);mesh.position.copy(a).add(b).multiplyScalar(.5).addScaledVector(side,(i-(order-1)/2)*.13);
        mesh.scale.set(.045,a.distanceTo(b),.045);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);group.add(mesh);
      }
    }
    for(const frame of aromaticFrames){const ring=createAromaticRing(THREE,own);updateAromaticRing(THREE,ring,frame);group.add(ring);}
    for(const port of layout.ports){
      const geometry=own(new THREE.BufferGeometry().setFromPoints([layout.atoms[port.atom].point,port.point]));
      const line=new THREE.Line(geometry,own(new THREE.LineDashedMaterial({color:0xfbbf24,dashSize:.1,gapSize:.065,depthTest:false})));line.computeLineDistances();line.renderOrder=5;group.add(line);
      const ring=new THREE.Mesh(own(new THREE.TorusGeometry(.15,.026,6,24)),own(new THREE.MeshBasicMaterial({color:0xfbbf24,depthTest:false})));ring.position.copy(port.point);ring.renderOrder=6;ring.userData.portRing=true;group.add(ring);
    }
  }
  function resize(){
    if(disposed||!canvas)return;
    width=Math.max(1,stage.clientWidth);height=Math.max(1,stage.clientHeight);
    if(renderer)renderer.setSize(width,height,false);
    else{const ratio=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);}
    camera.aspect=width/height;camera.updateProjectionMatrix();requestDraw();
  }
  function draw(){
    group.rotation.set(viewState.pitch,viewState.yaw,viewState.roll,'YXZ');
    const halfFov=Math.min(19*Math.PI/180,Math.atan(Math.tan(19*Math.PI/180)*width/height));
    camera.position.set(0,0,radius/Math.sin(halfFov)*1.12/viewState.zoom);camera.lookAt(0,0,0);camera.updateMatrixWorld();group.updateMatrixWorld();
    if(renderer){for(const object of group.children)if(object.userData.portRing)object.quaternion.copy(group.quaternion).invert();renderer.render(scene,camera);}else drawSoftware();
  }
  function drawSoftware(){
    context.clearRect(0,0,width,height);
    const rotated=layout.atoms.map(atom=>({...atom,world:atom.point.clone().applyQuaternion(group.quaternion)}));
    const project=point=>{const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};};
    const commands=[];
    for(const bond of layout.bonds){
      const order=displayedBondOrder(bond,aromaticEdges);
      const start=rotated[bond.a],end=rotated[bond.b],axis=end.world.clone().sub(start.world).normalize();
      // Stop sticks at sphere surfaces; drawing center-to-center would paint
      // spokes over the foreground atom in the software depth-sorted renderer.
      const a=start.world.clone().addScaledVector(axis,ELEMENTS[start.element].radius*.72);
      const b=end.world.clone().addScaledVector(axis,-ELEMENTS[end.element].radius*.72);
      if(a.z>=camera.position.z||b.z>=camera.position.z)continue;
      commands.push({z:(a.z+b.z)/2,draw:()=>{
        const p=project(a),q=project(b),length=Math.max(1,Math.hypot(q.x-p.x,q.y-p.y)),dx=-(q.y-p.y)/length,dy=(q.x-p.x)/length;
        const scale=height/(2*Math.tan(19*Math.PI/180)*(camera.position.z-(a.z+b.z)/2));
        context.strokeStyle='#adbdcf';context.lineCap='round';context.lineWidth=Math.max(2,scale*.07);
        for(let i=0;i<order;i++){const offset=(i-(order-1)/2)*.13*scale;context.beginPath();context.moveTo(p.x+dx*offset,p.y+dy*offset);context.lineTo(q.x+dx*offset,q.y+dy*offset);context.stroke();}
      }});
    }
    // Sort short arc segments with atoms/bonds so rotation does not turn the
    // entire ring into a foreground overlay in the software renderer.
    for(const frame of aromaticFrames){
      const points=aromaticRingPoints(frame).map(point=>point.applyQuaternion(group.quaternion));
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],z=(a.z+b.z)/2;
        if(Math.max(a.z,b.z)>=camera.position.z)continue;
        commands.push({z,draw:()=>{
          const p=project(a),q=project(b),scale=height/(2*Math.tan(19*Math.PI/180)*(camera.position.z-z));
          context.save();context.strokeStyle=AROMATIC_STYLE.cssColor;context.lineCap='round';
          for(const [tube,opacity] of [[AROMATIC_STYLE.glowTube,AROMATIC_STYLE.glowOpacity],[AROMATIC_STYLE.tube,AROMATIC_STYLE.opacity]]){
            context.globalAlpha=opacity;context.lineWidth=Math.max(1,tube*frame.radius*2*scale);
            context.beginPath();context.moveTo(p.x,p.y);context.lineTo(q.x,q.y);context.stroke();
          }
          context.restore();
        }});
      }
    }
    for(const atom of rotated){
      const depth=camera.position.z-atom.world.z;if(depth<=.01)continue;
      commands.push({z:atom.world.z+ELEMENTS[atom.element].radius*.72,draw:()=>{
        const p=project(atom.world),r=ELEMENTS[atom.element].radius*.72*height/(2*Math.tan(19*Math.PI/180)*depth);
        const gradient=context.createRadialGradient(p.x-r*.3,p.y-r*.35,r*.07,p.x,p.y,r);
        gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.25,ELEMENTS[atom.element].color);gradient.addColorStop(1,'#182337');
        context.fillStyle=gradient;context.beginPath();context.arc(p.x,p.y,r,0,Math.PI*2);context.fill();
      }});
    }
    commands.sort((a,b)=>a.z-b.z).forEach(command=>command.draw());
    for(const port of layout.ports){
      const a=layout.atoms[port.atom].point.clone().applyQuaternion(group.quaternion),b=port.point.clone().applyQuaternion(group.quaternion);
      if(a.z>=camera.position.z||b.z>=camera.position.z)continue;
      const p=project(a),q=project(b);context.strokeStyle='#fbbf24';context.lineWidth=2;context.setLineDash([5,4]);context.beginPath();context.moveTo(p.x,p.y);context.lineTo(q.x,q.y);context.stroke();context.setLineDash([]);context.beginPath();context.arc(q.x,q.y,8,0,Math.PI*2);context.stroke();
    }
  }
  function bindControls(){
    listen(canvas,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();controls.down(event.pointerId,event.clientX,event.clientY);canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});});
    listen(canvas,'pointermove',event=>controls.move(event.pointerId,event.clientX,event.clientY));
    const release=event=>{controls.up(event.pointerId);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);};
    listen(canvas,'pointerup',release);listen(canvas,'pointercancel',release);listen(canvas,'lostpointercapture',event=>controls.up(event.pointerId));
    listen(canvas,'wheel',event=>{event.preventDefault();controls.zoom(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.003));},{passive:false});
    listen(canvas,'keydown',event=>{
      const actions={ArrowLeft:()=>controls.rotate(-.15,0),ArrowRight:()=>controls.rotate(.15,0),ArrowUp:()=>controls.rotate(0,-.15),ArrowDown:()=>controls.rotate(0,.15),'+':()=>controls.zoom(1.2),'=':()=>controls.zoom(1.2),'-':()=>controls.zoom(1/1.2),'0':()=>controls.reset()};
      if(actions[event.key]){event.preventDefault();actions[event.key]();}
    });
    listen(canvas,'webglcontextlost',event=>{event.preventDefault();status.textContent='3D描画が中断されました。詳細を開き直してください。';});
  }
  function releaseGraphics(){
    observer?.disconnect();for(const remove of listeners.splice(0))remove();
    for(const resource of resources)resource.dispose();resources.clear();
    renderer?.dispose();renderer?.forceContextLoss();renderer=null;canvas?.remove();
  }
  listen(owner,'visibilitychange',()=>{controls.cancel();if(owner.hidden){cancelAnimationFrame(frame);frame=0;}else requestDraw();});
  requestDraw();
  return {dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);frame=0;releaseGraphics();model=null;host.replaceChildren();}};
}
