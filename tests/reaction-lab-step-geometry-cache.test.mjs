import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {
  compileReactionCatalog,reactionCandidates,createContactMatcher,
  scoreReactionGeometry,arbitrateReactionCandidateComponents,
  resolveSupplementalParticipants,supplementalSelectionCenter,environmentMatches,
  CONTACT_DWELL_MS,
} from '../src/reaction-lab-core.js';
import {createReactionLabEnvironment} from '../src/reaction-lab-environment.js';
import {canonicalNonbondedPairGeometry,REACTION_LAB_WORLD_UNITS_PER_ANGSTROM} from '../src/reaction-lab-stage-a.js';
import {REACTION_LAB_BATCH_PHASES} from '../src/reaction-lab-batch.js';

// Keep the uncached oracle in Git history rather than copying a retired
// production implementation into the tree. CI running this test must fetch
// the immutable pre-repair main commit (the finite workflow uses fetch-depth 0).
const oracleSha='6c676317ff590dd756685168484c79788b5a329b';
const root=new URL('..',import.meta.url);
const oracleSource=execFileSync('git',['show',`${oracleSha}:src/reaction-lab-viewer.js`],{cwd:root,encoding:'utf8'});
const currentSource=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');
function productionFunction(source,name){
  const start=source.indexOf(`  function ${name}(`);assert.ok(start>=0,`Missing production ${name}`);
  const brace=source.indexOf('{',start);let depth=1,end=brace+1;
  while(depth&&end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
  assert.equal(depth,0,`Unclosed production ${name}`);return source.slice(start,end);
}
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const recordsById=new Map(records.map(record=>[record.id,record]));
const catalog=compileReactionCatalog(records),models=new Map();
assert.equal(catalog.reactions.size,29,'The oracle uses the complete production reaction authority');

function modelFor(species){
  if(!models.has(species)){
    const model=createPreviewModel(THREE,recordsById.get(species));for(let index=0;index<190;index++)model.step();
    models.set(species,model.snapshot());
  }
  return models.get(species);
}
function itemFor(species,id,index){
  const record=recordsById.get(species),model=modelFor(species),group=new THREE.Group();
  group.position.set(index*25*REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,0,0);
  group.quaternion.setFromEuler(new THREE.Euler(.17*index,-.23*index,.11*index));group.updateMatrixWorld(true);
  return{id,species,record:{...record,atoms:model.atoms.map(atom=>({...atom,point:atom.point.clone()}))},group,
    busy:false,batchGeneration:7,feedMotion:null,stageBody:{positionAngstrom:group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM),orientation:group.quaternion.toArray(),velocityAngstromPerPs:[0,0,0],angularVelocityRadPerPs:[0,0,0]}};
}
function harness(source,speciesList,{conditions=[],manipulating=false}={}){
  const instances=speciesList.map((species,index)=>itemFor(species,`instance-${index}`,index));
  const environment=createReactionLabEnvironment();environment.setFromConditionTokens(conditions);
  const matcher=createContactMatcher(),matcherCalls=[],candidateCalls=[],arbitrations=[],commits=[];
  const contactMatcher=Object.fromEntries(Object.keys(matcher).map(name=>[name,(...args)=>{
    const result=matcher[name](...args);matcherCalls.push({name,args:structuredClone(args),result});return result;
  }]));
  const operations={worldCoordinates:0,canonicalAtomPairs:0};
  const scope={THREE,REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,REACTION_LAB_BATCH_PHASES,CONTACT_DWELL_MS,
    instances,reactionCatalog:catalog,contactMatcher,activationEnvironment:environment,
    supplementalSelectionCenter,resolveSupplementalParticipants,scoreReactionGeometry,environmentMatches,
    batch:{phase:REACTION_LAB_BATCH_PHASES.ACTIVE,generation:7},polymerRouteOwned:false,reactionAnimation:null,
    stageBPhysicsEnabled:true,testIsolation:null,reactionDiagnostics:[],reactionTrajectoryTrace:null,
    stageAPerformance:{fixedSteps:0},simulationClockSeconds:0,
    vector:(_three,point)=>Array.isArray(point)?new THREE.Vector3(...point):new THREE.Vector3(point.x,point.y,point.z),
    isManipulating:()=>manipulating,
    reactionCandidates:(pair,authority)=>{assert.equal(authority,catalog);const result=reactionCandidates(pair,authority);candidateCalls.push({pair:structuredClone(pair),count:result.length});return result;},
    canonicalNonbondedPairGeometry:(...args)=>{operations.canonicalAtomPairs++;return canonicalNonbondedPairGeometry(...args);},
    arbitrateReactionCandidateComponents:ready=>{const result=arbitrateReactionCandidateComponents(ready);arbitrations.push(structuredClone({ready,result}));return result;},
    commit:candidate=>commits.push(structuredClone(candidate)),
  };
  const api=runInNewContext(`
    ${['atomWorld','atomWorldAngstrom','instanceById'].map(name=>productionFunction(oracleSource,name)).join('\n')}
    const uncachedWorldCoordinate=atomWorldAngstrom;
    atomWorldAngstrom=(...args)=>{operations.worldCoordinates++;return uncachedWorldCoordinate(...args);};
    ${productionFunction(source,'reactionStep')}
    ({step:reactionStep,diagnostics:()=>reactionDiagnostics,setTrace:reactionId=>{reactionTrajectoryTrace={reactionId,samples:[]};},trace:()=>reactionTrajectoryTrace,
      setIsolation:ids=>{testIsolation=ids===null?null:new Set(ids);},setPolymerOwned:value=>{polymerRouteOwned=value;},setAnimation:value=>{reactionAnimation=value;}});
  `,{...scope,operations});
  return{...api,instances,environment,operations,candidateCalls,matcherCalls,arbitrations,commits,
    capture:()=>structuredClone({diagnostics:api.diagnostics(),matcherCalls,candidateCalls,arbitrations,commits,trace:api.trace()})};
}
function pair(species,options){return{oracle:harness(oracleSource,species,options),current:harness(currentSource,species,options)};}
function each(h,action){for(const instance of [h.oracle,h.current])action(instance);}
function compareStep(h,label){each(h,instance=>instance.step(1000/120));assert.deepEqual(h.current.capture(),h.oracle.capture(),label);}
function syncPose(item){item.group.updateMatrixWorld(true);item.stageBody.positionAngstrom=item.group.position.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);item.stageBody.orientation=item.group.quaternion.toArray();}
function pointAngstrom(item,index){return item.group.localToWorld(item.record.atoms[index].point.clone()).divideScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM);}

test('all 29 production rules retain complete candidate diagnostics and matcher bookkeeping against immutable uncached main',()=>{
  for(const rule of catalog.reactions.values()){
    const species=rule.reactants.map(item=>item.species),h=pair(species,{conditions:rule.requires});
    compareStep(h,`${rule.id}: initial orientations`);
    assert.ok(h.current.diagnostics().some(row=>row.reactionId===rule.id),`${rule.id} really exercised its production pathways`);
    each(h,instance=>instance.instances.forEach((item,index)=>{
      item.group.position.add(new THREE.Vector3(.31*(index+1),-.17*index,.29));
      item.group.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.13,.19,-.07)));syncPose(item);
    }));
    compareStep(h,`${rule.id}: changed position and orientation in the next step`);
  }
});

test('unchanged full Stage B fixture evaluates all 384 candidates and recomputes changed geometry on the next step',()=>{
  const h=pair(['methane','oxygen','2-butene','methane','oxygen','2-butene']);
  compareStep(h,'full six-body fixture');assert.equal(h.current.diagnostics().length,384);
  assert.deepEqual(h.oracle.operations,{worldCoordinates:19968,canonicalAtomPairs:9216},'The immutable uncached oracle exercises the diagnosed redundant work');
  assert.deepEqual(h.current.operations,{worldCoordinates:14,canonicalAtomPairs:48},'Every candidate remains assessed while identical read-only geometry is computed once per step');
  const before=structuredClone(h.current.diagnostics());
  each(h,instance=>{const item=instance.instances[1];item.group.position.set(.2,.1,.3);item.group.quaternion.setFromEuler(new THREE.Euler(.7,-.3,.2));syncPose(item);});
  compareStep(h,'next-step cache invalidation');assert.equal(h.current.diagnostics().length,384);
  assert.deepEqual(h.current.operations,{worldCoordinates:28,canonicalAtomPairs:96},'A second fixed step rebuilds both geometry caches after the pose change');
  assert.notDeepEqual(h.current.diagnostics(),before,'The changed pose must change the computed diagnostics');
  assert.deepEqual(h.current.candidateCalls,h.oracle.candidateCalls,'No pair, rule or labelled pathway is removed');
});

test('supplemental participant choice, busy state and isolation remain candidate-specific',()=>{
  const h=pair(['methane','oxygen','oxygen','oxygen'],{conditions:['heat']});
  compareStep(h,'supplemental initial choice');
  const before=structuredClone(h.current.diagnostics());
  each(h,instance=>{instance.instances[2].busy=true;instance.instances[3].group.position.set(2,1,-1);syncPose(instance.instances[3]);});
  compareStep(h,'busy state and supplemental choice change');
  assert.notDeepEqual(h.current.diagnostics(),before);
  assert.ok(h.current.diagnostics().some(row=>row.rejectionReasons.includes('participant-busy')));
  each(h,instance=>instance.setIsolation(['instance-0','instance-1','instance-3']));
  compareStep(h,'isolation changes the encounter set independently');
  assert.ok(h.current.diagnostics().every(row=>!row.encounterParticipantIds.includes('instance-2')));
});

function arrangeHydrogenChlorination(h,separation){
  each(h,instance=>{
    instance.instances.forEach((item,index)=>{
      const axis=item.record.atoms[1].point.clone().sub(item.record.atoms[0].point).normalize();
      item.group.quaternion.setFromUnitVectors(axis,new THREE.Vector3(index===0?-1:1,0,0));
      item.group.position.set(0,0,0);item.group.updateMatrixWorld(true);
      const anchor=pointAngstrom(item,0),desired=new THREE.Vector3(index===0?0:separation,0,0);
      item.group.position.copy(desired.sub(anchor).multiplyScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM));syncPose(item);
    });
  });
}
test('canonical overlap boundary, dwell and actual arbitration/commit inputs match the uncached oracle',()=>{
  const h=pair(['hydrogen','chlorine'],{conditions:['light']}),rule='complete-20-hydrogen-chlorination';
  const candidate=reactionCandidates([{species:'hydrogen',id:'instance-0'},{species:'chlorine',id:'instance-1'}],catalog)[0];
  const constraint=candidate.geometryConstraints[0],left=h.current.instances[0].record.nonbonded,right=h.current.instances[1].record.nonbonded;
  const boundary=canonicalNonbondedPairGeometry({sigmaAngstrom:left.sigmaAngstrom[0],epsilonKcalMol:left.epsilonKcalMol[0]},{sigmaAngstrom:right.sigmaAngstrom[0],epsilonKcalMol:right.epsilonKcalMol[0]},constraint.target).softCoreBoundaryAngstrom;
  for(const separation of [boundary-1e-8,boundary+1e-8,constraint.min-1e-8,constraint.min+1e-8,constraint.max-1e-8,constraint.max+1e-8]){
    arrangeHydrogenChlorination(h,separation);compareStep(h,`canonical boundary ${separation}`);
  }
  each(h,instance=>{instance.environment.setFromConditionTokens([]);instance.setTrace(rule);});
  arrangeHydrogenChlorination(h,constraint.target);compareStep(h,'environment-gated at target');
  each(h,instance=>instance.environment.setFromConditionTokens(['light']));
  for(let step=0;step<5;step++)compareStep(h,`eligible dwell step ${step}`);
  assert.ok(h.current.diagnostics().some(row=>row.commitReady),'A real production geometry becomes commit ready');
  assert.ok(h.current.arbitrations.length>0,'Real production component arbitration was exercised');
  assert.ok(h.current.commits.length>0,'The production reactionStep selected an actual commit input');
  assert.ok(h.current.trace().samples.length>0,'Trajectory diagnostics keep the same body/geometry observations');
  assert.equal(h.current.commits.at(-1).reactionId,rule);
  const committed=h.current.commits.length;
  arrangeHydrogenChlorination(h,25);compareStep(h,'moving away clears readiness and cannot reuse old positions');
  assert.equal(h.current.commits.length,committed);
});

test('manipulation and polymer/animation early returns preserve reset behavior',()=>{
  const h=pair(['hydrogen','chlorine'],{conditions:['light'],manipulating:true});
  compareStep(h,'manipulating clears dwell');assert.ok(h.current.diagnostics().every(row=>row.rejectionReasons.includes('participant-manipulating')));
  each(h,instance=>instance.setPolymerOwned(true));compareStep(h,'polymer-owned batch bypasses generic matcher');assert.equal(h.current.diagnostics().length,0);
  each(h,instance=>{instance.setPolymerOwned(false);instance.setAnimation({phase:'PREPARING'});});compareStep(h,'active transformation resets matcher');assert.equal(h.current.diagnostics().length,0);
});
