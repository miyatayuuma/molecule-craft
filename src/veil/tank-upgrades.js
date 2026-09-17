// Permanent processing, not polymer inventory or per-expedition maintenance.
// These are compressed engineering models for gameplay: discovered chemistry
// unlocks a fabrication process, while the permanent O2 tank authority remains
// state.upgrades.oxygenTank.
export const OXYGEN_UPGRADES=Object.freeze([
  Object.freeze({
    id:'seal',name:'Seal Repair',icon:'◉',capacity:48,requires:['ethene','propene'],cost:{C:24,H:48},
    process:'Polymerization',material:'EPR-type elastomer seal',component:'O₂ tank valve / neck seal',
    property:'Elastic sealing ↑ · safe fill pressure ↑',effect:'O₂ 36 → 48',
  }),
  Object.freeze({
    id:'overwrap',name:'Composite Overwrap',icon:'▧',capacity:72,requires:['phenol','formaldehyde'],cost:{C:96,H:48,O:16},
    process:'Thermoset resin formation',material:'Phenolic resin composite matrix',component:'O₂ tank overwrap',
    property:'Load sharing ↑ · pressure tolerance ↑',effect:'O₂ 48 → 72',
  }),
]);
export const oxygenCapacity=level=>[36,48,72][level??0]??36;
export const nextOxygenUpgrade=state=>OXYGEN_UPGRADES[state.upgrades?.oxygenTank??0]??null;
export function oxygenUpgradeProcessState(state,upgrade,index=OXYGEN_UPGRADES.indexOf(upgrade)){
  const level=state?.upgrades?.oxygenTank??0,recipes=state?.recipes??[],completed=level>index,sequenceReady=level===index,chemistryReady=upgrade.requires.every(id=>recipes.includes(id));
  return {...upgrade,index,completed,sequenceReady,chemistryReady,available:!completed&&sequenceReady&&chemistryReady};
}
export const oxygenUpgradeProcesses=state=>OXYGEN_UPGRADES.map((upgrade,index)=>oxygenUpgradeProcessState(state,upgrade,index));
