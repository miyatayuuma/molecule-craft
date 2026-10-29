import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTorsionModel} from '../src/torsion-model.js';
import {createMoleculeGraph,getFrontierCandidates} from '../src/molecule-graph.js';
import {FIELD_PROGRESSION_RESERVED_MOLECULE_IDS,isFieldProgressionReserved} from '../src/veil/progression-reserved-molecules.js';
import {signalCandidateEligible} from '../src/veil/resources.js';
const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url)));
const molecules=await read('../data/molecules.json'),graph=createMoleculeGraph(await read('../data/molecule-graph.json'));
assert.equal(FIELD_PROGRESSION_RESERVED_MOLECULE_IDS.length,6);
for(const id of FIELD_PROGRESSION_RESERVED_MOLECULE_IDS){
 const molecule=molecules.find(row=>row.id===id);assert(molecule,`${id} is still an ordinary molecule record`);assert.equal(isFieldProgressionReserved(id),true);
 assert.equal(signalCandidateEligible(molecule,{region:'frontier',canUseElement:()=>true}),false,`${id} cannot enter direct FIELD signal fallback`);
}
const candidates=getFrontierCandidates(graph,{discoveredIds:['hydrogen','methane','oxygen','ethene','propene','1-butene','ethylene-glycol','ethylenediamine','chlorotrifluoroethylene']});
for(const id of FIELD_PROGRESSION_RESERVED_MOLECULE_IDS)assert(!candidates.some(item=>item.id===id),`${id} cannot enter automatic frontier recipe selection`);
for(const id of ['1-3-butadiene','isoprene']){
 const molecule=molecules.find(row=>row.id===id),runtime={atoms:molecule.atoms.map((element,index)=>({id:index,element})),bonds:molecule.bonds.map(([a,b,order])=>({a,b,order}))};
 const central=molecule.bonds.find(([a,b,order])=>order===1&&molecule.atoms[a]==='C'&&molecule.atoms[b]==='C'&&molecule.bonds.some(([x,y,o])=>o===2&&(x===a||y===a))&&molecule.bonds.some(([x,y,o])=>o===2&&(x===b||y===b)));
 assert(central,`${id} has a central single bond between alkene carbons`);
 const model=createTorsionModel(runtime);assert.equal(model.bonds.get(`${central[0]}:${central[1]}`)?.classification,'RESTRICTED',`${id}: central conjugated bond uses shared conjugation authority`);
 assert.equal(molecule.bonds.filter(([, ,order])=>order===2).length,2,`${id}: two C=C bonds preserve conformational options across the central bond`);
}
console.log('Reserved FIELD candidates and generalized conjugated diene geometry passed.');
