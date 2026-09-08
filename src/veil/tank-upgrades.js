// Permanent processing, not polymer inventory or per-expedition maintenance.
// Seal repair restores usable volume; only the resin/carbon-fibre overwrap
// reinforces the pressure vessel. Costs are compressed fabrication game units.
export const OXYGEN_UPGRADES=Object.freeze([
  Object.freeze({id:'seal',name:'Elastomer Seal Repair',icon:'◉',capacity:48,requires:['ethene','propene'],cost:{C:24,H:48}}),
  Object.freeze({id:'overwrap',name:'Composite Overwrap',icon:'▧',capacity:72,requires:['phenol','formaldehyde'],cost:{C:96,H:48,O:16}}),
]);
export const oxygenCapacity=level=>[36,48,72][level??0]??36;
export const nextOxygenUpgrade=state=>OXYGEN_UPGRADES[state.upgrades?.oxygenTank??0]??null;
