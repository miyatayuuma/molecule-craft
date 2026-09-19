import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js';
import {createMoleculeGraph,getFrontierCandidates} from '../src/molecule-graph.js';

const root=new URL('../',import.meta.url);
const [catalog,rawGraph,encyclopedia,solverSource,buildSource]=await Promise.all([
  readFile(new URL('data/molecules.json',root),'utf8').then(JSON.parse),
  readFile(new URL('data/molecule-graph.json',root),'utf8').then(JSON.parse),
  readFile(new URL('data/encyclopedia.json',root),'utf8').then(JSON.parse),
  readFile(new URL('src/structure-relaxation.js',root),'utf8'),
  readFile(new URL('scripts/build-molecule-db.mjs',root),'utf8'),
]);
setMoleculeDatabase(catalog);
const ctfe=catalog.find(record=>record.id==='chlorotrifluoroethylene');
const moleculeFrom=record=>{const molecule=new Molecule(),ids=record.atoms.map(atom=>molecule.addAtom(atom).id);for(const [a,b,order] of record.bonds)molecule.setBond(ids[a],ids[b],order);return molecule;};

test('CTFE is a normal molecule DB record with CF2=CClF connectivity and ordinary valence recognition',()=>{
  assert.ok(ctfe);assert.equal(ctfe.nameEn,'Chlorotrifluoroethylene');assert.equal(ctfe.formula,'C2ClF3');
  assert.deepEqual(ctfe.atoms.reduce((out,atom)=>(out[atom]=(out[atom]??0)+1,out),{}),{C:2,F:3,Cl:1});
  assert.deepEqual(ctfe.bonds,[[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]]);
  const correct=moleculeFrom(ctfe);assert.equal(correct.validation().level,'ok');assert.equal(correct.recognizedMolecule()?.id,'chlorotrifluoroethylene');
  const single=structuredClone(ctfe);single.bonds[0][2]=1;assert.notEqual(moleculeFrom(single).recognizedMolecule()?.id,'chlorotrifluoroethylene','single C-C cannot complete CTFE');
  const wrongHalogen=structuredClone(ctfe);wrongHalogen.atoms[4]='F';assert.notEqual(moleculeFrom(wrongHalogen).recognizedMolecule()?.id,'chlorotrifluoroethylene','C2F4 cannot complete CTFE');
});

test('CTFE uses the shared alkene sp2 planar authority with no molecule-specific geometry hook',()=>{
  assert.match(solverSource,/bond\.order !== 2/);assert.match(solverSource,/geometryFor\(id\)\.kind !== 'sp2'/);assert.match(solverSource,/planarSubstituentGroup\(bond\)/);
  assert.doesNotMatch(solverSource,/chlorotrifluoroethylene|\bCTFE\b/);
});

test('CTFE is a minimal substitution leaf off vinyl chloride and remains ordinary Graph frontier data',()=>{
  const graph=createMoleculeGraph(rawGraph),neighbors=new Set(graph.getNeighbors('vinyl-chloride'));
  assert(neighbors.has('chlorotrifluoroethylene'));assert.deepEqual(graph.getNeighbors('chlorotrifluoroethylene'),['vinyl-chloride']);
  const columns=rawGraph.edgeColumns,rows=rawGraph.edges.map(row=>Object.fromEntries(columns.map((key,index)=>[key,row[index]]))),nodes=rawGraph.nodes.map(row=>Object.fromEntries(rawGraph.nodeColumns.map((key,index)=>[key,row[index]]))),id=value=>Number.isInteger(value)?nodes[value]?.id:value;
  const edge=rows.find(row=>new Set([id(row.from),id(row.to)]).has('chlorotrifluoroethylene'));assert(edge);assert.equal(rawGraph.relationCodes[String(edge.relationCode)],'substitution');
  const frontier=getFrontierCandidates(graph,{discoveredIds:['vinyl-chloride']});assert(frontier.some(candidate=>candidate.id==='chlorotrifluoroethylene'));
});

test('Encyclopedia and build authority include CTFE but no independent PCTFE game object',()=>{
  assert.ok(encyclopedia.molecules.chlorotrifluoroethylene);assert.match(encyclopedia.molecules.chlorotrifluoroethylene.description,/CF₂=CClF/);
  assert.match(buildSource,/chlorotrifluoroethylene/);assert.match(buildSource,/molecules\.length !== 136/);
  assert.equal(catalog.some(record=>/pctfe/i.test(record.id)||/^PCTFE$/i.test(record.nameEn??'')),false);
  assert.equal(Object.keys(encyclopedia.molecules).some(id=>/pctfe/i.test(id)),false);
});
