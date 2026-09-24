import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js';
const molecules=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const encyclopedia=JSON.parse(await readFile(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
setMoleculeDatabase(molecules);
const expected={
 '1-3-butadiene':{nameJa:'1,3-ブタジエン',nameEn:'1,3-Butadiene',formula:'C4H6',iupac:'Buta-1,3-diene',category:'hydrocarbon',aliases:['butadiene'],bonds:[[0,1,2],[1,2,1],[2,3,2]]},
 isoprene:{nameJa:'イソプレン',nameEn:'Isoprene',formula:'C5H8',iupac:'2-Methylbuta-1,3-diene',category:'hydrocarbon',aliases:['2-methyl-1,3-butadiene'],bonds:[[0,1,2],[1,2,1],[2,3,2],[1,4,1]]},
 'vinylidene-fluoride':{nameJa:'フッ化ビニリデン',nameEn:'Vinylidene fluoride',formula:'C2H2F2',iupac:'1,1-Difluoroethene',category:'halogenated-hydrocarbon',aliases:['VDF','VF2'],bonds:[[0,1,2],[1,2,1],[1,3,1]]},
 hexafluoropropylene:{nameJa:'ヘキサフルオロプロピレン',nameEn:'Hexafluoropropylene',formula:'C3F6',iupac:'1,1,2,3,3,3-Hexafluoroprop-1-ene',category:'halogenated-hydrocarbon',aliases:['HFP'],bonds:[[0,1,2],[1,2,1],[0,3,1],[0,4,1],[1,5,1],[2,6,1],[2,7,1],[2,8,1]]},
 tetrafluoroethylene:{nameJa:'テトラフルオロエチレン',nameEn:'Tetrafluoroethylene',formula:'C2F4',iupac:'1,1,2,2-Tetrafluoroethene',category:'halogenated-hydrocarbon',aliases:['TFE'],bonds:[[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]]},
 hexamethylenediamine:{nameJa:'ヘキサメチレンジアミン',nameEn:'Hexamethylenediamine',formula:'C6H16N2',iupac:'Hexane-1,6-diamine',category:'diamine',aliases:['HMDA','1,6-hexanediamine'],bonds:[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[5,6,1],[6,7,1]]},
};
assert.equal(molecules.length,142);assert.equal(new Set(molecules.map(m=>m.id)).size,142);
for(const [id,contract] of Object.entries(expected)){
 const record=molecules.find(m=>m.id===id);assert(record,id);
 for(const [key,value]of [['nameJa',contract.nameJa],['nameEn',contract.nameEn],['formula',contract.formula],['iupacNameEn',contract.iupac],['category',contract.category]])assert.equal(record[key],value,`${id}: ${key}`);
 for(const alias of contract.aliases)assert(record.aliases.includes(alias),`${id}: missing alias ${alias}`);
 const heavy=record.atoms.map((element,index)=>({element,index})).filter(atom=>atom.element!=='H');assert.equal(heavy.length,contract.bonds.reduce((count,[a,b])=>Math.max(count,a+1,b+1),0));
 assert.deepEqual(record.bonds.filter(([a,b])=>record.atoms[a]!=='H'&&record.atoms[b]!=='H'),contract.bonds,`${id}: canonical heavy-atom connectivity`);
 const molecule=new Molecule(),ids=record.atoms.map(element=>molecule.addAtom(element).id);for(const [a,b,order]of record.bonds)molecule.setBond(ids[a],ids[b],order);assert.equal(molecule.validation().level,'ok',`${id}: valid valence`);assert.equal(molecule.recognizedMolecule()?.id,id,`${id}: exact production recognition`);
 const entry=encyclopedia.molecules[id];assert(entry,`${id}: regular molecule encyclopedia entry`);assert.ok(entry.number>=137&&entry.number<=142);assert.ok(entry.description.length>=12&&entry.description.length<=90);assert.ok(entry.details.length>=2);
}
for(let number=1;number<=136;number++)assert.equal(Object.values(encyclopedia.molecules).find(entry=>entry.number===number)?.number,number,`legacy Encyclopedia number ${number} remains assigned`);
console.log('Six canonical monomers pass production identity, formula, aliases, connectivity, recognition and Encyclopedia contracts.');
