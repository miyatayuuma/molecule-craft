import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {createStageABody,REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,STAGE_A_GAME_STEP_SECONDS,STAGE_A_PHYSICAL_PS_PER_GAME_SECOND} from '../src/reaction-lab-stage-a.js';
import {evaluateStageBForces,integrateStageB} from '../src/reaction-lab-stage-b.js';
import {createChamberTimeAuthority,CHAMBER_TIME_MODES} from '../src/reaction-lab-manipulation.js';

const source=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');
// Run the actual production handlers. Browser tests cover acquisition/movement;
// this harness controls the release call stack and subsequent physics exactly.
function productionFunction(name){
  const start=source.indexOf(`  function ${name}(`);assert.ok(start>=0,name);
  const brace=source.indexOf('{',start);let depth=1,end=brace+1;
  while(depth&&end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
  assert.equal(depth,0,`Unclosed production function ${name}`);return source.slice(start,end);
}
const water=(JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'))).find(record=>record.id==='water');
const model=createPreviewModel(THREE,water);for(let i=0;i<190;i++)model.step();
const atoms=model.snapshot().atoms.map((atom,index)=>({element:atom.element,positionAngstrom:atom.point.toArray().map(v=>v/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),chargeE:water.nonbonded.atomicChargesE[index],sigmaAngstrom:water.nonbonded.sigmaAngstrom[index],epsilonKcalMol:water.nonbonded.epsilonKcalMol[index]}));
function harness(){
  const items=[[0,0,0],[290,240,0],[340,240,0],[390,240,0]].map((positionAngstrom,index)=>{
    const stageBody=createStageABody({id:`water-${index}`,atoms,virtualChargeSites:water.nonbonded.virtualChargeSites,positionAngstrom,velocityAngstromPerPs:[7+index,-3,2],angularVelocityRadPerPs:[.1,.2,.3]});
    const group=new THREE.Group();group.position.fromArray(positionAngstrom.map(v=>v*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM));return{id:stageBody.id,stageBody,group};
  });
  const chamberTime=createChamberTimeAuthority();chamberTime.setMode(CHAMBER_TIME_MODES.MANIPULATING);
  const captures=new Set([11]),updates=[],locks=[],commandUpdates=[],window=new EventTarget();
  const scope={items,chamberTime,CHAMBER_TIME_MODES,REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,window,eventOptions:{signal:new AbortController().signal},
    canvas:{hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)},
    clearDepthTarget:()=>{},updateCommandBar:()=>commandUpdates.push(true),onPointerLockChange:value=>locks.push(value),
    updateManipulation:ms=>{updates.push(ms);items[0].group.position.x+=.42;},
    startManualPolymerDock:()=>{throw Error('Generic water must not enter polymer docking');},
  };
  const api=runInNewContext(`
    let selected=items[0],down={pointerId:11,group:items[0]},pinchActive=false,pinchDistance=0,polymerOrbitGesture=null,polymerOrbitPinchDistance=0;
    const activePointers=new Map([[11,{x:0,y:0}]]),polymerOrbitPointers=new Set();
    ${['syncStageABodyFromGroup','endManipulation','endPointer','cancelAllPointers'].map(productionFunction).join('\n')}
    ${source.match(/^  window\.addEventListener\('blur',.*eventOptions\);$/m)?.[0]??''}
    ({endPointer,cancelAllPointers,state:()=>({selected,down,activePointers:[...activePointers.keys()],mode:chamberTime.mode,scale:chamberTime.scale}),addPointer:id=>activePointers.set(id,{x:0,y:0})});
  `,scope);
  return{...api,items,captures,updates,locks,commandUpdates,window};
}
const xyz=value=>Array.from(value);

test('production pointerup handler resets the owned body synchronously, preserves other bodies, and restores time/capture',()=>{
  const h=harness(),other=structuredClone(h.items.slice(1).map(item=>item.stageBody)),angular=[...h.items[0].stageBody.angularVelocityRadPerPs];
  h.endPointer({pointerId:11,type:'pointerup'});
  assert.deepEqual(xyz(h.items[0].stageBody.velocityAngstromPerPs),[0,0,0]);
  assert.deepEqual(h.items.slice(1).map(item=>item.stageBody),other,'No other instance is reset');
  assert.deepEqual(h.items[0].stageBody.angularVelocityRadPerPs,angular,'Release preserves natural angular motion');
  assert.deepEqual(h.updates,[16],'Final drag update executes before reset');
  assert.equal(h.state().selected,null);assert.equal(h.state().down,null);assert.deepEqual(xyz(h.state().activePointers),[]);
  assert.equal(h.state().mode,'NORMAL');assert.equal(h.state().scale,1);assert.equal(h.captures.size,0);assert.equal(h.locks.at(-1),false);
});

test('inactive or non-owning pointer release cannot reset another pointer\'s dragged instance',()=>{
  for(const active of [false,true]){
    const h=harness(),before=structuredClone(h.items.map(item=>item.stageBody));if(active)h.addPointer(22);
    h.endPointer({pointerId:22,type:'pointerup'});
    assert.deepEqual(h.items.map(item=>item.stageBody),before);assert.equal(h.state().selected.id,'water-0');assert.equal(h.state().down.pointerId,11);assert.equal(h.state().scale,.15);assert.deepEqual(h.updates,[]);
  }
});

test('pointercancel and all-pointer cancellation zero release velocity without a final drag update',()=>{
  for(const kind of ['pointercancel','cancelAllPointers']){
    const h=harness();if(kind==='pointercancel')h.endPointer({pointerId:11,type:kind});else h.cancelAllPointers();
    assert.deepEqual(xyz(h.items[0].stageBody.velocityAngstromPerPs),[0,0,0]);assert.deepEqual(h.updates,[]);assert.equal(h.state().selected,null);assert.equal(h.state().down,null);assert.equal(h.state().scale,1);assert.deepEqual(xyz(h.state().activePointers),[]);assert.equal(h.captures.size,0);
  }
});

test('zero release momentum and nonzero velocity after ordinary Stage B steps are compatible',()=>{
  const h=harness();for(const item of h.items)item.stageBody.velocityAngstromPerPs=[0,0,0];
  h.endPointer({pointerId:11,type:'pointerup'});const bodies=h.items.map(item=>item.stageBody),before=structuredClone(bodies);
  assert.deepEqual(xyz(bodies[0].velocityAngstromPerPs),[0,0,0]);
  const forces=evaluateStageBForces(bodies);assert.ok(Math.hypot(...forces.bodies.get('water-0').forceKcalMolAngstrom)>0);
  const dt=STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND;
  for(let i=0;i<8;i++)integrateStageB(bodies,dt,{collectPairDiagnostics:false});
  assert.ok(Math.hypot(...bodies[0].velocityAngstromPerPs)>1e-12,'A later zero-velocity assertion confuses physics acceleration with throw momentum');
  assert.ok(bodies.every(body=>[...body.positionAngstrom,...body.velocityAngstromPerPs,...body.orientation,...body.angularVelocityRadPerPs].every(Number.isFinite)));
  assert.notDeepEqual(bodies[0].positionAngstrom,before[0].positionAngstrom);
});

// A window blur does not dispatch pointerup to the canvas. Exercise the actual
// production event registration, rather than calling cancelAllPointers directly.
test('window blur cancels an owned drag even when its release event is absent',()=>{
  const h=harness();h.window.dispatchEvent(new Event('blur'));
  assert.equal(h.commandUpdates.length,1,'Blur unlocks command and environment controls as well as pointer state');
  assert.equal(h.state().selected,null);assert.equal(h.state().down,null);assert.equal(h.state().scale,1);
  assert.deepEqual(xyz(h.items[0].stageBody.velocityAngstromPerPs),[0,0,0]);
  assert.deepEqual(xyz(h.state().activePointers),[]);assert.equal(h.captures.size,0);
});
