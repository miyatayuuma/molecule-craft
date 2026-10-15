import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeReactionLabCanvas} from '../src/reaction-lab-viewer.js';

function fixture(){
  let rect={width:856,height:589},ratio=1;
  const calls=[],canvas={width:856,height:589,getBoundingClientRect:()=>rect};
  const camera={aspect:856/589,updateProjectionMatrix(){calls.push('projection');}};
  const renderer={getPixelRatio:()=>ratio,setSize(w,h,style){assert.equal(style,false);calls.push(['size',w,h]);canvas.width=Math.floor(w*ratio);canvas.height=Math.floor(h*ratio);},setDrawingBufferSize(w,h,r){ratio=r;calls.push(['buffer',w,h,r]);canvas.width=Math.floor(w*r);canvas.height=Math.floor(h*r);}};
  return{canvas,camera,renderer,calls,rect:value=>{rect=value;},run:r=>resizeReactionLabCanvas({canvas,camera,renderer,pixelRatio:r??1})};
}
test('no-op completion fits and repeated observer callbacks do not reset WebGL state',()=>{
  const f=fixture();for(let i=0;i<8;i++)assert.equal(f.run(),false);assert.deepEqual(f.calls,[]);
  f.camera.aspect=1;assert.equal(f.run(),false);assert.equal(f.camera.aspect,856/589);assert.deepEqual(f.calls,['projection']);
});
test('viewport change updates the full buffer and perspective once; repeated observer is a no-op',()=>{
  const f=fixture();f.rect({width:346,height:550});assert.equal(f.run(),true);assert.equal(f.canvas.width,346);assert.equal(f.canvas.height,550);assert.equal(f.camera.aspect,346/550);assert.equal(f.run(),false);assert.deepEqual(f.calls,[['size',346,550],'projection']);
});
test('DPR-only and simultaneous size/DPR changes use one native drawing-buffer update',()=>{
  const f=fixture();assert.equal(f.run(2),true);assert.deepEqual(f.calls,[['buffer',856,589,2]]);assert.equal(f.canvas.height,1178);assert.equal(f.run(2),false);assert.equal(f.run(3),false,'existing DPR cap remains 2');
  f.rect({width:390,height:600});assert.equal(f.run(1),true);assert.equal(f.canvas.width,390);assert.equal(f.camera.aspect,390/600);assert.deepEqual(f.calls.slice(1),[['buffer',390,600,1],'projection']);
});
test('hidden and subpixel layout changes preserve resolution while keeping camera aspect correct',()=>{
  const f=fixture();f.rect({width:0,height:0});assert.equal(f.run(),false);assert.deepEqual(f.calls,[]);
  f.rect({width:856.4,height:589.2});assert.equal(f.run(),false);assert.equal(f.canvas.width,856);assert.equal(f.canvas.height,589);assert.equal(f.camera.aspect,856.4/589.2);assert.deepEqual(f.calls,['projection']);
});
