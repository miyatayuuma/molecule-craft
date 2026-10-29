import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8'),start=source.indexOf("  canvas.addEventListener('pointerdown',event=>"),brace=source.indexOf('{',start);let end=brace+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
test('reference orbit never hands the canvas to retained actual feeds or hidden water',()=>{
 for(const actualHit of ['water','unused-feed']){
  const activePointers=new Map(),polymerOrbitPointers=new Set(),scope={polymerGraphVisual:{},disposed:false,contextLost:false,pickerOpen:false,isTransitionLocked:()=>false,reactionAnimation:null,growthCameraMotion:null,observation:{comparisonActive:false},canObservePolymerSample:()=>true,finiteReferenceView:{},activePointers,polymerOrbitPointers,raycastAtoms(){throw Error(`Must not raycast actual ${actualHit}`);},fallbackGrab(){throw Error('Must not grab actual world');},capturePointer(){},polymerOrbitGesture:null,performance:{now:()=>1},onPointerLockChange(){},updateCommandBar(){}};
  const handler=runInNewContext(`(event=>${source.slice(brace,end)})`,scope);handler({pointerId:7,clientX:190,clientY:410,preventDefault(){}});
  assert.equal(activePointers.size,1);assert.equal(polymerOrbitPointers.has(7),true);assert.equal(scope.polymerOrbitGesture.pointerId,7);
 }
});
