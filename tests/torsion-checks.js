import {Molecule} from '../src/chemistry.js?v=20';
import {createTorsionModel} from '../src/torsion-model.js?v=33';
import {planStructureEdit,editRelaxationOptions} from '../src/structure-edit.js?v=33';

// Pure topology checks, shared by Node and the public browser harness.
export function checkTorsionModel(records){
  let checks=0;const assert=(ok,message)=>{checks++;if(!ok)throw new Error(message);};
  function graph(elements,bonds){const molecule=new Molecule(),ids=elements.map(e=>molecule.addAtom(e).id);for(const[a,b,order=1]of bonds)molecule.setBond(ids[a],ids[b],order);return {molecule,ids};}
  const key=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
  for(const name of ['methane','ethene','ethyne','benzene']){
    const record=records.find(r=>r.id===name),{molecule,ids}=graph(record.atoms,record.bonds),model=createTorsionModel(molecule);
    for(const id of ids)assert(model.forAtom(id).mode==='atom-locked',`${name}: an atom can deform a locked structure`);
    const loose=molecule.addAtom('O');assert(planStructureEdit(molecule,loose.id).mode==='atom-translate','Isolated atom cannot translate');
    assert(!planStructureEdit(molecule,ids[0]).scope.has(loose.id),'Disconnected atom included');
  }
  {
    const record=records.find(r=>r.id==='phosphoric-acid'),{molecule,ids}=graph(record.atoms,record.bonds),model=createTorsionModel(molecule);
    assert(model.forAtom(ids[record.atoms.indexOf('P')]).mode==='atom-locked','Central P swings the skeleton around OH');
    for(const id of ids.filter((_,i)=>record.atoms[i]==='H')){
      const plan=model.forAtom(id);assert(plan.mode==='torsion'&&plan.ids.length===2,'OH should rotate around P–O');
      const locks=editRelaxationOptions(molecule,plan).lockedIds;
      assert(ids.filter(other=>!plan.ids.includes(other)).every(other=>locks.has(other)),'Local correction moves untouched skeleton');
    }
  }
  {
    // Fully saturated unregistered C6 chain: recognition must not gate axes.
    const {molecule,ids}=graph(Array(6).fill('C'),[[0,1],[1,2],[2,3],[3,4],[4,5]]);
    for(let i=0;i<6;i++)for(let j=0;j<(i===0||i===5?3:2);j++)molecule.setBond(ids[i],molecule.addAtom('H').id,1);
    const model=createTorsionModel(molecule),plan=model.forAtom(ids[0]);
    assert(plan.mode==='conformation'&&plan.candidates.length===3,'Three branch axes were not combined for conformation drag');
    for(const candidate of plan.candidates){
      const selected=model.forAtom(ids[0],{activeKey:candidate.key});
      assert(selected.mode==='torsion'&&selected.key===candidate.key,'Explicit axis ignored');
      assert(selected.ids.includes(ids[0])&&!selected.ids.includes(ids[5]),'Wrong side moves');
    }
    assert(model.forAtom(ids[0],{activeKey:'missing'}).mode==='axis-select','Stale axis was accepted');
  }
  for(const donor of ['N','O','S']){
    const {molecule,ids}=graph(['O','C',donor,'C','H','H'],[[0,1,2],[1,2],[2,3],[1,4],[3,5]]),model=createTorsionModel(molecule);
    assert(model.bonds.get(key(ids[1],ids[2])).kind==='restricted',`Acyl ${donor} conjugation is not constrained`);
    assert(model.bonds.get(key(ids[2],ids[3])).allowed,`${donor}–alkyl incorrectly locked`);
  }
  {
    const {molecule,ids}=graph(['C','C','C','C','H','H'],[[0,1,2],[1,2],[2,3,2],[0,4],[3,5]]);
    const connector=createTorsionModel(molecule).bonds.get(key(ids[1],ids[2]));
    assert(connector.classification==='RESTRICTED'&&!connector.allowed,'Conjugated diene connector was exposed as a free torsion');
  }
  for(const name of ['anisole','phenol']){
    const record=records.find(r=>r.id===name),{molecule,ids}=graph(record.atoms,record.bonds);
    const ring=ids.slice(0,6),model=createTorsionModel(molecule,{aromaticCycles:[ring]});
    const oxygen=ids[record.atoms.indexOf('O')],aryl=molecule.neighbors(oxygen).find(n=>ring.includes(n.atomId)).atomId;
    assert(model.bonds.get(key(oxygen,aryl)).kind==='restricted',`${name}: aromatic follower plane not protected`);
    if(name==='anisole'){
      const methyl=molecule.neighbors(oxygen).find(n=>!ring.includes(n.atomId)).atomId;
      assert(model.forAtom(methyl).mode==='torsion','Anisole methyl rotation unavailable');
    }
  }
  // A biaryl connector and a side chain are not themselves ring bonds.
  {
    const {molecule,ids}=graph(Array(12).fill('C'),[[0,1,2],[1,2],[2,3,2],[3,4],[4,5,2],[5,0],[6,7,2],[7,8],[8,9,2],[9,10],[10,11,2],[11,6],[0,6]]);
    const model=createTorsionModel(molecule,{aromaticCycles:[ids.slice(0,6),ids.slice(6)]});
    assert(model.bonds.get(key(ids[0],ids[6])).allowed,'Biaryl connector incorrectly locked');
    assert(model.bonds.get(key(ids[1],ids[2])).kind==='ring','Single ring edge incorrectly free');
    // Removing the connector invalidates its key in a freshly built index.
    molecule.removeBond(ids[0],ids[6]);assert(!createTorsionModel(molecule).bonds.has(key(ids[0],ids[6])),'Deleted axis survived rebuilding');
  }
  assert(planStructureEdit(new Molecule(),999)===null,'Missing atom creates a plan');
  return {checks};
}
