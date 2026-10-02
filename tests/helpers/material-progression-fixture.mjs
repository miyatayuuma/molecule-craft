// Production actions from a pre-Core CHO checkpoint; no ⑩ flags or unlocks are seeded.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createResources,RESOURCE_KEY} from '../../src/veil/resources.js';
import {createInitialResourcesState} from '../../src/veil/resources-persistence.js';
import {createRun,stepRun,stepNormalExtractionPending,beginBurst,beginShock,setCombustionHeld} from '../../src/veil/engine.js';
import {createUniverse} from '../../src/veil/universe.js';
import {flightConfig,REGIONS} from '../../src/veil/growth.js';
import {isInsideSafeExtractionSite} from '../../src/veil/safe-extraction-sites.js';
import {EXPEDITION} from '../../src/veil/config.js';
import {Molecule,setMoleculeDatabase} from '../../src/chemistry.js?v=20';
import {createCraftWorkspace} from '../../src/craft-workspace.js';
import {createCollectionState} from '../../src/collection-state.js';
export const readCatalog=name=>JSON.parse(readFileSync(new URL(`../../data/${name}.json`,import.meta.url)));
export function memoryStorage(){const values=new Map();return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
export function preCoreCheckpoint(){
  const storage=memoryStorage(),state=createInitialResourcesState();
  // Previously closed CHO / Nitrogen campaign and its ordinary stock/loadout.
  Object.assign(state.progress,{choCompleted:true,regions:Object.keys(REGIONS),checkpoint:'nitrogen',foundElements:['H','C','O','N']});
  state.recipes=['hydrogen','methane','oxygen','water','nitromethane'];Object.assign(state.elements,{H:600,C:300,O:300,N:60});
  storage.setItem(RESOURCE_KEY,JSON.stringify(state));const resources=createResources({storage});resources.setCatalog(readCatalog('molecules'));
  return{storage,resources};
}
export function launch(resources,region,{seed=77}={}){
  // Refill only through canonical inventory transactions, as LOADOUT does.
  for(const [use,id] of [['fuel','methane'],['oxidizer','oxygen'],['coolant','water'],['propellant','hydrogen'],['shock','nitromethane']]){
    assert.equal(resources.setLoadoutTank(use,id),true);
    const capacity={fuel:18,oxidizer:36,coolant:20,propellant:3,shock:1}[use];
    resources.fillTankFromElements(use,id,Math.max(0,capacity-(resources.state.tanks[use]?.amount??0)));
  }
  const config=flightConfig(resources.state),capabilities={combustionDrive:true,nitrogenField:config.nitrogenField,coreFractured:config.coreFractured,worldAwakened:config.worldAwakened,rareEcologyEligible:config.rareEcologyEligible};
  const run=createRun(createUniverse(seed,resources.state.elements,{capabilities}),config,{fuel:resources.prepareExpedition({region}),collectorShell:resources.collectorShellState(),engineering:resources.engineeringState()});
  Object.assign(run.player,REGIONS[region]);run.region=region;return run;
}
export function flyTo(run,resources,target,{radius=45,burst=false,limit=100}={}){
  setCombustionHeld(run,true);
  for(let n=0;n<limit*60;n++){
    const dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy);
    if(distance<=radius)return;
    assert.equal(run.captured,false,`captured flying toward ${JSON.stringify(target)} at ${run.time}`);
    if(burst&&distance<620)beginBurst(run,()=>resources.consumeBoost());
    stepRun(run,{x:dx/distance,y:dy/distance},1/60,{consumeCombustion:packet=>resources.consumeCombustion(packet),consumeCoolant:(amount,id)=>resources.consumeTank('coolant',id,amount)});
  }
  assert.fail(`unreachable waypoint ${JSON.stringify(target)}: ${run.player.x},${run.player.y}`);
}
export function normalReturn(run,resources){
  const site=run.map.safeExtractionSites.reduce((best,item)=>Math.hypot(item.x-run.player.x,item.y-run.player.y)<Math.hypot(best.x-run.player.x,best.y-run.player.y)?item:best);
  flyTo(run,resources,site,{radius:site.radius*.7});assert.ok(isInsideSafeExtractionSite(run.player,run.map.safeExtractionSites));
  setCombustionHeld(run,false);for(let n=0;n<Math.ceil(EXPEDITION.normalExtractionSeconds*60);n++)stepNormalExtractionPending(run,1/60);
  assert.equal(run.captured,false);const result=resources.settleExpedition(run.elementDust,run.best,false);assert.ok(result);return result;
}
export function awaken(resources){
  const run=launch(resources,'nitrogen');assert.equal(run.map.dust.some(item=>item.rareEcology),false);
  flyTo(run,resources,run.map.nitrogenCore,{radius:259.9,burst:true});
  const event=beginShock(run,(id,amount)=>resources.consumeTank('shock',id,amount));assert.equal(event.coreFractured,true);
  assert.equal(resources.recordCoreFracture().stage,'pending');assert.equal(resources.worldAwakeningState().worldAwakened,false);
  assert.equal(normalReturn(run,resources).worldAwakenedNow,true);return{seconds:run.time};
}
export function acquireRare(resources,element,region){
  const run=launch(resources,region),target=run.map.dust.filter(item=>item.rareEcology&&item.element===element).sort((a,b)=>Math.hypot(a.x-run.player.x,a.y-run.player.y)-Math.hypot(b.x-run.player.x,b.y-run.player.y))[0];assert.ok(target,`${element} spawn`);
  flyTo(run,resources,target,{radius:8});setCombustionHeld(run,false);
  for(let n=0;n<24;n++)stepRun(run,{x:0,y:0},1/60,{});
  assert.ok(run.elementDust[element]>=1,`${element} enters cargo from a real socket`);
  const settlement=normalReturn(run,resources);assert.ok(settlement.atoms[element]>=1);return{element,acquired:settlement.atoms[element],seconds:run.time};
}
export function craftInputs(resources,storage,ids){
  const records=readCatalog('molecules');setMoleculeDatabase(records);
  const collection=createCollectionState({records,groups:[],templates:[],storage,elementAccess:element=>resources.canUseElement(element)});
  for(const id of ids){
    const record=records.find(item=>item.id===id),molecule=new Molecule(),workspace=createCraftWorkspace({molecule,placements:new Map(),resources});
    assert.ok(record.atoms.every(element=>resources.canUseElement(element)),`${id}: all elements acquired`);
    const atoms=record.atoms.map(element=>workspace.addAtom(element,{x:0,y:0,z:0}));assert.ok(atoms.every(Boolean));
    for(const [a,b,order] of record.bonds)molecule.setBond(atoms[a].id,atoms[b].id,order);
    assert.equal(molecule.recognizedMolecule()?.id,id);
    collection.observeStructures([{complete:true,record:molecule.recognizedMolecule(),graph:molecule,signature:id}]);
    resources.discoverWithLoadout(id);workspace.clear();assert.ok(collection.hasMolecule(id));
  }
  return collection;
}
