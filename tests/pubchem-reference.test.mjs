import assert from 'node:assert/strict';
import {PUBCHEM_INTRO_STORAGE_KEY,conservativeSmiles,createPubchemIntroState,pubchemReferenceFor} from '../src/pubchem-reference.js';

const structure=(atoms,bonds,formula)=>({formula,graph:{atoms:atoms.map((element,index)=>({id:index+1,element})),bonds:bonds.map(([a,b,order])=>({a:a+1,b:b+1,order}))}});

const ethanol=structure(['C','C','O','H','H','H','H','H','H'],[[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1]],'C2H6O');
assert.equal(conservativeSmiles(ethanol.graph),'CCO');
assert.deepEqual(pubchemReferenceFor(ethanol),{mode:'structure',query:'CCO',url:'https://pubchem.ncbi.nlm.nih.gov/#query=CCO'});

const formaldehyde=structure(['C','O','H','H'],[[0,1,2],[0,2,1],[0,3,1]],'CH2O');
assert.equal(conservativeSmiles(formaldehyde.graph),'C=O');

const cyclopropane=structure(['C','C','C','H','H','H','H','H','H'],[[0,1,1],[1,2,1],[2,0,1],[0,3,1],[0,4,1],[1,5,1],[1,6,1],[2,7,1],[2,8,1]],'C3H6');
assert.equal(conservativeSmiles(cyclopropane.graph),null,'Cycles deliberately fall back to formula search.');
assert.equal(pubchemReferenceFor(cyclopropane).mode,'formula');

const phosphine=structure(['P','H','H','H'],[[0,1,1],[0,2,1],[0,3,1]],'PH3');
assert.equal(pubchemReferenceFor(phosphine).mode,'formula','P/S chemistry stays on the conservative fallback.');

const hydrogen=structure(['H','H'],[[0,1,1]],'H2');
assert.equal(pubchemReferenceFor(hydrogen).mode,'formula','No-heavy-atom structures use formula search.');

const hydrogenChloride=structure(['Cl','H'],[[0,1,1]],'HCl');
assert.equal(pubchemReferenceFor(hydrogenChloride).mode,'formula','Standalone halogen hydrides avoid implicit-H ambiguity.');

assert.equal(pubchemReferenceFor({formula:'—',graph:{atoms:[],bonds:[]}}),null);

let introValue=null,writes=0;
const introStorage={getItem:key=>key===PUBCHEM_INTRO_STORAGE_KEY?introValue:null,setItem:(key,value)=>{assert.equal(key,PUBCHEM_INTRO_STORAGE_KEY);introValue=value;writes++;}};
const intro=createPubchemIntroState(introStorage);
assert.equal(intro.label('first-signature'),'PubChem ↗','The first unregistered completion teaches the external reference once.');
assert.equal(intro.label('first-signature'),'PubChem ↗','Repeated renders of the same first completion keep the label stable.');
assert.equal(writes,1);
assert.equal(intro.label(null),'↗','Leaving the first unregistered completion ends the teaching state.');
assert.equal(intro.label('second-signature'),'↗','Later unregistered completions stay visually secondary.');
assert.equal(createPubchemIntroState(introStorage).label('after-reload'),'↗','The intro is remembered on the device.');
const deniedIntro=createPubchemIntroState({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});
assert.equal(deniedIntro.label('fallback'),'PubChem ↗','Storage denial must not break the affordance.');
console.log('PubChem reference tests passed.');
