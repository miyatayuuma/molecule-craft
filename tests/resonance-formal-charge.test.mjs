import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js?resonance-test=1';
import {supportedResonanceGroups} from '../src/resonance-model.js?v=1';
import {bondAddition,atomBondState} from '../src/bonding-model.js?v=31';
import {evaluateCraftTargetMatch} from '../src/craft-target-match.js';
import {nextCraftBondHint} from '../src/craft-target-hint.js?v=1';
import {createMoleculeGraph} from '../src/molecule-graph.js';

const root=new URL('../',import.meta.url);
const records=JSON.parse(await readFile(new URL('data/molecules.json',root),'utf8'));
setMoleculeDatabase(records);
assert.equal(records.length,135,'Resonance extension should bring the production DB to 135 molecules');
const byId=id=>records.find(record=>record.id===id);

function build(record){
  const molecule=new Molecule(),ids=record.atoms.map(element=>molecule.addAtom(element).id);
  for(const[a,b,order]of record.bonds)molecule.setBond(ids[a],ids[b],order);
  return{molecule,ids};
}
function alternate(record){
  const copy=structuredClone(record);
  for(const group of copy.resonanceGroups??[]){
    const edges=copy.bonds.filter(([a,b])=>(a===group.center&&group.ends.includes(b))||(b===group.center&&group.ends.includes(a)));
    assert.equal(edges.length,2,`${record.id}: expected two equivalent resonance bonds`);
    [edges[0][2],edges[1][2]]=[edges[1][2],edges[0][2]];
  }
  return copy;
}
function precursor(record){
  const copy=structuredClone(record);
  for(const group of copy.resonanceGroups??[])for(const bond of copy.bonds){
    if((bond[0]===group.center&&group.ends.includes(bond[1]))||(bond[1]===group.center&&group.ends.includes(bond[0])))bond[2]=1;
  }
  return copy;
}

for(const id of ['ozone','nitromethane']){
  const record=byId(id),other=alternate(record),built=build(other);
  assert.ok(record,`Missing ${id}`);
  assert.equal(built.molecule.recognizedMolecule()?.id,id,`${id}: alternate resonance contributor must recognize as the same molecule`);
  assert.equal(built.molecule.validation().level,'ok',`${id}: supported formal-charge valence must validate`);
  assert.equal(evaluateCraftTargetMatch(record,other)?.percent,100,`${id}: alternate resonance contributor must be 100% Target Match`);
  const groups=supportedResonanceGroups(built.molecule);assert.equal(groups.length,1,`${id}: expected one supported resonance group`);
  const group=groups[0],center=atomBondState(built.molecule,group.center),negative=atomBondState(built.molecule,group.negative);
  assert.equal(center.charge,1,`${id}: positive formal charge`);assert.equal(negative.charge,-1,`${id}: negative formal charge`);assert.equal(negative.pairs,3,`${id}: O- keeps three lone pairs`);
  const pre=precursor(record),stats={},hint=nextCraftBondHint(record,pre,{stats});
  assert.ok(hint,`${id}: precursor must have a next bond hint`);assert.equal(hint.nextOrder,2,`${id}: hint should complete a resonance double bond`);
  const elements=hint.workspaceIndices.map(index=>pre.atoms[index]).sort().join('');
  assert.ok(elements==='NO'||elements==='OO',`${id}: hint must target the resonance bond, got ${elements}`);
}

const nitromethane=byId('nitromethane'),nitroPre=precursor(nitromethane),builtPre=build(nitroPre),nitroGroup=nitromethane.resonanceGroups[0];
const nId=builtPre.ids[nitroGroup.center],oId=builtPre.ids[nitroGroup.ends[0]];
assert.deepEqual(bondAddition(builtPre.molecule,nId,oId),{allowed:true,order:2,kind:'extension'},'Supported nitro completion may cross the ordinary N valence ceiling without widening N chemistry globally');

const ozone=byId('ozone'),ozonePre=precursor(ozone),builtOzonePre=build(ozonePre),ozoneGroup=ozone.resonanceGroups[0];
assert.deepEqual(bondAddition(builtOzonePre.molecule,builtOzonePre.ids[ozoneGroup.center],builtOzonePre.ids[ozoneGroup.ends[0]]),{allowed:true,order:2,kind:'extension'},'Supported ozone completion may cross the ordinary O valence ceiling only for the recognized motif');

const nitrobenzene=byId('nitrobenzene');
assert.equal(build(nitrobenzene).molecule.recognizedMolecule()?.id,'nitrobenzene','Nitrobenzene canonical recognition');
assert.equal(build(alternate(nitrobenzene)).molecule.recognizedMolecule()?.id,'nitrobenzene','Nitrobenzene alternate nitro resonance recognition');
for(const record of records.slice(0,129))assert.equal(build(record).molecule.recognizedMolecule()?.id,record.id,`Legacy recognition changed: ${record.id}`);

const tnt=byId('2-4-6-trinitrotoluene'),tntPre=precursor(tnt),stats={},started=performance.now(),tntHint=nextCraftBondHint(tnt,tntPre,{stats}),elapsed=performance.now()-started;
assert.ok(tntHint,'TNT precursor should produce a next-bond hint');
assert.ok(elapsed<1000,`TNT hint took ${elapsed.toFixed(1)} ms`);
assert.ok((stats.recursiveVisits??0)<200000,`TNT hint search exploded: ${JSON.stringify(stats)}`);
console.log('TNT_HINT_PROFILE',JSON.stringify({elapsedMs:Number(elapsed.toFixed(2)),...stats}));

const rawGraph=JSON.parse(await readFile(new URL('data/molecule-graph.json',root),'utf8')),graph=createMoleculeGraph(rawGraph);
assert.equal(graph.nodes.length,135,'Graph should contain all 135 production molecules');
const relation=(a,b)=>graph.edges.find(edge=>(edge.from===a&&edge.to===b)||(edge.from===b&&edge.to===a));
for(const[a,b]of [['oxygen','ozone'],['methane','nitromethane'],['benzene','nitrobenzene'],['toluene','2-nitrotoluene'],['2-nitrotoluene','2-4-dinitrotoluene'],['2-4-dinitrotoluene','2-4-6-trinitrotoluene']])assert.ok(relation(a,b),`Missing Graph edge ${a} -> ${b}`);
assert.equal(graph.relationCodes[relation('oxygen','ozone').relationCode],'oxygenation');
for(const[a,b]of [['methane','nitromethane'],['benzene','nitrobenzene'],['toluene','2-nitrotoluene'],['2-nitrotoluene','2-4-dinitrotoluene'],['2-4-dinitrotoluene','2-4-6-trinitrotoluene']])assert.equal(graph.relationCodes[relation(a,b).relationCode],'substitution',`${a} -> ${b} should be one substitution step`);
assert.equal(relation('toluene','2-4-6-trinitrotoluene'),undefined,'TNT must not shortcut directly from toluene');
const seen=new Set(graph.roots),queue=[...graph.roots];while(queue.length){for(const next of graph.getNeighbors(queue.shift()))if(!seen.has(next)){seen.add(next);queue.push(next);}}
assert.equal(seen.size,graph.nodes.length,'All Graph nodes must remain reachable');

for(const id of ['ozone','nitromethane','nitrobenzene','2-nitrotoluene','2-4-dinitrotoluene','2-4-6-trinitrotoluene']){
  const svg=await readFile(new URL(`assets/models/molecule-${id}.svg`,root),'utf8');
  assert.match(svg,/[+−]/,`${id}: generated Encyclopedia asset must show formal charge`);
}
console.log('Resonance/formal-charge foundation passed: equivalence, validation, Target Match/hint, Graph reachability and charged assets.');
