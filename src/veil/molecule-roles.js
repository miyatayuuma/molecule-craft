// Game-balance data for molecules that may serve expedition systems.
// These values intentionally mix real chemistry (for example O2 stoichiometry)
// with compressed game units. They do not change active tank/runtime behavior
// until the owning propulsion or thermal system explicitly consumes them.

export const ROLE_BALANCE_VERSION=1;

const profile=(roles,performance)=>Object.freeze({roles:Object.freeze([...roles]),performance:Object.freeze(performance)});

export const MOLECULE_ROLE_PROFILES=Object.freeze({
  hydrogen:profile(['propellant','fuel'],{
    propellant:Object.freeze({capacity:120,moleculesPerBurst:40,burstPower:1.00}),
    fuel:Object.freeze({capacity:28,oxygenPerFuel:.50,energy:.30,heatFactor:.75}),
  }),
  ammonia:profile(['propellant','fuel','coolant'],{
    propellant:Object.freeze({capacity:96,moleculesPerBurst:12,burstPower:.82}),
    fuel:Object.freeze({capacity:24,oxygenPerFuel:.75,energy:.40,heatFactor:.70}),
    coolant:Object.freeze({capacity:60,coolingPower:1.25,environmentTolerance:1.25}),
  }),
  nitrogen:profile(['propellant','coolant'],{
    propellant:Object.freeze({capacity:80,moleculesPerBurst:10,burstPower:.72}),
    coolant:Object.freeze({capacity:72,coolingPower:1.15,environmentTolerance:1.80}),
  }),
  'carbon-dioxide':profile(['propellant','coolant'],{
    propellant:Object.freeze({capacity:72,moleculesPerBurst:8,burstPower:.62}),
    coolant:Object.freeze({capacity:64,coolingPower:.70,environmentTolerance:1.35}),
  }),
  methane:profile(['fuel'],{
    fuel:Object.freeze({capacity:18,oxygenPerFuel:2.00,energy:1.00,heatFactor:1.00}),
  }),
  ethane:profile(['fuel'],{
    fuel:Object.freeze({capacity:14,oxygenPerFuel:3.50,energy:1.78,heatFactor:1.05}),
  }),
  propane:profile(['fuel'],{
    fuel:Object.freeze({capacity:11,oxygenPerFuel:5.00,energy:2.55,heatFactor:1.10}),
  }),
  'n-butane':profile(['propellant','fuel'],{
    propellant:Object.freeze({capacity:40,moleculesPerBurst:4,burstPower:.52}),
    fuel:Object.freeze({capacity:9,oxygenPerFuel:6.50,energy:3.31,heatFactor:1.15}),
  }),
  isobutane:profile(['fuel'],{
    fuel:Object.freeze({capacity:9,oxygenPerFuel:6.50,energy:3.29,heatFactor:1.13}),
  }),
  'n-pentane':profile(['fuel'],{
    fuel:Object.freeze({capacity:7,oxygenPerFuel:8.00,energy:4.10,heatFactor:1.20}),
  }),
  'n-hexane':profile(['fuel'],{
    fuel:Object.freeze({capacity:6,oxygenPerFuel:9.50,energy:5.19,heatFactor:1.25}),
  }),
  ethyne:profile(['fuel'],{
    fuel:Object.freeze({capacity:12,oxygenPerFuel:2.50,energy:1.45,heatFactor:1.25}),
  }),
  methanol:profile(['fuel','coolant'],{
    fuel:Object.freeze({capacity:20,oxygenPerFuel:1.50,energy:.80,heatFactor:.85}),
    coolant:Object.freeze({capacity:56,coolingPower:.90,environmentTolerance:1.35}),
  }),
  ethanol:profile(['fuel','coolant'],{
    fuel:Object.freeze({capacity:16,oxygenPerFuel:3.00,energy:1.54,heatFactor:.95}),
    coolant:Object.freeze({capacity:48,coolingPower:.85,environmentTolerance:1.25}),
  }),
  '1-butanol':profile(['fuel'],{
    fuel:Object.freeze({capacity:10,oxygenPerFuel:6.00,energy:3.02,heatFactor:1.00}),
  }),
  isobutanol:profile(['fuel'],{
    fuel:Object.freeze({capacity:10,oxygenPerFuel:6.00,energy:3.00,heatFactor:.98}),
  }),
  'dimethyl-ether':profile(['fuel'],{
    fuel:Object.freeze({capacity:14,oxygenPerFuel:3.00,energy:1.65,heatFactor:1.00}),
  }),
  water:profile(['coolant'],{
    coolant:Object.freeze({capacity:80,coolingPower:1.00,environmentTolerance:1.00}),
  }),
  'ethylene-glycol':profile(['coolant'],{
    coolant:Object.freeze({capacity:32,coolingPower:1.10,environmentTolerance:1.55}),
  }),
  'propylene-glycol':profile(['coolant'],{
    coolant:Object.freeze({capacity:30,coolingPower:1.05,environmentTolerance:1.50}),
  }),
  oxygen:profile(['oxidizer'],{
    oxidizer:Object.freeze({capacity:36,oxidizingPower:1.00}),
  }),
});

export const roleProfileFor=id=>MOLECULE_ROLE_PROFILES[id]??null;
export const rolesFor=id=>roleProfileFor(id)?.roles??[];
export const performanceFor=(id,role)=>roleProfileFor(id)?.performance?.[role]??null;
export const moleculesForRole=role=>Object.entries(MOLECULE_ROLE_PROFILES).filter(([,entry])=>entry.roles.includes(role)).map(([id])=>id);

// Runtime roles are the subset exposed by the Collector Shell and expedition.
export const ACTIVE_TANK_ROLES=Object.freeze(['propellant','fuel','oxidizer','coolant']);
export const activeTankRolesFor=id=>rolesFor(id).filter(role=>ACTIVE_TANK_ROLES.includes(role));
export const tankCapacityFor=(role,id)=>performanceFor(id,role)?.capacity??null;

const gcd=(a,b)=>b?gcd(b,a%b):a;
const integerRatio=value=>{
  for(let denominator=1;denominator<=100;denominator++){
    const numerator=Math.round(value*denominator);
    if(Math.abs(numerator/denominator-value)<1e-9){const divisor=gcd(numerator,denominator);return {numerator:numerator/divisor,denominator:denominator/divisor};}
  }
  return null;
};

// Combustion spends whole molecule-count game units. The smallest packet whose
// O2 cost is integral avoids fractional saved inventory and rounding loss.
export function combustionPacketFor(id,{baseSeconds=2}={}){
  const fuel=performanceFor(id,'fuel'),oxygen=integerRatio(fuel?.oxygenPerFuel);
  if(!fuel||!oxygen)return null;
  const fuelAmount=oxygen.denominator,oxygenAmount=oxygen.numerator;
  return Object.freeze({fuel:id,fuelAmount,oxidizer:'oxygen',oxygenAmount,seconds:fuelAmount*baseSeconds*fuel.energy});
}
