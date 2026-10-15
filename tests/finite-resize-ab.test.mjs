import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {instrumentFiniteResizeSource} from '../scripts/finite-resize-ab-probes.mjs';

test('one shared diagnostic transform parses against both frozen production roots',()=>{
  for(const source of [readFileSync('src/reaction-lab-viewer.js','utf8'),spawnSync('git',['show','da4a0f529ceb4ca0fc5303e6e768d82945b4f934:src/reaction-lab-viewer.js'],{encoding:'utf8'}).stdout]){
    const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:instrumentFiniteResizeSource(source),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  }
});
test('diagnostic wrappers preserve return, throw, native receiver/arguments and real state',()=>{
  const source=`let polymerSamplePresentation=null;function resize(){return 42;}
  function finishPolymerSample(result){polymerSamplePresentation=result;return result;}
  function advancePolymerCompletion(){}
  const observer=new ResizeObserver(resize);
  scene.add(new THREE.HemisphereLight());`;
  let tick=0;const canvas={width:856,height:589},window={},renderer={setSize(...args){assert.equal(this,renderer);canvas.height=args[1];return 'native';},setDrawingBufferSize(){throw Error('native-failure');}};
  const context={window,renderer,canvas,performance:{now:()=>++tick},ResizeObserver:class{constructor(fn){this.fn=fn;}},scene:{add(){}},THREE:{HemisphereLight:class{}}};
  runInNewContext(instrumentFiniteResizeSource(source)+'\nthis.api={resize,finishPolymerSample,observer};',context);
  assert.equal(context.api.resize(),42);const sample={sampleId:'original'};assert.equal(context.api.finishPolymerSample(sample),sample);assert.equal(renderer.setSize(856,622,false),'native');assert.equal(canvas.height,622);assert.throws(()=>renderer.setDrawingBufferSize(),/native-failure/);assert.ok(window.__c9ResizeWork.some(row=>row.sampleId==='original'));assert.deepEqual(Array.from(window.__c9ResizeWork.find(row=>row.kind==='setSize').args),[856,622,false]);
});
test('unknown source structure fails closed before a campaign',()=>{
  assert.throws(()=>instrumentFiniteResizeSource('function resize(){return true;}'),/assertion|false/i);
});
